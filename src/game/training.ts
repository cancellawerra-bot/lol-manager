/** 훈련 진행도는 커리어의 게임 값이며 원본 시즌 기록과 분리합니다. */
export const AGE_TRAINING_ENABLED = true;
export type TrainingKind = "mechanics" | "strategy" | "champion" | "recovery";
export interface VerifiedBirth { date: string; sourceUrl: string; checkedAt: string }
export interface TrainingProfile { age?: number; known: boolean; mechanics: number; strategy: number; recovery: number; fatigueLoad: number }
export interface TrainingProgress {
  person: string; mechanicsXp: number; strategyXp: number; fatigue: number; lastDate?: string;
  /** v2.21.0 성장(능력치 점수). 피지컬 = 교전·압박, 뇌지컬 = 판단·운영. 원본 카드 능력치 위에 더합니다. */
  physGain?: number; brainGain?: number;
  /** 주간 훈련 포인트(월요일 기준 주) */
  weekKey?: string; weekPts?: number; weekPhys?: number;
  /** 누적 출전 세트 수(뇌지컬 경험) · 누적 과훈련 일수 */
  sets?: number; overDays?: number;
  /** 처리한 일정 일수(훈련·스크림·휴식 포함) */
  days?: number;
  /** v2.34.0 챔피언 훈련: 연습할 챔피언(champFocus)과 챔피언별 누적 연습 일수(champs). 경기의 챔피언 숙련도 보정에 반영됩니다. */
  champFocus?: string; champs?: Record<string, number>;
}
/** 성장 계산 기준: 원본 능력치(base), 상한(potential = 모든 선수 100), 재능에 따른 성장 속도(speed, 기본 1) */
export interface GrowthCtx { base: number; potential: number; speed?: number }
export interface TrainingImpact { mechanics: number; strategy: number; fatigue: number }
export type MatchTraining = Record<string, TrainingImpact>;
export type TrainingSummary = { B: TrainingImpact; R: TrainingImpact };

/** 게임용 학습 효율입니다. 실제 선수의 전성기·능력치를 측정한 수치가 아닙니다. */
export const AGE_TRAINING_ANCHORS = [
  { age: 16, mechanics: 1.15, strategy: 0.95, recovery: 1.10, fatigueLoad: 0.95 },
  { age: 19, mechanics: 1.20, strategy: 1.00, recovery: 1.10, fatigueLoad: 0.95 },
  { age: 22, mechanics: 1.05, strategy: 1.15, recovery: 1.05, fatigueLoad: 1.00 },
  { age: 24, mechanics: 1.00, strategy: 1.20, recovery: 1.00, fatigueLoad: 1.04 },
  { age: 28, mechanics: 0.97, strategy: 1.15, recovery: 0.98, fatigueLoad: 1.10 },
  { age: 34, mechanics: 0.95, strategy: 1.10, recovery: 0.95, fatigueLoad: 1.16 },
] as const;
const clamp = (n: number, lo: number, hi: number): number => Number.isFinite(n) ? Math.max(lo, Math.min(hi, n)) : lo;
function isoDate(text: string): number | undefined {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return;
  const t = Date.parse(text + "T00:00:00Z");
  if (!Number.isFinite(t) || new Date(t).toISOString().slice(0, 10) !== text) return;
  return t;
}

