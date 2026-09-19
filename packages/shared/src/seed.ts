// Seeded freshmen so the demo never shows an empty screen.
// Section catalog: subject + professor + room + weekly meetings. Each meeting is one CourseInstance.
// Distribution against the demo preset (same department): 2 people share ≥3 instances,
// 8 people share 1–2, everyone else shares 0. 하늘 is designed to produce the Wednesday chain.

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

export const SECTIONS = {
  // 경영학과 전공 (직권배정 분반)
  MGMT_A: {
    subject: "경영학원론",
    professor: "김예진",
    room: "33302",
    meetings: twice("MON", "WED", 2),
  },
  MGMT_B: {
    subject: "경영학원론",
    professor: "오정민",
    room: "33304",
    meetings: twice("TUE", "THU", 2),
  },
  MGMT_C: {
    subject: "경영학원론",
    professor: "임하늘",
    room: "33401",
    meetings: twice("MON", "WED", 5),
  },
  ACC_A: {
    subject: "회계원리",
    professor: "박성훈",
    room: "32205",
    meetings: twice("MON", "WED", 4),
  },
  ACC_B: {
    subject: "회계원리",
    professor: "유재석",
    room: "32206",
    meetings: twice("TUE", "THU", 4),
  },
  ACC_C: {
    subject: "회계원리",
    professor: "강민호",
    room: "32305",
    meetings: twice("MON", "WED", 2),
  },
  ACC_D: {
    subject: "회계원리",
    professor: "신혜원",
    room: "32303",
    meetings: twice("TUE", "THU", 2),
  },
  ECON_A: {
    subject: "경제학원론",
    professor: "이수민",
    room: "32301",
    meetings: twice("TUE", "THU", 2),
  },
  ECON_B: {
    subject: "경제학원론",
    professor: "장미란",
    room: "32302",
    meetings: twice("MON", "WED", 4),
  },
  ECON_C: {
    subject: "경제학원론",
    professor: "서준호",
    room: "32401",
    meetings: twice("TUE", "THU", 5),
  },
  // 교양 (타 학과와 공유)
  ENG_A: {
    subject: "대학영어",
    professor: "Sarah Kim",
    room: "31207",
    meetings: twice("TUE", "THU", 4),
  },
  ENG_B: {
    subject: "대학영어",
    professor: "James Lee",
    room: "31208",
    meetings: twice("MON", "WED", 3),
  },
  ENG_C: {
    subject: "대학영어",
    professor: "홍유진",
    room: "31301",
    meetings: twice("TUE", "THU", 3),
  },
  ENG_D: {
    subject: "대학영어",
    professor: "김도현",
    room: "31302",
    meetings: twice("MON", "WED", 6),
  },
  WRI_A: {
    subject: "글쓰기와 소통",
    professor: "한지원",
    room: "31305",
    meetings: [{ day: "FRI", start: 3 }],
  },
  WRI_B: {
    subject: "글쓰기와 소통",
    professor: "문선영",
    room: "31306",
    meetings: [{ day: "FRI", start: 2 }],
  },
  WRI_C: {
    subject: "글쓰기와 소통",
    professor: "배지훈",
    room: "31402",
    meetings: [{ day: "TUE", start: 6 }],
  },
  GE_CT: {
    subject: "컴퓨팅사고와 SW코딩",
    professor: "오세훈",
    room: "61301",
    meetings: [{ day: "WED", start: 6 }],
  },
  GE_PHIL: {
    subject: "철학의 이해",
    professor: "김철수",
    room: "31405",
    meetings: [{ day: "THU", start: 6 }],
  },
  GE_PSY: {
    subject: "심리학개론",
    professor: "이나영",
    room: "50201",
    meetings: [{ day: "FRI", start: 5 }],
  },
  GE_LAW: {
    subject: "법과 사회",
    professor: "정의철",
    room: "20301",
    meetings: [{ day: "MON", start: 6 }],
  },
  GE_STAT: {
    subject: "통계학입문",
    professor: "배수지",
    room: "32403",
    meetings: [{ day: "FRI", start: 4 }],
  },
  // 타 학과 전공
  ECON_MICRO: {
    subject: "미시경제학원론",
    professor: "조민수",
    room: "32304",
    meetings: twice("MON", "WED", 2),
  },
  ECON_MATH: {
    subject: "경제수학",
    professor: "권혁진",
    room: "32402",
    meetings: twice("TUE", "THU", 5),
  },
  SOC_INTRO: {
    subject: "사회학개론",
    professor: "윤태호",
    room: "31401",
    meetings: twice("MON", "WED", 4),
  },
  SOC_SURVEY: {
    subject: "사회조사입문",
    professor: "김보라",
    room: "31304",
    meetings: twice("TUE", "THU", 3),
  },
  GL_LEAD: {
    subject: "리더십의 이해",
    professor: "최우영",
    room: "20205",
    meetings: twice("TUE", "THU", 2),
  },
  GL_POLI: {
    subject: "정치학개론",
    professor: "박정훈",
    room: "20303",
    meetings: twice("MON", "WED", 5),
  },
  // 자과캠 (하드 필터 확인용 — 같은 건물 번호라도 캠퍼스가 다르면 제외)
  SW_PROG: {
    subject: "프로그래밍기초",
    professor: "김태영",
    room: "32201",
    meetings: twice("MON", "WED", 2),
  },
  SW_DISC: {
    subject: "이산수학",
    professor: "정수연",
    room: "31305",
    meetings: twice("TUE", "THU", 3),
  },
  SW_ENG: {
    subject: "대학영어",
    professor: "Emily Park",
    room: "31207",
    meetings: twice("TUE", "THU", 4),
  },
} satisfies Record<string, Section>;

