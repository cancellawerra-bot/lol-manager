// v2.38.0 마케팅: 굿즈 제작·시즌 말 정산·광고 모델·팬미팅의 규칙과 금액을 검사합니다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked } from "../../src/data";
import { newHistoryCareer } from "../../src/game/story";
import { payIncome } from "../../src/game/stove";
import { projectLedger } from "../../src/game/ledger";
import { seasonForm, formFactor, FORM_LOW, FORM_HIGH, meetRange, orderGoods, holdMeet, goodsDemand, goodsPreview, meetPreview, goodsError, meetError, settleGoods, unitOf, modelPower, QTY_COST, VENUE, MAX_MODELS } from "../../src/game/marketing";
await loadCore(); await loadRanked();
const info = { name: "마케팅 검증", birth: "1988-01-01", nation: "한국", career: "amateur" as const };
const mk = (seed = 4) => newHistoryCareer("T1", 1, seed, { startYear: 2024, managerInfo: info, difficulty: "normal" });

// 1) 단위·수요: LCK는 10배, 팬심·모델이 오르면 수요가 늘고 성적이 좋을수록 늘어난다
const s = mk(); assert.equal(unitOf(s), 10);
const keys = s.starters[s.team].slice(0, 3);
const d0 = goodsDemand(s, "uniform", [], 6), d1 = goodsDemand(s, "uniform", keys, 6);
assert(d1 > d0, "광고 모델은 수요를 늘림"); assert(modelPower(s, keys) > 0 && modelPower(s, keys) < 0.3);
assert(goodsDemand(s, "uniform", [], 1) > goodsDemand(s, "uniform", [], 6) && goodsDemand(s, "uniform", [], 6) > goodsDemand(s, "uniform", [], 9));
assert(goodsDemand(s, "jacket", [], 6) < goodsDemand(s, "uniform", [], 6), "자켓은 덜 팔림");
const f0 = s.eco.fans; s.eco.fans = 90; assert(goodsDemand(s, "uniform", [], 6) > d0); s.eco.fans = f0;

// 2) 예상표: 제작비는 단위×배율, 소량은 하위권에서도 매진, 대량은 손해 위험이 크다
const pre = goodsPreview(s, "uniform", []); assert.equal(pre.length, 5);
for (const p of pre) { assert.equal(p.cost, Math.round(unitOf(s) * QTY_COST[p.qty] * 100) / 100); assert(p.soldLow <= p.soldHigh + 1e-9 && p.netLow <= p.netHigh + 1e-9); }
assert.equal(pre[0].cost, 0); assert.equal(pre[0].netLow, 0);
assert(pre[1].soldLow === 1 && pre[1].netLow > 0, "소량은 안전"); assert(pre[4].netLow < 0, "대량은 하위권에서 손해");

// 3) 제작: 비용은 바로 차감, 같은 상품은 한 해 한 번, 자금 부족·비선발 모델 거절
const cash0 = s.eco.cash; const r1 = orderGoods(s, "uniform", "m", keys); assert(r1.includes("제작"), r1);
assert.equal(Math.round((cash0 - s.eco.cash) * 100) / 100, 6); assert.equal(s.marketing!.goods.uniform!.cost, 6);
assert(orderGoods(s, "uniform", "s", []).includes("이미")); assert(goodsError(s, "jacket", "m", ["nobody"])!.includes("선발"));
assert(goodsError(s, "jacket", "m", [...keys, s.starters[s.team][3]])!.includes(String(MAX_MODELS)));
const poor = mk(); poor.eco.cash = 1; assert(goodsError(poor, "uniform", "xl", [])!.includes("부족"));
assert(goodsError(s, "bogus" as any, "m", [])!.includes("알 수 없는"));
assert.equal(orderGoods(s, "jacket", "none", []).includes("만들지 않기로"), true); assert.equal(s.marketing!.goods.jacket!.cost, 0);

// 4) 예상 장부·시즌 말 정산: 판매 수입이 payIncome에 들어오고 한 번만 정산된다
const led = projectLedger(s)!; assert(led.lines.some((l) => l.label.includes("굿즈")), "장부에 굿즈 예상 수입");
const cashBefore = s.eco.cash; s.story!.lastRank = 1; payIncome(s);
const o = s.marketing!.goods.uniform!; assert(o.settled && o.sold! > 0 && o.sold! <= 1); assert(o.net !== undefined);
const delta = s.eco.cash - cashBefore; assert(delta > 0);
const before2 = s.eco.cash; assert.equal(settleGoods(s, 1), 0, "한 번만 정산"); assert.equal(s.eco.cash, before2);
// 순위가 낮을수록 판매가 줄어든다(같은 조건 비교)
const a = mk(5), b = mk(5); orderGoods(a, "uniform", "l", []); orderGoods(b, "uniform", "l", []);
settleGoods(a, 1); settleGoods(b, 9); assert(a.marketing!.goods.uniform!.sold! >= b.marketing!.goods.uniform!.sold!);
// 시즌 말에 모델이 벤치로 밀리면 인기 보정이 없다
const c = mk(6), ck = c.starters[c.team].slice(0, 3); orderGoods(c, "uniform", "l", ck); const withModels = goodsDemand(c, "uniform", ck, 3);
c.starters[c.team] = c.starters[c.team].map((k) => ck.includes(k) ? "x" + k : k); settleGoods(c, 3);
assert(c.marketing!.goods.uniform!.sold! <= Math.min(1, withModels / c.marketing!.goods.uniform!.cost) + 1e-9);

