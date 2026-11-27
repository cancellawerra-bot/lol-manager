// 2군(CL) 육성. 가상 유망주 이름만 쓰며 실존 선수 사진·발언·성격은 넣지 않습니다.
// 미사용(필드 없음·육성 중지·빈 목록)이면 1군 승부·성장·경제 배율이 기본값이라 기존 결과가 그대로입니다.
import { PL } from "../data";
import type { Player, PosIdx } from "../types";
import { moneyRound, fmtMoney } from "./money";
import type { Save } from "./season";
import { hiredOf } from "./staff";
import { trainingSession, potentialFor, type TrainingProgress } from "./training";

export const ACADEMY_LEVELS = ["lean", "standard", "aggressive"] as const;
export type AcademyLevel = (typeof ACADEMY_LEVELS)[number];
export const ACADEMY_GROWTH_CAP = 1.10;
export const ACADEMY_CALLUP_SALARY = 0.5;
export const ACADEMY_START_RATING = 32;
export const POS_KO = ["탑", "정글", "미드", "원딜", "서포터"] as const;

export const ACADEMY_LEVEL_META: Record<AcademyLevel, { label: string; salary: number; growth: number; blurb: string }> = {
  lean: { label: "절제", salary: 0.3, growth: 1.04, blurb: "비용을 낮추고 2군 성장을 조금만 올립니다." },
  standard: { label: "표준", salary: 0.6, growth: 1.07, blurb: "보통 수준의 2군 운영입니다." },
  aggressive: { label: "적극", salary: 1.0, growth: 1.10, blurb: "비용을 더 들이고 2군 성장 상한까지 올립니다." },
};

export interface AcademyFour { fight: number; press: number; judge: number; ops: number }
export interface AcademyProspect {
  key: string;
  person: string;
  name: string;
  pos: PosIdx;
  origin: "virtual" | "demoted";
  letter?: string;
  rating: number;
  four: AcademyFour;
  yearIn: number;
}
export interface AcademyState {
  level?: AcademyLevel;
  prepaid?: boolean;
  prospects: AcademyProspect[];
  seenOffer?: boolean;
}

const FOUR32 = (): AcademyFour => ({ fight: 32, press: 32, judge: 32, ops: 32 });

export function isMainSquad(c: { squad?: string } | null | undefined): boolean {
  return c?.squad !== "cl";
}

export function academyState(s: Save | { academy?: AcademyState } | null | undefined): AcademyState | undefined {
  return s?.academy;
}

export function academyProspects(s: Save | { academy?: AcademyState } | null | undefined): AcademyProspect[] {
  return s?.academy?.prospects ?? [];
}

export function academyLevel(s: Save | { academy?: AcademyState } | null | undefined): AcademyLevel | undefined {
  const lv = s?.academy?.level;
  return lv && (ACADEMY_LEVELS as readonly string[]).includes(lv) ? lv : undefined;
}

export function isAcademyActive(s: Save | { academy?: AcademyState } | null | undefined): boolean {
  return !!academyLevel(s);
}

export function academyPayroll(s: Save | { academy?: AcademyState } | null | undefined): number {
  const lv = academyLevel(s);
  return lv ? moneyRound(ACADEMY_LEVEL_META[lv].salary) : 0;
}

export function academyGrowthBoost(s: Save | { academy?: AcademyState } | null | undefined): number | undefined {
  const lv = academyLevel(s);
  if (!lv) return;
  const base = ACADEMY_LEVEL_META[lv].growth;
  const coach = hiredOf(s as Save, "acad")?.train ?? 1;
  const extra = (base - 1) + (coach - 1);
  return Math.min(ACADEMY_GROWTH_CAP, 1 + extra);
}

export function academyEffectLines(level: AcademyLevel, coachTrain = 1): string[] {
  const g = ACADEMY_LEVEL_META[level].growth;
  const cap = Math.min(ACADEMY_GROWTH_CAP, 1 + (g - 1) + (coachTrain - 1));
  const lines = [`2군 주간 성장 ×${g.toFixed(2)} (상한 ×${ACADEMY_GROWTH_CAP.toFixed(2)})`];
  if (coachTrain > 1) lines.push(`2군 감독 합산 후 ×${cap.toFixed(2)}`);
  return lines;
}

export function markAcademyOfferSeen(s: Save): void {
  s.academy = s.academy ?? { prospects: [] };
  s.academy.seenOffer = true;
}

export function shouldOfferAcademy(s: Save): boolean {
  if (s.mode !== "story" || s.story?.ended || s.phase === "done" || s.session) return false;
  if (isAcademyActive(s) || academyProspects(s).length > 0) return false;
  return !s.academy?.seenOffer;
}

