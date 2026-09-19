// 「같은 반」 similarity: physical proximity per slot + transition bonuses.
// Pure functions only. Runs inside a single Function call on the Worker and in unit tests.
//
// Presentation model (what the WAM shows): a 0–100 score where 100 means "same timetable as
// mine", split into three parts — 같은 강의실 / 같은 건물 / 공강. Internally the
// free-period part still rewards "class → shared free" chains and lunch-hour overlap; those are
// folded into 공강 for display, per the team's decision to keep the UI to one idea of 공강.

import {
  DAYS,
  DAY_LABELS,
  MAX_PERIOD,
  MIN_PERIOD,
  buildSlotGrid,
  buildingKey,
  buildingName,
  courseKey,
  floorOf,
  instanceId,
  isLunchPeriod,
  type CourseInstance,
  type Day,
  type Profile,
  type SlotGrid,
} from "./timetable.js";

export const WEIGHTS = {
  sameRoom: 1.0, // w1 — flat per shared period (rarity weighting removed by team decision)
  sameFloor: 0.45, // w2a
  sameBuilding: 0.25, // w2b
  sharedFree: 0.15, // w3
  // Free-period bonuses are kept small on purpose: sharing a class must outweigh sharing a gap.
  chain: 1.0,
  lunch: 0.5,
} as const;

export type Weights = { [K in keyof typeof WEIGHTS]: number };

export type Proximity = "ROOM" | "BUILDING" | "FREE";

export const PROXIMITY_LABELS: Record<Proximity, string> = {
  ROOM: "같은 강의실",
  BUILDING: "같은 건물",
  FREE: "공강만 겹쳐요",
};

export interface Slot {
  day: Day;
  period: number;
}

export interface BuildingOverlap extends Slot {
  building: string;
  sameFloor: boolean;
}

export interface Chain {
  day: Day;
  period: number; // last period of the shared class
  freePeriod: number; // the shared free period right after it
  subject: string;
}

export type OverlapKind = "SAME" | "BUILDING" | "FREE";

/** One highlighted cell of the overlaid timetable. Never reveals the other person's solo classes. */
export interface OverlapCell extends Slot {
  kind: OverlapKind;
  label: string;
}

/** Raw weighted contributions before normalisation. */
export interface RawBreakdown {
  sameRoom: number;
  sameBuilding: number;
  sharedFree: number;
  chain: number;
  lunch: number;
}

/** What the UI shows: points out of 100, summing to `score`. */
export interface ScoreParts {
  sameRoom: number;
  sameBuilding: number;
  free: number; // sharedFree + chain + lunch
}

export interface MatchResult {
  targetId: string;
  nickname: string;
  department: string;
  campus: Profile["campus"];
  /** 0–100. 100 = the same timetable as mine. */
  score: number;
  parts: ScoreParts;
  raw: { score: number; breakdown: RawBreakdown };
  proximity: Proximity;
  sameRoom: CourseInstance[]; // distinct shared instances (my copy)
  sameCourseCount: number; // distinct subject+professor pairs
  sameBuilding: BuildingOverlap[];
  sharedFreeSlots: Slot[];
  sharedFreeDays: Day[];
  chains: Chain[];
  overlapCells: OverlapCell[];
  dailySummary: Partial<Record<Day, string>>;
  reasons: string[];
}

function isClass(
  state: SlotGrid[Day][number],
): state is { kind: "CLASS"; instance: CourseInstance } {
  return state.kind === "CLASS";
}

const round2 = (value: number) => Math.round(value * 100) / 100;
const round1 = (value: number) => Math.round(value * 10) / 10;

interface RawPair {
  breakdown: RawBreakdown;
  score: number;
  sameRoom: CourseInstance[];
  sameBuilding: BuildingOverlap[];
  sharedFreeSlots: Slot[];
  sharedFreeDays: Day[];
  chains: Chain[];
  overlapCells: OverlapCell[];
}

