import { readFileSync } from "fs";
import assert from "node:assert/strict";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, CARDS, PL } from "../../src/data";
import { newStoryCareer, marketCards, storySalary, ensurePlayer, cmpCard, upcomingSalaryDue, payrollSoftCap } from "../../src/game/story";
import { autoManageRoster, autoAdvanceOffseason, type IncomingBid } from "../../src/game/stove";
import { Rng } from "../../src/game/rng";

await loadCore();

function fixture() {
  const opening = [0, 1, 2, 3, 4].map((pos) => marketCards(2018).filter((c) => c.posIdx === pos)
    .sort((a, b) => storySalary(a, "CK") - storySalary(b, "CK") || cmpCard(a, b))[0].id);
  const s = newStoryCareer("SGU", "감독", 1, 17, { cards: opening, starters: opening, difficulty: "normal",
    club: { name: "신구", short: "SGU", color: "#2DD4BF" },
    managerInfo: { name: "감독", birth: "1988-01-01", nation: "한국", career: "amateur" } });
  const st = s.story!;
  st.year = 2025; st.phase = "stove"; st.tier = "LCK"; st.franchised = true;
  st.lck = [s.team, "GEN"]; st.ck = [];
  const cards = [0, 1, 2, 3, 4].map((pos) => marketCards(2026).filter((c) => c.posIdx === pos && c.year === 2026)
    .sort((a, b) => a.percentile - b.percentile || cmpCard(a, b))[0]);
  st.contracts = cards.map((c) => ({ key: ensurePlayer(c, 2026, false), cardId: c.id, person: c.pkey,
    salary: c.salary, years: 2, prepaid: true }));
  s.starters[s.team] = st.contracts.map((ct) => ct.key);
  s.cards = st.contracts.map((ct) => ct.key);
  s.eco.cash = 0;
  st.stove = { week: 2, maxWeek: 5, awards: [], tryoutPool: [], tryoutOffers: [], expiryKeys: [], expiryDecided: {},
    faPool: [], pendingBids: [], incoming: [], rumors: [], transfersOn: true, aiContracts: { GEN: [] } };
  return s;
}

function saleFixture() {
  const s = fixture();
  const ct = s.story!.contracts[2];
  const c = marketCards(2026).filter((c) => c.year === 2026 && c.posIdx === 2 && c.percentile >= PL[ct.key].pct.ovr + 5)
    .sort((a, b) => a.salary - b.salary || cmpCard(a, b))[0];
  assert(c);
  const offer: IncomingBid = { id: "test-offer", from: "GEN", key: ct.key, person: ct.person, fee: 30,
    salary: 100, years: 2, stance: "조건이 되면 협상한다", expireWeek: 2, status: "open" };
  s.story!.stove!.incoming = [offer];
  s.story!.stove!.faPool = [c.id];
  return { s, ct, c, offer };
}

{
  const s = fixture();
  const c = marketCards(2026).filter((c) => c.year === 2026 && c.posIdx === 2)
    .sort((a, b) => b.percentile - a.percentile || cmpCard(a, b))[0];
  const key = ensurePlayer(c, 2026, false);
  s.story!.contracts.push({ key, cardId: c.id, person: c.pkey, salary: c.salary, years: 2, prepaid: true });
  s.cards.push(key);
  s.story!.stove!.transfersOn = false;
  const contracts = structuredClone(s.story!.contracts);
  autoAdvanceOffseason(s, new Rng(1), { signStars: true });
  assert.equal(s.starters[s.team][2], key, "잔고 0원에서도 더 좋은 보유 벤치를 주전으로 올려야 함");
  assert.equal(s.eco.cash, 0);
  assert.equal(s.story!.contracts.length, contracts.length);
  assert(s.story!.contracts.some((ct) => ct.person === c.pkey && ct.salary === c.salary));
  console.log("OK zero-cash bench promotion through full offseason");
}

