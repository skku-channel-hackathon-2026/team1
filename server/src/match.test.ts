import assert from "node:assert/strict";
import test from "node:test";
import {
  DEMO_PRESET,
  DEMO_PRESETS,
  SEED_PROFILES,
  seedProfilesOn,
  buildDailySummary,
  buildSlotGrid,
  buildingKey,
  instancesOf,
  rankMatches,
  scorePair,
  type Profile,
} from "@tutorial/shared";

const me: Profile = {
  memberId: "me",
  nickname: "나",
  includeOtherDepartments: false,
  ...DEMO_PRESET,
};

test("free periods exist only between the first and last class of a day", () => {
  const grid = buildSlotGrid(me.instances);
  // 수: 2교시, 4교시, 6교시 수업 → 3·5교시 공강, 1교시와 7교시 이후는 없음
  assert.equal(grid.WED[2].kind, "CLASS");
  assert.equal(grid.WED[3].kind, "FREE");
  assert.equal(grid.WED[5].kind, "FREE");
  assert.equal(grid.WED[1].kind, "NONE");
  assert.equal(grid.WED[7].kind, "NONE");
  // 금: 3교시 하나만 → 공강 없음
  assert.equal(grid.FRI[2].kind, "NONE");
  assert.equal(grid.FRI[4].kind, "NONE");
});

test("building keys are campus-scoped so code 31 never collides", () => {
  assert.equal(buildingKey("HUMANITIES", "31207"), "HUMANITIES:퇴계인문관");
  assert.equal(buildingKey("SCIENCE", "31207"), "SCIENCE:제1과학관");
  assert.equal(
    buildingKey("HUMANITIES", "61101"),
    buildingKey("HUMANITIES", "62101"),
  );
});

test("seed distribution around the demo timetable matches the PRD (2 with ≥3, 8 with 1–2)", () => {
  const sameDepartment = rankMatches(me, SEED_PROFILES).filter(
    (result) => result.department === me.department,
  );
  const shared = sameDepartment.map((result) => result.sameRoom.length);
  assert.equal(shared.filter((count) => count >= 3).length, 2);
  assert.equal(shared.filter((count) => count === 1 || count === 2).length, 8);
  assert.equal(sameDepartment.length, 23);
});

test("the other campus is excluded regardless of score", () => {
  const results = rankMatches(me, SEED_PROFILES);
  assert.ok(results.every((result) => result.campus === "HUMANITIES"));
  assert.ok(!results.some((result) => result.nickname === "우주"));
  assert.equal(results.length, seedProfilesOn("HUMANITIES").length);
  assert.equal(seedProfilesOn("HUMANITIES").length, 29);
  assert.equal(seedProfilesOn("SCIENCE").length, 29);
});

test("the 자과캠 demo has its own courses and the same match shape", () => {
  const science: Profile = {
    memberId: "me-s",
    nickname: "나",
    includeOtherDepartments: false,
    ...DEMO_PRESETS.SCIENCE,
  };
  // Different subjects and professors, not just different rooms.
  const humanitiesSubjects = new Set(
    DEMO_PRESETS.HUMANITIES.instances.map((i) => i.subject),
  );
  const scienceSubjects = new Set(
    DEMO_PRESETS.SCIENCE.instances.map((i) => i.subject),
  );
  assert.ok(
    [...scienceSubjects].some((subject) => !humanitiesSubjects.has(subject)),
  );
  assert.notEqual(
    DEMO_PRESETS.SCIENCE.instances[0].professor,
    DEMO_PRESETS.HUMANITIES.instances[0].professor,
  );

  const results = rankMatches(science, SEED_PROFILES);
  assert.ok(results.every((result) => result.campus === "SCIENCE"));
  assert.equal(results.length, 29);
  const sameDepartment = results.filter(
    (r) => r.department === science.department,
  );
  const shared = sameDepartment.map((r) => r.sameRoom.length);
  assert.equal(shared.filter((count) => count >= 3).length, 2);
  assert.equal(shared.filter((count) => count === 1 || count === 2).length, 8);
  assert.equal(results[0].nickname, "우주");
  assert.equal(
    results[0].dailySummary.WED,
    "2교시 같이 듣기 → 공강 1시간 → 4교시 같이 듣기 → 공강 1시간 → 6교시 같이 듣기",
  );
});

