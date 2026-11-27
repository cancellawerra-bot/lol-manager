// 고용형 코칭스태프. 가상 코치만 쓰며 실존 인물 이름·사진·발언·성격은 넣지 않습니다.
// 미고용(필드 없음·빈 목록)이면 훈련·밴픽·경제 배율이 기본값이라 기존 결과가 그대로입니다.
import type { Side } from "./draft";
import { moneyRound } from "./money";
import { fmtMoney } from "./money";
import type { Save } from "./season";

export const STAFF_ROLES = ["head", "phys", "ops", "cond", "acad"] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];
export const STAFF_GRADES = ["normal", "skilled", "veteran"] as const;
export type StaffGrade = (typeof STAFF_GRADES)[number];

export const STAFF_TRAIN_CAP = 1.10;
export const STAFF_RECOVER_CAP = 1.20;
export const STAFF_FATIGUE_FLOOR = 0.90;
export const STAFF_ADVICE_CAP = 0.30;
export const STAFF_DEFAULT_TEMP = 0.45;

export interface StaffHire { role: StaffRole; id: string; prepaid?: boolean }
export interface StaffState { hires: StaffHire[]; seenOffer?: boolean }

export interface StaffBoost {
  mechanics: number;
  strategy: number;
  recovery: number;
  fatigueLoad: number;
}

export interface StaffCatalogEntry {
  id: string;
  role: StaffRole;
  grade: StaffGrade;
  name: string;
  salary: number;
  train: number;
  recover: number;
  fatigueLoad: number;
  advice: number;
}

const ROLE_META: Record<StaffRole, { label: string; short: string; focus: string }> = {
  head: { label: "수석코치", short: "수석", focus: "밴픽·작전 조언" },
  phys: { label: "피지컬 코치", short: "피지컬", focus: "교전·압박 훈련" },
  ops: { label: "운영 코치", short: "운영", focus: "판단·운영 훈련" },
  cond: { label: "컨디션 코치", short: "컨디션", focus: "멘탈·피로 회복" },
  acad: { label: "2군 감독", short: "2군", focus: "2군 육성" },
};

const GRADE_META: Record<StaffGrade, { label: string; salary: number; train: number; recover: number; fatigueLoad: number; advice: number; letter: string }> = {
  normal: { label: "보통", salary: 1, train: 1.04, recover: 1.08, fatigueLoad: 0.96, advice: 0.10, letter: "A" },
  skilled: { label: "숙련", salary: 2, train: 1.07, recover: 1.14, fatigueLoad: 0.93, advice: 0.20, letter: "B" },
  veteran: { label: "베테랑", salary: 3, train: 1.10, recover: 1.20, fatigueLoad: 0.90, advice: 0.30, letter: "C" },
};

export const STAFF_CATALOG: StaffCatalogEntry[] = STAFF_ROLES.flatMap((role) =>
  STAFF_GRADES.map((grade) => {
    const g = GRADE_META[grade], r = ROLE_META[role];
    return {
      id: `${role}-${grade}`,
      role,
      grade,
      name: `${r.label} ${g.letter}`,
      salary: g.salary,
      train: g.train,
      recover: g.recover,
      fatigueLoad: g.fatigueLoad,
      advice: g.advice,
    };
  }),
);

export const staffRoleLabel = (role: StaffRole): string => ROLE_META[role].label;
export const staffRoleFocus = (role: StaffRole): string => ROLE_META[role].focus;
export const staffGradeLabel = (grade: StaffGrade): string => GRADE_META[grade].label;

export function staffById(id: string): StaffCatalogEntry | undefined {
  return STAFF_CATALOG.find((c) => c.id === id);
}

export function staffHires(s: Save | { staff?: StaffState } | null | undefined): StaffHire[] {
  return s?.staff?.hires ?? [];
}

export function hiredOf(s: Save | { staff?: StaffState } | null | undefined, role: StaffRole): StaffCatalogEntry | undefined {
  const id = staffHires(s).find((h) => h.role === role)?.id;
  return id ? staffById(id) : undefined;
}

export function staffPayroll(s: Save | { staff?: StaffState } | null | undefined): number {
  return moneyRound(staffHires(s).reduce((n, h) => n + (staffById(h.id)?.salary ?? 0), 0));
}

export const IDENTITY_BOOST: StaffBoost = { mechanics: 1, strategy: 1, recovery: 1, fatigueLoad: 1 };

export function staffSessionBoost(s: Save | { staff?: StaffState } | null | undefined): StaffBoost | undefined {
  const phys = hiredOf(s, "phys");
  const ops = hiredOf(s, "ops");
  const cond = hiredOf(s, "cond");
  if (!phys && !ops && !cond) return;
  const out: StaffBoost = { ...IDENTITY_BOOST };
  if (phys) out.mechanics = Math.min(STAFF_TRAIN_CAP, phys.train);
  if (ops) out.strategy = Math.min(STAFF_TRAIN_CAP, ops.train);
  if (cond) {
    out.recovery = Math.min(STAFF_RECOVER_CAP, cond.recover);
    out.fatigueLoad = Math.max(STAFF_FATIGUE_FLOOR, cond.fatigueLoad);
  }
  return out;
}

