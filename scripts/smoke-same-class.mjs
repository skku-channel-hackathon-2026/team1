// Local-only end-to-end check of the 「같은 반」 functions against a running `wrangler dev` (D1 included).
// Usage: pnpm exec wrangler dev --local --port 8797  →  node scripts/smoke-same-class.mjs
import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";

const origin = process.env.SMOKE_ORIGIN ?? "http://127.0.0.1:8797";
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin)) {
  throw new Error("This synthetic smoke is local-only");
}
const signingKey = Buffer.from("11".repeat(32), "hex");
const channelId = `smoke-${randomUUID().slice(0, 8)}`;

async function call(method, params, managerId) {
  const body = JSON.stringify({
    method,
    params,
    context: {
      caller: { type: "manager", id: managerId },
      channel: { id: channelId },
    },
  });
  const signature = createHmac("sha256", signingKey)
    .update(body)
    .digest("base64");
  const response = await fetch(`${origin}/functions`, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-signature": signature },
    body,
  });
  assert.equal(
    response.status,
    200,
    `${method} returned HTTP ${response.status}`,
  );
  const json = await response.json();
  if (json.error) throw new Error(`${method}: ${JSON.stringify(json.error)}`);
  return json.result;
}

const minji = {
  nickname: "데모",
  department: "경영학과",
  campus: "HUMANITIES",
  includeOtherDepartments: false,
  instances: [
    {
      subject: "경영학원론",
      professor: "김예진",
      day: "MON",
      startPeriod: 2,
      endPeriod: 2,
      room: "33302",
    },
    {
      subject: "경영학원론",
      professor: "김예진",
      day: "WED",
      startPeriod: 2,
      endPeriod: 2,
      room: "33302",
    },
    {
      subject: "회계원리",
      professor: "박성훈",
      day: "MON",
      startPeriod: 4,
      endPeriod: 4,
      room: "32205",
    },
    {
      subject: "회계원리",
      professor: "박성훈",
      day: "WED",
      startPeriod: 4,
      endPeriod: 4,
      room: "32205",
    },
    {
      subject: "경제학원론",
      professor: "이수민",
      day: "TUE",
      startPeriod: 2,
      endPeriod: 2,
      room: "32301",
    },
    {
      subject: "경제학원론",
      professor: "이수민",
      day: "THU",
      startPeriod: 2,
      endPeriod: 2,
      room: "32301",
    },
    {
      subject: "대학영어",
      professor: "Sarah Kim",
      day: "TUE",
      startPeriod: 4,
      endPeriod: 4,
      room: "31207",
    },
    {
      subject: "대학영어",
      professor: "Sarah Kim",
      day: "THU",
      startPeriod: 4,
      endPeriod: 4,
      room: "31207",
    },
    {
      subject: "글쓰기와 소통",
      professor: "한지원",
      day: "FRI",
      startPeriod: 3,
      endPeriod: 3,
      room: "31305",
    },
    {
      subject: "컴퓨팅사고와 SW코딩",
      professor: "오세훈",
      day: "WED",
      startPeriod: 6,
      endPeriod: 6,
      room: "61301",
    },
  ],
};

// 1. No profile yet → empty match, null profile.
assert.deepEqual(await call("tutorial.getProfile", {}, "m1"), {
  profile: null,
});
assert.deepEqual(await call("tutorial.match", {}, "m1"), {
  me: null,
  poolSize: 0,
  results: [],
});

// 2. Save the demo timetable and match against the seeds.
const saved = await call("tutorial.saveProfile", minji, "m1");
assert.equal(saved.profile.memberId, "m1");
assert.ok(saved.profile.updatedAt);

