// 구단주 시즌 목표 정의와 현재 진행 상황. Setup(목표 고르기)과 구단 화면(목표 표)이 같은 표를 씁니다.
import type { Economy, Save } from "./season";
import { standings } from "./season";

export interface GoalDef { id: Economy["goal"]; t: string; grant: number; bonus: number; hit: number; win: number }

export const GOALS: GoalDef[] = [
  { id: "win", t: "우승", grant: 8, bonus: 10, hit: 20, win: 15 },
  { id: "final", t: "결승 진출", grant: 5, bonus: 8, hit: 16, win: 12 },
  { id: "sf", t: "4강", grant: 3, bonus: 6, hit: 12, win: 10 },
  { id: "po", t: "플레이오프 진출", grant: 2, bonus: 5, hit: 10, win: 9 },
  { id: "top8", t: "8위 이내", grant: 1.5, bonus: 5, hit: 10, win: 9 },
];
export const STORY_GOALS: GoalDef[] = [
  { id: "win", t: "2부 우승·승격", grant: 0.5, bonus: 0.6, hit: 16, win: 12 },
  { id: "final", t: "승강전 진출", grant: 0.35, bonus: 0.45, hit: 14, win: 10 },
  { id: "sf", t: "상위 2위", grant: 0.25, bonus: 0.35, hit: 12, win: 9 },
  { id: "po", t: "상위 4위", grant: 0.2, bonus: 0.3, hit: 10, win: 8 },
  { id: "top8", t: "잔류", grant: 0.1, bonus: 0.2, hit: 8, win: 6 },
];

/** 시즌 끝에 구단주가 실제로 보는 달성 조건(season.ts judgeSeason과 같은 기준). */
export const GOAL_RULE: Record<Economy["goal"], string> = {
  win: "플레이오프에서 우승",
  final: "플레이오프 결승 진출",
  sf: "플레이오프 4강(준결승) 이상",
  po: "정규 시즌 상위 6위(플레이오프 진출)",
  top8: "정규 시즌 8위 이내",
};

export type GoalState = "wait" | "ok" | "risk" | "fail";
/** 지금 목표에 얼마나 다가갔는지(구단주 평가 모드 전용). */
export function goalStatus(s: Save): { state: GoalState; text: string } {
  const g = s.eco.goal;
  if (s.phase === "done") {
    const ok = !!s.ownerNote && s.ownerNote.includes("달성했습니다");
    return { state: ok ? "ok" : "fail", text: s.ownerNote ?? "시즌이 끝났습니다." };
  }
  const rows = standings(s);
  const idx = rows.findIndex((r) => r.t === s.team);
  const me = rows[idx];
  const rank = idx + 1;
  const played = (st: string): boolean => s.series.some((x) => x.stage === st && (x.a === s.team || x.b === s.team));
  if (s.phase === "regular") {
    if (!me || me.w + me.l === 0) return { state: "wait", text: "아직 경기를 치르지 않았습니다. 정규 시즌 순위가 정해지면 여기에 표시됩니다." };
    if (g === "top8") return rank <= 8 ? { state: "ok", text: `현재 ${rank}위 — 8위 이내입니다. 시즌 끝까지 지키면 달성입니다.` } : { state: "risk", text: `현재 ${rank}위 — 8위 안으로 올라야 합니다.` };
    return rank <= 6
      ? { state: "ok", text: `현재 ${rank}위 — 플레이오프 진출권(상위 6위)입니다. ${g === "po" ? "지키면 달성입니다." : `목표(${GOAL_RULE[g]})는 플레이오프 성적으로 정해집니다.`}` }
      : { state: "risk", text: `현재 ${rank}위 — 플레이오프 진출권(상위 6위) 밖입니다.` };
  }
  // 플레이오프 중
  const seeded = (s.seeds ?? []).includes(s.team);
  if (!seeded) return { state: "fail", text: "플레이오프에 진출하지 못했습니다." };
  if (g === "po") return { state: "ok", text: "플레이오프에 진출해 목표를 달성했습니다. 결과는 시즌 끝에 반영됩니다." };
  const lost = (st: string): boolean => s.series.some((x) => x.stage === st && (x.a === s.team || x.b === s.team) && x.winner && x.winner !== s.team);
  if (lost("F") || lost("SF") || lost("PO1")) {
    const reached = played("F") ? "final" : played("SF") ? "sf" : "po";
    const okNow = g === "final" ? reached === "final" : g === "sf" ? reached === "final" || reached === "sf" : false;
    return { state: okNow ? "ok" : "fail", text: okNow ? "목표 단계까지 올랐습니다. 결과는 시즌 끝에 반영됩니다." : "플레이오프에서 탈락해 이번 목표는 달성하지 못했습니다." };
  }
  if (g === "sf" && (played("SF") || played("F"))) return { state: "ok", text: "4강에 올라 목표를 달성했습니다. 결과는 시즌 끝에 반영됩니다." };
  if (g === "final" && played("F")) return { state: "ok", text: "결승에 올라 목표를 달성했습니다. 결과는 시즌 끝에 반영됩니다." };
  return { state: "risk", text: `플레이오프 진행 중 — 목표: ${GOAL_RULE[g]}.` };
}