/** 커리어의 현재 날짜로 계산합니다. 카드 기록 연도나 PC의 현재 날짜를 쓰지 않습니다. */
export function trainingProfile(birth: VerifiedBirth | undefined, date: string): TrainingProfile {
  const neutral: TrainingProfile = { known: false, mechanics: 1, strategy: 1, recovery: 1, fatigueLoad: 1 };
  const now = isoDate(date), born = birth ? isoDate(birth.date) : undefined;
  if (now == null || born == null || born > now || !/^https:\/\//.test(birth!.sourceUrl) || isoDate(birth!.checkedAt) == null) return neutral;
  const b = new Date(born), d = new Date(now);
  let years = d.getUTCFullYear() - b.getUTCFullYear();
  const anniversary = (year: number): number => Date.UTC(year, b.getUTCMonth(), b.getUTCDate());
  if (now < anniversary(d.getUTCFullYear())) years--;
  const last = anniversary(b.getUTCFullYear() + years), next = anniversary(b.getUTCFullYear() + years + 1);
  const age = years + (now - last) / (next - last);
  const point = clamp(age, 16, 34);
  const lower = [...AGE_TRAINING_ANCHORS].reverse().find((a) => a.age <= point)!;
  const upper = AGE_TRAINING_ANCHORS.find((a) => a.age >= point)!;
  const f = upper.age === lower.age ? 0 : (point - lower.age) / (upper.age - lower.age);
  const lerp = (a: number, b_: number): number => a + (b_ - a) * f;
  return { known: true, age: years, mechanics: lerp(lower.mechanics, upper.mechanics), strategy: lerp(lower.strategy, upper.strategy), recovery: lerp(lower.recovery, upper.recovery), fatigueLoad: lerp(lower.fatigueLoad, upper.fatigueLoad) };
}

// ---- v2.21.0 성장 규칙 (Grok 2026-11-22) ----
// 100까지 오를 수 있지만 쉽지 않게: 잠재력 상한 + 체감 성장 + 나이 곡선 + 주간 훈련 한도(과훈련 = 컨디션 저하).
/** 주간 훈련 포인트 한도(훈련·스크림 1회 = 1포인트). 넘는 날은 성장 없이 피로만 크게 쌓입니다. */
export const WEEKLY_POINTS = 5;
/** 훈련 1포인트당 기본 성장(능력치 점수) */
export const GROWTH_STEP = 0.09;
/** 피지컬 하락(훈련을 쉰 시즌 기준): 25–27세 0.4, 28–30세 0.7, 31세+ 1.0. 스토리 한 시즌의 훈련 처리 일수(실측 약 189일)를 한 시즌으로 봅니다. */
export const SEASON_DAYS = 189;
const lerp = (a: number, b: number, t: number): number => a + (b - a) * clamp(t, 0, 1);
/** 체감 성장: 70대는 잘 오르고 90+는 느리고 95+는 더 느립니다. */
export function growthRoom(r: number): number {
  if (r < 80) return 1;
  if (r < 90) return lerp(1, 0.55, (r - 80) / 10);
  if (r < 95) return lerp(0.55, 0.4, (r - 90) / 5);
  return lerp(0.4, 0.3, (r - 95) / 5);
}
/** 상한(100)에 닿으면 멈춤 */
const headroom = (r: number, pot: number): number => (r < pot ? 1 : 0);
/** v2.21.1 (교수님 정정 "모든 선수가 다 올릴 수 있다고"): 모든 선수의 상한은 100입니다. 재능 차이는 상한이 아니라 성장 속도로만 둡니다. */
export const GROWTH_CAP = 100;
export function potentialFor(_best?: number, _age?: number): number { return GROWTH_CAP; }
/** 재능 = 성장 속도: 커리어 최고 시즌 능력치 88 기준 1배, 1점당 ±2.5% (0.85–1.2배) */
export const talentSpeed = (best?: number): number => best == null ? 1 : clamp(1 + (best - 88) * 0.025, 0.85, 1.2);
/** 나이 곡선: 어린 선수는 피지컬이 빨리 오르고, 뇌지컬은 출전 경험이 쌓여야 오릅니다.
 *  25세부터 피지컬이 서서히 내려가지만, 그 주에 피지컬 훈련을 2회 이상 하면 하락하지 않습니다(훈련으로 극복 가능). */
export function ageGrowth(age?: number): { phys: number; brain: number; decline: number } {
  if (age == null) return { phys: 1, brain: 1, decline: 0 };
  if (age <= 22) return { phys: 1.3, brain: 0.95, decline: 0 };
  if (age <= 24) return { phys: 1, brain: 1, decline: 0 };
  if (age <= 27) return { phys: 0.85, brain: 1.1, decline: 0.4 };
  if (age <= 30) return { phys: 0.75, brain: 1.1, decline: 0.7 };
  return { phys: 0.65, brain: 1.05, decline: 1.0 };
}
/** 피지컬 하락을 막는 주간 피지컬 훈련 횟수 */
export const DECLINE_GUARD = 2;
/** 뇌지컬 경험 계수: 출전 0세트 0.6배 → 70세트 1.3배(최대) */
export const experienceFactor = (sets = 0): number => clamp(0.6 + sets / 100, 0.6, 1.3);
function weekKeyOf(date: string): string {
  const t = Date.parse(date + "T00:00:00Z"), wd = (new Date(t).getUTCDay() + 6) % 7;
  return new Date(t - wd * 86400000).toISOString().slice(0, 10);
}
/** 화면·경기용 성장 반영 능력치. 각 축은 잠재력 상한을 넘지 않고, 종합은 두 축 평균(최대 100). */
export function trainedRating(p: TrainingProgress, ctx: GrowthCtx): { phys: number; brain: number; overall: number } {
  const cap = Math.max(ctx.base, ctx.potential);
  const phys = clamp(ctx.base + (p.physGain ?? 0), 60, cap), brain = clamp(ctx.base + (p.brainGain ?? 0), 60, cap);
  return { phys, brain, overall: Math.min(100, Math.round((phys + brain) / 2)) };
}
function grow(r: number, pot: number, factor: number, speed = 1): number {
  return GROWTH_STEP * factor * speed * growthRoom(r) * headroom(r, pot);
}
/** 출전 1세트: 뇌지컬 경험(세트 수)과 작은 뇌지컬 성장. 같은 세트는 호출하는 쪽에서 한 번만 처리합니다. */
export function matchExperience(p: TrainingProgress, ctx?: GrowthCtx): TrainingProgress {
  const out = { ...p, sets: (p.sets ?? 0) + 1 };
  if (ctx) { const b = p.brainGain ?? p.strategyXp * 0.04; out.brainGain = b + grow(ctx.base + b, ctx.potential, 0.15 * experienceFactor(p.sets), ctx.speed); }
  return out;
}

/** 한 사람의 하루 한 세션. 60분당 XP만 달라져 시간 단축 보너스를 중복 지급하지 않습니다. ctx가 있으면 능력치 성장도 계산합니다. */
export function trainingSession(progress: TrainingProgress, kind: TrainingKind, date: string, birth?: VerifiedBirth, ctx?: GrowthCtx): { progress: TrainingProgress; profile: TrainingProfile; applied: boolean; over?: boolean } {
  const profile = trainingProfile(birth, date);
  if (isoDate(date) == null || (progress.lastDate != null && date <= progress.lastDate)) return { progress: { ...progress }, profile, applied: false };
  const p = { ...progress, mechanicsXp: clamp(progress.mechanicsXp, 0, 100), strategyXp: clamp(progress.strategyXp, 0, 100), fatigue: clamp(progress.fatigue, 0, 100), lastDate: date };
  p.days = (p.days ?? 0) + 1;
  const wk = weekKeyOf(date);
  // 옛 세이브: 성장 필드가 없으면 숙련 XP 100 = 4점으로 한 번 옮깁니다.
  if (ctx && p.physGain === undefined) p.physGain = p.mechanicsXp * 0.04;
  if (ctx && p.brainGain === undefined) p.brainGain = p.strategyXp * 0.04;
  const ag0 = ageGrowth(profile.known ? profile.age : undefined);
  if (p.weekKey !== wk) {
    // 지난주 피지컬 훈련이 2회 미만이면 그 주만큼 피지컬 하락(25세+). 성장분에서만, 최저 −2.
    if (ctx && p.weekKey && ag0.decline > 0 && (p.weekPhys ?? 0) < DECLINE_GUARD) p.physGain = Math.max(-2, (p.physGain ?? 0) - ag0.decline * 7 / SEASON_DAYS);
    p.weekKey = wk; p.weekPts = 0; p.weekPhys = 0;
  }
  const ag = ageGrowth(profile.known ? profile.age : undefined);
  let over = false;
  if (kind === "recovery") p.fatigue = clamp(p.fatigue - 25 * profile.recovery, 0, 100);
  else {
    p.weekPts = (p.weekPts ?? 0) + 1;
    over = p.weekPts > WEEKLY_POINTS;
    if (kind === "mechanics" && !over) p.weekPhys = (p.weekPhys ?? 0) + 1;
    const champ = kind === "champion";   // 챔피언 훈련은 성장(XP·능력치) 대신 연습한 챔피언의 숙련을 쌓습니다
    const attr = kind === "mechanics" ? "mechanicsXp" : "strategyXp";
    const fatigueFactor = Math.max(0.5, 1 - p.fatigue / 150);
    const progressFactor = 1 - p[attr] / 200;
    if (!over && !champ) p[attr] = clamp(p[attr] + 10 * profile[kind as "mechanics" | "strategy"] * fatigueFactor * progressFactor, 0, 100);
    if (!over && champ && p.champFocus) p.champs = { ...(p.champs ?? {}), [p.champFocus]: (p.champs?.[p.champFocus] ?? 0) + 1 };
    // 과훈련: 성장 없음 + 피로 3배 → 컨디션 저하
    p.fatigue = clamp(p.fatigue + 12 * profile.fatigueLoad * (over ? 3 : 1), 0, 100);
    if (over) p.overDays = (p.overDays ?? 0) + 1;
    else if (ctx && !champ) {
      if (kind === "mechanics") p.physGain = (p.physGain ?? 0) + grow(ctx.base + (p.physGain ?? 0), ctx.potential, ag.phys * fatigueFactor, ctx.speed);
      else p.brainGain = (p.brainGain ?? 0) + grow(ctx.base + (p.brainGain ?? 0), ctx.potential, ag.brain * experienceFactor(p.sets) * fatigueFactor, ctx.speed);
    }
  }
  return { progress: p, profile, applied: true, over };
}

/** 경기 입력에 합성하는 성장 보정. 원본 카드 수치는 수정하지 않습니다. */
/** v2.21.0: 성장한 능력치 점수 1점 = 경기 입력 +0.5%. 옛 세이브(성장 필드 없음)는 숙련 XP 100 = 4점으로 환산합니다. */
export const BONUS_PER_POINT = 0.005;
export function trainingBonuses(p: TrainingProgress): { mechanics: number; strategy: number } {
  const phys = p.physGain ?? clamp(p.mechanicsXp, 0, 100) * 0.04, brain = p.brainGain ?? clamp(p.strategyXp, 0, 100) * 0.04;
  return { mechanics: clamp(phys, -2, 15) * BONUS_PER_POINT, strategy: clamp(brain, 0, 15) * BONUS_PER_POINT };
}
/** 피로 → 경기력 저하: 기본 피로 0~2% + 피로 60 넘는 컨디션 저하 최대 3% 추가 */
export const fatiguePenalty = (fatigue: number): number => clamp(fatigue, 0, 100) / 100 * 0.02 + clamp(fatigue - 60, 0, 40) / 40 * 0.03;
