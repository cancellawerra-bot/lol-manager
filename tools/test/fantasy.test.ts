// 판타지 드래프트 규칙 검사 (v2.16.0): 막힘 없음 · 팀 간 카드 중복 없음 · 포지션마다 한 명 · 예산 이내 · AI 로스터가 서로 다름
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore, loadRanked, CARDS, CORE } from "../../src/data";
import { BUDGETS } from "../../src/game/cards";
import { Rng } from "../../src/game/rng";
import { FANTASY_ROUNDS, aiPick, applyPick, draftCtx, ctxLockReason, lockReason, pickMax, whoPicks, type Rosters } from "../../src/game/fantasy";
import { cardRating } from "../../src/rating";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
await loadCore(); await loadRanked();
const all = Object.values(CARDS);
assert(all.length > 900, "cards loaded");
type Strat = "salaryHigh" | "ratingHigh" | "random" | "cheap";
function run(seed: number, cap: number, strat: Strat): Rosters {
  const rng = new Rng(seed), order = rng.shuffle(CORE.teams.map((t) => t.short)), me = order[seed % order.length];
  let st = { rosters: {} as Rosters, round: 0, pick: 0 };
  while (st.round < FANTASY_ROUNDS) {
    const who = whoPicks(order, st.round, st.pick)!;
    let id: string | undefined;
    if (who === me) {
      const ctx = draftCtx(me, st.rosters, cap); const ok = all.filter((c) => !ctxLockReason(c, ctx));
      assert(ok.length > 0, `dead end: seed ${seed} ${strat} round ${st.round}`);
      { const pm = pickMax(me, st.rosters, cap), mn = Math.min(...ok.map((c) => c.salary)); assert(pm + 1e-9 >= mn, `pickMax ${pm} < min ${mn}`); }
      const sorted = strat === "salaryHigh" ? ok.sort((a, b) => b.salary - a.salary) : strat === "ratingHigh" ? ok.sort((a, b) => cardRating(b) - cardRating(a)) : strat === "cheap" ? ok.sort((a, b) => a.salary - b.salary) : rng.shuffle(ok);
      id = sorted[0].id;
    } else {
      id = aiPick(who, st.rosters, cap, rng);
      assert(id, `AI dead end: seed ${seed} team ${who}`);
      assert.equal(lockReason(CARDS[id], who, st.rosters, cap), undefined);
    }
    st = applyPick(id, order, st.rosters, st.round, st.pick);
  }
  return st.rosters;
}
let drafts = 0;
for (const cap of Object.values(BUDGETS)) for (const strat of ["salaryHigh", "ratingHigh", "random", "cheap"] as Strat[]) for (let seed = 1; seed <= 6; seed++) {
  const r = run(seed * 97 + cap, cap, strat); drafts++;
  const ids = Object.values(r).flat();
  assert.equal(Object.keys(r).length, 10);
  assert.equal(ids.length, 50);
  assert.equal(new Set(ids).size, 50, "no duplicate cards across teams");
  for (const [t, roster] of Object.entries(r)) {
    assert.deepEqual(roster.map((id) => CARDS[id].posIdx).sort(), [0, 1, 2, 3, 4], `${t} one per position`);
    assert.equal(new Set(roster.map((id) => CARDS[id].pkey)).size, 5, `${t} one card per person`);
    assert(roster.reduce((n, id) => n + CARDS[id].salary, 0) <= cap + 1e-9, `${t} within cap`);
  }
  const sigs = new Set(Object.values(r).map((x) => [...x].sort().join(",")));
  assert.equal(sigs.size, 10, "AI rosters distinct");
}
// AI는 능력치 위주: 평균 능력치가 가성비 저가 카드(2012~15 위주)보다 확실히 높아야 함
const r = run(7, BUDGETS.normal, "random");
const avg = Object.values(r).flat().reduce((n, id) => n + cardRating(CARDS[id]), 0) / 50;
assert(avg >= 85, `AI average rating ${avg.toFixed(1)}`);
console.log(`OK fantasy draft: ${drafts} drafts, no dead end, no duplicates, valid rosters within cap, AI distinct; sample avg rating ${avg.toFixed(1)}`);