export function hydrateAcademy(s: Save | { academy?: AcademyState } | null | undefined): void {
  if (!s?.academy) return;
  for (const p of s.academy.prospects ?? []) {
    if (p.origin === "virtual" || p.key.startsWith("cl-")) registerProspect(p);
  }
}

function zOf(rating: number): number {
  return (rating - 85) / 4;
}

function registerProspect(p: AcademyProspect): void {
  const z = zOf(p.rating);
  const pl: Player = {
    key: p.key, name: p.name, full: p.name, team: -1, pos: p.pos,
    games: 0, gamesPos: 0, wins: 0, teamsPlayed: {},
    m: { gd: null, csd: null, xpd: null, kda: 0, kp: 0, dpm: 0, dsh: 0, gpm: 0, cspm: 0, vspm: 0, wk: 0, pool: 0 },
    kdaRaw: [0, 0, 0], pool: [],
    z: { lane: z, fight: z, farm: z, vision: 0, pool: 0, ovr: z },
    pct: { lane: 50, fight: 50, farm: 50, vision: 50, pool: 50, ovr: 50 },
    small: true, limited: true, label: "2군 · 공식 시즌 기록 없음",
    rating: p.rating, personKey: p.person,
  };
  PL[p.key] = pl;
}

function nextLetter(used: Set<string>): string {
  for (let n = 0; n < 50; n++) {
    const letter = n < 26 ? String.fromCharCode(65 + n) : `A${String.fromCharCode(65 + (n - 26))}`;
    if (!used.has(letter)) return letter;
  }
  return `X${used.size}`;
}

function usedLetters(s: Save, pos: number): Set<string> {
  const out = new Set<string>();
  for (const p of academyProspects(s)) if (p.pos === pos && p.letter) out.add(p.letter);
  for (const c of s.story?.contracts ?? []) {
    const m = /^cl-[^-]+-(\d+)-([A-Z]+)$/.exec(c.person);
    if (m && Number(m[1]) === pos) out.add(m[2]);
  }
  return out;
}

function makeVirtual(s: Save, pos: PosIdx, letter: string): AcademyProspect {
  const team = (s.team || "CL").toLowerCase();
  const key = `cl-${team}-${pos}-${letter.toLowerCase()}`;
  const p: AcademyProspect = {
    key, person: key, name: `2군 ${POS_KO[pos]} ${letter}`,
    pos, origin: "virtual", letter, rating: ACADEMY_START_RATING, four: FOUR32(),
    yearIn: s.story?.year ?? 2018,
  };
  registerProspect(p);
  return p;
}

export function seedAcademyProspects(s: Save): void {
  s.academy = s.academy ?? { prospects: [] };
  const have = new Set(academyProspects(s).filter((p) => p.origin === "virtual").map((p) => p.pos));
  for (let pos = 0 as PosIdx; pos < 5; pos = (pos + 1) as PosIdx) {
    if (have.has(pos)) continue;
    const letter = nextLetter(usedLetters(s, pos));
    s.academy.prospects.push(makeVirtual(s, pos, letter));
  }
}

export function refillAcademyProspects(s: Save): void {
  if (!isAcademyActive(s)) return;
  seedAcademyProspects(s);
}

export function setAcademyLevel(s: Save, level: AcademyLevel | "off"): string | null {
  if (s.mode !== "story" || !s.story) return "스토리·역사 모드에서만 2군을 운영할 수 있습니다.";
  if (s.story.ended) return "이미 끝난 커리어입니다.";
  const cur = academyLevel(s);
  if (level === "off") {
    if (!cur) {
      s.academy = s.academy ?? { prospects: [] };
      s.academy.level = undefined;
      s.academy.seenOffer = true;
      return null;
    }
    s.academy!.level = undefined;
    s.academy!.prepaid = false;
    s.academy!.seenOffer = true;
    return null;
  }
  const meta = ACADEMY_LEVEL_META[level];
  const prevPay = cur ? ACADEMY_LEVEL_META[cur].salary : 0;
  const due = moneyRound(Math.max(0, meta.salary - (s.academy?.prepaid && cur ? prevPay : 0)));
  const cash = s.eco?.cash ?? 0;
  if (cur === level) return "이미 그 단계로 운영 중입니다.";
  if (cash < due) return `자금이 부족합니다. ${meta.label} 단계에는 ${fmtMoney(due)}이 필요하고, 지금 잔고는 ${fmtMoney(cash)}입니다.`;
  s.academy = s.academy ?? { prospects: [] };
  const first = !cur;
  s.academy.level = level;
  s.academy.prepaid = true;
  s.academy.seenOffer = true;
  if (due) s.eco.cash = moneyRound(cash - due);
  if (first) seedAcademyProspects(s);
  return null;
}

