// v2.21.0 성장 규칙: 100은 가능하지만 쉽지 않게
import assert from "node:assert/strict";
import { simulate, MAX_PLAN, LIMIT_PLAN } from "./growth-sim";
import { potentialFor, growthRoom, trainingSession, fatiguePenalty, WEEKLY_POINTS } from "../../src/game/training";
// 잠재력: 최고 96 → 100 가능, 평범(85) → 89 이하
assert.equal(potentialFor(96, 20), 100); assert(potentialFor(85, 20) <= 89); assert(potentialFor(90, 26) < 100);
assert(growthRoom(75) > growthRoom(91) && growthRoom(91) > growthRoom(97), "체감 성장");
// 1시즌 안에는 100 불가 (기본 95 최상위 어린 선수, 최적 관리)
for (const base of [90, 93, 95]) {
  const r = simulate({ name: "x", birth: "2003-03-31", startYear: 2022, base: () => base, best: 96, seasons: 1, plan: LIMIT_PLAN, restWhenTired: 60 })[0];
  assert(r.overall < 100, `1시즌 100 불가 (기본 ${base} → ${r.overall})`);
  assert(r.overall - base <= 3, `90+ 시즌당 소폭 (${base} → ${r.overall})`);
}
// 최상위는 여러 시즌(3시즌 이상)에 100 가능
const elite = simulate({ name: "e", birth: "2001-03-31", startYear: 2018, base: (y) => Math.min(96, 88 + (y - 2018) * 1.2), best: 96, seasons: 8, plan: LIMIT_PLAN, restWhenTired: 60 });
const hit = elite.findIndex((r) => r.overall >= 100);
assert(hit >= 2, `100 도달은 3시즌째 이후 (${hit + 1})`);
// 평범한 선수는 상한 안
const avg = simulate({ name: "a", birth: "1998-01-01", startYear: 2018, base: () => 82, best: 85, seasons: 8, plan: MAX_PLAN, restWhenTired: 60 });
assert(avg.every((r) => r.phys <= r.pot && r.brain <= r.pot && r.overall <= 89), "평범한 선수 상한");
// 과훈련: 주 한도 초과 날은 성장 없이 피로 3배
const ctx = { base: 85, potential: 92 };
let p = { person: "o", mechanicsXp: 0, strategyXp: 0, fatigue: 0 } as any;
const days = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06"];
const out: any[] = [];
for (const d of days) { const r = trainingSession(p, "mechanics", d, undefined, ctx); out.push(r); p = r.progress; }
assert.equal(out.filter((r) => r.over).length, days.length - WEEKLY_POINTS);
const last = out[out.length - 1], prev = out[out.length - 2].progress;
assert.equal(last.progress.physGain, prev.physGain, "과훈련 날 성장 없음");
assert(last.progress.fatigue - prev.fatigue > 30, "과훈련 피로 3배");
assert(fatiguePenalty(100) > fatiguePenalty(50) * 2.5, "피로 60+ 컨디션 저하");
console.log("OK growth rules: no 100 in one season, elite reaches 100 at season", hit + 1, "| ordinary capped | overtraining penalty");
