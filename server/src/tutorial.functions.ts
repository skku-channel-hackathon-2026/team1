import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  CancelMatchInputSchema,
  CancelMatchOutputSchema,
  CommandActionInputSchema,
  EmptyInputSchema,
  EmptyOutputSchema,
  GetProfileOutputSchema,
  InboxOutputSchema,
  MatchInputSchema,
  MatchOutputSchema,
  ProfileInputSchema,
  ReadChatInputSchema,
  ReadChatOutputSchema,
  RequestMatchInputSchema,
  RequestMatchOutputSchema,
  SaveProfileOutputSchema,
  SendAsBotInputSchema,
  SendChatInputSchema,
  SendChatOutputSchema,
  TUTORIAL_FUNCTIONS,
  TUTORIAL_WAM_NAME,
  isSeedMember,
  rankMatches,
  type CancelMatchInput,
  type CancelMatchOutput,
  type CommandActionInput,
  type GetProfileOutput,
  type InboxOutput,
  type MatchCandidate,
  type MatchOutput,
  type Profile,
  type ProfileInput,
  type ReadChatInput,
  type ReadChatOutput,
  type RequestMatchInput,
  type RequestMatchOutput,
  type SaveProfileOutput,
  type SendAsBotInput,
  type SendChatInput,
  type TutorialWamArgs,
} from "@tutorial/shared";
import {
  CommandResultSchema,
  Ctx,
  Description,
  Extension,
  Func,
  FunctionCallError,
  FunctionCallErrorCode,
  GetCommandsOutputSchema,
  Input,
  InputSchema,
  NativeFunctionClient,
  OutputSchema,
  TokenManager,
  type Context,
} from "@channel.io/app-sdk-server";
import { appId, appSecret } from "./config.js";
import { getDatabase } from "./database.js";
import {
  appendChat,
  cancelMatch,
  deleteChat,
  deleteProfile,
  deriveMatchState,
  getProfile,
  listMatchRecords,
  listNotifications,
  listPool,
  markNotificationsRead,
  pushNotification,
  readChat,
  requestMatch,
  saveProfile,
} from "./same-class.store.js";
import {
  createTutorialTargetToken,
  readTutorialTargetToken,
} from "./target-token.js";

const tutorialMessage = "This is a test message sent by a manager.";
const botMessage = "This is a test message sent by a bot.";

// Demo-only: seeded freshmen answer so a solo presenter can show a real conversation.
const SEED_REPLIES = [
  "반가워요! 다음 수업 때 앞자리 쪽에 앉아 있을게요.",
  "저도 그 시간 공강이에요. 같이 밥 먹어요!",
  "좋아요, 강의실 앞에서 봐요 🙌",
];

function seedReply(_text: string, turn: number): string {
  return SEED_REPLIES[Math.floor(turn / 2) % SEED_REPLIES.length];
}

@Extension({ name: "command", systemVersion: "v1" })
export class CommandExtension {
  @Func("metadata.getCommands")
  @Description("Return the tutorial command definition")
  @InputSchema(z.object({}))
  @OutputSchema(GetCommandsOutputSchema)
  getCommands(): z.infer<typeof GetCommandsOutputSchema> {
    return {
      commands: [
        {
          name: "tutorial",
          scope: "desk",
          description: "Open the Channel App SDK tutorial WAM",
          actionFunctionName: TUTORIAL_FUNCTIONS.open,
          alfMode: "disable",
          enabledByDefault: true,
        },
      ],
    };
  }
}

function requireManager(ctx: Context): string {
  const managerId = ctx.caller.id;
  if (ctx.caller.type !== "manager" || !managerId) {
    throw new FunctionCallError(
      "Only channel managers can use 같은 반",
      FunctionCallErrorCode.BadRequest,
      { type: "invalidCaller" },
    );
  }
  return managerId;
}

@Injectable()
export class TutorialFunctions {
  constructor(
    private readonly tokenManager: TokenManager,
    private readonly nativeClient: NativeFunctionClient,
  ) {}

