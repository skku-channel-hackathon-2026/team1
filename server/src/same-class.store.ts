// 「같은 반」 persistence on top of the existing app_records(id, value_json) table.
// No new migration: every record is JSON under a prefixed id.
//   profile:<channelId>:<memberId>          → Profile
//   match:<channelId>:<memberA>|<memberB>   → MatchRecord (pair sorted, '|' never appears in ids)

import {
  ChatMessageSchema,
  NotificationSchema,
  ProfileSchema,
  SEED_PROFILES,
  isSeedMember,
  type ChatMessage,
  type MatchState,
  type Notification,
  type NotificationKind,
  type Profile,
} from "@tutorial/shared";
import { z } from "zod";
import type { AppDatabase } from "./database.js";

const MatchRecordSchema = z.object({
  pair: z.tuple([z.string(), z.string()]),
  requestedBy: z.array(z.string()),
  acceptedAt: z.string().optional(),
  updatedAt: z.string(),
});

export type MatchRecord = z.infer<typeof MatchRecordSchema>;

export function profileRecordId(channelId: string, memberId: string): string {
  return `profile:${channelId}:${memberId}`;
}

export function profilePrefix(channelId: string): string {
  return `profile:${channelId}:`;
}

export function matchRecordId(channelId: string, a: string, b: string): string {
  return `match:${channelId}:${[a, b].sort().join("|")}`;
}

export function matchPrefix(channelId: string): string {
  return `match:${channelId}:`;
}

export function deriveMatchState(
  record: MatchRecord | undefined,
  me: string,
  other: string,
): MatchState {
  if (!record) return "NONE";
  const mine = record.requestedBy.includes(me);
  const theirs = record.requestedBy.includes(other);
  if (mine && theirs) return "ACCEPTED";
  if (mine) return "REQUESTED";
  if (theirs) return "RECEIVED";
  return "NONE";
}