// 5) 팬미팅: 한 해 한 번, 비용·수입이 맞고 팬심이 오른다. 재현 가능(같은 시드 같은 결과)
const m1 = mk(7), m2 = mk(7), fans = m1.eco.fans, cashM = m1.eco.cash;
const t1 = holdMeet(m1, "small"), t2 = holdMeet(m2, "small"); assert.equal(t1, t2, "같은 조건이면 같은 결과");
const meet = m1.marketing!.meet!; assert(meet.attendance > 0 && meet.fill > 0 && meet.fill <= 1);
assert.equal(Math.round((m1.eco.cash - cashM) * 100) / 100, meet.net); assert(m1.eco.fans > fans && m1.eco.fans - fans === meet.fansGain);
assert(meetError(m1, "mid")!.includes("이미")); assert(meetError(m1, "bogus" as any) !== undefined);
const prev = meetPreview(m1); assert.equal(prev.length, 3); for (const p of prev) { assert(p.fillLow <= p.fillHigh && p.netLow <= p.netHigh); assert.equal(p.seats, VENUE[p.venue].seats); }
const gym = mk(8); gym.eco.cash = 5; assert(meetError(gym, "gym")!.includes("부족"));
// 해가 바뀌면 새로 시작
const y = mk(9); orderGoods(y, "uniform", "s", []); y.story!.year += 1; assert.equal(orderGoods(y, "uniform", "s", []).includes("이미"), false); assert.equal(y.marketing!.year, y.story!.year);

// 6) 성적이 판매·관객을 좌우한다: 승률·순위·우승 계수, 같은 제작량도 성적에 따라 다르게 팔린다
{
  assert(formFactor(FORM_LOW) < 0.7 && formFactor(FORM_HIGH) > 1.8, `${formFactor(FORM_LOW)} ${formFactor(FORM_HIGH)}`);
  assert(formFactor({ rank: 3, wr: 0.75, champ: false }) > formFactor({ rank: 3, wr: 0.25, champ: false }), "승률이 높을수록 많이 팜");
  assert(formFactor({ rank: 1, wr: 0.5, champ: true }) > formFactor({ rank: 1, wr: 0.5, champ: false }), "우승하면 더 팜");
  const W = mk(11), D = mk(11); const me = W.team;
  const play = (x: ReturnType<typeof mk>, wins: number, games: number): void => { const mine = x.series.filter((q) => q.stage === "R" && [q.a, q.b].includes(me)).slice(0, games); assert.equal(mine.length, games);
    mine.forEach((q, i) => { const win = i < wins; q.winner = win ? me : (q.a === me ? q.b : q.a); q.sa = q.a === q.winner ? 2 : 0; q.sb = q.b === q.winner ? 2 : 0; }); };
  play(W, 5, 6); play(D, 1, 6);
  const fW = seasonForm(W), fD = seasonForm(D); assert(fW.wr! > 0.8 && fD.wr! < 0.2, `${fW.wr} ${fD.wr}`);
  assert(formFactor(fW) > formFactor(fD));
  assert(goodsDemand(W, "uniform", [], fW) > goodsDemand(D, "uniform", [], fD) * 1.5, "잘한 팀은 훨씬 많이 팔림");
  const [wl, wh] = meetRange(W), [dl, dh] = meetRange(D); assert(wl > dl && wh > dh, "성적이 좋을 때 팬미팅 관객이 많음");
  orderGoods(W, "uniform", "l", []); orderGoods(D, "uniform", "l", []); settleGoods(W, 0); settleGoods(D, 0);
  assert(W.marketing!.goods.uniform!.sold! > D.marketing!.goods.uniform!.sold!, "같은 제작량도 성적에 따라 판매율이 다름");
  W.champion = me; assert(seasonForm(W).champ);
}
console.log("OK marketing form");
console.log("OK marketing", { uniformSold: o.sold, uniformNet: o.net, meet: meet.attendance });