test("하늘 ranks first and the Wednesday summary reads class → gap → class", () => {
  const [top] = rankMatches(me, SEED_PROFILES);
  assert.equal(top.nickname, "하늘");
  assert.equal(top.proximity, "ROOM");
  assert.ok(top.sharedFreeDays.includes("WED"));
  assert.equal(
    top.dailySummary.WED,
    "2교시 같이 듣기 → 공강 1시간 → 4교시 같이 듣기 → 공강 1시간 → 6교시 같이 듣기",
  );
  assert.equal(top.reasons[0], "같은 수업 3개");
  assert.ok(top.reasons.every((line) => !/점심|끝나고/.test(line)));
});

test("scores are 0–100 and the four displayed parts add up", () => {
  const results = rankMatches(me, SEED_PROFILES);
  for (const result of results) {
    assert.ok(result.score >= 0 && result.score <= 100, result.nickname);
    const rawSum = Object.values(result.raw.breakdown).reduce(
      (a, b) => a + b,
      0,
    );
    assert.ok(Math.abs(rawSum - result.raw.score) < 0.011, result.nickname);
    const partsSum = Object.values(result.parts).reduce((a, b) => a + b, 0);
    assert.ok(
      Math.abs(partsSum - result.score) <= 0.5,
      `${result.nickname}: parts ${partsSum} vs score ${result.score}`,
    );
  }
  const [top] = results;
  assert.ok(top.parts.free > 0);
  // Sharing classes must matter more than sharing gaps for the people who share classes.
  assert.ok(top.parts.sameRoom > top.parts.free);
  assert.ok(top.score < 100, "nobody in the seed shares my whole week");
});

test("my own timetable scores exactly 100", () => {
  const twin: Profile = { ...me, memberId: "twin", nickname: "쌍둥이" };
  const [top] = rankMatches(me, [...SEED_PROFILES, twin]);
  assert.equal(top.nickname, "쌍둥이");
  assert.equal(top.score, 100);
});

test("results are sorted by score and the runner-up has a wide margin", () => {
  const results = rankMatches(me, SEED_PROFILES);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].raw.score >= results[i].raw.score);
  }
  // 상위권 점수가 10% 이내로 붙으면 변별력이 없다 (PRD 리스크).
  assert.ok(results[0].raw.score > results[1].raw.score * 1.1);
});

test("same building on the same floor scores higher than a different floor", () => {
  const sameFloor: Profile = {
    ...me,
    memberId: "floor",
    instances: instancesOf(["MAJOR2_D"]), // 32303, TUE/THU 2 — 데모 MAJOR3_A는 32301
  };
  const otherFloor: Profile = {
    ...me,
    memberId: "other",
    instances: instancesOf(["MAJOR3_B"]), // 32302, MON/WED 4 — 데모 MAJOR2_A는 32205
  };
  const a = scorePair(me, sameFloor);
  const b = scorePair(me, otherFloor);
  assert.equal(a.proximity, "BUILDING");
  assert.ok(a.sameBuilding.every((overlap) => overlap.sameFloor));
  assert.ok(b.sameBuilding.every((overlap) => !overlap.sameFloor));
  assert.ok(a.raw.score > b.raw.score);
  assert.equal(a.reasons[1], "같은 건물 다른 강의실 2교시 (다산경제관)");
  // No building overlap → the line is simply absent, never "없음" next to shared classes.
  assert.equal(b.reasons.length, 3);
  assert.ok(
    !b.reasons.some((line) => line.includes("없음") && line.includes("건물")),
  );
});

