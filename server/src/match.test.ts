import assert from "node:assert/strict";
import test from "node:test";
import {
  LUNCH_PERIODS,
  DEMO_PRESET,
  SEED_PROFILES,
  buildDailySummary,
  buildSlotGrid,
  buildingKey,
  computeIdf,
  instancesOf,
  rankMatches,
  scorePair,
  type Profile,
} from "@tutorial/shared";

const minji: Profile = {
  memberId: "me",
  nickname: "나",
  includeOtherDepartments: false,
  ...DEMO_PRESET,
};

test("free periods exist only between the first and last class of a day", () => {
  const grid = buildSlotGrid(minji.instances);
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

test("lunch is the period that sits inside 11:30–13:30", () => {
  assert.deepEqual(LUNCH_PERIODS, [3]);
});

test("building keys are campus-scoped so code 31 never collides", () => {
  assert.equal(buildingKey("HUMANITIES", "31207"), "HUMANITIES:퇴계인문관");
  assert.equal(buildingKey("SCIENCE", "31207"), "SCIENCE:제1과학관");
  assert.equal(
    buildingKey("HUMANITIES", "61101"),
    buildingKey("HUMANITIES", "62101"),
  );
});

test("seed distribution around 민지 matches the PRD (2 with ≥3, 8 with 1–2)", () => {
  const sameDepartment = rankMatches(minji, SEED_PROFILES).filter(
    (result) => result.department === minji.department,
  );
  const shared = sameDepartment.map((result) => result.sameRoom.length);
  assert.equal(shared.filter((count) => count >= 3).length, 2);
  assert.equal(shared.filter((count) => count === 1 || count === 2).length, 8);
  assert.equal(sameDepartment.length, 23);
});

test("the other campus is excluded regardless of score", () => {
  const results = rankMatches(minji, SEED_PROFILES);
  assert.ok(results.every((result) => result.campus === "HUMANITIES"));
  assert.ok(!results.some((result) => result.nickname === "우주"));
  assert.equal(results.length, SEED_PROFILES.length - 1);
});

test("하늘 ranks first with a Wednesday chain and lunch", () => {
  const [top] = rankMatches(minji, SEED_PROFILES);
  assert.equal(top.nickname, "하늘");
  assert.equal(top.proximity, "ROOM");
  assert.ok(
    top.chains.some((chain) => chain.day === "WED" && chain.period === 2),
  );
  assert.ok(
    top.chains.some((chain) => chain.day === "WED" && chain.period === 4),
  );
  assert.ok(top.lunchDays.includes("WED"));
  assert.match(
    top.dailySummary.WED ?? "",
    /^2교시 같이 듣고 → 끝나고 점심 함께 → 4교시 같이 듣고 → 끝나고 공강 1시간 → 6교시 같이 듣고$/,
  );
  assert.equal(top.reasons[0], "같은 수업 3개");
});

test("the breakdown adds up to the score", () => {
  for (const result of rankMatches(minji, SEED_PROFILES)) {
    const sum = Object.values(result.breakdown).reduce((a, b) => a + b, 0);
    assert.ok(Math.abs(sum - result.score) < 0.011, `${result.nickname}`);
  }
  const [top] = rankMatches(minji, SEED_PROFILES);
  assert.equal(top.breakdown.chain, 9); // 3 chains × 3.0
  assert.equal(top.breakdown.lunch, 4); // 월·수 점심
});

test("results are sorted by score and the runner-up has a wide margin", () => {
  const results = rankMatches(minji, SEED_PROFILES);
  for (let i = 1; i < results.length; i++) {
    assert.ok(results[i - 1].score >= results[i].score);
  }
  // 상위권 점수가 10% 이내로 붙으면 변별력이 없다 (PRD 리스크).
  assert.ok(results[0].score > results[1].score * 1.1);
});

test("same building on the same floor scores higher than a different floor", () => {
  const idf = computeIdf([minji]);
  const sameFloor: Profile = {
    ...minji,
    memberId: "floor",
    instances: instancesOf(["ACC_D"]), // 32303, TUE/THU 2 — 민지 ECON_A는 32301
  };
  const otherFloor: Profile = {
    ...minji,
    memberId: "other",
    instances: instancesOf(["ECON_B"]), // 32302, MON/WED 4 — 민지 ACC_A는 32205
  };
  const a = scorePair(minji, sameFloor, idf);
  const b = scorePair(minji, otherFloor, idf);
  assert.equal(a.proximity, "BUILDING");
  assert.ok(a.sameBuilding.every((overlap) => overlap.sameFloor));
  assert.ok(b.sameBuilding.every((overlap) => !overlap.sameFloor));
  assert.ok(a.score > b.score);
  assert.equal(a.reasons[1], "다산경제관에 같이 있는 교시 2개");
});

test("people who only share free periods stay in the list with the FREE badge", () => {
  const results = rankMatches(minji, SEED_PROFILES);
  const freeOnly = results.filter((result) => result.proximity === "FREE");
  assert.ok(freeOnly.length > 0);
  assert.ok(freeOnly.every((result) => result.sameRoom.length === 0));
  assert.deepEqual(results.at(-1)?.proximity, "FREE");
});

test("overlap cells never include the other person's solo classes", () => {
  const results = rankMatches(minji, SEED_PROFILES);
  const myGrid = buildSlotGrid(minji.instances);
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

test("'끝나고' appears only when the shared free period directly follows the shared class", () => {
  // Shared class at 2, I alone have class at 3, both free at 4 → no chain, no "끝나고".
  const a = mondayProfile("a", [
    ["공유", 2, 2, "31101"],
    ["나만", 3, 3, "32101"],
    ["끝", 5, 5, "33101"],
  ]);
  const b = mondayProfile("b", [
    ["공유", 2, 2, "31101"],
    ["끝", 5, 5, "50101"],
  ]);
  const gap = scorePair(a, b, computeIdf([a, b]));
  assert.equal(gap.chains.length, 0);
  assert.equal(gap.breakdown.chain, 0);
  assert.equal(
    gap.dailySummary.MON,
    "2교시 같이 듣고 → 공강 1시간 → 5교시 같이 듣고",
  );

  // Two-period shared class 2–3, both free at 4 → one chain ending at period 3.
  const c = mondayProfile("c", [
    ["긴수업", 2, 3, "31101"],
    ["끝", 5, 5, "33101"],
  ]);
  const d = mondayProfile("d", [
    ["긴수업", 2, 3, "31101"],
    ["끝", 5, 5, "33101"],
  ]);
  const adjacent = scorePair(c, d, computeIdf([c, d]));
  assert.deepEqual(adjacent.chains, [
    { day: "MON", period: 3, freePeriod: 4, subject: "긴수업" },
  ]);
  assert.equal(adjacent.breakdown.chain, 3);
  assert.equal(
    adjacent.dailySummary.MON,
    "2~3교시 같이 듣고 → 끝나고 공강 1시간 → 5교시 같이 듣고",
  );
  // Only the class's last period and the free period carry the chain flag.
  assert.deepEqual(
    adjacent.overlapCells
      .filter((cell) => cell.chain)
      .map((cell) => cell.period),
    [3, 4],
  );
});

test("daily summary merges consecutive periods and labels lunch", () => {
  const summary = buildDailySummary([
    {
      day: "MON",
      period: 2,
      kind: "SAME",
      label: "경영학원론",
      lunch: false,
      chain: true,
    },
    {
      day: "MON",
      period: 3,
      kind: "FREE",
      label: "점심",
      lunch: true,
      chain: true,
    },
    {
      day: "MON",
      period: 4,
      kind: "FREE",
      label: "공강",
      lunch: false,
      chain: false,
    },
    {
      day: "TUE",
      period: 5,
      kind: "BUILDING",
      label: "다산경제관",
      lunch: false,
      chain: false,
    },
    {
      day: "TUE",
      period: 6,
      kind: "BUILDING",
      label: "다산경제관",
      lunch: false,
      chain: false,
    },
  ]);
  assert.equal(summary.MON, "2교시 같이 듣고 → 끝나고 점심 함께 → 공강 1시간");
  assert.equal(summary.TUE, "5~6교시 같은 건물(다산경제관)");
  assert.equal(summary.WED, undefined);
});