  @Func(TUTORIAL_FUNCTIONS.open)
  @Description("Open the tutorial WAM")
  @InputSchema(CommandActionInputSchema)
  @OutputSchema(CommandResultSchema)
  open(
    @Ctx() ctx: Context,
    @Input() params: CommandActionInput,
  ): z.infer<typeof CommandResultSchema> {
    const chat = params.chat;
    const managerId = ctx.caller.id ?? "";
    const triggerAttributes = params.trigger?.attributes ?? {};
    const targetToken =
      chat?.type === "group" &&
      chat.id &&
      ctx.caller.type === "manager" &&
      managerId
        ? createTutorialTargetToken(
            {
              channelId: ctx.channel.id,
              groupId: chat.id,
              managerId,
              expiresAt: Date.now() + 5 * 60 * 1000,
            },
            appSecret,
          )
        : undefined;

    const wamArgs = {
      chatId: chat?.id ?? "",
      chatType: chat?.type ?? "",
      chatTitle: triggerAttributes.chatTitle ?? "",
      rootMessageId: triggerAttributes.rootMessageId,
      broadcast: triggerAttributes.broadcast === "true",
      managerId,
      message: tutorialMessage,
      targetToken,
    } satisfies TutorialWamArgs;

    return {
      type: "wam",
      attributes: {
        appId,
        name: TUTORIAL_WAM_NAME,
        wamArgs,
      },
    };
  }

  @Func(TUTORIAL_FUNCTIONS.sendAsBot)
  @Description("Send a team chat message with the app bot profile")
  @InputSchema(SendAsBotInputSchema)
  @OutputSchema(z.object({}))
  async sendAsBot(
    @Ctx() ctx: Context,
    @Input() input: SendAsBotInput,
  ): Promise<Record<string, never>> {
    const target = readTutorialTargetToken(input.targetToken, appSecret);
    if (
      !target ||
      target.expiresAt <= Date.now() ||
      target.channelId !== ctx.channel.id ||
      ctx.caller.type !== "manager" ||
      target.managerId !== ctx.caller.id
    ) {
      throw new FunctionCallError(
        "The tutorial target is invalid or expired",
        FunctionCallErrorCode.BadRequest,
        { type: "invalidTarget" },
      );
    }

    const token = await this.tokenManager.getChannelToken({
      channelId: ctx.channel.id,
    });
    const api = this.nativeClient.createProxyApi(token.accessToken);

    try {
      await api.writeGroupMessage({
        channelId: ctx.channel.id,
        groupId: target.groupId,
        rootMessageId: input.rootMessageId,
        broadcast: input.broadcast,
        dto: {
          plainText: botMessage,
          botName: "AppTutorialBot",
        },
      });
    } catch {
      throw new FunctionCallError(
        "The bot message could not be sent",
        FunctionCallErrorCode.Internal,
        { type: "nativeCallFailed" },
      );
    }

    return {};
  }

  // ---------------------------------------------------------------------------
  // 「같은 반」
  // ---------------------------------------------------------------------------

  @Func(TUTORIAL_FUNCTIONS.getProfile)
  @Description("Read the caller's 같은 반 timetable profile")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(GetProfileOutputSchema)
  async getProfile(@Ctx() ctx: Context): Promise<GetProfileOutput> {
    const memberId = requireManager(ctx);
    const profile = await getProfile(getDatabase(), ctx.channel.id, memberId);
    return { profile };
  }

  @Func(TUTORIAL_FUNCTIONS.saveProfile)
  @Description("Create or replace the caller's 같은 반 timetable profile")
  @InputSchema(ProfileInputSchema)
  @OutputSchema(SaveProfileOutputSchema)
  async saveProfile(
    @Ctx() ctx: Context,
    @Input() input: ProfileInput,
  ): Promise<SaveProfileOutput> {
    const memberId = requireManager(ctx);
    const profile: Profile = { ...input, memberId };
    const stored = await saveProfile(getDatabase(), ctx.channel.id, profile);
    return { profile: stored };
  }

  @Func(TUTORIAL_FUNCTIONS.deleteProfile)
  @Description("Delete the caller's timetable and every match it was part of")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(EmptyOutputSchema)
  async deleteProfile(@Ctx() ctx: Context): Promise<Record<string, never>> {
    const memberId = requireManager(ctx);
    await deleteProfile(getDatabase(), ctx.channel.id, memberId);
    return {};
  }