test("people who only share free periods stay in the list with the FREE badge", () => {
  const results = rankMatches(me, SEED_PROFILES);
  const freeOnly = results.filter((result) => result.proximity === "FREE");
  assert.ok(freeOnly.length > 0);
  assert.ok(freeOnly.every((result) => result.sameRoom.length === 0));
  assert.deepEqual(results.at(-1)?.proximity, "FREE");
});

test("overlap cells never include the other person's solo classes", () => {
  const results = rankMatches(me, SEED_PROFILES);
  const myGrid = buildSlotGrid(me.instances);
  for (const result of results) {
    for (const cell of result.overlapCells) {
      const mine = myGrid[cell.day][cell.period];
      if (cell.kind === "FREE") assert.equal(mine.kind, "FREE");
      else assert.equal(mine.kind, "CLASS");
    }
  }
});

function mondayProfile(
  id: string,
  rows: [string, number, number, string][],
): Profile {
  return {
    memberId: id,
    nickname: id,
    department: "d",
    campus: "HUMANITIES",
    includeOtherDepartments: false,
    instances: rows.map(([subject, start, end, room]) => ({
      subject,
      professor: "p",
      day: "MON",
      startPeriod: start,
      endPeriod: end,
      room,
    })),
  };
}

test("a gap between shared classes is just 공강, whatever sits around it", () => {
  const a = mondayProfile("a", [
    ["공유", 2, 2, "31101"],
    ["나만", 3, 3, "32101"],
    ["끝", 5, 5, "33101"],
  ]);
  const b = mondayProfile("b", [
    ["공유", 2, 2, "31101"],
    ["끝", 5, 5, "50101"],
  ]);
  const gap = scorePair(a, b);
  assert.equal(gap.raw.breakdown.sharedFree, 0.15); // period 4 only
  assert.equal(
    gap.dailySummary.MON,
    "2교시 같이 듣기 → 공강 1시간 → 5교시 같이 듣기",
  );

  const c = mondayProfile("c", [
    ["긴수업", 2, 3, "31101"],
    ["끝", 5, 5, "33101"],
  ]);
  const d = mondayProfile("d", [
    ["긴수업", 2, 3, "31101"],
    ["끝", 5, 5, "33101"],
  ]);
  const adjacent = scorePair(c, d);
  assert.equal(
    adjacent.dailySummary.MON,
    "2~3교시 같이 듣기 → 공강 1시간 → 5교시 같이 듣기",
  );
  assert.equal(adjacent.score, 100, "identical timetables score 100");
});

test("daily summary merges consecutive periods", () => {
  const summary = buildDailySummary([
    { day: "MON", period: 2, kind: "SAME", label: "경영학원론" },
    { day: "MON", period: 3, kind: "FREE", label: "공강" },
    { day: "MON", period: 4, kind: "FREE", label: "공강" },
    { day: "TUE", period: 5, kind: "BUILDING", label: "다산경제관" },
    { day: "TUE", period: 6, kind: "BUILDING", label: "다산경제관" },
  ]);
  assert.equal(summary.MON, "2교시 같이 듣기 → 공강 2시간");
  assert.equal(summary.TUE, "5~6교시 같은 건물(다산경제관)");
  assert.equal(summary.WED, undefined);
});

test("a shared period is worth the same no matter how many people take that class", () => {
  // Same instance shared with 3 people vs with 20 → identical per-period value.
  const shared = mondayProfile("x", [["공통", 2, 2, "31101"]]);
  const other = mondayProfile("y", [["공통", 2, 2, "31101"]]);
  const alone = scorePair(shared, other);
  const crowd = rankMatches(shared, [
    other,
    ...Array.from({ length: 20 }, (_, i) =>
      mondayProfile(`z${i}`, [["공통", 2, 2, "31101"]]),
    ),
  ]);
  assert.equal(alone.raw.breakdown.sameRoom, 1);
  assert.ok(crowd.every((r) => r.raw.breakdown.sameRoom === 1));
});
