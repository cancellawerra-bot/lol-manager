import { PL, TM, POS_KO } from "../data";
import { rankedMu, shrink, type DraftState, type Side } from "./draft";

export type Tempo = "atk" | "bal" | "safe";
export type Focus = "balanced" | "top" | "jungle" | "mid" | "bot";
export interface TacticPlan { tempo: Tempo; focus: Focus }
export const TEMPO_LABEL: Record<Tempo, string> = { atk: "초반 압박", bal: "균형 운영", safe: "후반 준비" };
export const FOCUS_LABEL: Record<Focus, string> = { balanced: "고른 지원", top: "탑 지원", jungle: "정글 성장 우선", mid: "미드 지원", bot: "바텀 지원" };
export const TEMPO_NOTE: Record<Tempo, string> = {
  atk: "초반 교전·오브젝트에 힘을 싣고 후반 판정에는 부담을 감수합니다.",
  bal: "초반과 후반에 추가 부담을 주지 않는 기본 운영입니다.",
  safe: "초반 주도권을 일부 양보하고 중반·후반 판정에 힘을 남깁니다.",
};
// 게임용 자원 배분입니다. 실제 선수의 성격·실기록·숨은 능력치를 만들지 않습니다.
export const FOCUS_GOLD: Record<Focus, readonly number[]> = {
  balanced: [0, 0, 0, 0, 0], top: [120, 0, -40, -50, -30], jungle: [-30, 120, -30, -30, -30],
  mid: [-40, 0, 120, -50, -30], bot: [-50, 0, -50, 75, 25],
};
export const TEMPO_EFFECT: Record<Tempo, { early: number; late: number }> = {
  atk: { early: .06, late: -.06 }, bal: { early: 0, late: 0 }, safe: { early: -.06, late: .06 },
};
export const TACTIC_LANE_TEMPO = 300;
export function normalizeTactic(p?: Partial<TacticPlan>): TacticPlan {
  return { tempo: validTempo(p?.tempo), focus: validFocus(p?.focus) };
}
const validTempo = (x: unknown): Tempo => x === "atk" || x === "safe" ? x : "bal";
const validFocus = (x: unknown): Focus => x === "top" || x === "jungle" || x === "mid" || x === "bot" ? x : "balanced";
export function matchTactics(d: DraftState, preferences?: Record<string, TacticPlan>): Record<Side, TacticPlan> {
  return { B: normalizeTactic(preferences?.[d.teams.B]), R: normalizeTactic(preferences?.[d.teams.R]) };
}
export const tacticLabel = (p: TacticPlan): string => `${TEMPO_LABEL[p.tempo]} · ${FOCUS_LABEL[p.focus]}`;
export function tacticAllocation(p: TacticPlan): string {
  return FOCUS_GOLD[p.focus].map((v, i) => `${POS_KO[i]} ${v >= 0 ? "+" : ""}${v}`).join(" / ") + " (게임용 골드 배분)";
}
export interface TacticEffects {
  plans: Record<Side, TacticPlan>; lane: number[]; focus: number[]; early: number; late: number;
}
export function tacticEffects(orders?: Record<Side, TacticPlan>): TacticEffects {
  const plans = { B: normalizeTactic(orders?.B), R: normalizeTactic(orders?.R) };
  const early = TEMPO_EFFECT[plans.B.tempo].early - TEMPO_EFFECT[plans.R.tempo].early;
  const late = TEMPO_EFFECT[plans.B.tempo].late - TEMPO_EFFECT[plans.R.tempo].late;
  const focus = FOCUS_GOLD[plans.B.focus].map((v, i) => v - FOCUS_GOLD[plans.R.focus][i]);
  return { plans, early, late, focus, lane: focus.map((v) => v + early * TACTIC_LANE_TEMPO) };
}
export type TacticStage = "opening" | "river" | "dragon" | "tower" | "fight" | "closing";
export const TACTIC_STAGE_LABEL: Record<TacticStage, string> = {
  opening: "첫 교전", river: "첫 유충 우세", dragon: "첫 드래곤", tower: "첫 포탑", fight: "중반 첫 한타", closing: "최종 승패 판정",
};
export interface TacticExecution { target: string; success: boolean; modifier: number }
export function tacticExecution(plans: Record<Side, TacticPlan>, lanes15: number[], river: Side, dragon: Side): Record<Side, TacticExecution> {
  const one = (side: Side): TacticExecution => {
    const focus = plans[side].focus;
    if (focus === "balanced") return { target: "별도 집중 목표 없음", success: true, modifier: 0 };
    const dir = side === "B" ? 1 : -1;
    const success = focus === "top" ? river === side : focus === "bot" ? dragon === side : focus === "jungle" ? lanes15[1] * dir > 0 : lanes15[2] * dir > 0;
    return { target: focus === "top" ? "첫 유충 우세" : focus === "bot" ? "첫 드래곤 확보" : focus === "jungle" ? "14분 정글 골드 우세" : "14분 미드 골드 우세", success, modifier: success ? .04 : -.04 };
  };
  return { B: one("B"), R: one("R") };
}
export interface TacticDecision { stage: TacticStage; before: number; after: number; winner: Side }
export interface TacticsRecord {
  version: 1; teams: Record<Side, string>; teamNames: Record<Side, string>;
  plans: Record<Side, TacticPlan>; laneAdjustment: number[]; lanes15: number[]; decisions: TacticDecision[];
  execution: Record<Side, TacticExecution>;
}
export function tacticsRecord(d: DraftState, effect: TacticEffects, lanes15: number[], decisions: TacticDecision[], execution: Record<Side, TacticExecution>): TacticsRecord {
  return { version: 1, teams: { ...d.teams }, teamNames: { B: TM[d.teams.B]?.ko ?? d.teams.B, R: TM[d.teams.R]?.ko ?? d.teams.R },
    plans: { B: { ...effect.plans.B }, R: { ...effect.plans.R } }, laneAdjustment: [...effect.lane], lanes15: [...lanes15], decisions: decisions.map((x) => ({ ...x })), execution: { B: { ...execution.B }, R: { ...execution.R } } };
}
/** 확인 가능한 현재 선수 라인 지표·랭크 상성만 읽는 게임용 조언. 미래 기록·가상 잠재력 없음. */
export function recommendTactic(d: DraftState, side: Side): { plan: TacticPlan; reasons: string[] } {
  const other: Side = side === "B" ? "R" : "B", scores: (number | undefined)[] = [], reasons: string[] = [];
  for (let pos = 0; pos < 5; pos++) {
    const mine = PL[d.lineup[side][pos]], theirs = PL[d.lineup[other][pos]];
    const a = d.picks[side].find((p) => p.pos === pos), b = d.picks[other].find((p) => p.pos === pos);
    const evidence: number[] = [];
    if (mine?.m.gd != null && theirs?.m.gd != null) evidence.push((mine.z.lane - theirs.z.lane) * .1);
    if (a && b) { const mu = rankedMu(pos, a.c, b.c); if (mu) evidence.push(shrink(mu.wr * mu.n, mu.n) - .5); }
    scores[pos] = evidence.length ? evidence.reduce((n, x) => n + x, 0) / evidence.length : undefined;
    reasons.push(`${POS_KO[pos]}: ${mine?.m.gd != null && theirs?.m.gd != null ? "선수 라인 지표 확인" : "선수 라인 지표 기록 없음"} · ${a && b && rankedMu(pos, a.c, b.c) ? "랭크 상성 30판 이상" : "랭크 상성 표본 부족"}`);
  }
  const mean = (ns: number[]): number => ns.reduce((n, x) => n + x, 0) / ns.length;
  const candidates = ([['top', [0]], ['jungle', [1]], ['mid', [2]], ['bot', [3, 4]]] as [Focus, number[]][]).map(([focus, positions]) => {
    const known = positions.map((i) => scores[i]).filter((x): x is number => x != null);
    return { focus, score: known.length === positions.length ? mean(known) : -Infinity };
  }).sort((a, b) => b.score - a.score);
  const known = scores.filter((x): x is number => x != null), avg = known.length ? mean(known) : 0;
  const plan: TacticPlan = { tempo: avg > .06 ? "atk" : avg < -.06 ? "safe" : "bal", focus: candidates[0].score > .02 ? candidates[0].focus : "balanced" };
  return { plan, reasons };
}
