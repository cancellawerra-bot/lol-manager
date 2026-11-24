// v2.38.2 역사 모드 약팀 성장 가속: 낮은 능력치에서만 붙고, 스토리 상위 유망주(4시즌)보다 빨리 100에 닿지 않음
import assert from "node:assert/strict";
import { simulate, firstHundred, CASES } from "./growth-sim";
import { potentialFor, talentSpeed, trainingSession, trainedRating, matchExperience, type GrowthCtx, type TrainingProgress, type VerifiedBirth } from "../../src/game/training";
import { historyGrowthSpeed, HISTORY_GROWTH_FULL, HISTORY_GROWTH_CUTOFF } from "../../src/game/historyGrowth";
import { historyGrowthBoost } from "../../src/game/story";

assert.equal(historyGrowthBoost(4), 1); assert.equal(historyGrowthBoost(5), 1.4); assert.equal(historyGrowthBoost(8), 1.8);
assert.equal(historyGrowthSpeed(1, 70), 1);
assert.equal(historyGrowthSpeed(1.8, 70), 1.8);
assert.equal(historyGrowthSpeed(1.8, HISTORY_GROWTH_FULL), 1.8);
assert.equal(historyGrowthSpeed(1.8, HISTORY_GROWTH_CUTOFF), 1);
assert.equal(historyGrowthSpeed(1.8, 95), 1);
assert.equal(historyGrowthSpeed(1.4, 85), 1 + 0.4 * 0.5);
assert(historyGrowthSpeed(1.8, 85) < 1.8 && historyGrowthSpeed(1.8, 85) > 1);

const SEASON = 189;
function simulateHistory(opts: Parameters<typeof simulate>[0] & { boost: number }) {
  const birth: VerifiedBirth = { date: opts.birth, sourceUrl: "https://example.org/sim", checkedAt: "2026-11-22" };
  let p: TrainingProgress = { person: opts.name, mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
  const rows: { season: number; overall: number }[] = [];
  for (let k = 0; k < opts.seasons; k++) {
    const year = opts.startYear + k, base = opts.base(year);
    let t = Date.parse(`${year}-01-15T00:00:00Z`); p = { ...p, weekKey: undefined, weekPts: 0 };
    for (let d = 0; d < SEASON; d++, t += 86400000) {
      const date = new Date(t).toISOString().slice(0, 10), wd = (new Date(t).getUTCDay() + 6) % 7;
      const cur = trainedRating(p, { base, potential: potentialFor(), speed: 1 });
      const ctx: GrowthCtx = { base, potential: potentialFor(), speed: talentSpeed(Math.max(opts.best, base)) * historyGrowthSpeed(opts.boost, cur.overall) };
      let act = opts.plan[wd]; if (opts.restWhenTired != null && p.fatigue >= opts.restWhenTired) act = "rest";
      p = trainingSession(p, act === "train" ? "mechanics" : act === "scrim" ? "strategy" : "recovery", date, birth, ctx).progress;
      if (wd === 2 || wd === 5) p = { ...matchExperience(p, ctx), fatigue: Math.min(100, p.fatigue + 2) };
    }
    rows.push({ season: k + 1, overall: trainedRating(p, { base, potential: potentialFor(), speed: 1 }).overall });
  }
  return rows;
}

const story: Record<string, number | undefined> = Object.fromEntries(Object.entries(CASES).map(([k, c]) => [k, firstHundred(simulate(c))]));
assert.equal(story.elite, 4); assert.equal(story.vet, 5); assert.equal(story.avg82, 8); assert.equal(story.vet82, 10); assert.equal(story.low75, 11);

const hit = (boost: number) => Object.fromEntries(Object.entries(CASES).map(([k, c]) => [k, firstHundred(simulateHistory({ ...c, boost }) as any)]));
const mid = hit(1.4), weak = hit(1.8);
console.log("story", JSON.stringify(story));
console.log("history 5-7 (+40% tapered)", JSON.stringify(mid));
console.log("history 8-10 (+80% tapered)", JSON.stringify(weak));

// 스토리 성장은 그대로, 약팀 가속이 있어도 상위 유망주(4시즌)보다 빠르지 않음
for (const [k, n] of Object.entries(weak)) {
  assert(n != null && n >= 4, `${k} 약팀 1.8이 4시즌보다 빠름: ${n}`);
  assert(n <= (story[k] as number), `${k} 약팀 지원 후 더 느려지면 안 됨: ${n} vs 스토리 ${story[k]}`);
}
assert.equal(weak.elite, 4, "90에서 시작하는 유망주는 가속이 없어 스토리와 같은 4시즌");
assert(weak.low75! < story.low75!, "낮은 선수는 따라잡는 속도가 빨라야 함");
assert.equal(hit(1).elite, 4, "배수 1은 스토리와 같음");

// 예전처럼 배수를 끝까지 곱하면 유망주가 3시즌 만에 100 — 이 정리로 막힘
assert.equal(firstHundred(simulate({ ...CASES.elite, seasons: 15 })), 4);
console.log("OK history growth taper: weak-team catch-up below 90, none at 90+, no one faster than 4 seasons");