  @Func(TUTORIAL_FUNCTIONS.match)
  @Description(
    "Rank everyone in the channel by physical proximity to the caller",
  )
  @InputSchema(MatchInputSchema)
  @OutputSchema(MatchOutputSchema)
  async match(@Ctx() ctx: Context): Promise<MatchOutput> {
    const memberId = requireManager(ctx);
    const db = getDatabase();
    const channelId = ctx.channel.id;
    const me = await getProfile(db, channelId, memberId);
    if (!me) return { me: null, poolSize: 0, results: [] };

    const pool = await listPool(db, channelId);
    const records = await listMatchRecords(db, channelId, memberId);

    const results: MatchCandidate[] = rankMatches(me, pool).map((result) => {
      const record = records.find((entry) =>
        entry.pair.includes(result.targetId),
      );
      return {
        ...result,
        matchState: deriveMatchState(record, memberId, result.targetId),
        isSeed: isSeedMember(result.targetId),
      };
    });

    return { me, poolSize: pool.length, results };
  }

  @Func(TUTORIAL_FUNCTIONS.requestMatch)
  @Description(
    "Send a 같은 반 request; a request in both directions is a match",
  )
  @InputSchema(RequestMatchInputSchema)
  @OutputSchema(RequestMatchOutputSchema)
  async requestMatch(
    @Ctx() ctx: Context,
    @Input() input: RequestMatchInput,
  ): Promise<RequestMatchOutput> {
    const memberId = requireManager(ctx);
    const db = getDatabase();
    const channelId = ctx.channel.id;
    if (input.targetId === memberId) {
      throw new FunctionCallError(
        "You cannot request yourself",
        FunctionCallErrorCode.BadRequest,
        { type: "selfTarget" },
      );
    }
    const me = await getProfile(db, channelId, memberId);
    if (!me) {
      throw new FunctionCallError(
        "Save your timetable before requesting a match",
        FunctionCallErrorCode.BadRequest,
        { type: "noProfile" },
      );
    }
    const pool = await listPool(db, channelId);
    const target = pool.find((profile) => profile.memberId === input.targetId);
    if (!target || target.campus !== me.campus) {
      throw new FunctionCallError(
        "The target is not in your candidate pool",
        FunctionCallErrorCode.BadRequest,
        { type: "unknownTarget" },
      );
    }

    const record = await requestMatch(db, channelId, memberId, input.targetId);
    const matchState = deriveMatchState(record, memberId, input.targetId);
    // The notification lives in this app's own inbox — no Channel DM permission involved.
    await pushNotification(db, channelId, input.targetId, {
      kind: matchState === "ACCEPTED" ? "ACCEPTED" : "REQUEST",
      fromId: memberId,
      fromNickname: me.nickname,
      text:
        matchState === "ACCEPTED"
          ? `${me.nickname}님과 같은 반이 됐어요! 이제 대화할 수 있어요.`
          : `${me.nickname}님이 같은 반 요청을 보냈어요.`,
    });
    // Accepting tells the requester too, so both inboxes show the match.
    if (matchState === "ACCEPTED") {
      await pushNotification(db, channelId, memberId, {
        kind: "ACCEPTED",
        fromId: input.targetId,
        fromNickname: target.nickname,
        text: `${target.nickname}님과 같은 반이 됐어요! 이제 대화할 수 있어요.`,
      });
    }
    return { targetId: input.targetId, matchState };
  }

  @Func(TUTORIAL_FUNCTIONS.cancelMatch)
  @Description("Withdraw a 같은 반 request, decline one, or dissolve a match")
  @InputSchema(CancelMatchInputSchema)
  @OutputSchema(CancelMatchOutputSchema)
  async cancelMatch(
    @Ctx() ctx: Context,
    @Input() input: CancelMatchInput,
  ): Promise<CancelMatchOutput> {
    const memberId = requireManager(ctx);
    const db = getDatabase();
    const channelId = ctx.channel.id;
    const before = await getProfile(db, channelId, memberId);
    const record = await cancelMatch(db, channelId, memberId, input.targetId);
    const matchState = deriveMatchState(record, memberId, input.targetId);
    // Cancelling ends the conversation as well; nothing should survive a dissolve.
    await deleteChat(db, channelId, memberId, input.targetId);
    if (before) {
      await pushNotification(db, channelId, input.targetId, {
        kind: "CANCELLED",
        fromId: memberId,
        fromNickname: before.nickname,
        text: `${before.nickname}님이 같은 반을 취소했어요.`,
      });
    }
    return { targetId: input.targetId, matchState };
  }

