// v2.21.1 성장 규칙 (교수님 정정: 모든 선수가 100까지 올릴 수 있다. 다만 쉽지 않게)
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { simulate, firstHundred, CASES, MAX_PLAN, LIMIT_PLAN } from "./growth-sim";
import { potentialFor, talentSpeed, growthRoom, trainingSession, trainedRating, fatiguePenalty, WEEKLY_POINTS } from "../../src/game/training";
// 모든 카드 상한 100 (커리어 최고와 무관), 재능은 속도로만
const cards = JSON.parse(readFileSync("public/data/cards.json", "utf8")).cards as { pkey: string; composite: number }[];
for (const c of cards) assert.equal(potentialFor(Math.round(85 + 4 * c.composite), 30), 100, `상한 100 ${c.pkey}`);
assert(talentSpeed(96) > talentSpeed(85) && talentSpeed(85) >= 0.85 && talentSpeed(99) <= 1.2);
assert.equal(trainedRating({ person: "x", mechanicsXp: 0, strategyXp: 0, fatigue: 0, physGain: 40, brainGain: 40 }, { base: 70, potential: potentialFor() }).overall, 100);
assert(growthRoom(75) > growthRoom(91) && growthRoom(91) > growthRoom(97), "체감 성장");
// 1시즌 안에는 100 불가 (최상위 어린 선수, 최적 관리)
for (const base of [90, 93, 95, 97]) {
  const r = simulate({ ...CASES.elite, base: () => base, seasons: 1 })[0];
  assert(r.overall < 100, `1시즌 100 불가 (기본 ${base} → ${r.overall})`);
}
// 모두 유한 시즌 안에 100 도달: 최상위 3–5시즌, 평범·낮은·베테랑은 더 오래
const hit = Object.fromEntries(Object.entries(CASES).map(([k, c]) => [k, firstHundred(simulate(c))]));
console.log("first 100 season:", JSON.stringify(hit));
assert(hit.elite! >= 3 && hit.elite! <= 5, "최상위 3–5시즌");
assert(hit.avg82! >= 6 && hit.avg82! <= 10, "평범 82 선수 6–10시즌");
assert(hit.low75! > hit.avg82!, "낮은 선수는 더 오래");
assert(hit.vet! > 0 && hit.vet82! > 0, "베테랑도 유한 시즌 내 100");
// 피지컬 하락은 훈련으로 막힘: 주 2회 이상 피지컬 훈련하면 25세+도 피지컬이 내려가지 않음
const vet = simulate({ ...CASES.vet82, seasons: 3 });
assert(vet[2].phys > vet[0].phys, "베테랑 피지컬 훈련으로 상승");
const idle = simulate({ ...CASES.vet82, seasons: 2, plan: ["scrim", "scrim", "rest", "scrim", "scrim", "rest", "rest"] });
assert(idle[1].phys < 82, "피지컬 훈련을 안 하면 25세+ 피지컬 하락");
// 과훈련: 주 한도 초과 날은 성장 없이 피로 3배
const ctx = { base: 85, potential: 100 };
let p = { person: "o", mechanicsXp: 0, strategyXp: 0, fatigue: 0 } as any;
const days = ["2024-01-01", "2024-01-02", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06"];
const out: any[] = [];
for (const d of days) { const r = trainingSession(p, "mechanics", d, undefined, ctx); out.push(r); p = r.progress; }
assert.equal(out.filter((r) => r.over).length, days.length - WEEKLY_POINTS);
const last = out[out.length - 1], prev = out[out.length - 2].progress;
assert.equal(last.progress.physGain, prev.physGain, "과훈련 날 성장 없음");
assert(last.progress.fatigue - prev.fatigue > 30, "과훈련 피로 3배");
assert(fatiguePenalty(100) > fatiguePenalty(50) * 2.5, "피로 60+ 컨디션 저하");
const lim = simulate({ ...CASES.avg82, seasons: 1 })[0], mx = simulate({ ...CASES.avg82, seasons: 1, plan: MAX_PLAN, restWhenTired: undefined })[0];
assert(mx.overall <= lim.overall && mx.fatigue > lim.fatigue, "주 6일 과훈련은 이득 없음");
void LIMIT_PLAN;
console.log("OK growth rules: all players cap 100, none in one season, elite", hit.elite, "seasons, ordinary", hit.avg82, ", veterans finite, overtraining penalty");
