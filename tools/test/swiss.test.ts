import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Rng } from "../../src/game/rng";
import { drawSwissRound, drawSwissKnockout, swissRows, matchSwiss, type SwissState, type SwissRow } from "../../src/game/swiss";
import type { SeriesRec, Save } from "../../src/game/season";
import { loadCore, loadRanked, PL, TM } from "../../src/data";
import { newStoryCareer, marketCards, startWorlds, finishStoryDay, simRestOfPhase, applyStoryWorld } from "../../src/game/story";
import { hydrateSave } from "../../src/game/cards";
import "../../src/game/stove";

function state(noRematch = true): SwissState {
  return { round: 1, drawRng: 1, avoidRematches: noRematch,
    teams: Array.from({ length: 16 }, (_, i) => ({ t: `T${i}`, pool: Math.floor(i / 4) + 1, region: `REG${i % 4}` })) };
}

// 테스트용 시리즈 기록으로 추첨 규칙을 조합 검사합니다. 실제 게임의 승패를 바꾸지 않습니다.
for (const noRematch of [false, true]) for (let example = 1; example <= 100; example++) {
  const st = state(noRematch), series: SeriesRec[] = [];
  const draw = new Rng(example), results = new Rng(example * 391);
  for (let round = 1; round <= 5; round++) {
    st.round = round;
    const before = swissRows(st, series);
    const pairs = drawSwissRound(st, series, draw);
    const frozen = JSON.parse(JSON.stringify(st));
    assert.deepEqual(drawSwissRound(frozen, series, new Rng(111)), drawSwissRound(st, series, new Rng(111)), "저장 복구 후 같은 추첨");
    assert.equal(pairs.length, [8, 8, 8, 6, 3][round - 1]);
    assert.equal(new Set(pairs.flatMap((p) => [p.a, p.b])).size, pairs.length * 2);
    for (const p of pairs) {
      const a = before.find((r) => r.t === p.a)!, b = before.find((r) => r.t === p.b)!;
      assert.equal(a.w, b.w); assert.equal(a.l, b.l);
      assert(a.w < 3 && a.l < 3);
      assert.equal(p.bo, a.w === 2 || a.l === 2 ? 3 : 1);
      if (round === 1) { assert.equal(a.pool + b.pool, 5); assert.notEqual(a.region, b.region); }
      if (noRematch) assert(!a.opponents.includes(b.t), "재대결 금지");
      if (a.pool !== b.pool) assert.equal(p.holder1, a.pool < b.pool ? a.t : b.t);
      const aWins = results.chance(0.5), need = Math.ceil(p.bo / 2);
      series.push({ id: `W-SW${round}-${series.length}`, day: series.length, stage: "SW", a: p.a, b: p.b,
        bo: p.bo, games: [], sa: aWins ? need : 0, sb: aWins ? 0 : need, winner: aWins ? p.a : p.b });
    }
  }
  const rows = swissRows(st, series), adv = rows.filter((r) => r.w === 3);
  assert.equal(series.length, 33);
  assert.equal(adv.length, 8); assert.equal(rows.filter((r) => r.l === 3).length, 8);
  assert.deepEqual([0, 1, 2].map((losses) => adv.filter((r) => r.l === losses).length), [2, 3, 3]);
  const ko = drawSwissKnockout(st, series, draw);
  assert.equal(new Set(ko.flat()).size, 8);
  for (const slot of [0, 2]) {
    assert.equal(rows.find((r) => r.t === ko[slot][0])!.l, 0);
    assert.equal(rows.find((r) => r.t === ko[slot][1])!.l, 2);
  }
}
console.log("OK 200 draw histories: records, Bo1/Bo3, regional protection, rematches, 33 matches, eight qualifiers, bracket, reload");

{
  const ts = "ABCDEF".split("").map((t) => ({ t } as SwissRow));
  const allowed = new Set(["AB", "AC", "BD", "EF"]);
  const matches = matchSwiss(ts, (a, b) => allowed.has([a.t, b.t].sort().join("")));
  assert(matches); assert.equal(matches.flat().length, 6);
  assert.equal(matchSwiss(ts, () => false), undefined);
  console.log("OK matching backtracking and impossible draw detection");
}

(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
await loadCore(); await loadRanked();
function fixture(year: number): Save {
  const used = new Set<string>();
  const cards = [0, 1, 2, 3, 4].map((pos) => {
    const c = marketCards(2018).find((c) => c.posIdx === pos && !used.has(c.pkey))!;
    used.add(c.pkey); return c.id;
  });
  const s = newStoryCareer("SGU", "검증", 1, 111, { club: { name: "검증 구단", short: "SGU", color: "#2DD4BF" },
    managerInfo: { name: "검증", birth: "1988-01-01", nation: "한국", career: "amateur" }, cards, starters: cards, difficulty: "normal" });
  s.story!.year = year; s.story!.split = "summer"; s.story!.tier = "LCK";
  s.story!.lck = [s.team, ...s.story!.lck.slice(0, 9)];
  applyStoryWorld(s);
  startWorlds(s);
  return s;
}

for (const year of [2023, 2024]) {
  const s = fixture(year), rng = new Rng(s.rng);
  assert.equal(s.story!.swiss!.avoidRematches, year >= 2024);
  const first = s.series.map((sr) => ({ id: sr.id, a: sr.a, b: sr.b, holder1: sr.holder1 }));
  const reloaded: Save = JSON.parse(JSON.stringify(s));
  hydrateSave(reloaded); applyStoryWorld(reloaded);
  assert.deepEqual(reloaded.series.map((sr) => ({ id: sr.id, a: sr.a, b: sr.b, holder1: sr.holder1 })), first);
  for (const sr of reloaded.series) for (const t of [sr.a, sr.b]) {
    assert(TM[t]); assert(reloaded.starters[t].every((k) => PL[k]), "로드 후 국제대 선수 복구");
  }
  // 실제 시뮬레이터로 한 경기씩 진행. 진출·탈락 직후 추가 경기를 배정하지 않아야 합니다.
  let steps = 0;
  while (JSON.parse(reloaded.story!.note!).step === "swiss" && steps++ < 40) finishStoryDay(reloaded, rng);
  assert.equal(JSON.parse(reloaded.story!.note!).step, "qf");
  assert.equal(reloaded.series.filter((sr) => sr.swiss).length, 33);
  assert(reloaded.series.filter((sr) => sr.swiss).every((sr) => sr.winner));
  assert.equal(reloaded.series.filter((sr) => sr.id.startsWith("W-QF")).length, 4);
  simRestOfPhase(reloaded, rng);
  assert.equal(reloaded.story!.phase, "awards");
  assert(reloaded.story!.worldsChamp);
  assert.equal(reloaded.series.filter((sr) => sr.id === "W-F").length, 1);
  console.log("OK real Swiss-to-final simulation", year, reloaded.story!.worldsChamp);
}

{
  const old = fixture(2022);
  assert(!old.story!.swiss); assert(old.series.every((sr) => sr.id.startsWith("W-G")));
  old.story!.year = 2027; // 이전 버전에서 이미 시작한 조별 세이브를 불러온 상황
  simRestOfPhase(old, new Rng(old.rng));
  assert(["clear", "fail"].includes(old.story!.ended!));
  assert(old.series.some((sr) => sr.id === "W-F" && sr.winner));
  console.log("OK legacy groups save completes without restarting Worlds");
}
