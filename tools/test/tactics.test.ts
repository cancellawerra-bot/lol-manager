import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL, TM, RANKED } from "../../src/data";
import { autoDraft, newDraft } from "../../src/game/draft";
import { Rng } from "../../src/game/rng";
import { simulateGame } from "../../src/game/sim";
import { FOCUS_GOLD, TEMPO_EFFECT, normalizeTactic, matchTactics, tacticEffects, recommendTactic, type TacticPlan } from "../../src/game/tactics";
import { newCareer, recordGame, simSeries } from "../../src/game/season";
await loadCore(); await loadRanked();
const original = JSON.stringify({ CARDS, PL, RANKED });
const d = autoDraft(newDraft("GEN", "T1", TM.GEN.starters, TM.T1.starters, "B", []), new Rng(17));
const balanced: TacticPlan = { tempo: "bal", focus: "balanced" };
const attack: TacticPlan = { tempo: "atk", focus: "bot" };
const safe: TacticPlan = { tempo: "safe", focus: "top" };
assert.deepEqual(normalizeTactic({ tempo: "bad", focus: "bad" } as any), balanced);
for (const [focus, vector] of Object.entries(FOCUS_GOLD)) assert.equal(vector.reduce((n, x) => n + x, 0), 0, focus + " 자원 배분 합계");
assert(TEMPO_EFFECT.atk.early > 0 && TEMPO_EFFECT.atk.late < 0);
assert(TEMPO_EFFECT.safe.early < 0 && TEMPO_EFFECT.safe.late > 0);
for (let seed = 1; seed <= 30; seed++) {
  const a = new Rng(seed), b = new Rng(seed);
  const legacy = simulateGame(d, {}, a), explicit = simulateGame(d, {}, b, undefined, { B: balanced, R: balanced });
  const { tactics: _a, ...plainA } = legacy, { tactics: _b, ...plainB } = explicit;
  assert.deepEqual(plainA, plainB); assert.equal(a.s, b.s);
  assert(explicit.tactics!.decisions.every((x) => x.before === x.after));
}
console.log("OK neutral plan preserves all match numbers and RNG; redistribution is zero sum");
{
  const a = tacticEffects({ B: attack, R: safe }), b = tacticEffects({ B: safe, R: attack });
  assert(a.lane.every((x, i) => x === -b.lane[i])); assert.equal(a.early, -b.early); assert.equal(a.late, -b.late);
  const blue = simulateGame(d, {}, new Rng(45), undefined, { B: { ...balanced, focus: "bot" }, R: balanced });
  const plain = simulateGame(d, {}, new Rng(45), undefined, { B: balanced, R: balanced });
  assert.deepEqual(blue.lanes15.map((x, i) => x - plain.lanes15[i]), FOCUS_GOLD.bot);
  const dragon = blue.tactics!.decisions.find((x) => x.stage === "dragon")!, river = blue.tactics!.decisions.find((x) => x.stage === "river")!;
  assert(dragon.after > dragon.before); assert(river.after < river.before);
  const tempo = simulateGame(d, {}, new Rng(45), undefined, { B: { ...balanced, tempo: "atk" }, R: balanced });
  assert(tempo.tactics!.decisions[0].after > tempo.tactics!.decisions[0].before);
  const closing = tempo.tactics!.decisions.find((x) => x.stage === "closing")!; assert(closing.after < closing.before);
  console.log("OK support changes real lane inputs and object probabilities; tempo has an opposite late cost; side symmetry");
}
{
  const preferences = { GEN: { ...attack }, T1: { ...safe } }, orders = matchTactics(d, preferences);
  const result = simulateGame(d, {}, new Rng(7), undefined, orders), frozen = JSON.stringify(result.tactics);
  preferences.GEN.focus = "top"; orders.B.tempo = "safe";
  assert.equal(JSON.stringify(result.tactics), frozen);
  const s = newCareer("GEN", "검증", 1, 8), sr = s.series.find((x) => x.a === "GEN" || x.b === "GEN")!;
  recordGame(s, sr, d, result, "GEN", false);
  assert(!sr.games[0].res); assert.equal(JSON.stringify(sr.games[0].tactics), frozen);
  assert.deepEqual(JSON.parse(JSON.stringify(s)).series.find((x: any) => x.id === sr.id).games[0].tactics, result.tactics);
  console.log("OK game-time plan and observations survive later preferences, compact automatic records and reload");
}
{
  const s = newCareer("GEN", "검증", 1, 8), sr = s.series.find((x) => x.a === "GEN" || x.b === "GEN")!;
  s.tactics = { GEN: attack }; simSeries(s, sr, new Rng(33));
  assert(sr.games.every((g) => g.tactics!.plans[g.blue === "GEN" ? "B" : "R"].tempo === "atk"));
  const outcomes = new Set<string>();
  for (let seed = 1; seed <= 100; seed++) outcomes.add(simulateGame(d, {}, new Rng(seed), undefined, { B: attack, R: safe }).winner);
  assert.equal(outcomes.size, 2, "같은 작전·전력으로도 양쪽이 이길 수 있음");
  console.log("OK actual auto-series uses saved plan for either side and does not prescribe the winner");
}
{
  const advice = recommendTactic(d, "B"); assert.deepEqual(advice, recommendTactic(d, "B")); assert.equal(advice.reasons.length, 5);
  const lane = { ...RANKED!.mu }; const old = d.lineup.B.concat(d.lineup.R).map((k) => [k, PL[k].m.gd] as const);
  for (const [k] of old) PL[k].m.gd = null as any;
  for (const k of Object.keys(RANKED!.mu)) delete RANKED!.mu[k];
  const missing = recommendTactic(d, "B"); assert.deepEqual(missing.plan, balanced); assert(missing.reasons.every((r) => r.includes("기록 없음") && r.includes("표본 부족")));
  Object.assign(RANKED!.mu, lane); for (const [k, gd] of old) PL[k].m.gd = gd;
  console.log("OK coach uses current evidence only and remains neutral when evidence is unavailable");
}
assert.equal(JSON.stringify({ CARDS, PL, RANKED }), original);
{
  const values = new Map<string, string>();
  (globalThis as any).localStorage = { getItem: (k: string) => values.get(k) ?? null, setItem: (k: string, v: string) => values.set(k, v) };
  const { setSave, setTacticPlan, setMeet, runSim, toResult } = await import("../../src/store");
  const s = newCareer("GEN", "검증", 1, 17), sr = s.series.find((x) => x.a === "GEN" && x.b === "T1" || x.a === "T1" && x.b === "GEN")!;
  s.session = { seriesId: sr.id, gameIdx: 0, holder: "GEN", stage: "meet", simStep: 0, blue: "GEN", red: "T1", draft: d };
  setSave(s); setTacticPlan(attack); runSim();
  const snapshot = JSON.stringify(s.session.result), rng = s.rng, plan = JSON.stringify(s.tactics);
  setTacticPlan(safe); setMeet("safe"); runSim();
  assert.equal(JSON.stringify(s.session.result), snapshot); assert.equal(s.rng, rng); assert.equal(JSON.stringify(s.tactics), plan);
  toResult(); toResult(); assert.equal(sr.games.length, 1); assert(sr.games[0].tactics);
  setSave(null);
  console.log("OK actual store freezes started plan, ignores rerun and records one result only");
}
console.log("OK tactics integration complete; original stats unchanged");
