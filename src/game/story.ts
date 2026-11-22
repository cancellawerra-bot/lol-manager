// 프랜차이즈 스토리 모드: 2018 2부 창단 → 승강전 → 2021 프랜차이즈 → 2027 월즈 클리어
import { CARDS, CARDS_BY_PERSON, PL, TM, cardLabel } from "../data";
import type { SeasonCard, Team } from "../types";
import { playerFromCard } from "./cards";
import { Rng } from "./rng";
import type { Day, Economy, Save, SeriesRec } from "./season";
import type { StoveState } from "./stove";
import { addNews, dateKo, simSeries, standings } from "./season";
import { moneyRound, fmtMoney } from "./money";
import { drawSwissRound, drawSwissKnockout, swissRows, type SwissState } from "./swiss";
import { beginTrainingPeriod, advanceTeamTraining } from "./trainingRuntime";
import { prepareInSeason } from "./inSeason";
import { syncPromises } from "./rotation";
import { initializeClubTimeline, archiveClubSplit } from "./clubTimeline";
import { cardRating } from "../rating";

/** 로케일·객체 삽입 순서에 의존하지 않는 비교. Node와 브라우저에서 같은 시드가 같은 결과가 나게 합니다. */
export const cmpStr = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
export const cmpCard = (a: SeasonCard, b: SeasonCard): number => cmpStr(a.pkey, b.pkey) || cmpStr(a.id, b.id);

export const STORY_START = 2018;
export const STORY_END = 2027;
export const STORY_BUDGETS = { easy: 5, normal: 3.2, hard: 2 } as const;
/** 2부 전형 연봉 하한·상한(억). 평균은 0.2–0.5억(2천만~5천만 원), 이름 있는 선수는 최대 약 2억. */
export const CK_SALARY_MIN = 0.2;
export const CK_SALARY_MAX = 2;
export const CK_OPS = 0.25; // 2부 연간 운영비(연습실·스태프 등, 억)
export const FRANCHISE_BUYIN = { easy: 3.5, normal: 6, hard: 9 } as const;
export const LCK_SHARE = 70; // 2021+ LCK 프랜차이즈 중계·배분(억)
export const LCK_SHARE_PRE = 25; // 2018–2020 LCK 중계 배분(억)
export const LCK_SPONSOR = 40; // LCK 기본 스폰서·미디어 수입(억). 2부 계약을 승격 시 이 규모로 올립니다.
export const LCK_OPS = 8; // LCK 연간 운영비(억)
export const LCK_PRIZE = [30, 22, 16, 12, 10, 10, 7, 7, 5, 5] as const; // 서머 정규 순위 상금(억)
export const LCK_PAYROLL_SOFT = 115; // 2021 이후 자동 감독 권고 총액. LCK 중위 연간 수입(~112억)에 맞춥니다.
export const LCK_PAYROLL_SOFT_PRE = 70; // 프랜차이즈 전(2020 시즌까지) 권고 총액. 배분 25억대 수입(~67–87억)에 맞춥니다.
export const RELEASE_OVR = 55; // 만료 시 이 미만이면 재계약하지 않습니다.
export const REPLACE_OVR = 55; // 자동 감독이 이 미만 주전을 먼저 교체합니다.
/** 쉬움에서만 잔고가 있으면 종합 60 미만도 교체·만료 방출합니다. 보통·어려움은 55. */
export const REPLACE_OVR_EASY = 60;
export const CASH_BANKRUPT = -5; // 이 이하 적자면 해임·파산
/** 월즈·MSI 해외 시드 추정 종합. 기본 밴드에 난이도별 추정 전력 보정을 적용합니다. */
export const INTL_BAND = { s1: 80, s2: 74, s3: 69, rest: 58 } as const;
export const INTL_BAND_DELTA = { easy: -16, normal: -8, hard: 5 } as const;
/** AI 구단의 주간 FA 예산 배수. 보통은 기존과 같고, 쉬움은 덜 쓰고 어려움은 더 씁니다. */
export const AI_FA_BUDGET_MULT = { easy: 0.55, normal: 1, hard: 1.5 } as const;

/** 오프시즌이면 다음 시즌, 시즌 중이면 올해. 연봉 한도와 로스터 연도에 씁니다. */
export function payrollYear(s: Save): number {
  const st = s.story;
  if (!st) return STORY_START;
  if (["awards", "tryout", "expiry", "stove", "franchise"].includes(st.phase)) return st.year + 1;
  return st.year;
}
export function payrollSoftCap(s: Save, tier?: Tier): number {
  const t = tier ?? s.story?.tier ?? "CK";
  if (t !== "LCK") return 2.8;
  return payrollYear(s) <= 2020 ? LCK_PAYROLL_SOFT_PRE : LCK_PAYROLL_SOFT;
}
/** 이번 정산에서 나갈, 아직 선납하지 않은 기존 연봉. exceptKey는 이번 입찰로 교체할 주전입니다. */
export function upcomingSalaryDue(contracts: Contract[], exceptKey?: string): number {
  return moneyRound(contracts.filter((c) => !c.prepaid && c.key !== exceptKey).reduce((n, c) => n + c.salary, 0));
}
export function storyDiff(s: Save): StoryDiff {
  return s.eco?.difficulty ?? "normal";
}
/** 만료 방출·주전 교체 기준. 쉬움은 잔고가 있을 때 더 적극적으로 바꿉니다. */
export function replaceOvrOf(s: Save): number {
  return storyDiff(s) === "easy" ? REPLACE_OVR_EASY : REPLACE_OVR;
}
export function intlGhostBand(tag: string, diff: StoryDiff = "normal"): number {
  const base = /LPL-1/.test(tag) ? INTL_BAND.s1 : /LPL-2|LEC-1/.test(tag) ? INTL_BAND.s2 : /LPL|LEC-2|LCS-1/.test(tag) ? INTL_BAND.s3 : INTL_BAND.rest;
  return Math.max(40, Math.min(95, base + INTL_BAND_DELTA[diff]));
}
export const DECAY_PCT = 15; // 해당 연도 공식 카드가 없을 때만 적용. 데이터 마지막 해(2026) 카드는 2027에도 그대로 씁니다.
export { fmtMoney };
export type StoryDiff = keyof typeof STORY_BUDGETS;
export type Tier = "LCK" | "CK";
export type Split = "spring" | "summer";
export type StoryPhase =
  | "regular" | "playoffs" | "promo" | "rtm" | "msi" | "worlds"
  | "awards" | "tryout" | "expiry" | "stove" | "franchise" | "clear" | "fail" | "bankrupt";

export interface EraTeam { short: string; ko: string; name: string; color: string }
export interface Contract { key: string; cardId: string; years: number; salary: number; person: string; prepaid?: boolean }
export interface PromoState {
  wb: [string, string][]; // remaining or completed markers via series
  lck9: string; lck10: string; ck1: string; ck2: string;
  step: "wbr1" | "wbf" | "lbr1" | "lbf" | "done";
  wbw?: [string, string]; // winners of r1
  lbl?: [string, string]; // losers of r1
  wbfW?: string; wbfL?: string;
  lbr1W?: string; lbr1L?: string;
  stay: string[]; // LCK next split
  down: string[];
}
export interface StoryState {
  year: number; split: Split; tier: Tier;
  phase: StoryPhase;
  lck: string[]; ck: string[];
  franchised: boolean;
  buyInOffered?: boolean; buyInPaid?: boolean; buyInRefused?: boolean;
  trophies: { lck: number; msi: number; worlds: number };
  contracts: Contract[];
  stove?: StoveState;
  worldsChamp?: string;
  swiss?: SwissState;
  ended?: "clear" | "fail" | "bankrupt";
  note?: string;
  /** 최근 스플릿 정규 순위(1부터). 일정 교체 후에도 상금·시드에 씁니다. */
  lastRank?: number;
  /** 최근 스플릿 월즈/MSI 시드: 우승 → 준우승 → 정규 순위. */
  splitSeeds?: string[];
  deficitYears?: number;
  financeWarn?: "low" | "deficit";
  /** AI 로스터를 마지막으로 짠 시즌 연도. 같은 해에 다시 호출하면 유지합니다. */
  worldBuiltYear?: number;
}

export const STORY_BUDGET_NOTE = "기본 자금(창단 한도)은 쉬움 5억, 보통 3.2억, 어려움 2억입니다. 개막 로스터 연봉은 시작할 때 차감합니다. 모두 게임용 가상 금액입니다.";

const T = (short: string, ko: string, name: string, color: string): EraTeam => ({ short, ko, name, color });

