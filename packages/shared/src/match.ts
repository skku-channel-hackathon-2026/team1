// 「같은 반」 similarity: physical proximity per slot + transition bonuses.
// Pure functions only. Runs inside a single Function call on the Worker and in unit tests.

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
  sameRoom: 1.0, // w1 (× idf)
  sameFloor: 0.45, // w2a
  sameBuilding: 0.25, // w2b
  sharedFree: 0.15, // w3
  chain: 3.0,
  walk: 1.0,
  lunch: 2.0,
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

export interface Walk {
  day: Day;
  fromPeriod: number;
  toPeriod: number;
  fromBuilding: string;
  toBuilding: string;
}

export type OverlapKind = "SAME" | "BUILDING" | "FREE";

/** One highlighted cell of the overlaid timetable. Never reveals the other person's solo classes. */
export interface OverlapCell extends Slot {
  kind: OverlapKind;
  label: string;
  lunch: boolean;
  chain: boolean;
}

export interface ScoreBreakdown {
  sameRoom: number;
  sameBuilding: number;
  sharedFree: number;
  chain: number;
  walk: number;
  lunch: number;
}

export interface MatchResult {
  targetId: string;
  nickname: string;
  department: string;
  campus: Profile["campus"];
  score: number;
  breakdown: ScoreBreakdown;
  proximity: Proximity;
  sameRoom: CourseInstance[]; // distinct shared instances (my copy)
  sameCourseCount: number; // distinct subject+professor pairs
  sameBuilding: BuildingOverlap[];
  sharedFreeSlots: Slot[];
  lunchDays: Day[];
  chains: Chain[];
  walks: Walk[];
  overlapCells: OverlapCell[];
  dailySummary: Partial<Record<Day, string>>;
  reasons: string[];
}

/** Instance rarity within the pool. Smoothed so a class everyone takes still counts a little. */
export function computeIdf(pool: Profile[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const profile of pool) {
    const seen = new Set<string>();
    for (const instance of profile.instances) {
      const id = instanceId(instance);
      if (seen.has(id)) continue;
      seen.add(id);
      counts.set(id, (counts.get(id) ?? 0) + 1);
    }
  }
  const total = Math.max(pool.length, 1);
  const idf = new Map<string, number>();
  for (const [id, count] of counts) idf.set(id, Math.log(1 + total / count));
  return idf;
}

function isClass(
  state: SlotGrid[Day][number],
): state is { kind: "CLASS"; instance: CourseInstance } {
  return state.kind === "CLASS";
}

