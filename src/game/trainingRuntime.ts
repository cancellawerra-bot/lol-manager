import { PL, CARDS, CARDS_BY_PERSON } from "../data";
import { ratingOf, cardRating } from "../rating";
import type { Save, SeriesRec, DayAct } from "./season";
import { AGE_TRAINING_ENABLED, trainingBonuses, trainingProfile, trainingSession, potentialFor, fatiguePenalty, trainedRating, type TrainingProgress, type MatchTraining, type GrowthCtx } from "./training";
import { PLAYER_BIRTHDATES } from "./playerBirthdates";

export interface TrainingState {
  version: 1; periodStart: string; players: Record<string, TrainingProgress>;
  plans: Record<string, DayAct[]>; automatic: Record<string, boolean>;
}
export const previousDate = (date: string): string => new Date(Date.parse(date + "T00:00:00Z") - 86400000).toISOString().slice(0, 10);
const nextDate = (date: string): string => new Date(Date.parse(date + "T00:00:00Z") + 86400000).toISOString().slice(0, 10);
export const trainingDate = (s: Save): string => s.days[Math.min(s.day, s.days.length - 1)]?.date ?? `${s.story?.year ?? 2018}-01-01`;
export function trainingPerson(s: Save, key: string): string | undefined {
  if (!key || key.startsWith("intl-") || !PL[key]) return;
  return s.story?.contracts.find((c) => c.key === key)?.person ?? PL[key].personKey ?? CARDS[key]?.pkey ?? key.toLowerCase();
}
const validPlan = (plan?: DayAct[]): plan is DayAct[] => !!plan && plan.length === 7 && plan.every((a) => ["train", "scrim", "rest"].includes(a)) && plan.includes("rest");
export function initializeTraining(s: Save): TrainingState | undefined {
  if (!AGE_TRAINING_ENABLED || s.mode !== "story") return;
  if (!s.training) {
    s.training = { version: 1, periodStart: trainingDate(s), players: {}, plans: {}, automatic: {} };
    // 이전 버전에서 직접 고른 주간 계획을 사람 기준으로 보존합니다.
    for (const key of s.starters[s.team] ?? []) {
      const person = trainingPerson(s, key);
      if (person && validPlan(s.sched[key])) s.training.plans[person] = [...s.sched[key]];
    }
  }
  return s.training;
}
export function recommendedTraining(person: string | undefined, date: string): DayAct[] {
  const profile = trainingProfile(person ? PLAYER_BIRTHDATES[person] : undefined, date);
  return profile.strategy > profile.mechanics
    ? ["scrim", "train", "scrim", "rest", "train", "scrim", "rest"]
    : ["train", "train", "scrim", "rest", "train", "scrim", "rest"];
}
export function trainingPlan(s: Save, key: string, date = trainingDate(s), team = s.team): DayAct[] {
  const person = trainingPerson(s, key);
  if (team !== s.team) return recommendedTraining(person, date);
  if (person && s.training?.automatic[person]) return recommendedTraining(person, date);
  const plan = (person ? s.training?.plans[person] : undefined) ?? s.sched[key];
  return plan?.length === 7 ? [...plan] : recommendedTraining(person, date);
}
export function setTrainingPlan(s: Save, key: string, plan: DayAct[], automatic = false): void {
  const person = trainingPerson(s, key), state = initializeTraining(s);
  s.sched[key] = [...plan];
  if (!person || !state) return;
  state.automatic[person] = automatic;
  if (automatic) delete state.plans[person]; else state.plans[person] = [...plan];
}
/** 커리어 최고 시즌 능력치(실제 카드 기준). 카드가 없으면 undefined. */
export function careerBest(person: string): number | undefined {
  const cs = CARDS_BY_PERSON[person];
  return cs?.length ? Math.max(...cs.map((c) => cardRating(c))) : undefined;
}
/** 성장 기준: 원본 능력치(지금 시즌 카드) + 잠재력 상한(커리어 최고 + 여유, 최대 100) */
export function growthCtx(s: Save, key: string, date = trainingDate(s)): GrowthCtx | undefined {
  const person = trainingPerson(s, key); if (!person) return;
  const base = ratingOf(PL[key]) ?? 85;
  const age = trainingProfile(PLAYER_BIRTHDATES[person], date);
  const best = Math.max(base, careerBest(person) ?? base);
  return { base, potential: Math.max(base, potentialFor(best, age.known ? age.age : undefined)) };
}
/** 화면용: 훈련 성장을 반영한 능력치(피지컬·뇌지컬·종합) */
export function trainedRatingOf(s: Save, key: string): { phys: number; brain: number; overall: number; base: number; potential: number } | undefined {
  const p = playerTraining(s, key), ctx = growthCtx(s, key); if (!p || !ctx) return;
  return { ...trainedRating(p, ctx), ...ctx };
}
export function playerTraining(s: Save, key: string): TrainingProgress | undefined {
  const person = trainingPerson(s, key);
  if (!person) return;
  return s.training?.players[person] ?? { person, mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
}
function roster(s: Save, team: string): string[] {
  return [...new Set([...(s.starters[team] ?? []), ...(team === s.team ? s.story?.contracts.map((c) => c.key) ?? [] : s.inSeason?.year === s.story?.year ? s.inSeason?.rosters[team]?.map((c) => c.key) ?? [] : [])])];
}
/** 새 스플릿의 공백 기간은 훈련으로 소급 적립하지 않습니다. 성장 XP는 유지하고 긴 휴식의 피로는 회복합니다. */
export function beginTrainingPeriod(s: Save, date: string): void {
  const state = initializeTraining(s); if (!state) return;
  state.periodStart = date;
  for (const team of [...new Set([...(s.story?.lck ?? []), ...(s.story?.ck ?? []), s.team])]) for (const key of roster(s, team)) {
    const person = trainingPerson(s, key); if (!person) continue;
    const old = state.players[person];
    if (old?.lastDate && old.lastDate >= date) continue;
    state.players[person] = { ...(old ?? { person, mechanicsXp: 0, strategyXp: 0, fatigue: 0 }),
      fatigue: old?.lastDate && Date.parse(date) - Date.parse(old.lastDate) <= 14 * 86400000 ? old.fatigue : 0,
      lastDate: previousDate(date) };
  }
}
/** 수동/자동 경기에서 공통 호출. 같은 날짜와 같은 사람은 한 번만 처리합니다. */
export function advanceTeamTraining(s: Save, team: string, date: string): void {
  const state = initializeTraining(s); if (!state) return;
  for (const key of roster(s, team)) {
    const person = trainingPerson(s, key); if (!person) continue;
    let p = state.players[person] ?? { person, mechanicsXp: 0, strategyXp: 0, fatigue: 0, lastDate: previousDate(state.periodStart > date ? date : state.periodStart) };
    if (p.lastDate && p.lastDate >= date) continue;
    const ctx = growthCtx(s, key, date);
    for (let day = nextDate(p.lastDate ?? previousDate(state.periodStart > date ? date : state.periodStart)); day <= date; day = nextDate(day)) {
      const weekday = (new Date(day + "T00:00:00Z").getUTCDay() + 6) % 7;
      const chosen = trainingPlan(s, key, day, team);
      let act = (validPlan(chosen) ? chosen : recommendedTraining(person, day))[weekday];
      const automatic = team !== s.team || state.automatic[person] || (!state.plans[person] && !validPlan(s.sched[key])) || !validPlan(chosen);
      if (automatic && p.fatigue >= 60) act = "rest";
      p = trainingSession(p, act === "train" ? "mechanics" : act === "scrim" ? "strategy" : "recovery", day, PLAYER_BIRTHDATES[person], ctx).progress;
    }
    state.players[person] = p;
  }
}
export function prepareSeriesTraining(s: Save, sr: SeriesRec): void {
  if (sr.winner || !s.days[sr.day]) return;
  for (const team of [sr.a, sr.b]) advanceTeamTraining(s, team, s.days[sr.day].date);
}
export function matchTraining(s: Save, keys: string[]): MatchTraining | undefined {
  if (!AGE_TRAINING_ENABLED || s.mode !== "story") return;
  const result: MatchTraining = {};
  for (const key of keys) {
    const p = playerTraining(s, key); if (!p) continue;
    result[key] = { ...trainingBonuses(p), fatigue: fatiguePenalty(p.fatigue) };
  }
  return result;
}