/** 연도별 LCK 10구단. 명칭은 그해 실사용에 가깝게, 로고는 없음. */
const LCK_BY_YEAR: Record<number, EraTeam[]> = {
  2018: [
    T("KT", "kt 롤스터", "KT Rolster", "#E4002B"),
    T("KZ", "킹존 드래곤X", "Kingzone DragonX", "#0B1B3F"),
    T("GEN", "젠지", "Gen.G", "#AA8A40"),
    T("SKT", "SK텔레콤 T1", "SK Telecom T1", "#E2012D"),
    T("AF", "아프리카 프릭스", "Afreeca Freecs", "#1D63ED"),
    T("JAG", "진에어 그린윙스", "Jin Air Green Wings", "#1BAFDB"),
    T("ROX", "ROX 타이거즈", "ROX Tigers", "#F26522"),
    T("BBQ", "bbq 올리버스", "bbq Olivers", "#F26322"),
    T("MVP", "MVP", "MVP", "#7A1F1F"),
    T("GRF", "그리핀", "Griffin", "#C5A572"),
  ],
  2019: [
    T("SKT", "SK텔레콤 T1", "SK Telecom T1", "#E2012D"),
    T("GRF", "그리핀", "Griffin", "#C5A572"),
    T("KZ", "킹존 드래곤X", "Kingzone DragonX", "#0B1B3F"),
    T("GEN", "젠지", "Gen.G", "#AA8A40"),
    T("KT", "kt 롤스터", "KT Rolster", "#E4002B"),
    T("AF", "아프리카 프릭스", "Afreeca Freecs", "#1D63ED"),
    T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"),
    T("JAG", "진에어 그린윙스", "Jin Air Green Wings", "#1BAFDB"),
    T("DWG", "담원 게이밍", "DAMWON Gaming", "#0B3B8C"),
    T("SB", "샌드박스 게이밍", "SANDBOX Gaming", "#5B8C2A"),
  ],
  2020: [
    T("T1", "T1", "T1", "#E2012D"),
    T("GEN", "젠지", "Gen.G", "#AA8A40"),
    T("DWG", "담원 게이밍", "DAMWON Gaming", "#0B3B8C"),
    T("DRX", "DRX", "DRX", "#5B8DEF"),
    T("KT", "kt 롤스터", "KT Rolster", "#E4002B"),
    T("AF", "아프리카 프릭스", "Afreeca Freecs", "#1D63ED"),
    T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"),
    T("SB", "샌드박스 게이밍", "SANDBOX Gaming", "#5B8C2A"),
    T("DYN", "팀 다이내믹스", "Team Dynamics", "#2A6F97"),
    T("SP", "설해원 프린스", "SeolHaeOne Prince", "#6C4AB6"),
  ],
  2021: [
    T("DK", "담원 기아", "DWG KIA", "#0B3B8C"),
    T("GEN", "젠지", "Gen.G", "#AA8A40"),
    T("T1", "T1", "T1", "#E2012D"),
    T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"),
    T("KT", "kt 롤스터", "KT Rolster", "#E4002B"),
    T("NS", "농심 레드포스", "Nongshim RedForce", "#DE1C22"),
    T("LSB", "리브 샌드박스", "Liiv SANDBOX", "#C7A252"),
    T("BRO", "프레딧 브리온", "Fredit BRION", "#E87722"),
    T("DRX", "DRX", "DRX", "#5B8DEF"),
    T("AF", "아프리카 프릭스", "Afreeca Freecs", "#1D63ED"),
  ],
  2022: [
    T("DK", "DWG KIA", "DWG KIA", "#0B3B8C"),
    T("GEN", "젠지", "Gen.G", "#AA8A40"),
    T("T1", "T1", "T1", "#E2012D"),
    T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"),
    T("KT", "kt 롤스터", "KT Rolster", "#E4002B"),
    T("NS", "농심 레드포스", "Nongshim RedForce", "#DE1C22"),
    T("LSB", "리브 샌드박스", "Liiv SANDBOX", "#C7A252"),
    T("BRO", "프레딧 브리온", "Fredit BRION", "#E87722"),
    T("DRX", "DRX", "DRX", "#5B8DEF"),
    T("KDF", "광동 프릭스", "Kwangdong Freecs", "#E10600"),
  ],
  2023: [
    T("GEN", "젠지", "Gen.G", "#AA8A40"), T("T1", "T1", "T1", "#E2012D"), T("KT", "kt 롤스터", "KT Rolster", "#E4002B"),
    T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"), T("DK", "Dplus KIA", "Dplus KIA", "#0B3B8C"),
    T("LSB", "리브 샌드박스", "Liiv SANDBOX", "#C7A252"), T("DRX", "DRX", "DRX", "#5B8DEF"),
    T("KDF", "광동 프릭스", "Kwangdong Freecs", "#E10600"), T("NS", "농심 레드포스", "Nongshim RedForce", "#DE1C22"),
    T("BRO", "BRION", "BRION", "#E87722"),
  ],
  2024: [
    T("GEN", "젠지", "Gen.G", "#AA8A40"), T("T1", "T1", "T1", "#E2012D"), T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"),
    T("DK", "Dplus KIA", "Dplus KIA", "#0B3B8C"), T("KT", "kt 롤스터", "KT Rolster", "#E4002B"),
    T("KDF", "광동 프릭스", "Kwangdong Freecs", "#E10600"), T("FOX", "피어엑스", "FearX", "#7C3AED"),
    T("BRO", "한진 브리온", "HANJIN BRION", "#E87722"), T("NS", "농심 레드포스", "Nongshim RedForce", "#DE1C22"),
    T("DRX", "DRX", "DRX", "#5B8DEF"),
  ],
  2025: [
    T("GEN", "젠지", "Gen.G", "#AA8A40"), T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"),
    T("T1", "T1", "T1", "#E2012D"), T("DK", "Dplus KIA", "Dplus KIA", "#0B3B8C"),
    T("KT", "kt 롤스터", "KT Rolster", "#E4002B"), T("BFX", "BNK 피어엑스", "BNK FEARX", "#7C3AED"),
    T("NS", "농심 레드포스", "Nongshim RedForce", "#DE1C22"), T("DNS", "DN 수퍼스", "DN SOOPers", "#E10600"),
    T("BRO", "한진 브리온", "HANJIN BRION", "#E87722"), T("DRX", "DRX", "DRX", "#5B8DEF"),
  ],
  2026: [
    T("GEN", "젠지", "Gen.G", "#AA8A40"), T("HLE", "한화생명e스포츠", "Hanwha Life Esports", "#FF6B00"),
    T("T1", "T1", "T1", "#E2012D"), T("DK", "디플러스 기아", "Dplus Kia", "#0B3B8C"),
    T("KT", "kt 롤스터", "KT Rolster", "#E4002B"), T("BFX", "BNK 피어엑스", "BNK FEARX", "#7C3AED"),
    T("NS", "농심 레드포스", "Nongshim RedForce", "#DE1C22"), T("DNS", "DN 수퍼스", "DN SOOPers", "#E10600"),
    T("BRO", "한진 브리온", "HANJIN BRION", "#E87722"), T("KRX", "키움 DRX", "Kiwoom DRX", "#5B8DEF"),
  ],
};
LCK_BY_YEAR[2027] = LCK_BY_YEAR[2026].map((t) => ({ ...t }));

export const CK_POOL: EraTeam[] = [
  T("E8W", "Ever8 위너스", "Ever8 Winners", "#6B8E23"),
  T("KDM", "콩두 몬스터", "Kongdoo Monster", "#2C3E50"),
  T("BTC", "팀 배틀코믹스", "Team BattleComics", "#3D5A1F"),
  T("GCB", "GC 부산", "GC Busan Rising Star", "#1B4F72"),
  T("ESS", "ESSENDIA", "ESSENDIA", "#5D6D7E"),
  T("APK", "APK 프린스", "APK Prince", "#6C3483"),
  T("VSG", "VSG", "VSG", "#1A5276"),
  T("EEW", "ES 샤크스", "ES Sharks", "#1ABC9C"),
  T("ASP", "아스라 에스컬", "Asura", "#7F8C8D"),
  T("RPL", "리플 게이밍", "RunAway", "#16A085"),
];

export const lckTeamsOf = (year: number): EraTeam[] => LCK_BY_YEAR[Math.min(year, 2027)] ?? LCK_BY_YEAR[2026];
export const ckTeamsOf = (_year: number, user?: EraTeam): EraTeam[] => {
  const base = CK_POOL.slice(0, 7);
  return user ? [...base, user] : base;
};

/**
 * LCK는 카드에 적힌 공식 연봉 그대로입니다.
 * 2부는 퍼센타일(능력치)에 따라 0.2–0.5억이 전형이고, LCK에서 이름 있던 선수(높은 퍼센타일·여러 시즌)는 최대 약 2억입니다.
 */
export function storySalary(cardOrRaw: SeasonCard | number, tier: Tier): number {
  if (tier !== "CK") return typeof cardOrRaw === "number" ? cardOrRaw : cardOrRaw.salary;
  if (typeof cardOrRaw === "number") return ckSalaryFromRaw(cardOrRaw);
  return ckSalary(cardOrRaw);
}

let _byP: Map<string, SeasonCard[]> | null = null;
function cardsOf(pkey: string): SeasonCard[] {
  if (!_byP || _byP.size === 0) {
    _byP = new Map();
    for (const c of Object.values(CARDS)) {
      const arr = _byP.get(c.pkey) ?? [];
      arr.push(c);
      _byP.set(c.pkey, arr);
    }
  }
  return _byP.get(pkey) ?? [];
}

function ckBase(p: number): number {
  if (p <= 75) return 0.20 + 0.30 * (Math.max(0, p) / 75);
  return 0.50 + 0.50 * (Math.min(25, p - 75) / 25);
}

function ckNameBonus(card: SeasonCard): number {
  const hist = cardsOf(card.pkey).filter((x) => x.year <= card.year);
  const peak = Math.max(card.percentile, ...hist.map((x) => x.percentile));
  const seasons = new Set((hist.length ? hist : [card]).map((x) => x.year)).size;
  let b = 0;
  if (peak >= 90) b += 0.60;
  else if (peak >= 80) b += 0.40;
  else if (peak >= 70) b += 0.20;
  if (seasons >= 4) b += 0.30;
  else if (seasons >= 3) b += 0.15;
  return b;
}

function ckSalary(card: SeasonCard): number {
  const v = ckBase(card.percentile) + ckNameBonus(card);
  return moneyRound(Math.max(CK_SALARY_MIN, Math.min(CK_SALARY_MAX, v)));
}

/** 카드 없이 공식 연봉만 있을 때의 대략 환산(이름 가산 없음). */
function ckSalaryFromRaw(raw: number): number {
  const t = Math.max(0, Math.min(1, (raw - 3) / 44));
  const v = t <= 0.25 ? 0.20 + 0.30 * (t / 0.25) : 0.50 + 1.0 * ((t - 0.25) / 0.75);
  return moneyRound(Math.max(CK_SALARY_MIN, Math.min(CK_SALARY_MAX, v)));
}

/** Y시즌에 쓸 카드: 같은 해 우선, 없으면 가장 가까운 과거. 미래 연도는 쓰지 않음. */
export function cardForYear(pkey: string, year: number, posIdx?: number): { card: SeasonCard; estimated: boolean } | undefined {
  const y = Math.min(year, 2026); // 2027 → 2026 카드
  const all = (CARDS_BY_PERSON[pkey] ?? []).filter((c) => c.year <= y && (posIdx == null || c.posIdx === posIdx));
  if (!all.length) return;
  const same = all.filter((c) => c.year === y).sort((a, b) => b.games - a.games || cmpCard(a, b))[0];
  // 데이터 마지막 해(2026) 공식 카드는 2027에도 추정 감쇠 없이 그대로 씁니다.
  if (same) return { card: same, estimated: false };
  const prev = all.sort((a, b) => b.year - a.year || b.games - a.games || cmpCard(a, b))[0];
  return { card: prev, estimated: true };
}

export function debutYear(pkey: string): number | undefined {
  const ys = (CARDS_BY_PERSON[pkey] ?? []).map((c) => c.year);
  return ys.length ? Math.min(...ys) : undefined;
}

export function marketCards(year: number): SeasonCard[] {
  const y = Math.min(year, 2026);
  // 인물당 그해(또는 최신 과거) 한 장만, 데뷔 연도 이전은 제외
  const best = new Map<string, SeasonCard>();
  for (const id of Object.keys(CARDS).sort(cmpStr)) {
    const c = CARDS[id];
    if (c.year > y) continue;
    const k = c.pkey + "#" + c.posIdx;
    const cur = best.get(k);
    if (!cur || c.year > cur.year || (c.year === cur.year && c.games > cur.games)) best.set(k, c);
  }
  return [...best.values()].sort(cmpCard);
}

/** 프랜차이즈 영입 화면: 한 사람당 현재 연도에 가장 가까운 기록 한 개만 제공합니다. */
export function franchisePlayers(year: number): SeasonCard[] {
  const people = new Map<string, SeasonCard>();
  for (const c of marketCards(year)) {
    const old = people.get(c.pkey);
    if (!old || c.year > old.year || (c.year === old.year && (c.games > old.games || (c.games === old.games && cmpCard(c, old) < 0)))) people.set(c.pkey, c);
  }
  return [...people.values()].sort(cmpCard);
}

export function ensurePlayer(card: SeasonCard, year: number, estimated: boolean): string {
  let p = playerFromCard(card);
  if (estimated) {
    const pct = Math.max(5, Math.round(card.percentile) - DECAY_PCT);
    p = { ...p, key: `${card.pkey}-est-${year}-p${card.posIdx}`, pct: { ...p.pct, ovr: pct, fight: pct }, label: `${cardLabel(card)} · 추정`, small: true, rating: cardRating(card, true) };
  }
  if (!PL[p.key]) PL[p.key] = p;
  return p.key;
}

