import { z } from "zod";
import { CAMPUSES, DAYS, MAX_PERIOD, MIN_PERIOD } from "./timetable.js";

export * from "./timetable.js";
export * from "./match.js";
export * from "./seed.js";

export const TUTORIAL_WAM_NAME = "tutorial";

// The `tutorial` command and `tutorial.open` stay untouched (re-registration is out of scope).
// The 「같은 반」 functions are plain app functions called from the WAM; they need no registration.
export const TUTORIAL_FUNCTIONS = {
  open: "tutorial.open",
  sendAsBot: "tutorial.sendAsBot",
  writeAsManager: "writeGroupMessageAsManager",
  getProfile: "tutorial.getProfile",
  saveProfile: "tutorial.saveProfile",
  deleteProfile: "tutorial.deleteProfile",
  match: "tutorial.match",
  requestMatch: "tutorial.requestMatch",
  cancelMatch: "tutorial.cancelMatch",
  // In-app chat and notifications: no Channel DM permission needed.
  inbox: "tutorial.inbox",
  readChat: "tutorial.readChat",
  sendChat: "tutorial.sendChat",
} as const;

export const CommandActionInputSchema = z.object({
  chat: z.object({ type: z.string(), id: z.string() }).optional(),
  trigger: z
    .object({
      type: z.string(),
      attributes: z
        .record(z.string())
        .nullish()
        .transform((attributes) => attributes ?? {}),
    })
    .optional(),
  input: z
    .record(z.unknown())
    .nullish()
    .transform((input) => input ?? {}),
  language: z.string().optional(),
});

export type CommandActionInput = z.infer<typeof CommandActionInputSchema>;

export const SendAsBotInputSchema = z.object({
  targetToken: z.string().min(1),
  rootMessageId: z.string().optional(),
  broadcast: z.boolean().default(false),
});

export type SendAsBotInput = z.infer<typeof SendAsBotInputSchema>;

export const TutorialWamArgsSchema = z.object({
  chatId: z.string(),
  chatType: z.string(),
  chatTitle: z.string(),
  rootMessageId: z.string().optional(),
  broadcast: z.boolean(),
  managerId: z.string(),
  message: z.string(),
  targetToken: z.string().optional(),
});

export type TutorialWamArgs = z.infer<typeof TutorialWamArgsSchema>;

export const TutorialWamDataSchema = TutorialWamArgsSchema.extend({
  appId: z.string(),
  channelId: z.string(),
});

export type TutorialWamData = z.infer<typeof TutorialWamDataSchema>;

export type WriteGroupMessageAsManagerInput = {
  channelId: string;
  groupId: string;
  rootMessageId?: string;
  broadcast: boolean;
  dto: {
    plainText: string;
    managerId: string;
  };
};

// ---------------------------------------------------------------------------
// 「같은 반」 schemas
// ---------------------------------------------------------------------------

export const DaySchema = z.enum(DAYS);
export const CampusSchema = z.enum(CAMPUSES);

const PeriodSchema = z.number().int().min(MIN_PERIOD).max(MAX_PERIOD);

export const CourseInstanceSchema = z
  .object({
    subject: z.string().trim().min(1).max(40),
    professor: z.string().trim().min(1).max(30),
    day: DaySchema,
    startPeriod: PeriodSchema,
    endPeriod: PeriodSchema,
    room: z
      .string()
      .trim()
      .regex(/^\d{5}$/, "강의실 번호는 5자리 숫자입니다"),
  })
  .refine((instance) => instance.endPeriod >= instance.startPeriod, {
    message: "종료 교시는 시작 교시보다 빠를 수 없습니다",
    path: ["endPeriod"],
  });

export const ProfileInputSchema = z.object({
  nickname: z.string().trim().min(1).max(20),
  department: z.string().trim().min(1).max(30),
  campus: CampusSchema,
  includeOtherDepartments: z.boolean().default(false),
  instances: z.array(CourseInstanceSchema).min(1).max(30),
});

export type ProfileInput = z.infer<typeof ProfileInputSchema>;

export const ProfileSchema = ProfileInputSchema.extend({
  memberId: z.string().min(1),
  updatedAt: z.string().optional(),
});

export const GetProfileOutputSchema = z.object({
  profile: ProfileSchema.nullable(),
});

export type GetProfileOutput = z.infer<typeof GetProfileOutputSchema>;

export const SaveProfileOutputSchema = z.object({
  profile: ProfileSchema,
});

export type SaveProfileOutput = z.infer<typeof SaveProfileOutputSchema>;

export const MatchStateSchema = z.enum([
  "NONE",
  "REQUESTED",
  "RECEIVED",
  "ACCEPTED",
]);
export type MatchState = z.infer<typeof MatchStateSchema>;

const SlotSchema = z.object({ day: DaySchema, period: z.number().int() });