function scoreRaw(me: Profile, other: Profile, weights: Weights): RawPair {
  const mine = buildSlotGrid(me.instances);
  const theirs = buildSlotGrid(other.instances);

  const breakdown: RawBreakdown = {
    sameRoom: 0,
    sameBuilding: 0,
    sharedFree: 0,
    chain: 0,
    lunch: 0,
  };
  const sameRoomById = new Map<string, CourseInstance>();
  const sameBuilding: BuildingOverlap[] = [];
  const sharedFreeSlots: Slot[] = [];
  const freeDaySet = new Set<Day>();
  const lunchDaySet = new Set<Day>();
  const chains: Chain[] = [];
  const overlapCells: OverlapCell[] = [];

  for (const day of DAYS) {
    const a = mine[day];
    const b = theirs[day];
    for (let p = MIN_PERIOD; p <= MAX_PERIOD; p++) {
      const sa = a[p];
      const sb = b[p];
      if (isClass(sa) && isClass(sb)) {
        const idA = instanceId(sa.instance);
        if (idA === instanceId(sb.instance)) {
          breakdown.sameRoom += weights.sameRoom;
          sameRoomById.set(idA, sa.instance);
          overlapCells.push({
            day,
            period: p,
            kind: "SAME",
            label: sa.instance.subject,
          });
        } else if (
          buildingKey(me.campus, sa.instance.room) ===
          buildingKey(other.campus, sb.instance.room)
        ) {
          const sameFloor =
            floorOf(sa.instance.room) === floorOf(sb.instance.room);
          breakdown.sameBuilding += sameFloor
            ? weights.sameFloor
            : weights.sameBuilding;
          const building = buildingName(me.campus, sa.instance.room);
          sameBuilding.push({ day, period: p, building, sameFloor });
          overlapCells.push({
            day,
            period: p,
            kind: "BUILDING",
            label: building,
          });
        }
      } else if (sa.kind === "FREE" && sb.kind === "FREE") {
        breakdown.sharedFree += weights.sharedFree;
        sharedFreeSlots.push({ day, period: p });
        freeDaySet.add(day);
        if (isLunchPeriod(p)) lunchDaySet.add(day);
        overlapCells.push({ day, period: p, kind: "FREE", label: "공강" });
      }
    }

    // Chain: a shared class whose next period is free for both — "수업 끝나고 같이".
    for (let p = MIN_PERIOD; p < MAX_PERIOD; p++) {
      const sa = a[p];
      const sb = b[p];
      if (!isClass(sa) || !isClass(sb)) continue;
      if (instanceId(sa.instance) !== instanceId(sb.instance)) continue;
      if (sa.instance.endPeriod !== p) continue;
      if (a[p + 1].kind === "FREE" && b[p + 1].kind === "FREE") {
        chains.push({
          day,
          period: p,
          freePeriod: p + 1,
          subject: sa.instance.subject,
        });
      }
    }
  }

  breakdown.chain = weights.chain * chains.length;
  breakdown.lunch = weights.lunch * lunchDaySet.size;
  for (const key of Object.keys(breakdown) as (keyof RawBreakdown)[]) {
    breakdown[key] = round2(breakdown[key]);
  }
  const score = round2(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0),
  );

  return {
    breakdown,
    score,
    sameRoom: [...sameRoomById.values()],
    sameBuilding,
    sharedFreeSlots,
    sharedFreeDays: DAYS.filter((day) => freeDaySet.has(day)),
    chains,
    overlapCells,
  };
}

/**
 * The ceiling for `me`: what a person with exactly my timetable would score.
 * Dividing by it turns raw weights into a 0–100 score that reads as "how much of my week
 * this person shares".
 */
export function selfScore(me: Profile, weights: Weights = WEIGHTS): number {
  return scoreRaw(me, me, weights).score;
}

export function scorePair(
  me: Profile,
  other: Profile,
  weights: Weights = WEIGHTS,
  ceiling: number = selfScore(me, weights),
): MatchResult {
  const raw = scoreRaw(me, other, weights);
  const scale = ceiling > 0 ? 100 / ceiling : 0;
  const parts: ScoreParts = {
    sameRoom: round1(raw.breakdown.sameRoom * scale),
    sameBuilding: round1(raw.breakdown.sameBuilding * scale),
    free: round1(
      (raw.breakdown.sharedFree + raw.breakdown.chain + raw.breakdown.lunch) *
        scale,
    ),
  };
  // The displayed total is the rounded sum of the displayed parts, so the four numbers the
  // user sees always add up to the score. Ranking still uses raw.score.
  const partsSum = parts.sameRoom + parts.sameBuilding + parts.free;
  const score = Math.min(100, Math.round(partsSum));

  const sameCourseCount = new Set(raw.sameRoom.map(courseKey)).size;
  const proximity: Proximity =
    raw.sameRoom.length > 0
      ? "ROOM"
      : raw.sameBuilding.length > 0
        ? "BUILDING"
        : "FREE";

  return {
    targetId: other.memberId,
    nickname: other.nickname,
    department: other.department,
    campus: other.campus,
    score,
    parts,
    raw: { score: raw.score, breakdown: raw.breakdown },
    proximity,
    sameRoom: raw.sameRoom,
    sameCourseCount,
    sameBuilding: raw.sameBuilding,
    sharedFreeSlots: raw.sharedFreeSlots,
    sharedFreeDays: raw.sharedFreeDays,
    chains: raw.chains,
    overlapCells: raw.overlapCells,
    dailySummary: buildDailySummary(raw.overlapCells),
    reasons: buildReasons({
      sameCourseCount,
      sameBuilding: raw.sameBuilding,
      sharedFreeSlots: raw.sharedFreeSlots,
      sharedFreeDays: raw.sharedFreeDays,
    }),
  };
}