async function readJson<T>(
  db: AppDatabase,
  id: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T | null> {
  const row = await db
    .prepare("SELECT value_json FROM app_records WHERE id = ?")
    .bind(id)
    .first<{ value_json: string }>();
  if (!row) return null;
  const parsed = schema.safeParse(JSON.parse(row.value_json));
  return parsed.success ? parsed.data : null;
}

async function writeJson(
  db: AppDatabase,
  id: string,
  value: unknown,
): Promise<void> {
  await db
    .prepare(
      "INSERT INTO app_records (id, value_json) VALUES (?, ?) " +
        "ON CONFLICT(id) DO UPDATE SET value_json = excluded.value_json, updated_at = CURRENT_TIMESTAMP",
    )
    .bind(id, JSON.stringify(value))
    .run();
}

async function listJson<T>(
  db: AppDatabase,
  prefix: string,
  schema: z.ZodType<T, z.ZodTypeDef, unknown>,
): Promise<T[]> {
  const { results } = await db
    .prepare("SELECT id, value_json FROM app_records WHERE id LIKE ?")
    .bind(`${prefix}%`)
    .all<{ id: string; value_json: string }>();
  const items: T[] = [];
  for (const row of results) {
    const parsed = schema.safeParse(JSON.parse(row.value_json));
    if (parsed.success) items.push(parsed.data);
  }
  return items;
}

export async function getProfile(
  db: AppDatabase,
  channelId: string,
  memberId: string,
): Promise<Profile | null> {
  return readJson(db, profileRecordId(channelId, memberId), ProfileSchema);
}

export async function saveProfile(
  db: AppDatabase,
  channelId: string,
  profile: Profile,
): Promise<Profile> {
  const stored: Profile = { ...profile, updatedAt: new Date().toISOString() };
  await writeJson(db, profileRecordId(channelId, profile.memberId), stored);
  return stored;
}

export async function deleteProfile(
  db: AppDatabase,
  channelId: string,
  memberId: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM app_records WHERE id = ?")
    .bind(profileRecordId(channelId, memberId))
    .run();
  // Removing the timetable also removes every match, chat and notification of this member.
  const records = await listMatchRecords(db, channelId, memberId);
  for (const record of records) {
    await db
      .prepare("DELETE FROM app_records WHERE id = ?")
      .bind(matchRecordId(channelId, record.pair[0], record.pair[1]))
      .run();
    const other = record.pair.find((id) => id !== memberId) ?? memberId;
    await deleteChat(db, channelId, memberId, other);
  }
  await db
    .prepare("DELETE FROM app_records WHERE id = ?")
    .bind(notificationsRecordId(channelId, memberId))
    .run();
}

/** Channel profiles merged with the seeded freshmen. A real record wins over a seed with the same id. */
export async function listPool(
  db: AppDatabase,
  channelId: string,
): Promise<Profile[]> {
  const stored = await listJson(db, profilePrefix(channelId), ProfileSchema);
  const byId = new Map<string, Profile>();
  for (const seed of SEED_PROFILES) byId.set(seed.memberId, seed);
  for (const profile of stored) byId.set(profile.memberId, profile);
  return [...byId.values()];
}

export async function listMatchRecords(
  db: AppDatabase,
  channelId: string,
  memberId: string,
): Promise<MatchRecord[]> {
  const records = await listJson(db, matchPrefix(channelId), MatchRecordSchema);
  return records.filter((record) => record.pair.includes(memberId));
}

export async function requestMatch(
  db: AppDatabase,
  channelId: string,
  me: string,
  target: string,
): Promise<MatchRecord> {
  const id = matchRecordId(channelId, me, target);
  const existing = await readJson(db, id, MatchRecordSchema);
  const requestedBy = new Set(existing?.requestedBy ?? []);
  requestedBy.add(me);
  // Seeded freshmen are demo data with nobody behind them, so they accept right away.
  if (isSeedMember(target)) requestedBy.add(target);
  const pair = [me, target].sort() as [string, string];
  const now = new Date().toISOString();
  const record: MatchRecord = {
    pair,
    requestedBy: [...requestedBy],
    acceptedAt:
      existing?.acceptedAt ??
      (requestedBy.has(me) && requestedBy.has(target) ? now : undefined),
    updatedAt: now,
  };
  await writeJson(db, id, record);
  return record;
}

/**
 * Withdraw from a match. REQUESTED → my request disappears; RECEIVED → the other side's
 * request is declined; ACCEPTED → the pair is dissolved. In every case the record is either
 * reduced to the remaining party or deleted, so nobody is left "half matched".
 */
export async function cancelMatch(
  db: AppDatabase,
  channelId: string,
  me: string,
  target: string,
): Promise<MatchRecord | undefined> {
  const id = matchRecordId(channelId, me, target);
  const existing = await readJson(db, id, MatchRecordSchema);
  if (!existing) return undefined;
  const state = deriveMatchState(existing, me, target);
  const remaining =
    state === "REQUESTED"
      ? existing.requestedBy.filter((member) => member !== me)
      : []; // RECEIVED (decline) and ACCEPTED (dissolve) clear both sides
  if (remaining.length === 0) {
    await db.prepare("DELETE FROM app_records WHERE id = ?").bind(id).run();
    return undefined;
  }
  const record: MatchRecord = {
    pair: existing.pair,
    requestedBy: remaining,
    updatedAt: new Date().toISOString(),
  };
  await writeJson(db, id, record);
  return record;
}

// ---------------------------------------------------------------------------
// In-app notifications and 1:1 chat (still no new tables)
//   notif:<channelId>:<memberId>   → Notification[] (newest first, capped)
//   chat:<channelId>:<a>|<b>       → ChatMessage[]  (oldest first, capped)
// ---------------------------------------------------------------------------

const NotificationListSchema = z.array(NotificationSchema);
const ChatLogSchema = z.array(ChatMessageSchema);

/** Keep the JSON blobs small enough to read and write in one D1 round trip. */
export const NOTIFICATION_LIMIT = 50;
export const CHAT_LIMIT = 200;

export function notificationsRecordId(
  channelId: string,
  memberId: string,
): string {
  return `notif:${channelId}:${memberId}`;
}

export function chatRecordId(channelId: string, a: string, b: string): string {
  return `chat:${channelId}:${[a, b].sort().join("|")}`;
}

function newId(): string {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

export async function listNotifications(
  db: AppDatabase,
  channelId: string,
  memberId: string,
): Promise<Notification[]> {
  return (
    (await readJson(
      db,
      notificationsRecordId(channelId, memberId),
      NotificationListSchema,
    )) ?? []
  );
}

/** Append a notification for `toMemberId`. Never throws at the caller. */
export async function pushNotification(
  db: AppDatabase,
  channelId: string,
  toMemberId: string,
  entry: {
    kind: NotificationKind;
    fromId: string;
    fromNickname: string;
    text: string;
  },
): Promise<void> {
  // Seeded freshmen have no inbox to read.
  if (isSeedMember(toMemberId)) return;
  const existing = await listNotifications(db, channelId, toMemberId);
  const notification: Notification = {
    id: newId(),
    ...entry,
    createdAt: new Date().toISOString(),
    read: false,
  };
  await writeJson(
    db,
    notificationsRecordId(channelId, toMemberId),
    [notification, ...existing].slice(0, NOTIFICATION_LIMIT),
  );
}

/** Mark notifications read: all of them, or only those from one person. */
export async function markNotificationsRead(
  db: AppDatabase,
  channelId: string,
  memberId: string,
  fromId?: string,
): Promise<Notification[]> {
  const existing = await listNotifications(db, channelId, memberId);
  const updated = existing.map((notification) =>
    !notification.read &&
    (fromId === undefined || notification.fromId === fromId)
      ? { ...notification, read: true }
      : notification,
  );
  if (updated.some((n, index) => n.read !== existing[index].read)) {
    await writeJson(db, notificationsRecordId(channelId, memberId), updated);
  }
  return updated;
}

export async function readChat(
  db: AppDatabase,
  channelId: string,
  a: string,
  b: string,
): Promise<ChatMessage[]> {
  return (
    (await readJson(db, chatRecordId(channelId, a, b), ChatLogSchema)) ?? []
  );
}

export async function appendChat(
  db: AppDatabase,
  channelId: string,
  senderId: string,
  targetId: string,
  text: string,
): Promise<ChatMessage[]> {
  const existing = await readChat(db, channelId, senderId, targetId);
  const message: ChatMessage = {
    id: newId(),
    senderId,
    text,
    createdAt: new Date().toISOString(),
  };
  const next = [...existing, message].slice(-CHAT_LIMIT);
  await writeJson(db, chatRecordId(channelId, senderId, targetId), next);
  return next;
}

/** Drop the conversation when a match is cancelled, so nothing lingers after a dissolve. */
export async function deleteChat(
  db: AppDatabase,
  channelId: string,
  a: string,
  b: string,
): Promise<void> {
  await db
    .prepare("DELETE FROM app_records WHERE id = ?")
    .bind(chatRecordId(channelId, a, b))
    .run();
}
