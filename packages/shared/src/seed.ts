// Seeded freshmen so the demo never shows an empty screen — 자과캠 소프트웨어학과 1학년 cohort.
// Section catalog: subject + professor + room + weekly meetings. Each meeting is one CourseInstance.
// Against the demo timetable of the same department the overlap is a staircase from a near twin
// (5 of 6 sections) down to nobody-shared, so the list shows the whole range of scores. The top
// candidate produces the Wednesday "class → free → class → free → class" pattern.

import type { Campus, CourseInstance, Day, Profile } from "./timetable.js";

interface Meeting {
  day: Day;
  start: number;
  end?: number;
}

interface Section {
  subject: string;
  professor: string;
  room: string;
  meetings: Meeting[];
}

const twice = (a: Day, b: Day, period: number): Meeting[] => [
  { day: a, start: period },
  { day: b, start: period },
];

const once = (day: Day, period: number): Meeting[] => [{ day, start: period }];

/** Section keys are campus-neutral; each campus fills them with its own courses. */
export type SectionKey =
  | "MAJOR1_A"
  | "MAJOR1_B"
  | "MAJOR1_C"
  | "MAJOR2_A"
  | "MAJOR2_B"
  | "MAJOR2_C"
  | "MAJOR2_D"
  | "MAJOR3_A"
  | "MAJOR3_B"
  | "MAJOR3_C"
  | "ENG_A"
  | "ENG_B"
  | "ENG_C"
  | "ENG_D"
  | "WRI_A"
  | "WRI_B"
  | "WRI_C"
  | "GE_1"
  | "GE_2"
  | "GE_3"
  | "GE_4"
  | "GE_5"
  | "DEPT2_X"
  | "DEPT2_Y"
  | "DEPT3_X"
  | "DEPT3_Y"
  | "DEPT4_X"
  | "DEPT4_Y";

type Catalog = Record<SectionKey, Section>;

// 자과캠 — 소프트웨어학과 1학년. 수성관 05, 제1공학관 21·22·23, 제2공학관 25·26·27, 제1과학관 31,
// 제2과학관 32, 약학관 51, 생명공학관 61. Same slots as 인사캠, different courses and people.
export const SCIENCE_SECTIONS: Catalog = {
  MAJOR1_A: {
    subject: "프로그래밍기초",
    professor: "김태영",
    room: "22301",
    meetings: twice("MON", "WED", 2),
  },
  MAJOR1_B: {
    subject: "프로그래밍기초",
    professor: "박서준",
    room: "22303",
    meetings: twice("TUE", "THU", 2),
  },
  MAJOR1_C: {
    subject: "프로그래밍기초",
    professor: "이하은",
    room: "22401",
    meetings: twice("MON", "WED", 5),
  },
  MAJOR2_A: {
    subject: "이산수학",
    professor: "정수연",
    room: "26205",
    meetings: twice("MON", "WED", 4),
  },
  MAJOR2_B: {
    subject: "이산수학",
    professor: "최민재",
    room: "26206",
    meetings: twice("TUE", "THU", 4),
  },
  MAJOR2_C: {
    subject: "이산수학",
    professor: "한지우",
    room: "26305",
    meetings: twice("MON", "WED", 2),
  },
  MAJOR2_D: {
    subject: "이산수학",
    professor: "오세영",
    room: "26303",
    meetings: twice("TUE", "THU", 2),
  },
  MAJOR3_A: {
    subject: "미적분학",
    professor: "강도윤",
    room: "26301",
    meetings: twice("TUE", "THU", 2),
  },
  MAJOR3_B: {
    subject: "미적분학",
    professor: "윤서아",
    room: "26302",
    meetings: twice("MON", "WED", 4),
  },
  MAJOR3_C: {
    subject: "미적분학",
    professor: "임준혁",
    room: "26401",
    meetings: twice("TUE", "THU", 5),
  },
  ENG_A: {
    subject: "대학영어",
    professor: "Emily Park",
    room: "31207",
    meetings: twice("TUE", "THU", 4),
  },
  ENG_B: {
    subject: "대학영어",
    professor: "Daniel Cho",
    room: "31208",
    meetings: twice("MON", "WED", 3),
  },
  ENG_C: {
    subject: "대학영어",
    professor: "서지민",
    room: "31301",
    meetings: twice("TUE", "THU", 3),
  },
  ENG_D: {
    subject: "대학영어",
    professor: "문가영",
    room: "31302",
    meetings: twice("MON", "WED", 6),
  },
  WRI_A: {
    subject: "글쓰기와 소통",
    professor: "조현우",
    room: "31305",
    meetings: once("FRI", 3),
  },
  WRI_B: {
    subject: "글쓰기와 소통",
    professor: "신예린",
    room: "31306",
    meetings: once("FRI", 2),
  },
  WRI_C: {
    subject: "글쓰기와 소통",
    professor: "배준서",
    room: "31402",
    meetings: once("TUE", 6),
  },
  GE_1: {
    subject: "물리학실험",
    professor: "유진호",
    room: "05301",
    meetings: once("WED", 6),
  },
  GE_2: {
    subject: "인공지능개론",
    professor: "홍성민",
    room: "31405",
    meetings: once("THU", 6),
  },
  GE_3: {
    subject: "일반화학",
    professor: "김나연",
    room: "32201",
    meetings: once("FRI", 5),
  },
  GE_4: {
    subject: "생명과학의 이해",
    professor: "박준영",
    room: "61301",
    meetings: once("MON", 6),
  },
  GE_5: {
    subject: "통계학입문",
    professor: "이수빈",
    room: "26403",
    meetings: once("FRI", 4),
  },
  DEPT2_X: {
    subject: "회로이론",
    professor: "장민석",
    room: "27201",
    meetings: twice("MON", "WED", 2),
  },
  DEPT2_Y: {
    subject: "전자공학기초",
    professor: "김도훈",
    room: "27302",
    meetings: twice("TUE", "THU", 5),
  },
  DEPT3_X: {
    subject: "정역학",
    professor: "노현진",
    room: "25401",
    meetings: twice("MON", "WED", 4),
  },
  DEPT3_Y: {
    subject: "기계제도",
    professor: "송하늘",
    room: "25304",
    meetings: twice("TUE", "THU", 3),
  },
  DEPT4_X: {
    subject: "약학개론",
    professor: "최유리",
    room: "51205",
    meetings: twice("TUE", "THU", 2),
  },
  DEPT4_Y: {
    subject: "유기화학",
    professor: "권민수",
    room: "51303",
    meetings: twice("MON", "WED", 5),
  },
};

