// 「같은 반」 core timetable types and helpers.
// Shared by the Worker (scoring) and the WAM (rendering), so keep this file pure.

export const DAYS = ["MON", "TUE", "WED", "THU", "FRI"] as const;
export type Day = (typeof DAYS)[number];

export const DAY_LABELS: Record<Day, string> = {
  MON: "월",
  TUE: "화",
  WED: "수",
  THU: "목",
  FRI: "금",
};

export const MIN_PERIOD = 1;
export const MAX_PERIOD = 10;

// 75-minute periods with a 15-minute break, following the SKKU timetable.
export const PERIOD_TIMES: Record<number, { start: string; end: string }> = {
  1: { start: "09:00", end: "10:15" },
  2: { start: "10:30", end: "11:45" },
  3: { start: "12:00", end: "13:15" },
  4: { start: "13:30", end: "14:45" },
  5: { start: "15:00", end: "16:15" },
  6: { start: "16:30", end: "17:45" },
  7: { start: "18:00", end: "19:15" },
  8: { start: "19:30", end: "20:45" },
  9: { start: "21:00", end: "22:15" },
  10: { start: "22:30", end: "23:45" },
};

// Single campus by team decision: the app serves 자과캠(율전) only, so nothing in the UI
// asks about campus. The field stays in the data model so a second campus can return later.
export const CAMPUSES = ["SCIENCE"] as const;
export type Campus = (typeof CAMPUSES)[number];

export const CAMPUS_LABELS: Record<Campus, string> = {
  SCIENCE: "자과캠 (율전)",
};

export interface CourseInstance {
  subject: string;
  professor: string;
  day: Day;
  startPeriod: number;
  endPeriod: number;
  room: string; // 5 digits: building(2) + floor(1) + room(2), e.g. "31207"
}

export interface Profile {
  memberId: string;
  nickname: string;
  department: string;
  campus: Campus;
  includeOtherDepartments: boolean;
  instances: CourseInstance[];
  updatedAt?: string;
}

/** A course instance is the unit of "sitting in the same room at the same time". */
export function instanceId(instance: CourseInstance): string {
  return [
    instance.subject.trim(),
    instance.professor.trim(),
    instance.day,
    instance.startPeriod,
  ].join("|");
}

/** Distinct course (subject + professor) — used for "같은 수업 n개" wording. */
export function courseKey(instance: CourseInstance): string {
  return `${instance.subject.trim()}|${instance.professor.trim()}`;
}

// Building codes reuse the same two digits across campuses, so the table is keyed by campus.
// One building can own several codes (e.g. 제1공학관 = 21·22·23), so grouping uses the name.
export const BUILDINGS: Record<Campus, Record<string, string>> = {
  SCIENCE: {
    "05": "수성관",
    "21": "제1공학관",
    "22": "제1공학관",
    "23": "제1공학관",
    "25": "제2공학관",
    "26": "제2공학관",
    "27": "제2공학관",
    "31": "제1과학관",
    "32": "제2과학관",
    "51": "약학관",
    "61": "생명공학관",
    "62": "생명공학관",
    "71": "의학관",
  },
};

export function buildingCode(room: string): string {
  return room.trim().slice(0, 2);
}

export function floorOf(room: string): string {
  return room.trim().charAt(2);
}

export function buildingName(campus: Campus, room: string): string {
  const code = buildingCode(room);
  return BUILDINGS[campus][code] ?? `${code}번 건물`;
}

/** Campus + building name. Never compare building codes across campuses. */
export function buildingKey(campus: Campus, room: string): string {
  return `${campus}:${buildingName(campus, room)}`;
}

export type SlotState =
  | { kind: "CLASS"; instance: CourseInstance }
  | { kind: "FREE" }
  | { kind: "NONE" };

/** Day → period (1..MAX_PERIOD) → state. Index 0 is unused. */
export type SlotGrid = Record<Day, SlotState[]>;

/** Periods before the first class and after the last class that still count as 공강. */
export const FREE_MARGIN = 1;

/**
 * Expand instances to a week grid.
 * FREE = an empty period between the first and last class of that day, plus one period
 * right before the first class and one right after the last (people arrive early and linger
 * after class, so that hour is when you can actually meet). Anything further out is NONE.
 */
export function buildSlotGrid(instances: CourseInstance[]): SlotGrid {
  const grid = {} as SlotGrid;
  for (const day of DAYS) {
    const row: SlotState[] = Array.from({ length: MAX_PERIOD + 1 }, () => ({
      kind: "NONE",
    }));
    const todays = instances.filter((instance) => instance.day === day);
    for (const instance of todays) {
      for (let p = instance.startPeriod; p <= instance.endPeriod; p++) {
        if (p >= MIN_PERIOD && p <= MAX_PERIOD)
          row[p] = { kind: "CLASS", instance };
      }
    }
    if (todays.length > 0) {
      const first = Math.max(
        MIN_PERIOD,
        Math.min(...todays.map((i) => i.startPeriod)) - FREE_MARGIN,
      );
      const last = Math.min(
        MAX_PERIOD,
        Math.max(...todays.map((i) => i.endPeriod)) + FREE_MARGIN,
      );
      for (let p = first; p <= last; p++) {
        if (row[p].kind === "NONE") row[p] = { kind: "FREE" };
      }
    }
    grid[day] = row;
  }
  return grid;
}

/** Highest period that any instance touches, so grids can stay compact. */
export function lastPeriodOf(instances: CourseInstance[], minimum = 6): number {
  return Math.max(minimum, ...instances.map((instance) => instance.endPeriod));
}