export function scorePair(
  me: Profile,
  other: Profile,
  idf: Map<string, number>,
  weights: Weights = WEIGHTS,
): MatchResult {
  const mine = buildSlotGrid(me.instances);
  const theirs = buildSlotGrid(other.instances);

  const breakdown: ScoreBreakdown = {
    sameRoom: 0,
    sameBuilding: 0,
    sharedFree: 0,
    chain: 0,
    walk: 0,
    lunch: 0,
  };
  const sameRoomById = new Map<string, CourseInstance>();
  const sameBuilding: BuildingOverlap[] = [];
  const sharedFreeSlots: Slot[] = [];
  const lunchDaySet = new Set<Day>();
  const chains: Chain[] = [];
  const walks: Walk[] = [];
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
          breakdown.sameRoom += weights.sameRoom * (idf.get(idA) ?? 1);
          sameRoomById.set(idA, sa.instance);
          overlapCells.push({
            day,
            period: p,
            kind: "SAME",
            label: sa.instance.subject,
            lunch: false,
            chain: false,
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
            lunch: false,
            chain: false,
          });
        }
      } else if (sa.kind === "FREE" && sb.kind === "FREE") {
        breakdown.sharedFree += weights.sharedFree;
        sharedFreeSlots.push({ day, period: p });
        const lunch = isLunchPeriod(p);
        if (lunch) lunchDaySet.add(day);
        overlapCells.push({
          day,
          period: p,
          kind: "FREE",
          label: lunch ? "점심" : "공강",
          lunch,
          chain: false,
        });
      }
    }

    // Chain: a shared class whose next period is free for both — "수업 끝나고 같이 밥".
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

    // Walk: two consecutive periods where both of us move between the same buildings.
    for (let p = MIN_PERIOD; p < MAX_PERIOD; p++) {
      const [a0, a1, b0, b1] = [a[p], a[p + 1], b[p], b[p + 1]];
      if (!isClass(a0) || !isClass(a1) || !isClass(b0) || !isClass(b1))
        continue;
      const from = buildingKey(me.campus, a0.instance.room);
      const to = buildingKey(me.campus, a1.instance.room);
      if (
        from === buildingKey(other.campus, b0.instance.room) &&
        to === buildingKey(other.campus, b1.instance.room)
      ) {
        walks.push({
          day,
          fromPeriod: p,
          toPeriod: p + 1,
          fromBuilding: buildingName(me.campus, a0.instance.room),
          toBuilding: buildingName(me.campus, a1.instance.room),
        });
      }
    }
  }

  const lunchDays = DAYS.filter((day) => lunchDaySet.has(day));
  breakdown.chain = weights.chain * chains.length;
  breakdown.walk = weights.walk * walks.length;
  breakdown.lunch = weights.lunch * lunchDays.length;
  const round = (value: number) => Math.round(value * 100) / 100;
  for (const key of Object.keys(breakdown) as (keyof ScoreBreakdown)[]) {
    breakdown[key] = round(breakdown[key]);
  }
  const score = round(
    Object.values(breakdown).reduce((sum, value) => sum + value, 0),
  );

  for (const chain of chains) {
    for (const cell of overlapCells) {
      if (
        cell.day === chain.day &&
        (cell.period === chain.period || cell.period === chain.freePeriod)
      ) {
        cell.chain = true;
      }
    }
  }

  const sameRoom = [...sameRoomById.values()];
  const sameCourseCount = new Set(sameRoom.map(courseKey)).size;
  const proximity: Proximity =
    sameRoom.length > 0
      ? "ROOM"
      : sameBuilding.length > 0
        ? "BUILDING"
        : "FREE";

  return {
    targetId: other.memberId,
    nickname: other.nickname,
    department: other.department,
    campus: other.campus,
    score,
    breakdown,
    proximity,
    sameRoom,
    sameCourseCount,
    sameBuilding,
    sharedFreeSlots,
    lunchDays,
    chains,
    walks,
    overlapCells,
    dailySummary: buildDailySummary(overlapCells),
    reasons: buildReasons({
      sameCourseCount,
      sameBuilding,
      sharedFreeSlots,
      lunchDays,
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
  const sameCampus = pool.filter((profile) => profile.campus === me.campus);
  const idfPool = sameCampus.some((profile) => profile.memberId === me.memberId)
    ? sameCampus
    : [...sameCampus, me];
  const idf = computeIdf(idfPool);
  return sameCampus
    .filter((profile) => profile.memberId !== me.memberId)
    .map((profile) => scorePair(me, profile, idf, options.weights))
    .sort((x, y) => y.score - x.score || x.nickname.localeCompare(y.nickname));
}

function formatDays(days: Day[]): string {
  return days.map((day) => DAY_LABELS[day]).join("·");
}

function buildReasons(input: {
  sameCourseCount: number;
  sameBuilding: BuildingOverlap[];
  sharedFreeSlots: Slot[];
  lunchDays: Day[];
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
    reasons.push(`${building}에 같이 있는 교시 ${count}개`);
  } else {
    reasons.push(
      input.sharedFreeSlots.length > 0
        ? `공강 겹침 ${input.sharedFreeSlots.length}시간`
        : "겹치는 공강 없음",
    );
  }
  reasons.push(
    input.lunchDays.length > 0
      ? `${formatDays(input.lunchDays)} 점심 가능`
      : "점심 겹침 없음",
  );
  return reasons;
}

function periodRange(from: number, to: number): string {
  return from === to ? `${from}교시` : `${from}~${to}교시`;
}

/** "수: 2교시 같이 듣고 → 점심 함께 → 4교시 같이 듣고 → 끝나고 공강 1시간" */
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
        segments.push(`${periodRange(start.period, end.period)} 같이 듣고`);
      } else if (start.kind === "BUILDING") {
        segments.push(
          `${periodRange(start.period, end.period)} 같은 건물(${start.label})`,
        );
      } else {
        // "끝나고" only when this free run is a detected chain (right after a shared class),
        // so the sentence can never claim something the score did not count.
        const after = run[0].chain ? "끝나고 " : "";
        if (run.some((cell) => cell.lunch)) segments.push(`${after}점심 함께`);
        else segments.push(`${after}공강 ${run.length}시간`);
      }
      index = next;
    }
    summary[day] = segments.join(" → ");
  }
  return summary;
}
