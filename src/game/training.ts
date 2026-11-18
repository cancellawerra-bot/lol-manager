/** 훈련 진행도는 커리어의 게임 값이며 원본 시즌 기록과 분리합니다. */
export const AGE_TRAINING_ENABLED = true;
export type TrainingKind = "mechanics" | "strategy" | "recovery";
export interface VerifiedBirth { date: string; sourceUrl: string; checkedAt: string }
export interface TrainingProfile { age?: number; known: boolean; mechanics: number; strategy: number; recovery: number }
export interface TrainingProgress { person: string; mechanicsXp: number; strategyXp: number; fatigue: number; lastDate?: string }
export interface TrainingImpact { mechanics: number; strategy: number; fatigue: number }
export type MatchTraining = Record<string, TrainingImpact>;
export type TrainingSummary = { B: TrainingImpact; R: TrainingImpact };

/** 게임용 학습 효율입니다. 실제 선수의 전성기·능력치를 측정한 수치가 아닙니다. */
export const AGE_TRAINING_ANCHORS = [
  { age: 16, mechanics: 1.15, strategy: 0.95, recovery: 1.10 },
  { age: 19, mechanics: 1.20, strategy: 1.00, recovery: 1.10 },
  { age: 22, mechanics: 1.05, strategy: 1.15, recovery: 1.05 },
  { age: 24, mechanics: 1.00, strategy: 1.20, recovery: 1.00 },
  { age: 28, mechanics: 0.97, strategy: 1.15, recovery: 0.98 },
  { age: 34, mechanics: 0.95, strategy: 1.10, recovery: 0.95 },
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
  const neutral: TrainingProfile = { known: false, mechanics: 1, strategy: 1, recovery: 1 };
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
  return { known: true, age: years, mechanics: lerp(lower.mechanics, upper.mechanics), strategy: lerp(lower.strategy, upper.strategy), recovery: lerp(lower.recovery, upper.recovery) };
}

/** 한 사람의 하루 한 세션. 60분당 XP만 달라져 시간 단축 보너스를 중복 지급하지 않습니다. */
export function trainingSession(progress: TrainingProgress, kind: TrainingKind, date: string, birth?: VerifiedBirth): { progress: TrainingProgress; profile: TrainingProfile; applied: boolean } {
  const profile = trainingProfile(birth, date);
  if (isoDate(date) == null || (progress.lastDate != null && date <= progress.lastDate)) return { progress: { ...progress }, profile, applied: false };
  const p = { ...progress, mechanicsXp: clamp(progress.mechanicsXp, 0, 100), strategyXp: clamp(progress.strategyXp, 0, 100), fatigue: clamp(progress.fatigue, 0, 100), lastDate: date };
  if (kind === "recovery") p.fatigue = clamp(p.fatigue - 25 * profile.recovery, 0, 100);
  else {
    const attr = kind === "mechanics" ? "mechanicsXp" : "strategyXp";
    const fatigueFactor = Math.max(0.5, 1 - p.fatigue / 150);
    const progressFactor = 1 - p[attr] / 200;
    p[attr] = clamp(p[attr] + 10 * profile[kind] * fatigueFactor * progressFactor, 0, 100);
    p.fatigue = clamp(p.fatigue + 12, 0, 100);
  }
  return { progress: p, profile, applied: true };
}

/** 경기 입력에 합성하는 성장 보정. 원본 카드 수치는 수정하지 않습니다. */
export function trainingBonuses(p: TrainingProgress): { mechanics: number; strategy: number } {
  return { mechanics: clamp(p.mechanicsXp, 0, 100) / 100 * 0.03, strategy: clamp(p.strategyXp, 0, 100) / 100 * 0.03 };
}