export function dueAcademyPayroll(s: Save): number {
  if (!isAcademyActive(s) || s.academy?.prepaid) return 0;
  return academyPayroll(s);
}

export function settleAcademyPayroll(s: Save): number {
  const due = dueAcademyPayroll(s);
  if (due) s.eco.cash = moneyRound((s.eco.cash ?? 0) - due);
  if (s.academy) s.academy.prepaid = false;
  return due;
}

export function dropAcademyProspect(s: Save, key: string): void {
  if (!s.academy) return;
  s.academy.prospects = s.academy.prospects.filter((p) => p.key !== key && p.person !== key);
}

export function syncAcademyKeys(s: Save, nextKeys: Map<string, string>): void {
  if (!s.academy) return;
  for (const p of s.academy.prospects) {
    const nk = nextKeys.get(p.key);
    if (nk && nk !== p.key) { p.key = nk; }
  }
}

function mainContract(s: Save, key: string) {
  return s.story?.contracts.find((c) => (c.key === key || c.person === key) && c.years > 0 && isMainSquad(c));
}

function clContract(s: Save, key: string) {
  return s.story?.contracts.find((c) => (c.key === key || c.person === key) && c.years > 0 && !isMainSquad(c));
}

export function callUpAcademy(s: Save, key: string): string | null {
  if (!s.story) return "스토리·역사 모드에서만 콜업할 수 있습니다.";
  if (s.story.ended) return "이미 끝난 커리어입니다.";
  const prospect = academyProspects(s).find((p) => p.key === key);
  const demoted = clContract(s, key);
  if (!prospect && !demoted) return "2군에서 그 선수를 찾을 수 없습니다.";
  if (mainContract(s, key)) return "이미 1군 명단에 있습니다.";
  if (demoted) {
    delete demoted.squad;
    dropAcademyProspect(s, demoted.key);
    if (!s.cards.includes(demoted.key)) s.cards = [...s.cards, demoted.key];
    return null;
  }
  const p = prospect!;
  const cash = s.eco?.cash ?? 0;
  if (cash < ACADEMY_CALLUP_SALARY) {
    return `자금이 부족합니다. 콜업 연봉 ${fmtMoney(ACADEMY_CALLUP_SALARY)}이 필요하고, 지금 잔고는 ${fmtMoney(cash)}입니다.`;
  }
  registerProspect(p);
  s.eco.cash = moneyRound(cash - ACADEMY_CALLUP_SALARY);
  s.story.contracts.push({ key: p.key, cardId: p.key, years: 1, salary: ACADEMY_CALLUP_SALARY, person: p.person, prepaid: true });
  if (!s.cards.includes(p.key)) s.cards = [...s.cards, p.key];
  dropAcademyProspect(s, p.key);
  return null;
}

export function demoteToAcademy(s: Save, key: string): string | null {
  if (!s.story) return "스토리·역사 모드에서만 강등할 수 있습니다.";
  if (s.story.ended) return "이미 끝난 커리어입니다.";
  const c = mainContract(s, key);
  if (!c) return "1군 명단에서 그 선수를 찾을 수 없습니다.";
  if (c.key.startsWith("acad-")) return "주전 공백을 메운 연습생은 2군으로 내릴 수 없습니다.";
  c.squad = "cl";
  s.starters[s.team] = (s.starters[s.team] ?? []).map((k) => k === c.key ? "" : k);
  s.cards = (s.cards ?? []).filter((k) => k !== c.key && k !== c.cardId);
  const pl = PL[c.key];
  const pos = (pl?.pos ?? 0) as PosIdx;
  const already = academyProspects(s).some((p) => p.key === c.key);
  if (!already) {
    const rating = pl?.rating ?? ACADEMY_START_RATING;
    s.academy = s.academy ?? { prospects: [] };
    s.academy.prospects.push({
      key: c.key, person: c.person, name: pl?.name ?? c.person, pos, origin: "demoted",
      rating, four: FOUR32(), yearIn: s.story.year,
    });
  }
  return null;
}

