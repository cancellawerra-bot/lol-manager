// v2.21.0 성장 규칙 시뮬레이션 (보고용 표). 스토리 한 시즌 ≈ 189일·48세트(2018 시즌 실측).
import { trainingSession, matchExperience, trainedRating, potentialFor, fatiguePenalty, type TrainingProgress, type GrowthCtx, type VerifiedBirth } from "../../src/game/training";
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
    const ctx: GrowthCtx = { base, potential: Math.max(base, potentialFor(Math.max(opts.best, base), age)) };
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
if (process.argv[1]?.endsWith("growth-sim.ts")) {
  const show = (t: string, rows: ReturnType<typeof simulate>) => { console.log("\n" + t); for (const r of rows) console.log(`  S${r.season} ${r.year} 만${r.age} 기본${r.base} 상한${r.pot} → 피지컬 ${r.phys} · 뇌지컬 ${r.brain} · 종합 ${r.overall}`); };
  show("(a) 최상위 어린 선수 (최고 96, 17세 시작, 기본 90 고정, 주 5포인트 한도 계획)", simulate({ name: "elite", birth: "2001-03-31", startYear: 2018, base: () => 90, best: 96, seasons: 8, plan: LIMIT_PLAN, restWhenTired: 60 }));
  show("(a2) 최상위 어린 선수, 실제 기록 상승 반영 (기본 88→96)", simulate({ name: "elite2", birth: "2001-03-31", startYear: 2018, base: (y) => Math.min(96, 88 + (y - 2018) * 1.2), best: 96, seasons: 8, plan: LIMIT_PLAN, restWhenTired: 60 }));
  show("(b) 평범한 선수 (최고 85, 20세, 기본 82 고정)", simulate({ name: "avg", birth: "1998-01-01", startYear: 2018, base: () => 82, best: 85, seasons: 6, plan: LIMIT_PLAN, restWhenTired: 60 }));
  show("(b2) 70대 선수 (최고 80, 19세, 기본 74)", simulate({ name: "low", birth: "1999-01-01", startYear: 2018, base: () => 74, best: 80, seasons: 4, plan: LIMIT_PLAN, restWhenTired: 60 }));
  show("(c) 베테랑 Faker형 (최고 95, 1996-05-07생, 2022부터 기본 89 고정)", simulate({ name: "vet", birth: "1996-05-07", startYear: 2022, base: () => 89, best: 95, seasons: 5, plan: LIMIT_PLAN, restWhenTired: 60 }));
  const a = simulate({ name: "o1", birth: "2001-03-31", startYear: 2020, base: () => 85, best: 90, seasons: 1, plan: LIMIT_PLAN, restWhenTired: 60 })[0];
  const b = simulate({ name: "o2", birth: "2001-03-31", startYear: 2020, base: () => 85, best: 90, seasons: 1, plan: MAX_PLAN })[0];
  console.log(`\n(d) 과훈련: 한도 계획 → 피로 ${a.fatigue}, 경기력 −${(fatiguePenalty(a.fatigue) * 100).toFixed(1)}%, 종합 ${a.overall} / 주 6일 계획 → 과훈련 ${b.over}일, 피로 ${b.fatigue}, 경기력 −${(fatiguePenalty(b.fatigue) * 100).toFixed(1)}%, 종합 ${b.overall}`);
}
