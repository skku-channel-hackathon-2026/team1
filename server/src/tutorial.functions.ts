import { Injectable } from "@nestjs/common";
import { z } from "zod";
import {
  CommandActionInputSchema,
  EmptyInputSchema,
  EmptyOutputSchema,
  GetProfileOutputSchema,
  MatchInputSchema,
  MatchOutputSchema,
  ProfileInputSchema,
  RequestMatchInputSchema,
  RequestMatchOutputSchema,
  SaveProfileOutputSchema,
  SendAsBotInputSchema,
  TUTORIAL_FUNCTIONS,
  TUTORIAL_WAM_NAME,
  isSeedMember,
  rankMatches,
  type CommandActionInput,
  type GetProfileOutput,
  type MatchCandidate,
  type MatchOutput,
  type Profile,
  type ProfileInput,
  type RequestMatchInput,
  type RequestMatchOutput,
  type SaveProfileOutput,
  type SendAsBotInput,
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
  deleteProfile,
  deriveMatchState,
  getProfile,
  listMatchRecords,
  listPool,
  requestMatch,
  saveProfile,
} from "./same-class.store.js";
import {
  createTutorialTargetToken,
  readTutorialTargetToken,
} from "./target-token.js";

const tutorialMessage = "This is a test message sent by a manager.";
const botMessage = "This is a test message sent by a bot.";

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
    const byId = new Map(pool.map((profile) => [profile.memberId, profile]));

    const results: MatchCandidate[] = rankMatches(me, pool).map((result) => {
      const record = records.find((entry) =>
        entry.pair.includes(result.targetId),
      );
      const matchState = deriveMatchState(record, memberId, result.targetId);
      return {
        ...result,
        matchState,
        isSeed: isSeedMember(result.targetId),
        revealedInstances:
          matchState === "ACCEPTED"
            ? byId.get(result.targetId)?.instances
            : undefined,
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
    return {
      targetId: input.targetId,
      matchState,
      revealedInstances:
        matchState === "ACCEPTED" ? target.instances : undefined,
    };
  }
}
