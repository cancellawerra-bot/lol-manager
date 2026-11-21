// v2.21.0 성장 규칙 시뮬레이션 (보고용 표). 스토리 한 시즌 ≈ 189일·48세트(2018 시즌 실측).
import { trainingSession, matchExperience, trainedRating, potentialFor, talentSpeed, fatiguePenalty, type TrainingProgress, type GrowthCtx, type VerifiedBirth } from "../../src/game/training";
const SEASON = 189;
export type Plan = ("train" | "scrim" | "rest")[];
export const MAX_PLAN: Plan = ["train", "train", "scrim", "train", "scrim", "train", "rest"]; // 6일 근무(법정 최대) → 6번째는 과훈련
export const LIMIT_PLAN: Plan = ["train", "train", "scrim", "rest", "train", "scrim", "rest"]; // 주 5포인트 = 한도
export function simulate(opts: { name: string; birth: string; startYear: number; base: (year: number) => number; best: number; seasons: number; plan: Plan; setsPerWeek?: number; restWhenTired?: number }) {
  const birth: VerifiedBirth = { date: opts.birth, sourceUrl: "https://example.org/sim", checkedAt: "2026-11-22" };
  let p: TrainingProgress = { person: opts.name, mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
  const rows: { season: number; year: number; age: number; base: number; pot: number; phys: number; brain: number; overall: number; fatigue: number; over: number }[] = [];
  for (let k = 0; k < opts.seasons; k++) {
    const year = opts.startYear + k, base = opts.base(year);
    const age = year - Number(opts.birth.slice(0, 4)) - (opts.birth.slice(5) > "03-01" ? 1 : 0);
    const ctx: GrowthCtx = { base, potential: potentialFor(), speed: talentSpeed(Math.max(opts.best, base)) };
    let t = Date.parse(`${year}-01-15T00:00:00Z`); p = { ...p, weekKey: undefined, weekPts: 0 };
    for (let d = 0; d < SEASON; d++, t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10), wd = (new Date(t).getUTCDay() + 6) % 7;
      let act = opts.plan[wd]; if (opts.restWhenTired != null && p.fatigue >= opts.restWhenTired) act = "rest";
      p = trainingSession(p, act === "train" ? "mechanics" : act === "scrim" ? "strategy" : "recovery", date, birth, ctx).progress;
      if (wd === 2 || wd === 5) for (let i = 0; i < 1; i++) p = { ...matchExperience(p, ctx), fatigue: Math.min(100, p.fatigue + 2) };
    }
    const r = trainedRating(p, ctx);
    rows.push({ season: k + 1, year, age, base, pot: ctx.potential, phys: +r.phys.toFixed(1), brain: +r.brain.toFixed(1), overall: r.overall, fatigue: +p.fatigue.toFixed(0), over: p.overDays ?? 0 });
  }
  return rows;
}
export const firstHundred = (rows: ReturnType<typeof simulate>): number | undefined => { const i = rows.findIndex((r) => r.overall >= 100); return i < 0 ? undefined : i + 1; };
export const CASES = {
  elite: { name: "elite", birth: "2001-03-31", startYear: 2018, base: () => 90, best: 96, seasons: 15, plan: LIMIT_PLAN, restWhenTired: 60 },
  avg82: { name: "avg", birth: "1998-01-01", startYear: 2018, base: () => 82, best: 85, seasons: 15, plan: LIMIT_PLAN, restWhenTired: 60 },
  low75: { name: "low", birth: "1999-01-01", startYear: 2018, base: () => 75, best: 78, seasons: 15, plan: LIMIT_PLAN, restWhenTired: 60 },
  vet: { name: "vet", birth: "1996-05-07", startYear: 2022, base: () => 89, best: 95, seasons: 15, plan: LIMIT_PLAN, restWhenTired: 60 },
  vet82: { name: "vet82", birth: "1997-01-01", startYear: 2024, base: () => 82, best: 85, seasons: 15, plan: LIMIT_PLAN, restWhenTired: 60 },
} as const;
if (process.argv[1]?.endsWith("growth-sim.ts")) {
  const show = (t: string, rows: ReturnType<typeof simulate>) => { console.log(`\n${t} → 100 도달: ${firstHundred(rows) ?? "15시즌 내 없음"}시즌째`); console.log("  " + rows.map((r) => `S${r.season}(만${r.age}) ${r.overall} [피${r.phys.toFixed(1)}/뇌${r.brain.toFixed(1)}]`).join("  ")); };
  show("(a) 최상위 어린 선수 (최고 96, 만16 시작, 기본 90 고정)", simulate(CASES.elite));
  show("(b) 평범한 선수 (최고 85, 만20, 기본 82)", simulate(CASES.avg82));
  show("(c) 낮은 선수 (최고 78, 만19, 기본 75)", simulate(CASES.low75));
  show("(d) 베테랑 (최고 95, 1996생, 만25 시작, 기본 89)", simulate(CASES.vet));
  show("(e) 평범한 베테랑 (최고 85, 만27 시작, 기본 82)", simulate(CASES.vet82));
  const a = simulate({ ...CASES.avg82, seasons: 1 })[0], b = simulate({ ...CASES.avg82, seasons: 1, plan: MAX_PLAN, restWhenTired: undefined })[0];
  console.log(`\n(f) 과훈련: 한도 계획 → 피로 ${a.fatigue}, 경기력 −${(fatiguePenalty(a.fatigue) * 100).toFixed(1)}%, 종합 ${a.overall} / 주 6일 계획 → 과훈련 ${b.over}일, 피로 ${b.fatigue}, 경기력 −${(fatiguePenalty(b.fatigue) * 100).toFixed(1)}%, 종합 ${b.overall}`);
}