export const SECTIONS_BY_CAMPUS: Record<Campus, Catalog> = {
  SCIENCE: SCIENCE_SECTIONS,
};

export const SECTIONS = SCIENCE_SECTIONS;

export function instancesOf(
  keys: SectionKey[],
  campus: Campus = "SCIENCE",
): CourseInstance[] {
  const catalog = SECTIONS_BY_CAMPUS[campus];
  return keys.flatMap((key) => {
    const section = catalog[key];
    return section.meetings.map((meeting) => ({
      subject: section.subject,
      professor: section.professor,
      day: meeting.day,
      startPeriod: meeting.start,
      endPeriod: meeting.end ?? meeting.start,
      room: section.room,
    }));
  });
}

export const DEMO_SECTIONS: SectionKey[] = [
  "MAJOR1_A",
  "MAJOR2_A",
  "MAJOR3_A",
  "ENG_A",
  "WRI_A",
  "GE_1",
];

export interface DemoPreset {
  department: string;
  campus: Campus;
  instances: CourseInstance[];
}

/** One-click demo timetable per campus. Deliberately has no nickname — the user stays themselves. */
export const DEMO_PRESETS: Record<Campus, DemoPreset> = {
  SCIENCE: {
    department: "소프트웨어학과",
    campus: "SCIENCE",
    instances: instancesOf(DEMO_SECTIONS, "SCIENCE"),
  },
};

export const DEMO_PRESET = DEMO_PRESETS.SCIENCE;

/** True when `instances` is exactly one of the demo timetables (used to swap presets on campus change). */
export function matchesDemoPreset(
  instances: CourseInstance[],
  campus: Campus,
): boolean {
  const preset = DEMO_PRESETS[campus].instances;
  if (instances.length !== preset.length) return false;
  const key = (i: CourseInstance) =>
    `${i.subject}|${i.professor}|${i.day}|${i.startPeriod}|${i.endPeriod}|${i.room}`;
  const mine = new Set(instances.map(key));
  return preset.every((instance) => mine.has(key(instance)));
}

// Department slot → real name per campus. DEPT1 is the demo department.
const DEPARTMENTS: Record<Campus, [string, string, string, string]> = {
  SCIENCE: ["소프트웨어학과", "전자전기공학부", "기계공학부", "약학과"],
};

interface SeedSpec {
  dept: 0 | 1 | 2 | 3;
  sections: SectionKey[];
}

