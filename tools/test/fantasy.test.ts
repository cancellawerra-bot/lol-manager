// 판타지 드래프트 규칙 검사 (v2.16.0): 막힘 없음 · 팀 간 카드 중복 없음 · 포지션마다 한 명 · 예산 이내 · AI 로스터가 서로 다름
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore, loadRanked, CARDS, CORE } from "../../src/data";
import { FANTASY_BUDGETS as BUDGETS, fantasyPrice, fantasyRatingOf } from "../../src/game/cards";
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
      { const pm = pickMax(me, st.rosters, cap), mn = Math.min(...ok.map((c) => fantasyPrice(c))); assert(pm + 1e-9 >= mn, `pickMax ${pm} < min ${mn}`); }
      const sorted = strat === "salaryHigh" ? ok.sort((a, b) => fantasyPrice(b) - fantasyPrice(a)) : strat === "ratingHigh" ? ok.sort((a, b) => fantasyRatingOf(b) - fantasyRatingOf(a)) : strat === "cheap" ? ok.sort((a, b) => fantasyPrice(a) - fantasyPrice(b)) : rng.shuffle(ok);
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
    assert(roster.reduce((n, id) => n + fantasyPrice(CARDS[id]), 0) <= cap + 1e-9, `${t} within cap`);
  }
  const sigs = new Set(Object.values(r).map((x) => [...x].sort().join(",")));
  assert.equal(sigs.size, 10, "AI rosters distinct");
}
// v2.22.0 연봉 = 기본 5억 + 그 시즌 능력치 가산 (교수님 결정). 2026 페이커 50억만 지정값, 2026은 페이커가 최고가.
{ const f26 = fantasyPrice(CARDS["faker-2026"]), mx = Math.max(...all.map((c) => fantasyPrice(c)));
  assert.equal(f26, 50, "Faker 2026 owner-set 50");
  assert.equal(f26, mx, "Faker 2026 is the most expensive fantasy card");
  assert(all.filter((c) => c.year === 2026 && c.pkey !== "faker").every((c) => fantasyPrice(c) < f26), "2026: nobody at or above Faker");
  assert(all.every((c) => fantasyPrice(c) >= 5), "minimum 5억");
  // 단조성: 능력치가 높으면 항상 더 비쌈 (2026 페이커 지정값 제외)
  const rest = all.filter((c) => c.id !== "faker-2026");
  for (const a of rest) for (const b of rest) if (fantasyRatingOf(a) > fantasyRatingOf(b)) assert(fantasyPrice(a) > fantasyPrice(b), `monotone ${a.id} ${fantasyRatingOf(a)}/${fantasyPrice(a)} vs ${b.id} ${fantasyRatingOf(b)}/${fantasyPrice(b)}`);
  // 쵸비: 지표가 가장 좋은 2024가 2025·2026보다 비쌈
  assert(fantasyPrice(CARDS["chovy-2024"]) > fantasyPrice(CARDS["chovy-2026"]) && fantasyPrice(CARDS["chovy-2024"]) > fantasyPrice(CARDS["chovy-2025"]), "Chovy 2024 most expensive");
  // 판타지 능력치: 60–99, 옛 시즌은 하향 (스토리 표시 능력치는 그대로)
  assert(all.every((c) => fantasyRatingOf(c) >= 60 && fantasyRatingOf(c) <= 99), "fantasy rating range");
  assert(fantasyRatingOf(CARDS["zeus-2022"]) < fantasyRatingOf(CARDS["zeus-2026"]), "older Zeus lower");
  assert.equal(fantasyRatingOf(CARDS["faker-2026"]), cardRating(CARDS["faker-2026"]), "2026 rating unchanged");
  // v2.20.0 4대 능력치: 모든 카드에 있고, 값은 60–99 정수 또는 null(기록 없음). 4대 평균은 판타지 종합과 1점 이내.
  for (const c of all) {
    assert(c.four, `four stats missing ${c.id}`);
    const vs = (["fight", "press", "judge", "ops"] as const).map((k) => c.four![k]);
    for (const v of vs) assert(v === null || (Number.isInteger(v) && v >= 60 && v <= 99), `four range ${c.id} ${v}`);
    const ok = vs.filter((v): v is number => v !== null);
    if (ok.length) assert(Math.abs(ok.reduce((n, v) => n + v, 0) / ok.length - fantasyRatingOf(c)) <= 1.5, `four avg vs rating ${c.id}`);
  }
  assert(all.filter((c) => c.year >= 2015).every((c) => Object.values(c.four!).every((v) => v !== null)), "2015+ cards have all four stats");
  assert.equal(CARDS["faker-2026"].salary, 50, "story salary unchanged");
  for (const cap of Object.values(BUDGETS)) assert.equal(lockReason(CARDS["faker-2026"], "T1", {}, cap), undefined, `Faker draftable on first pick at ${cap}`); }
// AI는 능력치 위주: 평균 능력치가 가성비 저가 카드(2012~15 위주)보다 확실히 높아야 함
const r = run(7, BUDGETS.normal, "random");
const avg = Object.values(r).flat().reduce((n, id) => n + fantasyRatingOf(CARDS[id]), 0) / 50;
assert(avg >= 85, `AI average rating ${avg.toFixed(1)}`);
console.log(`OK fantasy draft: ${drafts} drafts, no dead end, no duplicates, valid rosters within cap, AI distinct; sample avg rating ${avg.toFixed(1)}`);