export function staffAdviceTemp(s: Save | { staff?: StaffState } | null | undefined): number {
  const head = hiredOf(s, "head");
  const advice = Math.min(STAFF_ADVICE_CAP, head?.advice ?? 0);
  return STAFF_DEFAULT_TEMP * (1 - advice);
}

export function staffDraftOpt(s: Save, blue: string, red: string): { sideTemp?: Partial<Record<Side, number>> } | undefined {
  if (!hiredOf(s, "head")) return;
  const temp = staffAdviceTemp(s);
  if (temp === STAFF_DEFAULT_TEMP) return;
  const sideTemp: Partial<Record<Side, number>> = {};
  if (blue === s.team) sideTemp.B = temp;
  if (red === s.team) sideTemp.R = temp;
  return Object.keys(sideTemp).length ? { sideTemp } : undefined;
}

export function staffEffectLines(entry: StaffCatalogEntry): string[] {
  if (entry.role === "head") {
    const temp = STAFF_DEFAULT_TEMP * (1 - Math.min(STAFF_ADVICE_CAP, entry.advice));
    return [`밴픽 자동 선택이 추천 상위안을 더 따릅니다 (조언 정확도 +${Math.round(entry.advice * 100)}%, 선택 온도 ${STAFF_DEFAULT_TEMP}→${temp.toFixed(3)})`];
  }
  if (entry.role === "phys") return [`피지컬 훈련(교전·압박) 효율 +${Math.round((entry.train - 1) * 100)}%`];
  if (entry.role === "ops") return [`운영 훈련(판단·운영) 효율 +${Math.round((entry.train - 1) * 100)}%`];
  if (entry.role === "acad") return [`2군 육성 성장 +${Math.round((entry.train - 1) * 100)}% (1군 훈련·밴픽·경기에는 적용되지 않음, 상한 +${Math.round((STAFF_TRAIN_CAP - 1) * 100)}%)`];
  return [
    `휴식 시 피로 회복 +${Math.round((entry.recover - 1) * 100)}%`,
    `훈련 피로 증가 ×${entry.fatigueLoad.toFixed(2)}`,
  ];
}

export function markStaffOfferSeen(s: Save): void {
  s.staff = s.staff ?? { hires: [] };
  s.staff.seenOffer = true;
}

export function shouldOfferStaff(s: Save): boolean {
  if (s.story?.ended || s.phase === "done" || s.session) return false;
  if (staffHires(s).length > 0) return false;
  return !s.staff?.seenOffer;
}

export function hireStaff(s: Save, id: string): string | null {
  const entry = staffById(id);
  if (!entry) return "그 코치를 찾을 수 없습니다.";
  const cur = hiredOf(s, entry.role);
  if (cur?.id === entry.id) return "이미 고용한 코치입니다.";
  const cash = s.eco?.cash ?? 0;
  if (cash < entry.salary) return `자금이 부족합니다. 연봉 ${fmtMoney(entry.salary)}이 필요하고, 지금 잔고는 ${fmtMoney(cash)}입니다.`;
  s.staff = s.staff ?? { hires: [] };
  s.staff.hires = s.staff.hires.filter((h) => h.role !== entry.role);
  s.staff.hires.push({ role: entry.role, id: entry.id, prepaid: true });
  s.staff.seenOffer = true;
  s.eco.cash = moneyRound(cash - entry.salary);
  return null;
}

export function fireStaff(s: Save, role: StaffRole): string | null {
  if (!hiredOf(s, role)) return "그 자리에는 고용된 코치가 없습니다.";
  s.staff = s.staff ?? { hires: [] };
  s.staff.hires = s.staff.hires.filter((h) => h.role !== role);
  return null;
}

export function dueStaffPayroll(s: Save): number {
  return moneyRound(staffHires(s).filter((h) => !h.prepaid).reduce((n, h) => n + (staffById(h.id)?.salary ?? 0), 0));
}

export function settleStaffPayroll(s: Save): number {
  const due = dueStaffPayroll(s);
  if (due) s.eco.cash = moneyRound((s.eco.cash ?? 0) - due);
  for (const h of staffHires(s)) h.prepaid = false;
  return due;
}

export function hireNews(entry: StaffCatalogEntry, prev?: StaffCatalogEntry): { title: string; body: string } {
  const effects = staffEffectLines(entry).join(" ");
  const swap = prev && prev.id !== entry.id ? ` 기존 ${prev.name}은 계약을 끝냈습니다.` : "";
  return {
    title: `코칭스태프 · ${entry.name} 고용`,
    body: `${entry.name}(${staffGradeLabel(entry.grade)}, ${staffRoleFocus(entry.role)})을 연봉 ${fmtMoney(entry.salary)}에 고용했습니다.${swap} ${effects} 연봉은 게임용 가상 금액이며 지금 자금에서 나갔습니다.`,
  };
}

export function fireNews(entry: StaffCatalogEntry): { title: string; body: string } {
  return {
    title: `코칭스태프 · ${entry.name} 해임`,
    body: `${entry.name} 계약을 끝냈습니다. 이미 나간 연봉은 돌려받지 않습니다. 이 자리의 효과는 더 이상 적용되지 않습니다.`,
  };
}