{
  const { s, ct, c, offer } = saleFixture();
  autoManageRoster(s, new Rng(1), 3.5);
  assert.equal(offer.status, "accepted");
  assert.equal(s.eco.cash, offer.fee, "입찰 전 자금은 실제 매각 대금만큼만 증가해야 함");
  assert(!s.story!.contracts.includes(ct));
  assert(!s.cards.includes(ct.key) && !s.cards.includes(ct.cardId));
  const bid = s.story!.stove!.pendingBids.find((b) => b.person === c.pkey);
  assert(bid, "매각 후 같은 자리의 더 나은 FA에 입찰해야 함");
  assert(s.eco.cash - bid.salary >= 3.5 + upcomingSalaryDue(s.story!.contracts));
  assert.equal(s.story!.stove!.aiContracts.GEN[0].cardId, ct.cardId, "매각 선수의 현재 시즌 카드를 사용해야 함");
  console.log("OK zero-cash sale funds a legal upgrade with reserves");
}

{
  const { s, ct, offer } = saleFixture();
  const c = marketCards(2026).filter((c) => c.year === 2026 && c.posIdx === 2)
    .sort((a, b) => b.percentile - a.percentile || cmpCard(a, b))[0];
  const key = ensurePlayer(c, 2026, false);
  s.story!.contracts.push({ key, cardId: c.id, person: c.pkey, salary: c.salary, years: 2, prepaid: true });
  s.cards.push(key);
  s.story!.stove!.faPool = [];
  autoManageRoster(s, new Rng(1));
  assert.equal(s.starters[s.team][2], key);
  assert.equal(offer.status, "accepted", "벤치 승격 뒤 남은 약한 선수의 실제 제안을 활용");
  assert(!s.story!.contracts.includes(ct));
  assert.equal(s.eco.cash, offer.fee);
  console.log("OK bench promotion followed by sale keeps the stronger starter");
}

{
  const s = fixture();
  const before = structuredClone(s.story!.contracts);
  autoManageRoster(s, new Rng(1));
  assert.deepEqual(s.story!.contracts, before);
  assert.equal(s.eco.cash, 0, "벤치나 제안이 없으면 자금·선수를 만들어 내면 안 됨");
  console.log("OK no bench or incoming offer leaves zero-cash roster intact");
}

{
  const { s } = saleFixture();
  s.story!.tier = "CK";
  s.eco.cash = 2;
  s.story!.stove!.incoming = [];
  for (const ct of s.story!.contracts) ct.salary = 0.2;
  autoManageRoster(s, new Rng(1));
  assert(s.story!.stove!.pendingBids.length > 0);
  assert(s.story!.stove!.pendingBids.every((b) => b.years === 1), "2부 자동 계약은 일회성 매각 대금으로 다음 해 빚을 만들지 않게 1년");
  console.log("OK CK manager uses one-year contracts");
}

{
  const s = fixture();
  const c = marketCards(2026).filter((c) => c.year === 2026 && c.posIdx === 2)
    .sort((a, b) => b.percentile - a.percentile || cmpCard(a, b))[0];
  const key = ensurePlayer(c, 2026, false);
  s.story!.contracts[2] = { key, cardId: c.id, person: c.pkey, salary: c.salary, years: 0, prepaid: false };
  s.starters[s.team][2] = key; s.cards = s.story!.contracts.map((ct) => ct.key);
  s.story!.phase = "expiry";
  s.story!.stove!.expiryKeys = [key]; s.story!.stove!.transfersOn = false;
  autoAdvanceOffseason(s, new Rng(1), { signStars: true });
  assert(!s.story!.contracts.some((ct) => ct.person === c.pkey && ct.salary === c.salary), "잔고 0원에서 감당 못 할 고액 재계약 금지");
  assert(s.eco.cash >= 0);
  console.log("OK automatic renewals reserve existing salary before committing");
}

{
  const s = fixture();
  const c = marketCards(2026).filter((c) => c.year === 2026 && c.posIdx === 2)
    .sort((a, b) => b.percentile - a.percentile || cmpCard(a, b))[0];
  const key = ensurePlayer(c, 2026, false);
  s.story!.contracts[2] = { key, cardId: c.id, person: c.pkey, salary: 0, years: 0, prepaid: false };
  s.starters[s.team][2] = key; s.cards = s.story!.contracts.map((ct) => ct.key);
  s.story!.phase = "expiry"; s.story!.stove!.expiryKeys = [key]; s.story!.stove!.transfersOn = false;
  autoAdvanceOffseason(s, new Rng(1), { signStars: true, reserveCash: 9 });
  assert(s.story!.contracts.some((ct) => ct.person === c.pkey && ct.salary === 0));
  console.log("OK zero-cost renewal does not consume protected cash");
}