export interface RankOptions {
  weights?: Weights;
}

/** Full O(N) pass over the pool. The caller decides the pool (channel profiles + seeds). */
export function rankMatches(
  me: Profile,
  pool: Profile[],
  options: RankOptions = {},
): MatchResult[] {
  const weights = options.weights ?? WEIGHTS;
  const sameCampus = pool.filter((profile) => profile.campus === me.campus);
  const ceiling = selfScore(me, weights);
  return sameCampus
    .filter((profile) => profile.memberId !== me.memberId)
    .map((profile) => scorePair(me, profile, weights, ceiling))
    .sort(
      (x, y) =>
        y.raw.score - x.raw.score || x.nickname.localeCompare(y.nickname),
    );
}

function formatDays(days: Day[]): string {
  return days.map((day) => DAY_LABELS[day]).join("·");
}

function buildReasons(input: {
  sameCourseCount: number;
  sameBuilding: BuildingOverlap[];
  sharedFreeSlots: Slot[];
  sharedFreeDays: Day[];
}): string[] {
  const reasons: string[] = [];
  reasons.push(
    input.sameCourseCount > 0
      ? `같은 수업 ${input.sameCourseCount}개`
      : "같은 수업 없음",
  );
  if (input.sameBuilding.length > 0) {
    const counts = new Map<string, number>();
    for (const overlap of input.sameBuilding) {
      counts.set(overlap.building, (counts.get(overlap.building) ?? 0) + 1);
    }
    const [building, count] = [...counts.entries()].sort(
      (x, y) => y[1] - x[1],
    )[0];
    // Same building but a different room — a shared class already counts as 같은 강의실 above.
    reasons.push(`같은 건물 다른 강의실 ${count}교시 (${building})`);
  }
  reasons.push(
    input.sharedFreeSlots.length > 0
      ? `공강 겹침 ${input.sharedFreeSlots.length}시간 (${formatDays(input.sharedFreeDays)})`
      : "겹치는 공강 없음",
  );
  return reasons;
}

function periodRange(from: number, to: number): string {
  return from === to ? `${from}교시` : `${from}~${to}교시`;
}

/** "수: 2교시 같이 듣기 → 공강 1시간 → 4교시 같이 듣기 → 공강 1시간" */
export function buildDailySummary(
  cells: OverlapCell[],
): Partial<Record<Day, string>> {
  const summary: Partial<Record<Day, string>> = {};
  for (const day of DAYS) {
    const todays = cells
      .filter((cell) => cell.day === day)
      .sort((x, y) => x.period - y.period);
    if (todays.length === 0) continue;

    const segments: string[] = [];
    let index = 0;
    while (index < todays.length) {
      const start = todays[index];
      let end = start;
      let next = index + 1;
      while (
        next < todays.length &&
        todays[next].kind === start.kind &&
        todays[next].label === start.label &&
        todays[next].period === end.period + 1
      ) {
        end = todays[next];
        next++;
      }
      const run = todays.slice(index, next);
      if (start.kind === "SAME") {
        segments.push(`${periodRange(start.period, end.period)} 같이 듣기`);
      } else if (start.kind === "BUILDING") {
        segments.push(
          `${periodRange(start.period, end.period)} 같은 건물(${start.label})`,
        );
      } else {
        segments.push(`공강 ${run.length}시간`);
      }
      index = next;
    }
    summary[day] = segments.join(" → ");
  }
  return summary;
}