// Same-department spread against the demo timetable (sections shared, 6 in the demo):
//   5 shared ×1 · 4 shared ×2 · 3 shared ×3 · 2 shared ×5 · 1 shared ×6 · 0 shared ×6.
// The 0-shared people still cross the demo in the same building or share free periods, so the
// bottom of the list is not empty. Other departments overlap only through 교양.
const SEED_SPECS: SeedSpec[] = [
  // 5 shared — near twin (index 0 → 우주, top of the list; keeps the Wednesday pattern)
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_A", "MAJOR3_A", "ENG_A", "WRI_B", "GE_1"],
  },
  // 4 shared
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_A", "MAJOR3_A", "ENG_C", "WRI_A", "GE_2"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_A", "MAJOR3_C", "ENG_A", "WRI_C", "GE_1"],
  },
  // 3 shared
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_B", "MAJOR3_A", "ENG_B", "WRI_A", "GE_3"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_C", "MAJOR2_A", "MAJOR3_A", "ENG_A", "WRI_B", "GE_4"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_A", "MAJOR3_C", "ENG_C", "WRI_A", "GE_5"],
  },
  // 2 shared
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_A", "MAJOR3_C", "ENG_A", "WRI_B", "GE_2"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_B", "MAJOR3_C", "ENG_B", "WRI_A", "GE_3"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_C", "MAJOR2_D", "MAJOR3_B", "ENG_A", "WRI_A", "GE_2"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_B", "MAJOR3_A", "ENG_B", "WRI_C", "GE_2"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_A", "MAJOR3_C", "ENG_C", "WRI_B", "GE_1"],
  },
  // 1 shared
  {
    dept: 0,
    sections: ["MAJOR1_A", "MAJOR2_B", "MAJOR3_C", "ENG_B", "WRI_B", "GE_4"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_A", "MAJOR3_C", "ENG_D", "WRI_C", "GE_3"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_C", "MAJOR2_B", "MAJOR3_A", "ENG_B", "WRI_B", "GE_5"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_C", "MAJOR3_B", "ENG_A", "WRI_C", "GE_5"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_C", "MAJOR2_D", "MAJOR3_C", "ENG_B", "WRI_A", "GE_4"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_C", "MAJOR3_B", "ENG_C", "WRI_B", "GE_1"],
  },
  // 0 shared — same building / shared free periods only
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_C", "MAJOR3_B", "ENG_C", "WRI_B", "GE_2"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_C", "MAJOR2_D", "MAJOR3_C", "ENG_B", "WRI_B", "GE_4"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_C", "MAJOR3_B", "ENG_D", "WRI_C", "GE_5"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_C", "MAJOR2_B", "MAJOR3_B", "ENG_C", "WRI_C", "GE_3"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_B", "MAJOR2_C", "MAJOR3_C", "ENG_B", "WRI_B", "GE_2"],
  },
  {
    dept: 0,
    sections: ["MAJOR1_C", "MAJOR2_D", "MAJOR3_B", "ENG_D", "WRI_B", "GE_5"],
  },
  // 타 학과 — 교양으로만 겹친다 (2 / 1 / 2 / 0 / 1 / 0 shared)
  { dept: 1, sections: ["DEPT2_X", "DEPT2_Y", "ENG_A", "WRI_A", "GE_2"] },
  { dept: 1, sections: ["DEPT2_X", "DEPT2_Y", "ENG_C", "WRI_B", "GE_1"] },
  { dept: 2, sections: ["DEPT3_X", "DEPT3_Y", "ENG_A", "WRI_C", "GE_1"] },
  { dept: 2, sections: ["DEPT3_X", "DEPT3_Y", "ENG_D", "WRI_B", "GE_3"] },
  { dept: 3, sections: ["DEPT4_X", "DEPT4_Y", "ENG_B", "WRI_A", "GE_4"] },
  { dept: 3, sections: ["DEPT4_X", "DEPT4_Y", "ENG_C", "WRI_C", "GE_5"] },
];

const NICKNAMES: Record<Campus, string[]> = {
  SCIENCE: [
    "우주",
    "새벽",
    "호두",
    "밤톨",
    "라임",
    "코알라",
    "번개",
    "안개",
    "겨울",
    "노랑",
    "강물",
    "바람",
    "모래",
    "유자",
    "솔잎",
    "은빛",
    "제비",
    "조개",
    "낙엽",
    "단풍",
    "서리",
    "풀잎",
    "물결",
    "청포도",
    "감귤",
    "소나기",
    "보름달",
    "연꽃",
    "자몽",
  ],
};

export const SEED_MEMBER_PREFIX = "seed:";

export function isSeedMember(memberId: string): boolean {
  return memberId.startsWith(SEED_MEMBER_PREFIX);
}

function buildCohort(campus: Campus, idPrefix: string): Profile[] {
  return SEED_SPECS.map((spec, index) => ({
    memberId: `${SEED_MEMBER_PREFIX}${idPrefix}${String(index + 1).padStart(2, "0")}`,
    nickname: NICKNAMES[campus][index],
    department: DEPARTMENTS[campus][spec.dept],
    campus,
    includeOtherDepartments: false,
    instances: instancesOf(spec.sections, campus),
  }));
}

/** 29 freshmen on 자과캠. */
export const SEED_PROFILES: Profile[] = buildCohort("SCIENCE", "s");

export function seedProfilesOn(campus: Campus): Profile[] {
  return SEED_PROFILES.filter((profile) => profile.campus === campus);
}