const started = Date.now();
const match = await call("tutorial.match", {}, "m1");
const elapsed = Date.now() - started;
assert.equal(match.me.nickname, "데모");
assert.equal(match.poolSize, 59); // 58 seeds (29 per campus) + me
assert.equal(match.results.length, 29); // 자과캠 시드 29명 제외
assert.equal(match.results[0].nickname, "하늘");
assert.ok(match.results[0].score > 0 && match.results[0].score <= 100);
assert.ok(match.results[0].raw.breakdown.sharedFree > 0);
assert.ok(!("revealedInstances" in match.results[0]));
assert.equal(match.results[0].proximity, "ROOM");
assert.equal(match.results[0].matchState, "NONE");
assert.match(match.results[0].dailySummary.WED, /공강 1시간/);
assert.doesNotMatch(match.results[0].dailySummary.WED, /점심|끝나고/);
assert.ok(match.results.every((r) => r.isSeed));

// 3. Request the top seed → seeds accept instantly → timetable revealed.
const request = await call(
  "tutorial.requestMatch",
  { targetId: match.results[0].targetId },
  "m1",
);
assert.equal(request.matchState, "ACCEPTED");
assert.equal(request.notified, false); // seeds have no manager to DM
const again = await call("tutorial.match", {}, "m1");
assert.equal(again.results[0].matchState, "ACCEPTED");
assert.ok(!("revealedInstances" in again.results[0]));

// 4. A second real manager joins: request flows one way, then both ways.
await call("tutorial.saveProfile", { ...minji, nickname: "두번째" }, "m2");
const fromTwo = await call("tutorial.requestMatch", { targetId: "m1" }, "m2");
assert.equal(fromTwo.matchState, "REQUESTED");
// A real manager target triggers the DM path; locally there is no channel token, so it fails softly
// and the reason is reported instead of swallowed.
assert.equal(fromTwo.notified, false);
assert.equal(typeof fromTwo.notifyError, "string");
assert.ok(fromTwo.notifyError.length > 0);
assert.match(fromTwo.notifyText, /같은 반 요청/);
const seenByOne = await call("tutorial.match", {}, "m1");
const two = seenByOne.results.find((r) => r.targetId === "m2");
assert.equal(two.matchState, "RECEIVED");
assert.equal(two.isSeed, false);
const accept = await call("tutorial.requestMatch", { targetId: "m2" }, "m1");
assert.equal(accept.matchState, "ACCEPTED");

// 5. Cross-campus targets and self-requests are rejected.
for (const [targetId, who] of [
  ["seed:30", "m1"],
  ["m1", "m1"],
]) {
  await assert.rejects(call("tutorial.requestMatch", { targetId }, who));
}

// 6. Cancel: withdraw a request, decline a received one, dissolve a match.
const c1 = await call("tutorial.cancelMatch", { targetId: "m2" }, "m1"); // was ACCEPTED
assert.equal(c1.matchState, "NONE");
assert.equal(
  (await call("tutorial.match", {}, "m2")).results.find(
    (r) => r.targetId === "m1",
  ).matchState,
  "NONE",
);
await call("tutorial.requestMatch", { targetId: "m2" }, "m1");
const c2 = await call("tutorial.cancelMatch", { targetId: "m1" }, "m2"); // decline
assert.equal(c2.matchState, "NONE");
await call("tutorial.requestMatch", { targetId: "m2" }, "m1");
const c3 = await call("tutorial.cancelMatch", { targetId: "m2" }, "m1"); // withdraw
assert.equal(c3.matchState, "NONE");

// 7. Deleting removes the profile and its matches.
await call("tutorial.deleteProfile", {}, "m1");
assert.deepEqual(await call("tutorial.getProfile", {}, "m1"), {
  profile: null,
});
const afterDelete = await call("tutorial.match", {}, "m2");
assert.ok(!afterDelete.results.some((r) => r.targetId === "m1"));
await call("tutorial.deleteProfile", {}, "m2");

console.log(
  `PASS: 같은 반 profile upsert, seeded ranking (하늘 first of 29, match in ${elapsed}ms), request/accept state, overlap-only after accept, DM notice flag, campus hard filter, cancel/decline/dissolve, delete`,
);