export type SectionKey = keyof typeof SECTIONS;

export function instancesOf(keys: SectionKey[]): CourseInstance[] {
  return keys.flatMap((key) => {
    const section: Section = SECTIONS[key];
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
  "MGMT_A",
  "ACC_A",
  "ECON_A",
  "ENG_A",
  "WRI_A",
  "GE_CT",
];

/** One-click demo timetable. Deliberately has no nickname — the user stays themselves. */
export const DEMO_PRESET = {
  department: "경영학과",
  campus: "HUMANITIES" as Campus,
  instances: instancesOf(DEMO_SECTIONS),
};

interface SeedSpec {
  nickname: string;
  department: string;
  campus?: Campus;
  sections: SectionKey[];
}

const SEED_SPECS: SeedSpec[] = [
  // 같은 인스턴스 3개 이상 (2명)
  {
    nickname: "하늘",
    department: "경영학과",
    sections: ["MGMT_A", "ACC_A", "ECON_C", "ENG_C", "WRI_B", "GE_CT"],
  },
  {
    nickname: "도윤",
    department: "경영학과",
    sections: ["MGMT_A", "ECON_A", "ENG_B", "ACC_B", "WRI_C", "GE_PHIL"],
  },
  // 1~2개 (8명)
  {
    nickname: "봄비",
    department: "경영학과",
    sections: ["MGMT_A", "ACC_B", "ECON_C", "ENG_C", "WRI_C", "GE_PSY"],
  },
  {
    nickname: "초코",
    department: "경영학과",
    sections: ["ACC_A", "MGMT_B", "ECON_C", "ENG_B", "WRI_B", "GE_PHIL"],
  },
  {
    nickname: "새싹",
    department: "경영학과",
    sections: ["ECON_A", "MGMT_C", "ACC_B", "ENG_B", "WRI_B", "GE_LAW"],
  },
  {
    nickname: "감자",
    department: "경영학과",
    sections: ["ENG_A", "MGMT_B", "ACC_C", "ECON_B", "WRI_C", "GE_STAT"],
  },
  {
    nickname: "구름",
    department: "경영학과",
    sections: ["WRI_A", "MGMT_B", "ACC_C", "ECON_C", "ENG_D", "GE_PHIL"],
  },
  {
    nickname: "달빛",
    department: "경영학과",
    sections: ["GE_CT", "MGMT_C", "ACC_B", "ECON_B", "ENG_C", "WRI_B"],
  },
  {
    nickname: "여름",
    department: "경영학과",
    sections: ["WRI_A", "GE_CT", "MGMT_B", "ACC_C", "ECON_B", "ENG_C"],
  },
  {
    nickname: "노을",
    department: "경영학과",
    sections: ["ACC_A", "MGMT_B", "ECON_C", "ENG_D", "WRI_C", "GE_PSY"],
  },
  // 0개 — 같은 학과
  {
    nickname: "바다",
    department: "경영학과",
    sections: ["MGMT_B", "ACC_C", "ECON_B", "ENG_C", "WRI_B", "GE_PHIL"],
  },
  {
    nickname: "산들",
    department: "경영학과",
    sections: ["MGMT_C", "ACC_D", "ECON_C", "ENG_B", "WRI_B", "GE_LAW"],
  },
  {
    nickname: "라떼",
    department: "경영학과",
    sections: ["MGMT_B", "ACC_C", "ECON_B", "ENG_D", "WRI_C", "GE_STAT"],
  },
  {
    nickname: "모카",
    department: "경영학과",
    sections: ["MGMT_C", "ACC_B", "ECON_B", "ENG_C", "WRI_C", "GE_PSY"],
  },
  {
    nickname: "솔방울",
    department: "경영학과",
    sections: ["MGMT_B", "ACC_C", "ECON_C", "ENG_B", "WRI_B", "GE_PHIL"],
  },
  {
    nickname: "은하",
    department: "경영학과",
    sections: ["MGMT_C", "ACC_D", "ECON_B", "ENG_D", "WRI_B", "GE_STAT"],
  },
  {
    nickname: "참새",
    department: "경영학과",
    sections: ["MGMT_B", "ACC_C", "ECON_B", "ENG_C", "WRI_C", "GE_LAW"],
  },
  {
    nickname: "무지개",
    department: "경영학과",
    sections: ["MGMT_C", "ACC_B", "ECON_C", "ENG_B", "WRI_B", "GE_PSY"],
  },
  {
    nickname: "조약돌",
    department: "경영학과",
    sections: ["MGMT_B", "ACC_C", "ECON_B", "ENG_D", "WRI_B", "GE_PHIL"],
  },
  {
    nickname: "도토리",
    department: "경영학과",
    sections: ["MGMT_C", "ACC_D", "ECON_C", "ENG_B", "WRI_C", "GE_LAW"],
  },
  {
    nickname: "이슬",
    department: "경영학과",
    sections: ["MGMT_B", "ACC_C", "ECON_B", "ENG_C", "WRI_B", "GE_STAT"],
  },
  {
    nickname: "나무",
    department: "경영학과",
    sections: ["MGMT_C", "ACC_B", "ECON_B", "ENG_D", "WRI_C", "GE_PHIL"],
  },
  {
    nickname: "파도",
    department: "경영학과",
    sections: ["MGMT_B", "ACC_C", "ECON_C", "ENG_B", "WRI_C", "GE_PSY"],
  },
  // 타 학과 (인사캠) — 교양으로만 겹친다
  {
    nickname: "민트",
    department: "경제학과",
    sections: ["ECON_MICRO", "ECON_MATH", "ENG_A", "WRI_A", "GE_PHIL"],
  },
  {
    nickname: "코코",
    department: "경제학과",
    sections: ["ECON_MICRO", "ECON_MATH", "ENG_C", "WRI_B", "GE_CT"],
  },
  {
    nickname: "하루",
    department: "사회학과",
    sections: ["SOC_INTRO", "SOC_SURVEY", "ENG_A", "WRI_C", "GE_PHIL"],
  },
  {
    nickname: "별",
    department: "사회학과",
    sections: ["SOC_INTRO", "SOC_SURVEY", "ENG_D", "WRI_B", "GE_PSY"],
  },
  {
    nickname: "연두",
    department: "글로벌리더학부",
    sections: ["GL_LEAD", "GL_POLI", "ENG_B", "WRI_A", "GE_LAW"],
  },
  {
    nickname: "루비",
    department: "글로벌리더학부",
    sections: ["GL_LEAD", "GL_POLI", "ENG_C", "WRI_C", "GE_STAT"],
  },
  // 자과캠 — 하드 필터로 제외되어야 한다
  {
    nickname: "우주",
    department: "소프트웨어학과",
    campus: "SCIENCE",
    sections: ["SW_PROG", "SW_DISC", "SW_ENG"],
  },
];

export const SEED_MEMBER_PREFIX = "seed:";

export function isSeedMember(memberId: string): boolean {
  return memberId.startsWith(SEED_MEMBER_PREFIX);
}

export const SEED_PROFILES: Profile[] = SEED_SPECS.map((spec, index) => ({
  memberId: `${SEED_MEMBER_PREFIX}${String(index + 1).padStart(2, "0")}`,
  nickname: spec.nickname,
  department: spec.department,
  campus: spec.campus ?? "HUMANITIES",
  includeOtherDepartments: false,
  instances: instancesOf(spec.sections),
}));