const TEAM_ALIAS: Record<string, string[]> = {
  GEN: ["Gen.G", "KSV eSports", "KSV"], SKT: ["SK Telecom T1", "SKT", "T1"], T1: ["T1", "SK Telecom T1", "SKT"],
  KT: ["KT Rolster", "kt Rolster", "KT"], AF: ["Afreeca Freecs", "DN SOOPers", "Kwangdong Freecs", "DN Freecs"],
  DNS: ["DN SOOPers", "Afreeca Freecs", "Kwangdong Freecs"], KDF: ["Kwangdong Freecs", "Afreeca Freecs", "DN SOOPers"],
  JAG: ["Jin Air Green Wings"], ROX: ["ROX Tigers", "Hanwha Life Esports"], HLE: ["Hanwha Life Esports", "ROX Tigers"],
  BBQ: ["bbq Olivers", "ESC Ever", "Ever8 Winners"], MVP: ["MVP"], GRF: ["Griffin"],
  KZ: ["Kingzone DragonX", "Longzhu Gaming", "DRX", "Kiwoom DRX"], DRX: ["DRX", "Kingzone DragonX", "Kiwoom DRX"],
  KRX: ["Kiwoom DRX", "DRX", "Kingzone DragonX"], DWG: ["DAMWON Gaming", "DWG KIA", "Dplus Kia", "Dplus KIA"],
  DK: ["Dplus Kia", "Dplus KIA", "DWG KIA", "DAMWON Gaming"], SB: ["SANDBOX Gaming", "Liiv SANDBOX", "Team BattleComics"],
  LSB: ["Liiv SANDBOX", "SANDBOX Gaming"], BRO: ["HANJIN BRION", "Fredit BRION", "BRION", "hyFresh Blade"],
  NS: ["Nongshim RedForce", "Team Dynamics"], DYN: ["Team Dynamics", "Nongshim RedForce"],
  SP: ["SeolHaeOne Prince", "APK Prince"], BFX: ["BNK FEARX", "FearX", "Liiv SANDBOX"], FOX: ["FearX", "BNK FEARX"],
  E8W: ["Ever8 Winners", "ESC Ever", "bbq Olivers"], KDM: ["Kongdoo Monster"], BTC: ["Team BattleComics", "SANDBOX Gaming"],
  EEW: ["ES Sharks"], APK: ["APK Prince", "SeolHaeOne Prince"],
};

function cardsForOrg(short: string, year: number): SeasonCard[] {
  const names = new Set((TEAM_ALIAS[short] ?? [short]).map((x) => x.toLowerCase()));
  return marketCards(year).filter((c) => names.has(c.team.toLowerCase()) || c.team.toLowerCase().includes(short.toLowerCase()));
}

export function fillTeamRoster(short: string, year: number, used: Set<string>, rng: Rng): string[] {
  const starters: string[] = new Array(5).fill("");
  const own = cardsForOrg(short, year);
  for (let pos = 0; pos < 5; pos++) {
    const cand = own.filter((c) => c.posIdx === pos && !used.has(c.pkey)).sort((a, b) => b.percentile - a.percentile || cmpCard(a, b));
    const c = cand[0];
    if (c) {
      const r = cardForYear(c.pkey, year, pos)!;
      const key = ensurePlayer(r.card, year, r.estimated);
      starters[pos] = key; used.add(c.pkey);
    }
  }
  for (let pos = 0; pos < 5; pos++) {
    if (starters[pos]) continue;
    const pool = marketCards(year).filter((c) => c.posIdx === pos && !used.has(c.pkey)).sort((a, b) => a.salary - b.salary || a.percentile - b.percentile || cmpCard(a, b));
    const pick = pool[Math.min(pool.length - 1, Math.floor(rng.next() * Math.min(8, pool.length)))] ?? pool[0];
    if (pick) {
      const r = cardForYear(pick.pkey, year, pos)!;
      starters[pos] = ensurePlayer(r.card, year, r.estimated);
      used.add(pick.pkey);
    }
  }
  return starters;
}

export function injectEraTeam(t: EraTeam, starters: string[], extra: string[] = []): Team {
  const team: Team = {
    id: Math.abs(hash(t.short)) % 900 + 100, short: t.short, name: t.name, ko: t.ko, color: t.color,
    starters, players: [...new Set([...starters, ...extra])], real: [0, 0, 0, 0], gw: 0, gl: 0, founded: t.short.length <= 4 && !LCK_BY_YEAR[2018].some((x) => x.short === t.short),
  };
  TM[t.short] = team;
  return team;
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }


function reviveKey(k: string, year: number, posIdx?: number): void {
  if (!k || PL[k]) return;
  if (CARDS[k]) { PL[k] = playerFromCard(CARDS[k]); return; }
  const m = /^(.*)-est-(\d+)(?:-p([0-4]))?$/.exec(k);
  if (m) {
    const y = Number(m[2]) || year;
    const r = cardForYear(m[1], y, m[3] == null ? posIdx : Number(m[3]));
    if (r) {
      const nk = ensurePlayer(r.card, y, true);
      if (!PL[k]) PL[k] = nk === k ? PL[nk] : { ...PL[nk], key: k };
    }
  }
}
export function applyStoryWorld(s: Save, yearOverride?: number): void {
  const st = s.story; if (!st) return;
  const year = yearOverride ?? st.year;
  const used = new Set<string>();
  // user people reserved
  for (const c of s.story?.contracts ?? []) used.add(c.person);
  for (const id of s.cards ?? []) if (CARDS[id]) used.add(CARDS[id].pkey);
  for (const keys of Object.values(s.starters ?? {})) keys.forEach((k, pos) => reviveKey(k, year, pos));
  // 추정 시즌 카드인 보유 벤치도 로드 후 같은 선수로 기용할 수 있어야 합니다.
  for (const c of st.contracts) reviveKey(c.key, year, CARDS[c.cardId]?.posIdx);
  if (s.inSeason?.year === year) for (const list of Object.values(s.inSeason.rosters)) for (const c of list) {
    const card = CARDS[c.cardId]; if (card) { reviveKey(c.key, year, card.posIdx); used.add(c.person); }
  }
  const rng = new Rng(s.seed ^ year * 17);
  const user = s.club ? { short: s.club.short, ko: s.club.name, name: s.club.name, color: s.club.color } : undefined;
  // 일정에 올라 있는 구단(승강 결과가 반영된 st.lck/st.ck) 기준으로 짭니다.
  // 공식 연도 명단만 쓰면 약칭이 바뀐 구단(ROX, SKT, BBQ 등)이 비어 승강전이 멈춥니다.
  const shorts = [...new Set([...(st.lck ?? []), ...(st.ck ?? []), s.team])].filter(Boolean);
  for (const short of shorts) {
    const t = eraTeamFor(short, year, user);
    if (short === s.team) {
      const stt = s.starters[s.team] ?? [];
      injectEraTeam(t, stt.length === 5 ? stt : fillAndKeep(s, year), s.cards);
      continue;
    }
    if (s.starters[short]?.length === 5 && st.worldBuiltYear === year && s.starters[short].every((k) => !/-\d{4}$/.test(k) || !!CARDS[k] || (/-est-\d{4}$/.test(k) && !!PL[k]))) { // 명단에서 뺀 선수가 남은 저장이면 이 구단만 다시 짭니다(옛 저장의 추정 선수 이름표 `이름-est-연도`는 되살릴 수 있으면 그대로 둡니다)
      const keys = s.starters[short];
      keys.forEach((k) => { const p = PL[k]; if (p?.personKey) used.add(p.personKey); });
      injectEraTeam(t, keys, s.inSeason?.year === year ? s.inSeason.rosters[short]?.map((c) => c.key) : undefined);
      continue;
    }
    const roster = fillTeamRoster(short, year, used, rng);
    s.starters[short] = roster;
    injectEraTeam(t, roster);
  }
  st.worldBuiltYear = year;
  // 로드로 PL/TM이 초기화되어도 국제대의 저장된 대진과 가상 시드 명단을 복구합니다.
  for (const tag of Object.keys(s.starters).filter((t) => /^[A-Z]+-\d+$/.test(t))) ensureIntlRoster(s, tag);
}


function eraTeamFor(short: string, year: number, user?: EraTeam): EraTeam {
  if (user && (user.short === short)) return user;
  const official = [...lckTeamsOf(year), ...ckTeamsOf(year, user)];
  const exact = official.find((t) => t.short === short);
  if (exact) return exact;
  const want = new Set((TEAM_ALIAS[short] ?? [short]).map((x) => x.toLowerCase()));
  want.add(short.toLowerCase());
  for (const t of official) {
    const names = [t.short, t.name, t.ko, ...(TEAM_ALIAS[t.short] ?? [])].map((x) => x.toLowerCase());
    if (names.some((n) => want.has(n))) return { ...t, short };
  }
  const prev = TM[short];
  if (prev) return { short, ko: prev.ko, name: prev.name, color: prev.color };
  return T(short, short, short, "#64748B");
}

function fillAndKeep(s: Save, _year: number): string[] {
  const keys = [...(s.starters[s.team] ?? [])];
  while (keys.length < 5) keys.push("");
  return keys.slice(0, 5);
}