for (const reason of ["no-money", "transfers-off", "expired", "no-replacement", "salary-reserve", "buyin-reserve", "refused"]) {
  const { s, ct, offer } = saleFixture();
  let reserve = 0;
  if (reason === "no-money") offer.fee = 0.01;
  if (reason === "transfers-off") s.story!.stove!.transfersOn = false;
  if (reason === "expired") offer.expireWeek = 1;
  if (reason === "no-replacement") s.story!.stove!.faPool = [];
  if (reason === "salary-reserve") for (const c of s.story!.contracts) { c.prepaid = false; c.salary = 40; }
  if (reason === "buyin-reserve") reserve = offer.fee;
  if (reason === "refused") { s.story!.trophies.worlds = 20; offer.salary = 0.2; }
  autoManageRoster(s, new Rng(1), reserve);
  assert(s.story!.contracts.includes(ct), reason + ": 기존 주전을 보존해야 함");
  assert.equal(s.starters[s.team][2], ct.key, reason);
  assert.equal(s.eco.cash, 0, reason + ": 매각 대금을 미리 더하면 안 됨");
  assert.equal(s.story!.stove!.pendingBids.length, 0, reason);
  if (reason === "refused") assert.equal(offer.status, "rejected");
  console.log("OK sale guard", reason);
}

{
  const { s, ct, offer } = saleFixture();
  s.eco.cash = 30;
  autoManageRoster(s, new Rng(1));
  assert.equal(offer.status, "open", "교체 자금이 이미 있으면 먼저 매각하지 않음");
  assert(s.story!.contracts.includes(ct));
  assert(s.story!.stove!.pendingBids.length > 0);
  console.log("OK affordable upgrade keeps incumbent until auction resolves");
}

{
  const { s, c } = saleFixture();
  s.eco.cash = 100;
  const pending = { team: s.team, person: c.pkey, cardId: c.id, salary: c.salary, years: 2, starter: true, bonuses: {}, kind: "fa" as const };
  s.story!.stove!.pendingBids = [pending];
  autoManageRoster(s, new Rng(1));
  assert.deepEqual(s.story!.stove!.pendingBids, [pending], "직접 넣은 같은 포지션 입찰을 중복하거나 덮어쓰지 않음");
  console.log("OK delegated manager preserves an existing position bid");
}

{
  const s = fixture();
  s.eco.cash = 60;
  for (const ct of s.story!.contracts) ct.prepaid = false;
  const old = structuredClone(s.story!.contracts);
  s.story!.stove!.faPool = [0, 1, 2, 3, 4].map((pos) => marketCards(2026)
    .filter((c) => c.year === 2026 && c.posIdx === pos && c.percentile >= 50 && c.percentile < 70)
    .sort((a, b) => a.salary - b.salary || cmpCard(a, b))[0].id);
  const reserve = 3.5;
  autoManageRoster(s, new Rng(1), reserve);
  const bids = s.story!.stove!.pendingBids;
  assert(bids.length >= 2, "여러 포지션의 동시 입찰을 검증해야 함");
  for (let mask = 0; mask < 2 ** bids.length; mask++) {
    const remaining = old.slice();
    let spent = 0;
    let payroll = old.reduce((n, ct) => n + ct.salary, 0);
    bids.forEach((b, i) => {
      if (!(mask & (1 << i))) return;
      const ct = old[CARDS[b.cardId].posIdx];
      remaining.splice(remaining.indexOf(ct), 1);
      spent += b.salary;
      payroll += b.salary - ct.salary;
    });
    assert(s.eco.cash - spent - upcomingSalaryDue(remaining) >= reserve - 1e-6, "어떤 입찰이 실패해도 기존 연봉·유보금 보장");
    assert(payroll <= payrollSoftCap(s) + 1e-6);
  }
  console.log("OK mixed auction outcomes preserve payroll and cash", bids.length);
}