export function academyLevelNews(level: AcademyLevel | "off", prev?: AcademyLevel, due = 0): { title: string; body: string } {
  if (level === "off") {
    return {
      title: "2군 육성 투자 중지",
      body: `2군 육성 투자를 멈췄습니다. 이미 나간 비용은 돌아오지 않습니다. 남아 있는 2군 선수는 콜업할 수 있고, 주간 성장과 다음 시즌 육성비는 적용되지 않습니다.`,
    };
  }
  const meta = ACADEMY_LEVEL_META[level];
  const swap = prev && prev !== level ? ` 이전 단계(${ACADEMY_LEVEL_META[prev].label})에서 바꿨습니다.` : "";
  const pay = due ? ` 이번 차감 ${fmtMoney(due)}.` : " 올해 육성비는 이미 냈습니다.";
  return {
    title: `2군 육성 투자 · ${meta.label}`,
    body: `2군 육성 투자를 ${meta.label}(연 ${fmtMoney(meta.salary)}, 성장 ×${meta.growth.toFixed(2)}, 상한 ×${ACADEMY_GROWTH_CAP.toFixed(2)})으로 정했습니다.${swap}${pay} 금액은 게임용 가상 금액입니다. 2군에 있는 선수만 이 성장이 적용되고, 1군 선발·경기에는 콜업한 뒤에만 나갑니다.`,
  };
}

export function callUpNews(name: string, salary: number, firstVirtual: boolean): { title: string; body: string } {
  const pay = firstVirtual ? ` 1군 연봉 ${fmtMoney(salary)}을 지금 자금에서 냈습니다.` : " 기존 계약 연봉은 그대로입니다.";
  return {
    title: `2군 콜업 · ${name}`,
    body: `${name}을(를) 1군 명단으로 올렸습니다.${pay} 이제 선발·벤치와 경기에 넣을 수 있습니다. 선발은 감독이 직접 정합니다.`,
  };
}

export function demoteNews(name: string): { title: string; body: string } {
  return {
    title: `2군 강등 · ${name}`,
    body: `${name}을(를) 2군으로 내렸습니다. 1군 선발과 경기에는 나가지 않습니다. 기존 계약 연봉은 그대로 나갑니다. 다시 쓰려면 콜업하면 됩니다.`,
  };
}

const previousDate = (date: string): string => new Date(Date.parse(date + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const nextDate = (date: string): string => new Date(Date.parse(date + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);

function writeFour(p: AcademyProspect, tr: { phys: number; brain: number }): void {
  const phys = Math.max(0, Math.min(100, Math.round(tr.phys)));
  const brain = Math.max(0, Math.min(100, Math.round(tr.brain)));
  p.four = { fight: phys, press: phys, judge: brain, ops: brain };
}

/** 육성 중이 아니면 바로 반환해 1군 훈련·난수를 건드리지 않습니다. */
export function advanceAcademyTraining(s: Save, date: string): void {
  if (!isAcademyActive(s) || s.mode !== "story" || !s.training) return;
  const boostN = academyGrowthBoost(s) ?? 1;
  const boost = boostN === 1 ? undefined : { mechanics: boostN, strategy: boostN, recovery: 1, fatigueLoad: 1 };
  const state = s.training;
  hydrateAcademy(s);
  for (const prosp of academyProspects(s)) {
    const person = prosp.person;
    let p: TrainingProgress = state.players[person] ?? { person, mechanicsXp: 0, strategyXp: 0, fatigue: 0, lastDate: previousDate(date) };
    if (p.lastDate && p.lastDate >= date) continue;
    const pl = PL[prosp.key];
    const base = pl?.rating ?? prosp.rating;
    for (let day = nextDate(p.lastDate ?? previousDate(date)); day <= date; day = nextDate(day)) {
      const weekday = (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
      const kind = weekday === 6 ? "recovery" : weekday % 2 === 0 ? "mechanics" : "strategy";
      const ctx = { base, potential: potentialFor(), speed: 1 };
      p = trainingSession(p, kind, day, undefined, ctx, boost).progress;
    }
    state.players[person] = p;
    writeFour(prosp, academyDisplay(base, p));
  }
}

/** 2군은 시작 32라 1군 표시 하한 60을 쓰지 않습니다. 성장 상한 100은 같습니다. */
export function academyDisplay(base: number, prog?: TrainingProgress): { phys: number; brain: number; overall: number; base: number } {
  const p = prog ?? { person: "", mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
  const phys = Math.max(0, Math.min(100, base + (p.physGain ?? 0)));
  const brain = Math.max(0, Math.min(100, base + (p.brainGain ?? 0)));
  return { phys, brain, overall: Math.min(100, Math.round((phys + brain) / 2)), base };
}

export function academyTrained(s: Save, prosp: AcademyProspect): { phys: number; brain: number; overall: number; base: number } {
  const person = prosp.person;
  const prog = s.training?.players[person] ?? { person, mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
  return academyDisplay(prosp.rating, prog);
}