export const MatchResultSchema = z.object({
  targetId: z.string(),
  nickname: z.string(),
  department: z.string(),
  campus: CampusSchema,
  score: z.number(),
  parts: z.object({
    sameRoom: z.number(),
    sameBuilding: z.number(),
    free: z.number(),
  }),
  raw: z.object({
    score: z.number(),
    breakdown: z.object({
      sameRoom: z.number(),
      sameBuilding: z.number(),
      sharedFree: z.number(),
    }),
  }),
  proximity: z.enum(["ROOM", "BUILDING", "FREE"]),
  sameRoom: z.array(CourseInstanceSchema),
  sameCourseCount: z.number().int(),
  sameBuilding: z.array(
    SlotSchema.extend({ building: z.string(), sameFloor: z.boolean() }),
  ),
  sharedFreeSlots: z.array(SlotSchema),
  sharedFreeDays: z.array(DaySchema),
  overlapCells: z.array(
    SlotSchema.extend({
      kind: z.enum(["SAME", "BUILDING", "FREE"]),
      label: z.string(),
    }),
  ),
  dailySummary: z.record(z.string()),
  reasons: z.array(z.string()),
});

// Even after mutual acceptance only the overlap is shown — the other person's solo classes
// never leave the server (team decision: privacy over the "reveal" payoff).
export const MatchCandidateSchema = MatchResultSchema.extend({
  matchState: MatchStateSchema,
  isSeed: z.boolean(),
});

export type MatchCandidate = z.infer<typeof MatchCandidateSchema>;

export const MatchInputSchema = z.object({});

export const MatchOutputSchema = z.object({
  me: ProfileSchema.nullable(),
  poolSize: z.number().int(),
  results: z.array(MatchCandidateSchema),
});

export type MatchOutput = z.infer<typeof MatchOutputSchema>;

export const RequestMatchInputSchema = z.object({
  targetId: z.string().min(1),
});

export type RequestMatchInput = z.infer<typeof RequestMatchInputSchema>;

export const RequestMatchOutputSchema = z.object({
  targetId: z.string(),
  matchState: MatchStateSchema,
});

export type RequestMatchOutput = z.infer<typeof RequestMatchOutputSchema>;

export const CancelMatchInputSchema = z.object({
  targetId: z.string().min(1),
});

export type CancelMatchInput = z.infer<typeof CancelMatchInputSchema>;

export const CancelMatchOutputSchema = z.object({
  targetId: z.string(),
  matchState: MatchStateSchema,
});

export type CancelMatchOutput = z.infer<typeof CancelMatchOutputSchema>;

// ---------------------------------------------------------------------------
// In-app notifications and 1:1 chat
// ---------------------------------------------------------------------------

export const NotificationKindSchema = z.enum([
  "REQUEST", // someone asked to be my 같은 반
  "ACCEPTED", // the other side accepted, we are now 같은 반
  "CANCELLED", // a request was withdrawn / declined / a match dissolved
  "MESSAGE", // a new chat message
]);

export type NotificationKind = z.infer<typeof NotificationKindSchema>;

export const NotificationSchema = z.object({
  id: z.string(),
  kind: NotificationKindSchema,
  /** The other person in this event. */
  fromId: z.string(),
  fromNickname: z.string(),
  text: z.string(),
  createdAt: z.string(),
  read: z.boolean(),
});

export type Notification = z.infer<typeof NotificationSchema>;

export const InboxOutputSchema = z.object({
  notifications: z.array(NotificationSchema),
  unread: z.number().int(),
  /** Unread chat messages per counterpart, so the list can badge each card. */
  unreadByPeer: z.record(z.number().int()),
});

export type InboxOutput = z.infer<typeof InboxOutputSchema>;

export const ChatMessageSchema = z.object({
  id: z.string(),
  senderId: z.string(),
  text: z.string(),
  createdAt: z.string(),
});

export type ChatMessage = z.infer<typeof ChatMessageSchema>;

export const CHAT_TEXT_MAX = 500;

export const ReadChatInputSchema = z.object({
  targetId: z.string().min(1),
  /** Mark this conversation's notifications read (default true). */
  markRead: z.boolean().default(true),
});

export type ReadChatInput = z.infer<typeof ReadChatInputSchema>;

export const ReadChatOutputSchema = z.object({
  targetId: z.string(),
  messages: z.array(ChatMessageSchema),
});

export type ReadChatOutput = z.infer<typeof ReadChatOutputSchema>;

export const SendChatInputSchema = z.object({
  targetId: z.string().min(1),
  text: z.string().trim().min(1).max(CHAT_TEXT_MAX),
});

export type SendChatInput = z.infer<typeof SendChatInputSchema>;

export const SendChatOutputSchema = ReadChatOutputSchema;

export type SendChatOutput = z.infer<typeof SendChatOutputSchema>;

export const EmptyInputSchema = z.object({});
export const EmptyOutputSchema = z.object({});