const addDays = (iso: string, n: number): string => { const d = new Date(iso + "T12:00:00+09:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

export function splitStartDate(year: number, split: Split): string {
  return split === "spring" ? `${year}-01-20` : `${year}-06-10`;
}

/** 원형 RR. 10팀이면 9라운드(싱글), 8팀이면 7라운드. */
export function buildSplitSchedule(teams: string[], start: string, bo: 3 | 5, prefix: string): { days: Day[]; series: SeriesRec[] } {
  const n = teams.length;
  const arr = [...teams];
  if (n % 2) arr.push("BYE");
  const m = arr.length;
  const rounds: [string, string][][] = [];
  for (let r = 0; r < m - 1; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < m / 2; i++) {
      const a = arr[i], b = arr[m - 1 - i];
      if (a !== "BYE" && b !== "BYE") pairs.push(r % 2 ? [b, a] : [a, b]);
    }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  const days: Day[] = []; const series: SeriesRec[] = [];
  rounds.forEach((pairs, i) => {
    const date = addDays(start, i * 3);
    days.push({ date, week: i + 1, stage: "R", label: `${i + 1}라운드` });
    pairs.forEach(([a, b], j) => series.push({ id: `${prefix}R${i}-${j}`, day: i, stage: "R", a, b, bo, games: [], sa: 0, sb: 0 }));
  });
  return { days, series };
}

export function currentLeague(s: Save): string[] {
  const st = s.story!;
  return st.tier === "LCK" ? st.lck : st.ck;
}

export function beginSplit(s: Save, year: number, split: Split): void {
  const st = s.story!;
  st.year = year; st.split = split; st.phase = "regular";
  ensureStartingFive(s);
  const teams = currentLeague(s);
  const start = splitStartDate(year, split);
  const sch = buildSplitSchedule(teams, start, 3, `${year}${split === "spring" ? "S" : "U"}-`);
  s.days = sch.days; s.series = sch.series; s.day = 0; s.phase = "regular"; s.champion = undefined; s.seeds = undefined; s.schedOk = s.schedOk || false;
  beginTrainingPeriod(s, start);
  const vs = s.series.find((x) => x.day === 0 && (x.a === s.team || x.b === s.team));
  addNews(s, "season", `${year} ${split === "spring" ? "스프링" : "서머"} 개막 · ${st.tier === "LCK" ? "LCK" : "2부"}`,
    `${s.club?.name ?? s.team}이(가) ${st.tier === "LCK" ? "LCK" : "챌린저스"} ${year} ${split === "spring" ? "스프링" : "서머"}를 시작합니다.${vs ? ` 첫 경기는 ${dateKo(sch.days[0].date)} ${vs.a === s.team ? vs.b : vs.a}전입니다.` : ""}`, s.team);
}

export function isStory(s: Save): boolean { return s.mode === "story" && !!s.story; }

export const SPLIT_KO = { spring: "스프링", summer: "서머" } as const;
export const TIER_KO = { LCK: "LCK", CK: "2부" } as const;
export const PHASE_STORY_KO: Record<StoryPhase, string> = {
  regular: "정규 시즌", playoffs: "플레이오프", promo: "승강전", rtm: "Road to MSI", msi: "MSI", worlds: "월즈",
  awards: "시상식", tryout: "트라이아웃", expiry: "계약 만료", stove: "스토브리그", franchise: "프랜차이즈 전환", clear: "클리어", fail: "종료", bankrupt: "파산",
};

export function seedTop4PO(s: Save): void {
  const rows = standings(s).filter((r) => currentLeague(s).includes(r.t));
  const seeds = rows.slice(0, 4).map((r) => r.t);
  if (seeds.length < 4) { goAfterSplit(s); return; }
  s.seeds = seeds; s.phase = "playoffs"; s.story!.phase = "playoffs";
  const d = s.days.length;
  s.days.push({ date: addDays(s.days[s.days.length - 1].date, 5), week: (s.days[s.days.length - 1].week ?? 9) + 1, stage: "SF", label: "플레이오프 준결승" });
  s.days.push({ date: addDays(s.days[s.days.length - 1].date, 5), week: (s.days[s.days.length - 1].week ?? 9) + 2, stage: "F", label: "플레이오프 결승" });
  s.series.push({ id: `${s.story!.year}-SF0`, day: d, stage: "SF", a: seeds[0], b: seeds[3], bo: 5, games: [], sa: 0, sb: 0, holder1: seeds[0] });
  s.series.push({ id: `${s.story!.year}-SF1`, day: d, stage: "SF", a: seeds[1], b: seeds[2], bo: 5, games: [], sa: 0, sb: 0, holder1: seeds[1] });
  s.day = d;
  addNews(s, "season", "플레이오프 대진 확정", `1위 ${seeds[0]} vs 4위 ${seeds[3]}, 2위 ${seeds[1]} vs 3위 ${seeds[2]} (Bo5).`, s.team);
}

/** 스플릿 종료 성적(정규 순위·PO 결승)을 저장합니다. 월즈/승강전으로 일정이 바뀌어도 상금과 시드가 유지됩니다. */
export function recordSplitResult(s: Save): void {
  const st = s.story; if (!st) return;
  // 승강전·국제대 일정이 이미 섞였으면 스플릿 종료 때 저장한 값을 유지합니다.
  if (s.series.some((x) => /^(PR-|W-|MSI-|RTM-)/.test(x.id))) {
    if (st.splitSeeds?.length || st.lastRank) return;
  }
  const teams = currentLeague(s);
  const rows = standings(s).filter((r) => teams.includes(r.t));
  if (rows.length < 2) return;
  st.lastRank = (rows.findIndex((r) => r.t === s.team) + 1) || rows.length;
  const finals = s.series.filter((x) => x.stage === "F" && x.winner && !/^(PR-|W-|MSI-|RTM-)/.test(x.id));
  const f = finals[finals.length - 1];
  const champ = (s.champion && teams.includes(s.champion) ? s.champion : undefined) ?? f?.winner;
  const runner = f ? (f.winner === f.a ? f.b : f.a) : undefined;
  const rest = rows.map((r) => r.t).filter((t) => t !== champ && t !== runner);
  st.splitSeeds = [champ, runner, ...rest].filter((t): t is string => !!t && teams.includes(t));
  archiveClubSplit(s, rows, champ);
}

export function lckWorldsSeeds(s: Save): string[] {
  recordSplitResult(s);
  const st = s.story!;
  if (st.splitSeeds?.length) return st.splitSeeds.filter((t) => st.lck.includes(t)).slice(0, 3);
  const lck = rankByPower(st.lck, st.year);
  const champ = s.champion && st.lck.includes(s.champion) ? s.champion : lck[0];
  return [champ, ...lck.filter((t) => t !== champ)].slice(0, 3);
}

/** 2부 스폰서를 LCK 중계·스폰서 규모로 올립니다. 이미 LCK 규모면 그대로 둡니다. */
export function scaleLckIncome(s: Save): void {
  const st = s.story; if (!st || st.tier !== "LCK") return;
  const cur = s.eco.sponsor;
  if (cur && cur.amount >= 15) return;
  const prev = cur?.amount;
  s.eco.sponsor = {
    name: cur?.name ? `${cur.name} · LCK` : "LCK 중계·스폰서",
    amount: LCK_SPONSOR,
    goal: cur?.goal ?? "po",
    years: Math.max(cur?.years ?? 0, 3),
  };
  addNews(s, "season", "LCK 수입 규모 적용",
    `승격에 맞춰 스폰서·중계 수입이 ${prev != null ? fmtMoney(prev) + "에서 " : ""}${fmtMoney(LCK_SPONSOR)} 규모로 조정되었습니다. LCK 공식 연봉을 감당할 수 있는 중계·배분·상금이 함께 들어옵니다.`,
    s.team);
}

export function academyPlayer(team: string, pos: number, year: number): string {
  const key = `acad-${team}-${year}-${pos}`;
  if (!PL[key]) {
    const band = 30;
    const posKo = ["탑", "정글", "미드", "원딜", "서포터"][pos] ?? "연습생";
    PL[key] = {
      key, name: `연습생 ${posKo}`, full: "연습생", team: -1, pos: pos as 0 | 1 | 2 | 3 | 4,
      games: 0, gamesPos: 0, wins: 0, teamsPlayed: {}, m: { gd: null, csd: null, xpd: null, kda: 0, kp: 0, dpm: 0, dsh: 0, gpm: 0, cspm: 0, vspm: 0, wk: 0, pool: 0 },
      kdaRaw: [0, 0, 0], pool: [], z: { lane: 0, fight: (band - 50) / 20, farm: 0, vision: 0, pool: 0, ovr: (band - 50) / 20 },
      pct: { lane: band, fight: band, farm: band, vision: 50, pool: 50, ovr: band },
      small: true, limited: true, label: `연습생 ${posKo} · 기록 없음`,
    };
  }
  return key;
}

/** 주전 5자리를 계약 선수 또는 연습생으로 채웁니다. 빈 라인업으로 시뮬이 깨지지 않게 합니다. */
export function ensureStartingFive(s: Save): void {
  const st = s.story; if (!st) return;
  const keys = [...(s.starters[s.team] ?? [])];
  while (keys.length < 5) keys.push("");
  const used = new Set<string>();
  for (const list of Object.values(s.starters ?? {})) for (const k of list) {
    const p = PL[k]; if (p?.personKey) used.add(p.personKey);
    if (k) used.add(k);
  }
  for (const c of st.contracts) used.add(c.person);
  for (let pos = 0; pos < 5; pos++) {
    if (keys[pos] && PL[keys[pos]]) continue;
    const c = st.contracts.find((ct) => {
      const p = PL[ct.key];
      return p && p.pos === pos && !used.has(ct.person) && !ct.person.startsWith("acad-");
    });
    if (c) { keys[pos] = c.key; used.add(c.person); }
  }
  let added = 0;
  const called: string[] = [];
  for (let pos = 0; pos < 5; pos++) {
    if (keys[pos] && PL[keys[pos]]) continue;
    const year = Math.min(st.year, 2026);
    const budget = Math.max(s.eco.cash, 0);
    const rate = (c: import("../types").SeasonCard): number => {
      const r = cardForYear(c.pkey, st.year, pos);
      if (!r) return 0;
      return r.estimated ? Math.max(5, Math.round(r.card.percentile) - DECAY_PCT) : r.card.percentile;
    };
    const cands = marketCards(year).filter((c) => c.posIdx === pos && !used.has(c.pkey));
    const payroll = st.contracts.reduce((n, x) => n + x.salary, 0);
    const roomPay = Math.max(0, payrollSoftCap(s, st.tier) - payroll);
    const affordable = cands.filter((c) => {
      const ask = storySalary(c, st.tier);
      return ask <= Math.max(budget, st.tier === "CK" ? 0.5 : 8) && ask <= Math.max(roomPay, st.tier === "CK" ? 0.4 : 12);
    });
    const cand = (affordable.length ? affordable : cands).sort((a, b) => rate(b) - rate(a) || storySalary(a, st.tier) - storySalary(b, st.tier) || cmpCard(a, b))[0];
    if (cand) {
      const r = cardForYear(cand.pkey, st.year, pos);
      const key = ensurePlayer(cand, st.year, r?.estimated ?? cand.year < year);
      const ask = storySalary(cand, st.tier);
      const salary = s.eco.cash >= ask ? ask : moneyRound(Math.max(0, Math.min(s.eco.cash, ask)));
      if (salary > 0) s.eco.cash = moneyRound(s.eco.cash - salary);
      st.contracts.push({ key, cardId: cand.id, years: 1, salary, person: cand.pkey, prepaid: true });
      keys[pos] = key; used.add(cand.pkey); added++;
      called.push(cand.name);
      continue;
    }
    const key = academyPlayer(s.team, pos, st.year);
    keys[pos] = key;
    if (!st.contracts.some((c) => c.key === key)) st.contracts.push({ key, cardId: key, years: 1, salary: 0, person: key });
    added++;
    called.push("연습생");
  }
  s.starters[s.team] = keys;
  if (added) addNews(s, "season", "주전 공백 보충", `비어 있던 주전 ${added}자리를 채웠습니다 (${called.join(", ")}). 시장에 남은 선수 또는 연습생이며, 연습생은 공식 시즌 기록이 없습니다.`, s.team);
}

function forceSalesToCover(s: Save): void {
  const st = s.story!;
  const starterSet = new Set((s.starters[s.team] ?? []).filter(Boolean));
  const score = (c: Contract): number => {
    const bench = starterSet.has(c.key) ? 0 : 1;
    return bench * 10000 + c.salary; // 벤치·고연봉부터 정리해 구멍을 줄입니다.
  };
  const sold: string[] = [];
  while (s.eco.cash < 0 && st.contracts.length) {
    const c = [...st.contracts].sort((a, b) => score(b) - score(a) || cmpStr(a.key, b.key))[0];
    const fee = moneyRound(c.salary * Math.max(c.years, 1) * 0.5);
    st.contracts = st.contracts.filter((x) => x !== c);
    s.starters[s.team] = (s.starters[s.team] ?? []).map((k) => k === c.key ? "" : k);
    s.cards = (s.cards ?? []).filter((k) => k !== c.key && k !== c.cardId);
    s.eco.cash = moneyRound(s.eco.cash + fee);
    sold.push(`${PL[c.key]?.name ?? c.person}(${fmtMoney(fee)})`);
  }
  if (sold.length) {
    addNews(s, "season", "적자 해소 강제 매각",
      `구단주 지시로 ${sold.join(", ")}을(를) 정리했습니다. 잔고 ${fmtMoney(s.eco.cash)}.`, s.team);
  }
}

/** 연봉 정산, 적자 시 강제 매각, 구단주 경고, 한도 초과 시 해임·파산. */
export function settlePayrollAndSolvency(s: Save): void {
  const st = s.story!;
  const pay = st.contracts.filter((c) => !c.prepaid).reduce((n, c) => n + c.salary, 0);
  for (const c of st.contracts) c.prepaid = false;
  s.eco.cash = moneyRound(s.eco.cash - pay);
  if (s.eco.cash < 0) forceSalesToCover(s);
  if (s.eco.cash < 0) {
    st.deficitYears = (st.deficitYears ?? 0) + 1;
    s.eco.trust = Math.max(0, (s.eco.trust ?? 55) - 15);
    st.financeWarn = "deficit";
    addNews(s, "season", "구단주 경고 — 적자 운영",
      `연봉 정산 후 잔고 ${fmtMoney(s.eco.cash)}입니다. 적자가 이어지거나 ${fmtMoney(CASH_BANKRUPT)} 아래로 떨어지면 해임·파산으로 끝납니다.`, s.team);
  } else {
    st.deficitYears = 0;
    if (s.eco.cash < 2) {
      st.financeWarn = "low";
      addNews(s, "season", "구단주 주의 — 잔고 부족",
        `잔고 ${fmtMoney(s.eco.cash)}. 적자가 누적되면 강제 매각이나 해임 위험이 있습니다.`, s.team);
    } else {
      st.financeWarn = undefined;
    }
  }
  // 쉬움은 −5억 임계만 적용합니다. 연속 적자+신뢰 20 이하는 보통·어려움만 (시드 11처럼 얕은 적자로 끝나던 경로).
  const trustBust = (st.deficitYears ?? 0) >= 2 && s.eco.cash < 0 && (s.eco.trust ?? 0) <= 20;
  if (s.eco.cash <= CASH_BANKRUPT || (storyDiff(s) !== "easy" && trustBust)) {
    endStory(s, "bankrupt");
    return;
  }
  ensureStartingFive(s);
}

export function lckPrizeOf(rank: number): number {
  const i = Math.min(Math.max((rank || 10) - 1, 0), LCK_PRIZE.length - 1);
  return LCK_PRIZE[i];
}

function goAfterSplit(s: Save): void {
  const st = s.story!;
  recordSplitResult(s);
  if (st.split === "spring") {
    if (st.tier === "LCK") startRTM(s);
    else if (st.year <= 2020) startPromo(s);
    else beginSplit(s, st.year, "summer");
    return;
  }
  if (st.year <= 2020) startPromo(s);
  else if (st.tier === "LCK") startWorlds(s);
  else beginOffseason(s);
}

export function finishStoryPO(s: Save): void {
  const seeds = s.seeds ?? [];
  const sf = s.series.filter((x) => x.stage === "SF" && x.winner);
  if (sf.length === 2 && !s.series.some((x) => x.stage === "F")) {
    const w = sf.map((x) => x.winner!).sort((a, b) => seeds.indexOf(a) - seeds.indexOf(b));
    const d = s.days.findIndex((x) => x.stage === "F");
    s.series.push({ id: `${s.story!.year}-F0`, day: d >= 0 ? d : s.day, stage: "F", a: w[0], b: w[1], bo: 5, games: [], sa: 0, sb: 0, holder1: w[0] });
    if (d >= 0) s.day = d;
    return;
  }
  const f = s.series.find((x) => x.stage === "F" && x.winner);
  if (f) {
    s.champion = f.winner;
    if (f.winner === s.team) s.story!.trophies.lck += 1;
    addNews(s, "season", `${f.winner}, ${s.story!.year} ${SPLIT_KO[s.story!.split]} 우승`, `결승에서 ${f.winner === f.a ? f.b : f.a}를 꺾었습니다.`, f.winner);
    goAfterSplit(s);
  }
}

export function startPromo(s: Save): void {
  const st = s.story!;
  ensureStartingFive(s);
  // standings from just-finished split: we need both leagues. After a split, only current league played.
  // For the other league, generate a quick RR if they have no series this split — use existing if we simulated both.
  // MVP: if user is CK, LCK 9/10 are taken from year template teams shuffled by seed/power; if user is LCK, CK 1/2 likewise.
  const myRows = standings(s).filter((r) => currentLeague(s).includes(r.t));
  let lck9: string, lck10: string, ck1: string, ck2: string;
  if (st.tier === "LCK") {
    lck9 = myRows[8]?.t ?? st.lck[8]; lck10 = myRows[9]?.t ?? st.lck[9];
    const ckRank = rankByPower(st.ck, st.year);
    ck1 = ckRank[0]; ck2 = ckRank[1];
  } else {
    ck1 = myRows[0]?.t ?? st.ck[0]; ck2 = myRows[1]?.t ?? st.ck[1];
    const lckRank = rankByPower(st.lck, st.year);
    lck9 = lckRank[8] ?? lckRank[lckRank.length - 2]; lck10 = lckRank[9] ?? lckRank[lckRank.length - 1];
  }
  st.phase = "promo";
  const date = addDays(s.days[s.days.length - 1]?.date ?? splitStartDate(st.year, st.split), 7);
  const d0 = s.days.length;
  s.days.push({ date, week: 20, stage: "PO1", label: `${SPLIT_KO[st.split]} 승강전 승자조 1R` });
  s.days.push({ date: addDays(date, 3), week: 21, stage: "SF", label: `${SPLIT_KO[st.split]} 승강전 승자조 결승` });
  s.days.push({ date: addDays(date, 4), week: 21, stage: "PO1", label: `${SPLIT_KO[st.split]} 승강전 패자조 1R` });
  s.days.push({ date: addDays(date, 7), week: 22, stage: "F", label: `${SPLIT_KO[st.split]} 승강전 패자조 결승` });
  s.series.push({ id: `PR-WB1`, day: d0, stage: "PO1", a: lck9, b: ck1, bo: 3, games: [], sa: 0, sb: 0, holder1: lck9 });
  s.series.push({ id: `PR-WB2`, day: d0, stage: "PO1", a: lck10, b: ck2, bo: 3, games: [], sa: 0, sb: 0, holder1: lck10 });
  s.day = d0;
  s.story!.note = JSON.stringify({ lck9, lck10, ck1, ck2, step: "wbr1", stay: [] as string[], down: [] as string[] } satisfies Partial<PromoState> & Record<string, unknown>);
  addNews(s, "season", `${st.year} ${SPLIT_KO[st.split]} 승강전 개막`, `LCK ${lck9}(9위) vs 2부 ${ck1}, LCK ${lck10}(10위) vs 2부 ${ck2}. 네 팀 중 두 팀이 다음 스플릿 LCK에 갑니다. 강등되어도 스토리는 이어집니다.`, s.team);
}

function rankByPower(shorts: string[], year: number): string[] {
  return [...shorts].sort((a, b) => teamPower(b, year) - teamPower(a, year) || cmpStr(a, b));
} // year used in powerOf
export function teamPower(short: string, _year?: number): number {
  const keys = TM[short]?.starters ?? [];
  if (!keys.length) return 40;
  const avg = keys.reduce((n, k) => n + (PL[k]?.pct.ovr ?? 40), 0) / keys.length;
  return avg;
}
/** AI 구단이 이번 주 FA에 쓸 수 있는 예산. 연봉 한도 잔여(roomPay)를 넘기지 않습니다. */
export function aiWeeklyFaBudget(team: string, roomPay: number, diff: StoryDiff): number {
  const base = 8 + teamPower(team) / 10;
  const adj = base * AI_FA_BUDGET_MULT[diff];
  return Math.min(adj, roomPay || adj);
}

function promoMeta(s: Save): PromoState { return JSON.parse(s.story!.note || "{}"); }
function savePromo(s: Save, p: PromoState): void { s.story!.note = JSON.stringify(p); }

export function advancePromo(s: Save, rng: Rng): void {
  const p = promoMeta(s);
  const played = (id: string) => s.series.find((x) => x.id === id);
  const fill = (id: string): void => { const sr = played(id); if (sr && !sr.winner) { try { simSeries(s, sr, rng); } catch { /* 라인업 공백 */ } } };
  if (p.step === "wbr1" || !p.step) {
    fill("PR-WB1"); fill("PR-WB2");
    const a = played("PR-WB1")!, b = played("PR-WB2")!;
    if (!a.winner || !b.winner) return;
    p.wbw = [a.winner, b.winner];
    p.lbl = [a.winner === a.a ? a.b : a.a, b.winner === b.a ? b.b : b.a];
    const d = s.days.findIndex((x) => x.label.includes("승자조 결승"));
    s.series.push({ id: "PR-WBF", day: d, stage: "SF", a: p.wbw[0], b: p.wbw[1], bo: 5, games: [], sa: 0, sb: 0, holder1: p.wbw[0] });
    p.step = "wbf"; savePromo(s, p); s.day = d; return;
  }
  if (p.step === "wbf") {
    fill("PR-WBF");
    const f = played("PR-WBF")!;
    if (!f.winner) return;
    p.wbfW = f.winner; p.wbfL = f.winner === f.a ? f.b : f.a;
    p.stay = [p.wbfW];
    const d = s.days.findIndex((x) => x.label.includes("패자조 1R"));
    s.series.push({ id: "PR-LB1", day: d, stage: "PO1", a: p.lbl![0], b: p.lbl![1], bo: 3, games: [], sa: 0, sb: 0, holder1: p.lbl![0] });
    p.step = "lbr1"; savePromo(s, p); s.day = d; return;
  }
  if (p.step === "lbr1") {
    fill("PR-LB1");
    const f = played("PR-LB1")!;
    if (!f.winner) return;
    p.lbr1W = f.winner; p.lbr1L = f.winner === f.a ? f.b : f.a;
    p.down = [p.lbr1L!];
    const d = s.days.findIndex((x) => x.label.includes("패자조 결승"));
    s.series.push({ id: "PR-LBF", day: d, stage: "F", a: p.wbfL!, b: p.lbr1W, bo: 5, games: [], sa: 0, sb: 0, holder1: p.wbfL });
    p.step = "lbf"; savePromo(s, p); s.day = d; return;
  }
  if (p.step === "lbf") {
    fill("PR-LBF");
    const f = played("PR-LBF")!;
    if (!f.winner) return;
    const loser = f.winner === f.a ? f.b : f.a;
    p.stay = [p.wbfW!, f.winner];
    p.down = [p.lbr1L!, loser];
    p.step = "done"; savePromo(s, p);
    applyPromoResult(s, p);
  }
}

function applyPromoResult(s: Save, p: PromoState): void {
  const st = s.story!;
  const stay = new Set(p.stay);
  const nextLck = st.lck.filter((t) => t !== p.lck9 && t !== p.lck10).concat(p.stay);
  const nextCk = st.ck.filter((t) => t !== p.ck1 && t !== p.ck2).concat(p.down);
  // keep length
  st.lck = unique10(nextLck, [...st.lck, ...st.ck]);
  st.ck = uniqueN(nextCk, [...st.ck, ...st.lck], 8, s.team);
  const was = st.tier;
  if (stay.has(s.team)) { st.tier = "LCK"; scaleLckIncome(s); }
  else if (p.down.includes(s.team)) st.tier = "CK";
  addNews(s, "season", `${st.year} ${SPLIT_KO[st.split]} 승강전 종료 — LCK 두 팀 확정`,
    `잔류·승격: ${p.stay.join(", ")}. 2부: ${p.down.join(", ")}.${was !== st.tier ? (st.tier === "LCK" ? " 우리 구단이 LCK로 올라갔습니다." : " 우리 구단은 다음 스플릿을 2부에서 시작합니다. 스토리는 계속됩니다.") : ""}`, s.team);
  afterPromo(s);
}
function unique10(arr: string[], fall: string[]): string[] {
  const out: string[] = [];
  for (const x of [...arr, ...fall]) if (!out.includes(x) && out.length < 10) out.push(x);
  return out;
}
function uniqueN(arr: string[], fall: string[], n: number, keep: string): string[] {
  const out: string[] = [];
  if (arr.includes(keep)) out.push(keep);
  for (const x of [...arr, ...fall]) if (!out.includes(x) && out.length < n) out.push(x);
  return out;
}

function afterPromo(s: Save): void {
  const st = s.story!;
  if (st.split === "spring") {
    beginSplit(s, st.year, "summer");
  } else if (st.year <= 2020 && st.tier === "LCK") {
    startWorlds(s);
  } else {
    beginOffseason(s);
  }
}


export function startRTM(s: Save): void {
  const st = s.story!;
  st.phase = "rtm";
  recordSplitResult(s);
  const seeds = (st.splitSeeds?.length ? st.splitSeeds : ([s.champion, ...rankByPower(st.lck, st.year).filter((t) => t !== s.champion)].filter(Boolean) as string[])).slice(0, 3);
  if (seeds.length < 2) { afterRTM(s, seeds[0] ? [seeds[0]] : rankByPower(st.lck, st.year).slice(0, 1)); return; }
  const date = addDays(s.days[s.days.length - 1]?.date ?? splitStartDate(st.year, "spring"), 5);
  const d = s.days.length;
  s.days.push({ date, week: 15, stage: "SF", label: "Road to MSI · 1시드 결정전" });
  s.series.push({ id: "RTM-1", day: d, stage: "SF", a: seeds[0], b: seeds[1], bo: 5, games: [], sa: 0, sb: 0, holder1: seeds[0] });
  s.day = d;
  st.note = JSON.stringify({ seeds, step: "seed1" });
  addNews(s, "season", `${st.year} Road to MSI`, `스프링 1위 ${seeds[0]} vs 2위 ${seeds[1]} (Bo5). 승자가 MSI 1시드입니다.${st.year >= 2021 && seeds[2] ? ` 패자는 3위 ${seeds[2]}와 최종전을 치릅니다.` : " 2018–2020은 스프링 대표 1팀이 MSI에 나갑니다."}`, s.team);
}

export function advanceRTM(s: Save, rng: Rng): void {
  const st = s.story!;
  const meta = JSON.parse(st.note || "{}") as { seeds: string[]; step: string };
  const m1 = s.series.find((x) => x.id === "RTM-1");
  if (!m1?.winner) {
    if (m1 && !m1.winner) simSeries(s, m1, rng);
    return;
  }
  if (meta.step === "seed1") {
    if (st.year <= 2020 || !meta.seeds[2]) { afterRTM(s, [m1.winner]); return; }
    const loser = m1.winner === m1.a ? m1.b : m1.a;
    const d = s.days.length;
    s.days.push({ date: addDays(s.days[s.days.length - 1].date, 3), week: 16, stage: "F", label: "Road to MSI · 최종전" });
    s.series.push({ id: "RTM-2", day: d, stage: "F", a: loser, b: meta.seeds[2], bo: 5, games: [], sa: 0, sb: 0, holder1: loser });
    s.day = d; meta.step = "seed2"; st.note = JSON.stringify(meta); return;
  }
  const m2 = s.series.find((x) => x.id === "RTM-2");
  if (m2 && !m2.winner) simSeries(s, m2, rng);
  if (m2?.winner) afterRTM(s, [m1.winner, m2.winner]);
}

function afterRTM(s: Save, lckSeeds: string[]): void { startMSI(s, lckSeeds.length ? lckSeeds : rankByPower(s.story!.lck, s.story!.year).slice(0, 1)); }

export function startMSI(s: Save, lckSeeds: string[]): void {
  const st = s.story!;
  st.phase = "msi";
  const intl = ["LPL-1", "LEC-1", "LCS-1", "PCS-1", "TCL-1", "VCS-1"];
  const need = Math.max(0, 6 - lckSeeds.length);
  const teams = [...lckSeeds, ...intl.slice(0, need)];
  for (const t of teams) {
    if (!TM[t]) {
      TM[t] = { id: 810, short: t, name: t, ko: t.includes("-") ? t.replace("-", " ") + "시드" : t, color: "#64748B", starters: [], players: [], real: [0, 0, 0, 0], gw: 0, gl: 0 };
    }
    if (t.includes("-") && (s.starters[t] ?? []).filter(Boolean).length < 5) s.starters[t] = ghostLineup(t, st.year, storyDiff(s));
  }
  const date = `${st.year}-05-10`;
  const d0 = s.days.length;
  let day = d0;
  for (let i = 0; i < teams.length; i++) for (let j = i + 1; j < teams.length; j++) {
    s.days.push({ date: addDays(date, day - d0), week: 17, stage: "R", label: `MSI 그룹 ${teams[i]} vs ${teams[j]}` });
    s.series.push({ id: `MSI-G-${i}-${j}`, day, stage: "R", a: teams[i], b: teams[j], bo: 1, games: [], sa: 0, sb: 0 });
    day++;
  }
  s.day = d0;
  st.note = JSON.stringify({ teams, lckSeeds, step: "groups" });
  addNews(s, "season", `${st.year} MSI 개막 · 6팀`, `LCK 시드: ${lckSeeds.join(", ") || "없음"}. 그룹은 단판 라운드 로빈, 상위 4팀이 준결승에 갑니다. 해외 팀은 리그 시드 이름만 쓰며 개별 선수 기록은 없습니다.`, s.team);
  if (!lckSeeds.includes(s.team)) {
    // 미참가: 빠르게 시뮬하고 다음 국면으로
  }
}

export function advanceMSI(s: Save, rng: Rng): void {
  const st = s.story!;
  const meta = JSON.parse(st.note || "{}") as { teams: string[]; step: string };
  const groups = s.series.filter((x) => x.id.startsWith("MSI-G-"));
  if (!meta.step || meta.step === "groups") {
    for (const sr of groups) if (!sr.winner) { try { simSeries(s, sr, rng); } catch { /* */ } }
    if (!groups.length || !groups.every((x) => x.winner)) return;
    const rows = (meta.teams ?? []).map((t) => {
      const w = groups.filter((x) => x.winner === t).length;
      return { t, w };
    }).sort((a, b) => b.w - a.w || cmpStr(a.t, b.t));
    const top = rows.slice(0, 4).map((r) => r.t);
    const d = s.days.length;
    s.days.push({ date: addDays(s.days[s.days.length - 1].date, 3), week: 18, stage: "SF", label: "MSI 준결승" });
    s.days.push({ date: addDays(s.days[s.days.length - 1].date, 3), week: 18, stage: "SF", label: "MSI 준결승" });
    s.series.push({ id: "MSI-SF0", day: d, stage: "SF", a: top[0], b: top[3], bo: 5, games: [], sa: 0, sb: 0, holder1: top[0] });
    s.series.push({ id: "MSI-SF1", day: d + 1, stage: "SF", a: top[1], b: top[2], bo: 5, games: [], sa: 0, sb: 0, holder1: top[1] });
    s.day = d; meta.step = "sf"; st.note = JSON.stringify(meta);
    addNews(s, "season", "MSI 4강 대진 확정", `${top[0]} vs ${top[3]}, ${top[1]} vs ${top[2]}.`, s.team);
    return;
  }
  if (meta.step === "sf") {
    for (const id of ["MSI-SF0", "MSI-SF1"]) {
      const sr = s.series.find((x) => x.id === id);
      if (sr && !sr.winner) { try { simSeries(s, sr, rng); } catch { /* */ } }
    }
    const a = s.series.find((x) => x.id === "MSI-SF0")?.winner, b = s.series.find((x) => x.id === "MSI-SF1")?.winner;
    if (!a || !b) return;
    const d = s.days.length;
    s.days.push({ date: addDays(s.days[s.days.length - 1].date, 4), week: 19, stage: "F", label: "MSI 결승" });
    s.series.push({ id: "MSI-F", day: d, stage: "F", a, b, bo: 5, games: [], sa: 0, sb: 0, holder1: a });
    s.day = d; meta.step = "f"; st.note = JSON.stringify(meta); return;
  }
  if (meta.step === "f") {
    const f = s.series.find((x) => x.id === "MSI-F");
    if (f && !f.winner) { try { simSeries(s, f, rng); } catch { /* */ } }
    if (!f?.winner) return;
    if (f.winner === s.team) st.trophies.msi += 1;
    addNews(s, "season", `${f.winner}, ${st.year} MSI 우승`, f.winner === s.team ? `${s.manager} 감독이 MSI를 우승했습니다.` : `우승은 ${f.winner}.`, f.winner);
    afterMSI(s);
  }
}

function afterMSI(s: Save): void {
  const st = s.story!;
  if (st.year <= 2020) startPromo(s);
  else beginSplit(s, st.year, "summer");
}

export function startWorlds(s: Save): void {
  const st = s.story!;
  st.phase = "worlds";
  // seeds: 서머 우승 → 준우승 → 정규 순위 (일정이 바뀌기 전에 저장해 둔 값)
  const lckSeeds = lckWorldsSeeds(s);
  const intl = ["LPL-1", "LPL-2", "LPL-3", "LEC-1", "LEC-2", "LCS-1", "LCS-2", "PCS-1", "VCS-1", "LCL-1", "CBLOL-1", "LJL-1", "LMS-1"];
  const teams = [...lckSeeds, ...intl].slice(0, 16);
  for (const t of intl) ensureIntlRoster(s, t);
  st.swiss = undefined;
  if (st.year >= 2023) {
    // 기존 게임의 LCK 3장·해외 13팀에 맞춘 4개 추첨 풀. 전력·승패로 풀을 바꾸지 않습니다.
    const pools = [[lckSeeds[0], "LPL-1", "LEC-1", "LCS-1"],
      [lckSeeds[1], "LPL-2", "LEC-2", "LCS-2"],
      [lckSeeds[2], "LPL-3", "PCS-1", "VCS-1"], ["LCL-1", "CBLOL-1", "LJL-1", "LMS-1"]];
    st.swiss = { round: 1, avoidRematches: st.year >= 2024,
      drawRng: (s.seed ^ Math.imul(st.year, 0x45d9f3b)) >>> 0,
      teams: pools.flatMap((pool, i) => pool.map((t) => ({ t, pool: i + 1, region: lckSeeds.includes(t) ? "LCK" : t.split("-")[0] }))) };
    s.days = []; s.series = []; s.day = 0;
    st.note = JSON.stringify({ step: "swiss", lckSeeds });
    appendSwissRound(s);
    addNews(s, "season", `${st.year} 월즈 개막 · 16팀 스위스`, `3승 진출·3패 탈락. 진출·탈락 결정전은 Bo3, 나머지는 Bo1. ${st.swiss.avoidRematches ? "스위스 재대결 금지." : "2023 방식: 2라운드부터 재대결 허용."} LCK 시드: ${lckSeeds.join(", ")}. 해외는 리그 시드 추정 전력이며 개별 선수 기록은 없습니다.`, s.team);
    return;
  }
  const groups: string[][] = [[], [], [], []];
  teams.forEach((t, i) => groups[i % 4].push(t));
  const date = `${st.year}-10-01`;
  s.days = []; s.series = []; s.day = 0;
  let day = 0;
  groups.forEach((g, gi) => {
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) {
      s.days.push({ date: addDays(date, day), week: 30, stage: "R", label: `월즈 조${"ABCD"[gi]} ${g[i]} vs ${g[j]}` });
      s.series.push({ id: `W-G${gi}-${i}-${j}`, day, stage: "R", a: g[i], b: g[j], bo: 3, games: [], sa: 0, sb: 0 });
      day++;
    }
  });
  s.story!.note = JSON.stringify({ groups, lckSeeds, step: "groups" });
  addNews(s, "season", `${st.year} 월즈 개막 · 16팀 4개조`, `LCK 시드: ${lckSeeds.join(", ")}. 조별은 Bo3, 토너먼트는 Bo5입니다. 해외 팀은 리그 시드 이름으로만 등장하며 개별 선수 기록은 없습니다(추정 전력).`, s.team);
}

function ensureIntlRoster(s: Save, t: string): void {
  if (!TM[t]) TM[t] = { id: 800, short: t, name: t, ko: intlName(t), color: "#64748B", starters: [], players: [], real: [0, 0, 0, 0], gw: 0, gl: 0 };
  const keys = s.starters[t] ?? [];
  if (keys.filter(Boolean).length < 5 || keys.some((k) => !PL[k])) s.starters[t] = ghostLineup(t, s.story!.year, storyDiff(s));
}

function appendSwissRound(s: Save): void {
  const st = s.story!.swiss!;
  const rng = new Rng(st.drawRng);
  const pairs = drawSwissRound(st, s.series, rng);
  st.drawRng = rng.s;
  const date = s.days.length ? addDays(s.days[s.days.length - 1].date, 1) : `${s.story!.year}-10-01`;
  const d0 = s.days.length;
  pairs.forEach((p, i) => {
    const day = d0 + i;
    s.days.push({ date: addDays(date, i), week: 40 + st.round, stage: "SW", label: `월즈 스위스 ${st.round}라운드 · ${p.w}승 ${p.l}패` });
    s.series.push({ id: `W-SW${st.round}-${i}`, day, stage: "SW", a: p.a, b: p.b, bo: p.bo, holder1: p.holder1,
      games: [], sa: 0, sb: 0, swiss: { round: st.round, w: p.w, l: p.l } });
  });
  s.day = d0;
  addNews(s, "season", `월즈 스위스 ${st.round}라운드 추첨`, pairs.map((p) => `${p.w}-${p.l}: ${p.a} vs ${p.b} (Bo${p.bo})`).join(", "), s.team);
}

function advanceWorldsSwiss(s: Save): void {
  const st = s.story!.swiss!;
  const open = s.series.filter((sr) => sr.swiss?.round === st.round && !sr.winner).sort((a, b) => a.day - b.day);
  if (open.length) { s.day = open[0].day; return; }
  const rows = swissRows(st, s.series);
  if (rows.some((r) => r.w < 3 && r.l < 3)) {
    st.round++;
    appendSwissRound(s);
    return;
  }
  const draw = new Rng(st.drawRng);
  const pairs = drawSwissKnockout(st, s.series, draw);
  st.drawRng = draw.s;
  startWorldsKnockout(s, pairs, rows.filter((r) => r.w === 3).map((r) => r.t));
}

function intlName(t: string): string {
  const [lg, n] = t.split("-");
  return `${lg} ${n}시드`;
}
export function ghostLineup(tag: string, _year: number, diff: StoryDiff = "normal"): string[] {
  // 보통은 v2.3.3과 같이 키 intl-{tag}-{pos}를 한 번만 만들고, 대회마다 밴드를 덮어쓰지 않습니다.
  // 쉬움·어려움은 키를 나눠 첫 생성 때 난이도 밴드를 넣습니다. 이미 있는 항목은 그대로 둡니다.
  const band = intlGhostBand(tag, diff);
  const keys: string[] = [];
  for (let pos = 0; pos < 5; pos++) {
    const key = diff === "normal" ? `intl-${tag}-${pos}` : `intl-${tag}-${pos}-${diff}`;
    const zFight = (band - 50) / 20;
    if (!PL[key]) {
      PL[key] = {
        key, name: `${intlName(tag)} ${["탑", "정글", "미드", "원딜", "서포터"][pos]}`, full: intlName(tag), team: -1, pos: pos as 0 | 1 | 2 | 3 | 4,
        games: 0, gamesPos: 0, wins: 0, teamsPlayed: {}, m: { gd: null, csd: null, xpd: null, kda: 0, kp: 0, dpm: 0, dsh: 0, gpm: 0, cspm: 0, vspm: 0, wk: 0, pool: 0 },
        kdaRaw: [0, 0, 0], pool: [], z: { lane: 0, fight: zFight, farm: 0, vision: 0, pool: 0, ovr: zFight },
        pct: { lane: band, fight: band, farm: band, vision: 50, pool: 50, ovr: band },
        small: true, label: `${intlName(tag)} · 기록 없음(추정)`, limited: true,
      };
    }
    keys.push(key);
  }
  if (TM[tag]) { TM[tag].starters = keys; TM[tag].players = keys; }
  return keys;
}

export function finishWorldsGroups(s: Save, rng: Rng): void {
  for (const sr of s.series.filter((x) => x.id.startsWith("W-G") && !x.winner)) simSeries(s, sr, rng);
  const meta = JSON.parse(s.story!.note || "{}" ) as { groups: string[][]; step: string };
  const adv: string[] = [];
  (meta.groups ?? []).forEach((g, gi) => {
    const rows = g.map((t) => {
      const won = s.series.filter((x) => x.id.startsWith(`W-G${gi}`) && x.winner === t).length;
      const lost = s.series.filter((x) => x.id.startsWith(`W-G${gi}`) && (x.a === t || x.b === t) && x.winner && x.winner !== t).length;
      return { t, w: won, l: lost };
    }).sort((a, b) => b.w - a.w || a.l - b.l || cmpStr(a.t, b.t));
    adv.push(rows[0].t, rows[1].t);
  });
  // QF: A1-B2, B1-A2, C1-D2, D1-C2
  const pairs: [string, string][] = [[adv[0], adv[3]], [adv[2], adv[1]], [adv[4], adv[7]], [adv[6], adv[5]]];
  startWorldsKnockout(s, pairs, adv);
}

function startWorldsKnockout(s: Save, pairs: [string, string][], adv: string[]): void {
  const meta = JSON.parse(s.story!.note || "{}");
  const date = addDays(s.days[s.days.length - 1].date, 3);
  const d0 = s.days.length;
  pairs.forEach((pr, i) => {
    s.days.push({ date: addDays(date, i), week: s.story!.swiss ? 50 : 31, stage: "PO1", label: `월즈 8강` });
    s.series.push({ id: `W-QF${i}`, day: d0 + i, stage: "PO1", a: pr[0], b: pr[1], bo: 5, games: [], sa: 0, sb: 0, holder1: pr[0] });
  });
  s.day = d0;
  s.story!.note = JSON.stringify({ ...meta, step: "qf", adv });
  addNews(s, "season", "월즈 8강 대진 확정", pairs.map((p) => p.join(" vs ")).join(", "), s.team);
}

export function advanceWorldsKO(s: Save, rng: Rng): void {
  const meta = JSON.parse(s.story!.note || "{}") as { step: string };
  const open = (pref: string) => s.series.filter((x) => x.id.startsWith(pref));
  const allDone = (pref: string) => open(pref).every((x) => x.winner);
  for (const sr of s.series.filter((x) => x.day === s.day && !x.winner && x.a !== s.team && x.b !== s.team)) simSeries(s, sr, rng);
  if (s.series.some((x) => x.day === s.day && !x.winner)) return; // user still playing
  if (meta.step === "qf" && allDone("W-QF")) {
    const w = [0, 1, 2, 3].map((i) => s.series.find((x) => x.id === `W-QF${i}`)!.winner!);
    const d = s.days.length;
    s.days.push({ date: addDays(s.days[s.days.length - 1].date, 3), week: s.story!.swiss ? 51 : 32, stage: "SF", label: "월즈 4강" });
    s.days.push({ date: addDays(s.days[s.days.length - 1].date, 3), week: s.story!.swiss ? 51 : 32, stage: "SF", label: "월즈 4강" });
    s.series.push({ id: "W-SF0", day: d, stage: "SF", a: w[0], b: w[1], bo: 5, games: [], sa: 0, sb: 0 });
    s.series.push({ id: "W-SF1", day: d + 1, stage: "SF", a: w[2], b: w[3], bo: 5, games: [], sa: 0, sb: 0 });
    s.day = d; meta.step = "sf"; s.story!.note = JSON.stringify(meta); return;
  }
  if (meta.step === "sf" && allDone("W-SF")) {
    const w = [s.series.find((x) => x.id === "W-SF0")!.winner!, s.series.find((x) => x.id === "W-SF1")!.winner!];
    const d = s.days.length;
    s.days.push({ date: addDays(s.days[s.days.length - 1].date, 7), week: s.story!.swiss ? 52 : 33, stage: "F", label: "월즈 결승" });
    s.series.push({ id: "W-F", day: d, stage: "F", a: w[0], b: w[1], bo: 5, games: [], sa: 0, sb: 0 });
    s.day = d; meta.step = "f"; s.story!.note = JSON.stringify(meta); return;
  }
  if (meta.step === "f") {
    const f = s.series.find((x) => x.id === "W-F");
    if (!f?.winner) return;
    stEndWorlds(s, f.winner);
  }
}

function stEndWorlds(s: Save, champ: string): void {
  const st = s.story!;
  st.worldsChamp = champ;
  if (champ === s.team) st.trophies.worlds += 1;
  addNews(s, "season", `${champ}, ${st.year} 월즈 우승`, champ === s.team ? `${s.manager} 감독이 ${st.year} 월즈를 들어올렸습니다.` : `우승은 ${champ}. 우리 구단의 여정은 계속됩니다.`, champ);
  if (st.year >= STORY_END) {
    endStory(s, champ === s.team ? "clear" : "fail");
  } else {
    beginOffseason(s);
  }
}

export function endStory(s: Save, how: "clear" | "fail" | "bankrupt"): void {
  const st = s.story!;
  st.ended = how; st.phase = how === "bankrupt" ? "bankrupt" : how; s.phase = "done"; s.session = undefined;
  if (how === "clear") {
    st.note = "클리어";
    addNews(s, "season", "클리어 — 2027 월즈 우승", `2018년 2부에서 출발한 ${s.club?.name ?? s.team}이 2027 월즈를 우승했습니다. LCK ${st.trophies.lck}회, 월즈 ${st.trophies.worlds}회.`, s.team);
  } else if (how === "bankrupt") {
    st.note = "파산";
    addNews(s, "season", "구단주 해임 — 파산", `누적 적자를 견디지 못해 ${s.manager} 감독이 해임되고 구단 운영이 중단되었습니다. 잔고 ${fmtMoney(s.eco.cash)}.`, s.team);
  } else {
    st.note = "미클리어";
    addNews(s, "season", "여정의 끝 — 2027 시즌 종료", `2027년을 마쳤지만 월즈 우승에는 이르지 못했습니다. LCK ${st.trophies.lck}회, 월즈 ${st.trophies.worlds}회. ${st.tier === "CK" && !st.franchised ? "2부에서 프랜차이즈 슬롯을 받지 못해 월즈에 나가지 못했습니다." : ""}`, s.team);
  }
}

let _beginOff: (s: Save) => void = (s) => { s.story!.phase = "stove"; };
let _enterWeeks: (s: Save, rng: import("./rng").Rng) => void = (s) => { s.story!.phase = "stove"; };
export function registerOffseason(fn: (s: Save) => void, weeks?: (s: Save, rng: import("./rng").Rng) => void): void {
  _beginOff = fn; if (weeks) _enterWeeks = weeks;
}
export function beginOffseason(s: Save): void { _beginOff(s); }
export function enterStoveWeeksFromFranchise(s: Save, rng: import("./rng").Rng): void { _enterWeeks(s, rng); }
export const startStove = beginOffseason;

export function finishStove(s: Save, _rng: Rng): void {
  const st = s.story!;
  // 연수 차감·만료는 오프시즌 초·재계약 화면에서 이미 처리합니다.
  const keep = new Set(st.contracts.map((c) => c.key));
  s.starters[s.team] = (s.starters[s.team] ?? []).map((k) => keep.has(k) ? k : "");
  // age cards to next year
  const next = st.year + 1;
  // 기존 계약 연봉을 먼저 정산합니다. 공백 보충으로 미지급 연봉을 써 버리지 않습니다.
  const pay = st.contracts.filter((c) => !c.prepaid).reduce((n, c) => n + c.salary, 0);
  settlePayrollAndSolvency(s);
  const nextKeys = new Map<string, string>();
  for (const ct of st.contracts) {
    const pos = PL[ct.key]?.pos ?? CARDS[ct.cardId]?.posIdx;
    const r = cardForYear(ct.person, next, pos);
    if (!r) continue;
    const nk = ensurePlayer(r.card, next, r.estimated);
    nextKeys.set(ct.key, nk); ct.key = nk; ct.cardId = r.card.id;
  }
  s.starters[s.team] = (s.starters[s.team] ?? []).map((k) => nextKeys.get(k) ?? k);
  s.cards = st.contracts.map((c) => c.key);
  applyStoryWorld(s, next); // AI는 다음 시즌 카드로 다시 짭니다. 이전에는 year===st.year 조건이 항상 참이라 2018 로스터가 남았습니다.
  syncPromises(s);
  if (st.ended) return;
  if (next > STORY_END) { endStory(s, st.trophies.worlds > 0 && st.year >= STORY_END ? "clear" : "fail"); return; }
  beginSplit(s, next, "spring");
  addNews(s, "welcome", `${next} 시즌 개막`, `연봉 ${fmtMoney(pay)}을 정산했습니다. 잔고 ${fmtMoney(s.eco.cash)}.`, s.team);
}

export function resolveFranchise(s: Save, accept: boolean): string | null {
  const st = s.story!;
  st.buyInOffered = true;
  if (st.tier === "LCK") {
    st.franchised = true;
    scaleLckIncome(s);
    addNews(s, "season", "프랜차이즈 슬롯 확보", "2020 시즌을 LCK에서 마쳐 2021 프랜차이즈 자리를 받았습니다. 이후 승강전은 없습니다.", s.team);
    if (st.stove) enterStoveWeeksFromFranchise(s, new Rng((s.seed^0)+st.year*19)); else beginOffseason(s);
    return null;
  }
  const cost = FRANCHISE_BUYIN[s.eco.difficulty];
  if (accept) {
    if (s.eco.cash < cost) return `매수 비용 ${fmtMoney(cost)}이 부족합니다. 현재 ${fmtMoney(s.eco.cash)}.`;
    s.eco.cash = moneyRound(s.eco.cash - cost);
    st.buyInPaid = true; st.franchised = true; st.tier = "LCK";
    scaleLckIncome(s);
    // replace weakest 2021 LCK team
    const yearTeams = lckTeamsOf(2021).map((t) => t.short);
    applyStoryWorld(s);
    const weak = [...yearTeams].sort((a, b) => teamPower(a, 2021) - teamPower(b, 2021) || cmpStr(a, b)).find((t) => t !== s.team) ?? yearTeams[yearTeams.length - 1];
    st.lck = yearTeams.map((t) => t === weak ? s.team : t);
    st.ck = st.ck.filter((t) => t !== s.team);
    addNews(s, "season", "프랜차이즈 매수 합의", `${fmtMoney(cost)}으로 2021 LCK에 진입합니다. 이 게임에서는 전력 최하위 구단(${weak}) 자리를 대신합니다.`, s.team);
    if (st.stove) enterStoveWeeksFromFranchise(s, new Rng((s.seed^0)+st.year*19)); else beginOffseason(s);
    return null;
  }
  st.buyInRefused = true; st.franchised = false; st.tier = "CK";
  addNews(s, "season", "2부 잔류", "매수 제안을 받아들이지 않았습니다. 2021부터는 LCK 챌린저스에서 이어가며, LCK·월즈에는 나갈 수 없습니다.", s.team);
  if (st.stove) enterStoveWeeksFromFranchise(s, new Rng((s.seed^0)+st.year*19)); else beginOffseason(s);
  return null;
}

export function autoQualifyFranchiseIfLck(s: Save): void {
  const st = s.story!;
  if (st.tier === "LCK") resolveFranchise(s, false); // path sets franchised when already LCK
}

/** 남은 정규(또는 지정) 시리즈를 자동 시뮬. 우리 경기도 즉시 시뮬합니다. */
export function simRestOfPhase(s: Save, rng: Rng, onlyOthers = false): void {
  if (onlyOthers) {
    for (const sr of s.series) {
      if (sr.winner || sr.day !== s.day || sr.a === s.team || sr.b === s.team) continue;
      try { simSeries(s, sr, rng); } catch { /* */ }
    }
    return;
  }
  const cur = s.story!.phase;
  let g = 0;
  while (g++ < 80 && s.story!.phase === cur && !s.story!.ended) {
    for (const sr of s.series.filter((x) => !x.winner && (cur !== "regular" || x.day === s.day))) {
      try { simSeries(s, sr, rng); } catch { /* */ }
    }
    const day0 = s.day;
    finishStoryDay(s, rng);
    if (s.story!.phase === cur && s.day === day0 && !s.series.some((x) => !x.winner)) {
      if (cur === "regular") afterRegularSplit(s);
      else break;
    }
  }
}

export function afterRegularSplit(s: Save): void {
  const st = s.story!;
  if (st.tier === "CK") archiveClubSplit(s, standings(s));
  if (st.tier === "LCK") seedTop4PO(s);
  else {
    // CK: no PO, go promo if 2018-2020
    if (st.year <= 2020) startPromo(s);
    else if (st.split === "summer") beginOffseason(s);
    else beginSplit(s, st.year, "summer");
  }
}

export function makeContracts(cardIds: string[], years: number, tier: Tier): Contract[] {
  return cardIds.map((id) => {
    const c = CARDS[id];
    const key = PL[id] ? id : (c ? ensurePlayer(c, c.year, false) : id);
    return { key, cardId: id, years, salary: c ? storySalary(c, tier) : (tier === "CK" ? 0.3 : 1), person: c?.pkey ?? id };
  });
}

export function finishStoryDay(s: Save, rng: Rng): void {
  const st = s.story!;
  if (st.phase === "clear" || st.phase === "fail" || st.phase === "bankrupt" || st.ended) { s.phase = "done"; return; }
  prepareInSeason(s);
  const date = s.days[Math.min(s.day, s.days.length - 1)]?.date;
  if (date) advanceTeamTraining(s, s.team, date);
  for (const sr of s.series.filter((x) => x.day === s.day && !x.winner)) {
    if ((s.starters[sr.a] ?? []).filter(Boolean).length < 5 || (s.starters[sr.b] ?? []).filter(Boolean).length < 5) {
      // still try if intl ghosts
    }
    try { simSeries(s, sr, rng); } catch { /* 라인업 부족 */ }
  }
  if (st.phase === "regular") {
    s.day += 1;
    const regDays = s.days.filter((d) => d.stage === "R").length;
    if (s.day >= regDays) afterRegularSplit(s);
    return;
  }
  if (st.phase === "playoffs") {
    const open = s.series.filter((x) => (x.stage === "SF" || x.stage === "F") && !x.winner);
    if (open.length) {
      const nxt = open.sort((a, b) => a.day - b.day)[0];
      s.day = nxt.day;
    }
    finishStoryPO(s);
    return;
  }
  if (st.phase === "promo") { advancePromo(s, rng); return; }
  if (st.phase === "rtm") { advanceRTM(s, rng); return; }
  if (st.phase === "msi") { advanceMSI(s, rng); return; }
  if (st.phase === "worlds") {
    const meta = JSON.parse(st.note || "{}") as { step?: string };
    if (meta.step === "swiss" && st.swiss) { advanceWorldsSwiss(s); return; }
    if (!meta.step || meta.step === "groups") {
      const open = s.series.filter((x) => x.id.startsWith("W-G") && !x.winner);
      if (open.length) {
        const nxt = open.sort((a, b) => a.day - b.day)[0];
        if (nxt.day !== s.day) { s.day = nxt.day; return; }
      }
      if (s.series.filter((x) => x.id.startsWith("W-G")).every((x) => x.winner)) finishWorldsGroups(s, rng);
      return;
    }
    advanceWorldsKO(s, rng);
    const nxt = s.series.find((x) => !x.winner);
    if (nxt) s.day = nxt.day;
  }
}

export function newStoryCareer(teamShort: string, _manager: string, slot: number, seed: number, opt: {
  club: { name: string; short: string; color: string }; managerInfo: import("./season").Manager;
  eco?: Partial<Economy>; cards: string[]; starters: string[]; difficulty: StoryDiff;
}): Save {
  const rng = new Rng(seed);
  const year = STORY_START;
  const club = opt.club;
  const user: EraTeam = { short: club.short, ko: club.name, name: club.name, color: club.color };
  const lck = lckTeamsOf(year).map((t) => t.short);
  const ck = ckTeamsOf(year, user).map((t) => t.short);
  const cap = STORY_BUDGETS[opt.difficulty];
  const eco: Economy = {
    difficulty: opt.difficulty, cap, cash: cap, trust: 55, fans: 40,
    goal: "po", grant: 0, bonus: 2, trustHit: 6, trustWin: 8,
    ...(opt.eco ?? {}),
  };
  const openPay = opt.cards.reduce((n, id) => n + (CARDS[id] ? storySalary(CARDS[id], "CK") : 0), 0);
  eco.cash = moneyRound(eco.cap + (eco.grant ?? 0) - openPay);   // 목표 추가 지원금을 시작 자금에 더합니다
  const now = new Date().toISOString();
  const info = opt.managerInfo;
  const story: StoryState = {
    year, split: "spring", tier: "CK", phase: "regular",
    lck, ck, franchised: false,
    trophies: { lck: 0, msi: 0, worlds: 0 },
    contracts: makeContracts(opt.cards, 2, "CK"),
  };
  const s: Save = {
    v: 2, slot, seed, rng: rng.s, team: teamShort, manager: info.name, created: now, updated: now,
    mode: "story", managerInfo: info, club, eco, cards: opt.cards,
    day: 0, days: [], series: [], news: [], newsSeq: 0, form: {}, starters: { [teamShort]: opt.starters },
    pstats: {}, sched: {}, schedOk: false, phase: "regular", seen: "", story,
  };
  applyStoryWorld(s);
  initializeClubTimeline(s, false);
  beginSplit(s, year, "spring");
  addNews(s, "welcome", `${info.name} 감독, ${club.name} 창단`, `${club.name}이(가) 2018 챌린저스에서 출발합니다. 목표는 2027 월즈 우승입니다. ${STORY_BUDGET_NOTE}`, teamShort);
  return s;
}

/** 현재 대회/스플릿을 결과가 날 때까지 시뮬합니다. 승패를 조작하지 않고 엔진 그대로 돌립니다. */
export function pumpStory(s: Save, rng: Rng, stop: StoryPhase[] = ["awards", "tryout", "expiry", "stove", "franchise", "clear", "fail", "bankrupt"]): StoryPhase {
  let g = 0;
  while (g++ < 200) {
    const ph = s.story!.phase;
    if (s.story!.ended || stop.includes(ph)) return ph;
    const open = s.series.filter((x) => !x.winner && (ph !== "regular" || x.day === s.day) && (s.starters[x.a]?.length || x.a.includes("-")) && (s.starters[x.b]?.length || x.b.includes("-")));
    for (const sr of open) {
      try { simSeries(s, sr, rng); } catch { /* */ }
    }
    const before = s.story!.phase;
    const day0 = s.day;
    finishStoryDay(s, rng);
    if (s.story!.phase === before && s.day === day0 && !s.series.some((x) => !x.winner)) {
      // stuck
      if (ph === "regular") afterRegularSplit(s);
      else break;
    }
  }
  return s.story!.phase;
}
