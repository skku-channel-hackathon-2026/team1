import assert from "node:assert/strict";
import test from "node:test";
import { DEMO_PRESET, SEED_PROFILES, type Profile } from "@tutorial/shared";
import type { AppDatabase } from "./database.js";
import {
  cancelMatch,
  deleteProfile,
  deriveMatchState,
  getProfile,
  listMatchRecords,
  listPool,
  matchRecordId,
  requestMatch,
  saveProfile,
} from "./same-class.store.js";

// Minimal in-memory stand-in for D1 that understands the four statements the store uses.
function fakeDatabase(): AppDatabase & { rows: Map<string, string> } {
  const rows = new Map<string, string>();
  const statement = (sql: string, values: (string | number | null)[]) => ({
    async run() {
      if (sql.startsWith("INSERT"))
        rows.set(String(values[0]), String(values[1]));
      else if (sql.startsWith("DELETE")) rows.delete(String(values[0]));
      else throw new Error(`unsupported run: ${sql}`);
      return {};
    },
    async first<T>() {
      assert.match(sql, /^SELECT value_json FROM app_records WHERE id = \?$/);
      const value = rows.get(String(values[0]));
      return (value === undefined ? null : { value_json: value }) as T | null;
    },
    async all<T>() {
      assert.match(
        sql,
        /^SELECT id, value_json FROM app_records WHERE id LIKE \?$/,
      );
      const prefix = String(values[0]).replace(/%$/, "");
      const results = [...rows.entries()]
        .filter(([id]) => id.startsWith(prefix))
        .map(([id, value_json]) => ({ id, value_json }));
      return { results: results as T[] };
    },
  });
  return {
    rows,
    prepare(sql: string) {
      return {
        bind: (...values: (string | number | null)[]) => statement(sql, values),
        first: () => statement(sql, []).first(),
        all: () => statement(sql, []).all(),
      };
    },
  };
}

const channel = "ch1";
const minji: Profile = {
  memberId: "m1",
  nickname: "나",
  includeOtherDepartments: false,
  ...DEMO_PRESET,
};

test("profiles round-trip through app_records as JSON with a prefixed id", async () => {
  const db = fakeDatabase();
  assert.equal(await getProfile(db, channel, "m1"), null);
  const stored = await saveProfile(db, channel, minji);
  assert.ok(stored.updatedAt);
  assert.ok(db.rows.has("profile:ch1:m1"));
  const read = await getProfile(db, channel, "m1");
  assert.equal(read?.nickname, "나");
  assert.equal(read?.instances.length, minji.instances.length);
});

test("the pool merges seeds with stored profiles and stored profiles win", async () => {
  const db = fakeDatabase();
  await saveProfile(db, channel, minji);
  await saveProfile(db, channel, {
    ...SEED_PROFILES[0],
    nickname: "덮어쓴 하늘",
  });
  const pool = await listPool(db, channel);
  assert.equal(pool.length, SEED_PROFILES.length + 1);
  assert.equal(
    pool.find((p) => p.memberId === SEED_PROFILES[0].memberId)?.nickname,
    "덮어쓴 하늘",
  );
  // 다른 채널에는 보이지 않는다
  const other = await listPool(db, "ch2");
  assert.equal(other.length, SEED_PROFILES.length);
});

test("match state moves NONE → REQUESTED → ACCEPTED as both sides request", async () => {
  const db = fakeDatabase();
  assert.equal(deriveMatchState(undefined, "a", "b"), "NONE");
  const first = await requestMatch(db, channel, "a", "b");
  assert.equal(deriveMatchState(first, "a", "b"), "REQUESTED");
  assert.equal(deriveMatchState(first, "b", "a"), "RECEIVED");
  assert.equal(first.acceptedAt, undefined);
  const second = await requestMatch(db, channel, "b", "a");
  assert.equal(deriveMatchState(second, "a", "b"), "ACCEPTED");
  assert.ok(second.acceptedAt);
  assert.equal(
    matchRecordId(channel, "b", "a"),
    matchRecordId(channel, "a", "b"),
  );
});

test("seeded freshmen accept immediately", async () => {
  const db = fakeDatabase();
  const record = await requestMatch(
    db,
    channel,
    "m1",
    SEED_PROFILES[0].memberId,
  );
  assert.equal(
    deriveMatchState(record, "m1", SEED_PROFILES[0].memberId),
    "ACCEPTED",
  );
});

test("deleting a profile also deletes its matches", async () => {
  const db = fakeDatabase();
  await saveProfile(db, channel, minji);
  await requestMatch(db, channel, "m1", "m2");
  await requestMatch(db, channel, "m3", "m2");
  assert.equal((await listMatchRecords(db, channel, "m1")).length, 1);
  await deleteProfile(db, channel, "m1");
  assert.equal(await getProfile(db, channel, "m1"), null);
  assert.equal((await listMatchRecords(db, channel, "m1")).length, 0);
  assert.equal((await listMatchRecords(db, channel, "m2")).length, 1);
});

test("cancel withdraws, declines, or dissolves depending on who had requested", async () => {
  const db = fakeDatabase();
  // REQUESTED → withdrawn: record gone
  await requestMatch(db, channel, "a", "b");
  assert.equal(
    deriveMatchState(await cancelMatch(db, channel, "a", "b"), "a", "b"),
    "NONE",
  );
  assert.equal((await listMatchRecords(db, channel, "a")).length, 0);

  // RECEIVED → declined: the other side's request is dropped too
  await requestMatch(db, channel, "a", "b");
  assert.equal(
    deriveMatchState(await cancelMatch(db, channel, "b", "a"), "b", "a"),
    "NONE",
  );
  assert.equal((await listMatchRecords(db, channel, "a")).length, 0);

  // ACCEPTED → dissolved for both
  await requestMatch(db, channel, "a", "b");
  await requestMatch(db, channel, "b", "a");
  assert.equal(
    deriveMatchState(await cancelMatch(db, channel, "a", "b"), "a", "b"),
    "NONE",
  );
  assert.equal((await listMatchRecords(db, channel, "b")).length, 0);

  // Withdrawing my request keeps the other person's request intact
  await requestMatch(db, channel, "a", "b");
  await requestMatch(db, channel, "b", "a");
  // (both requested = ACCEPTED, so this dissolves) — instead build a one-sided record from b
  await cancelMatch(db, channel, "a", "b");
  await requestMatch(db, channel, "b", "a");
  await requestMatch(db, channel, "a", "b"); // now ACCEPTED again
  await cancelMatch(db, channel, "a", "b"); // dissolve
  await requestMatch(db, channel, "b", "a"); // b requests only
  const seenByA = await cancelMatch(db, channel, "a", "b"); // a has nothing to withdraw → decline
  assert.equal(seenByA, undefined);

  // Cancelling when nothing exists is a no-op
  assert.equal(await cancelMatch(db, channel, "x", "y"), undefined);
});