  @Func(TUTORIAL_FUNCTIONS.inbox)
  @Description("Read my in-app notifications and unread counts")
  @InputSchema(EmptyInputSchema)
  @OutputSchema(InboxOutputSchema)
  async inbox(@Ctx() ctx: Context): Promise<InboxOutput> {
    const memberId = requireManager(ctx);
    const notifications = await listNotifications(
      getDatabase(),
      ctx.channel.id,
      memberId,
    );
    const unreadByPeer: Record<string, number> = {};
    for (const notification of notifications) {
      if (notification.read || notification.kind !== "MESSAGE") continue;
      unreadByPeer[notification.fromId] =
        (unreadByPeer[notification.fromId] ?? 0) + 1;
    }
    return {
      notifications,
      unread: notifications.filter((entry) => !entry.read).length,
      unreadByPeer,
    };
  }

  @Func(TUTORIAL_FUNCTIONS.readChat)
  @Description("Read the 1:1 conversation with a matched 같은 반")
  @InputSchema(ReadChatInputSchema)
  @OutputSchema(ReadChatOutputSchema)
  async readChat(
    @Ctx() ctx: Context,
    @Input() input: ReadChatInput,
  ): Promise<ReadChatOutput> {
    const memberId = requireManager(ctx);
    const db = getDatabase();
    const channelId = ctx.channel.id;
    await this.requireAcceptedMatch(db, channelId, memberId, input.targetId);
    if (input.markRead) {
      await markNotificationsRead(db, channelId, memberId, input.targetId);
    }
    return {
      targetId: input.targetId,
      messages: await readChat(db, channelId, memberId, input.targetId),
    };
  }

  @Func(TUTORIAL_FUNCTIONS.sendChat)
  @Description("Send a message in the 1:1 conversation with a matched 같은 반")
  @InputSchema(SendChatInputSchema)
  @OutputSchema(SendChatOutputSchema)
  async sendChat(
    @Ctx() ctx: Context,
    @Input() input: SendChatInput,
  ): Promise<ReadChatOutput> {
    const memberId = requireManager(ctx);
    const db = getDatabase();
    const channelId = ctx.channel.id;
    const me = await this.requireAcceptedMatch(
      db,
      channelId,
      memberId,
      input.targetId,
    );
    let messages = await appendChat(
      db,
      channelId,
      memberId,
      input.targetId,
      input.text,
    );
    await pushNotification(db, channelId, input.targetId, {
      kind: "MESSAGE",
      fromId: memberId,
      fromNickname: me.nickname,
      text: input.text.slice(0, 80),
    });
    // Seeded freshmen are demo data; a short reply keeps the demo conversation alive.
    if (isSeedMember(input.targetId)) {
      const pool = await listPool(db, channelId);
      const seed = pool.find((profile) => profile.memberId === input.targetId);
      if (seed) {
        messages = await appendChat(
          db,
          channelId,
          input.targetId,
          memberId,
          seedReply(input.text, messages.length),
        );
      }
    }
    return { targetId: input.targetId, messages };
  }

  /** Chat is only open between two people who both accepted. Returns my profile. */
  private async requireAcceptedMatch(
    db: ReturnType<typeof getDatabase>,
    channelId: string,
    memberId: string,
    targetId: string,
  ): Promise<Profile> {
    const me = await getProfile(db, channelId, memberId);
    if (!me) {
      throw new FunctionCallError(
        "Save your timetable first",
        FunctionCallErrorCode.BadRequest,
        { type: "noProfile" },
      );
    }
    const records = await listMatchRecords(db, channelId, memberId);
    const record = records.find((entry) => entry.pair.includes(targetId));
    if (deriveMatchState(record, memberId, targetId) !== "ACCEPTED") {
      throw new FunctionCallError(
        "You can only chat after both sides accept",
        FunctionCallErrorCode.BadRequest,
        { type: "notMatched" },
      );
    }
    return me;
  }
}
