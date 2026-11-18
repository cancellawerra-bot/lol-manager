import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL, TM } from "../../src/data";
import { newStoryCareer, marketCards, storySalary, applyStoryWorld, beginSplit, payrollSoftCap, settlePayrollAndSolvency } from "../../src/game/story";
import { hydrateSave } from "../../src/game/cards";
import { initializeInSeason, prepareInSeason, seasonCandidates, seasonMarketWeek, seasonSalaryDue, seasonReserve, startSeasonNegotiation, seasonClubReply, seasonPlayerReply, seasonMarketClosed, answerSeasonIncoming, setSeasonAutomatic } from "../../src/game/inSeason";
import { advanceTeamTraining, trainingDate } from "../../src/game/trainingRuntime";
import { beginOffseason } from "../../src/game/stove";
import type { Save } from "../../src/game/season";
await loadCore(); await loadRanked();
const original = JSON.stringify(CARDS), copy = <T>(x: T): T => JSON.parse(JSON.stringify(x));
function fixture(seed = 17): Save {
  const cards = [0, 1, 2, 3, 4].map((pos) => marketCards(2018).filter((c) => c.posIdx === pos).sort((a, b) => storySalary(a, "CK") - storySalary(b, "CK") || b.percentile - a.percentile)[0].id);
  const s = newStoryCareer("SGU", "이적 검증", 1, seed, { cards, starters: cards, difficulty: "normal", club: { name: "이적 검증", short: "SGU", color: "#2DD4BF" }, managerInfo: { name: "이적 검증", birth: "1988-01-01", nation: "한국", career: "amateur" } });
  // 화면/계약 분기를 검사하는 승격 후 상황. 자연 진행·클리어율 표본과 구분합니다.
  s.story!.ck = s.story!.ck.filter((t) => t !== s.team); s.story!.ck.push(s.story!.lck.pop()!); s.story!.lck.push(s.team); s.story!.tier = "LCK";
  s.story!.franchised = true; s.story!.year = 2021; s.eco.cash = 100; s.eco.trust = 100;
  applyStoryWorld(s); beginSplit(s, 2021, "spring"); prepareInSeason(s); return s;
}
function free(s: Save) { return seasonCandidates(s).filter((c) => c.owner === "FA" && c.salary < 10).sort((a, b) => b.ovr - a.ovr)[0]; }
function healthy(s: Save) {
  const people: string[] = [];
  for (const t of [...s.story!.lck, ...s.story!.ck]) {
    const own = t === s.team ? s.story!.contracts : s.inSeason!.rosters[t];
    assert(own.length <= 8); assert.equal(s.starters[t].length, 5);
    s.starters[t].forEach((key, pos) => { assert.equal(PL[key].pos, pos, `${t}/${key}: position ${pos}`); assert(own.some((c) => c.key === key)); });
    people.push(...own.map((c) => c.person));
    if (t !== s.team) assert(s.inSeason!.cash[t] >= 0);
  }
  assert.equal(people.length, new Set(people).size, "전 구단 동일 인물 독점 계약"); assert(s.eco.cash >= 0);
}
{
  const s = fixture(), rng = s.rng, before = JSON.stringify(s.inSeason); prepareInSeason(s);
  assert.equal(s.rng, rng); assert.equal(JSON.stringify(s.inSeason), before);
  const restored = copy(s); hydrateSave(restored); applyStoryWorld(restored); prepareInSeason(restored); assert.deepEqual(restored.inSeason, copy(s.inSeason)); healthy(restored);
  assert.equal(seasonCandidates(s).length, new Set(seasonCandidates(s).map((c) => c.person)).size);
  assert(seasonCandidates(s).every((c) => c.card.year <= 2021)); healthy(s);
  const legacy = copy(s), oldKey = (k: string) => k.replace(/(-est-\d{4})-p[0-4]$/, "$1");
  for (const team of Object.keys(legacy.starters)) legacy.starters[team] = legacy.starters[team].map(oldKey);
  for (const c of legacy.story!.contracts) c.key = oldKey(c.key);
  legacy.cards = legacy.cards.map(oldKey);
  for (const list of Object.values(legacy.inSeason!.rosters)) for (const c of list) c.key = oldKey(c.key);
  hydrateSave(legacy); applyStoryWorld(legacy); healthy(legacy);
  console.log("OK weekly idempotence, separate market RNG, reload, one person and no future records");
}
{
  const s = fixture(), target = free(s); assert(target);
  const baseCash = s.eco.cash, baseContracts = copy(s.story!.contracts);
  assert.equal(startSeasonNegotiation(s, target.card.id, 0), undefined);
  for (const [salary, years] of [[NaN, 1], [Infinity, 1], [-1, 1], [target.salary, 0], [target.salary, 1.5]]) assert(!seasonPlayerReply(s, salary, years, true).ok);
  s.eco.cash = 0; assert(!seasonPlayerReply(s, target.salary, 1, true).ok); assert.deepEqual(s.story!.contracts, baseContracts); s.eco.cash = baseCash;
  s.story!.phase = "playoffs"; assert(seasonMarketClosed(s)); assert(!seasonPlayerReply(s, target.salary, 1, true).ok);
  s.story!.phase = "regular"; s.session = { seriesId: s.series[0].id, gameIdx: 0, holder: "", stage: "press", simStep: 0 };
  assert(startSeasonNegotiation(s, target.card.id, 0)); assert(!seasonPlayerReply(s, target.salary, 1, true).ok); delete s.session;
  assert.equal(s.eco.cash, baseCash); assert.deepEqual(s.story!.contracts, baseContracts);
  console.log("OK invalid money, no cash, contract duration, competition/session locks are atomic");
}
let purchase: Save | undefined, transfer: Save | undefined, sale: Save | undefined, transferBefore: Save | undefined, saleBefore: Save | undefined;
{
  const base = fixture(); let refused = false;
  for (const t of seasonCandidates(base).filter((c) => c.owner !== "FA" && c.ovr < 80 && c.salary < 8 && c.fee < 10)) {
    const s = copy(base); applyStoryWorld(s);
    if (startSeasonNegotiation(s, t.card.id, t.fee) || seasonClubReply(s)) continue;
    const cash = s.eco.cash, rng = s.rng, contracts = copy(s.story!.contracts);
    const answer = seasonPlayerReply(s, t.salary, 1, false);
    if (!answer.ok && answer.message.includes("선수가")) {
      assert.equal(s.eco.cash, cash); assert.equal(s.rng, rng); assert.deepEqual(s.story!.contracts, contracts);
      assert(startSeasonNegotiation(s, t.card.id, t.fee)?.includes("답변")); refused = true; break;
    }
  }
  assert(refused, "구단이 동의해도 선수는 잔류를 선택할 수 있음");
  const s = fixture(), t = free(s); startSeasonNegotiation(s, t.card.id, 0); s.day = 3;
  const cash = s.eco.cash; assert(!seasonPlayerReply(s, t.salary, 1, true).ok); assert.equal(s.eco.cash, cash);
  console.log("OK actual player refusal, no charge/RNG change, no repeat answer and negotiation expiry");
}
{
  const s = fixture(), target = free(s), oldStarter = s.starters[s.team][target.card.posIdx];
  const salary = Math.min(20, Math.max(target.salary * 2, 5)), cash = s.eco.cash, rng = s.rng;
  s.eco.cash = seasonSalaryDue(s, salary) + seasonReserve(s);
  const exactCash = s.eco.cash; assert.equal(startSeasonNegotiation(s, target.card.id, 0), undefined);
  const result = seasonPlayerReply(s, salary, 1, true); assert(result.ok, result.message);
  const ct = s.story!.contracts.find((c) => c.person === target.person)!;
  assert(ct); assert.equal(ct.salary, salary); assert.equal(ct.prepaid, false); assert.equal(s.eco.cash, +(exactCash - seasonSalaryDue(s, salary)).toFixed(2));
  assert(s.story!.contracts.some((c) => c.key === oldStarter)); assert.equal(s.rng, rng);
  assert.equal(s.training!.players[target.person].lastDate, trainingDate(s));
  assert.equal(s.training!.players[target.person].mechanicsXp + s.training!.players[target.person].strategyXp, 0, "FA 미등록 기간 XP 소급 없음");
  assert(startSeasonNegotiation(s, free(s).card.id, 0)); healthy(s);
  s.eco.cash = cash; purchase = copy(s);
  console.log("OK FA exact prorated settlement, bench retention, weekly purchase cap and no retroactive FA XP");
}
{
  const s = fixture(), target = free(s); assert.equal(startSeasonNegotiation(s, target.card.id, 0), undefined);
  const salary = target.salary, due = seasonSalaryDue(s, salary); s.eco.cash = +(due + seasonReserve(s) + salary - .01).toFixed(2);
  const before = s.eco.cash; assert(!seasonPlayerReply(s, salary, 2, false).ok); assert.equal(s.eco.cash, before);
  while (s.story!.contracts.length < 8) { const c = free(s); const key = c.card.id; s.story!.contracts.push({ key, person: c.person, cardId: c.card.id, salary: .01, years: 1 }); }
  s.eco.cash = 100; assert(!seasonPlayerReply(s, salary, 1, true).ok);
  console.log("OK next-year salary reserve and eight-player roster cap");
}
{
  const s = fixture(), target = free(s);
  s.training!.players[target.person] = { person: target.person, mechanicsXp: 123, strategyXp: 78, fatigue: 21, lastDate: "2020-09-01" };
  startSeasonNegotiation(s, target.card.id, 0);
  assert(seasonPlayerReply(s, Math.min(20, Math.max(target.salary * 2, 5)), 1, true).ok);
  advanceTeamTraining(s, s.team, trainingDate(s));
  assert.deepEqual(s.training!.players[target.person], { person: target.person, mechanicsXp: 123, strategyXp: 78, fatigue: 21, lastDate: trainingDate(s) });
  console.log("OK previously released FA retains growth without XP during unregistered gap");
}
{
  const base = fixture();
  const star = seasonCandidates(base).find((c) => c.owner !== "FA" && c.ovr >= 80)!;
  assert.equal(startSeasonNegotiation(base, star.card.id, star.fee), undefined); assert(seasonClubReply(base)?.includes("간판"));
  const targets = seasonCandidates(base).filter((c) => c.owner !== "FA" && c.ovr < 80 && c.fee < 10 && c.salary < 10);
  for (const target of targets) {
    const s = copy(base); applyStoryWorld(s);
    if (startSeasonNegotiation(s, target.card.id, target.fee) || seasonClubReply(s)) continue;
    const from = target.owner, cash = s.eco.cash, sellerCash = s.inSeason!.cash[from];
    advanceTeamTraining(s, from, trainingDate(s)); const growth = copy(s.training!.players[target.person]);
    const before = copy(s), salary = Math.max(target.salary * 2, 6), result = seasonPlayerReply(s, salary, 2, true); if (!result.ok) continue;
    assert.equal(s.eco.cash, +(cash - target.fee - seasonSalaryDue(s, salary)).toFixed(2));
    assert(s.inSeason!.cash[from] <= sellerCash + target.fee); assert.deepEqual(s.training!.players[target.person], growth);
    healthy(s); transfer = copy(s); transferBefore = before; break;
  }
  assert(transfer, "실제 구단 합의·선수 동의 이적 성공 분기");
  console.log("OK club star refusal, funded replacement, two-step transfer and personal XP/fatigue carryover");
}
{
  // 실제 생성된 제안 중 벤치 매각 가능한 사례를 찾으며 선수의 선택은 그대로 계산합니다.
  for (let seed = 1; seed <= 50 && !sale; seed++) {
    const s = fixture(seed), target = free(s);
    startSeasonNegotiation(s, target.card.id, 0);
    if (!seasonPlayerReply(s, Math.min(20, Math.max(target.salary * 2, 5)), 1, true).ok) continue;
    for (let day = 1; day < s.days.filter((d) => d.stage === "R").length && !sale; day++) {
      s.day = day; prepareInSeason(s);
      for (const offer of s.inSeason!.incoming.filter((o) => o.status === "open")) {
        const sold = s.story!.contracts.find((c) => c.person === offer.person)!;
        const blockedCash = s.eco.cash;
        if (s.starters[s.team].includes(sold.key)) {
          assert(answerSeasonIncoming(s, offer.id, true)); assert.equal(s.eco.cash, blockedCash); continue;
        }
        const before = copy(s), pre = s.eco.cash, buyer = s.inSeason!.cash[offer.from];
        if (!answerSeasonIncoming(s, offer.id, true)) {
          assert.equal(s.eco.cash, +(pre + offer.fee).toFixed(2));
          assert.equal(s.inSeason!.cash[offer.from], +(buyer - offer.fee - seasonSalaryDue(s, offer.salary)).toFixed(2));
          assert(answerSeasonIncoming(s, offer.id, true)); healthy(s); sale = copy(s); saleBefore = before; break;
        }
      }
    }
  }
  assert(sale, "자연 생성 제안과 선수 동의로 실제 벤치 매각");
  console.log("OK actual incoming sale, buyer cash, no wage refund, repeat acceptance and no-replacement starter guard");
}
{
  const s = purchase!, people = copy(s.story!.contracts), player = people[people.length - 1];
  player.years = 2; s.story!.contracts.find((c) => c.person === player.person)!.years = 2;
  const ai = copy(s.inSeason!.rosters); beginOffseason(s);
  assert.equal(s.story!.contracts.find((c) => c.person === player.person)!.years, 1);
  for (const [t, list] of Object.entries(ai)) assert.deepEqual(s.story!.stove!.aiContracts[t], list, "스토브 진입 시 AI 벤치 계약 유지");
  const nextPayroll = copy(s); nextPayroll.eco.cash = 200;
  const due = nextPayroll.story!.contracts.filter((c) => !c.prepaid).reduce((n, c) => n + c.salary, 0);
  settlePayrollAndSolvency(nextPayroll); assert.equal(nextPayroll.eco.cash, +(200 - due).toFixed(2));
  console.log("OK remaining contract and AI bench survive offseason transition");
}
{
  const s = fixture(); s.day = 4; delete s.inSeason; const rng = s.rng; initializeInSeason(s); prepareInSeason(s);
  assert.equal(s.inSeason!.week, seasonMarketWeek(s)); assert(s.inSeason!.history.every((d) => d.date === trainingDate(s))); assert.equal(s.rng, rng);
  const low = s.story!.contracts[0];
  const stronger = seasonCandidates(s).find((c) => c.owner === "FA" && c.card.posIdx === PL[low.key].pos && c.ovr > PL[low.key].pct.ovr);
  assert(stronger);
  // Public negotiation purchases that bench, followed by the actual zero-cash delegation.
  startSeasonNegotiation(s, stronger.card.id, 0); const result = seasonPlayerReply(s, Math.max(stronger.salary * 2, 20), 1, false);
  assert(result.ok, result.message); s.eco.cash = 0; setSeasonAutomatic(s, true);
  assert.equal(PL[s.starters[s.team][PL[low.key].pos]].personKey, stronger.person); assert.equal(s.eco.cash, 0);
  console.log("OK old save starts at current week and zero-cash automatic bench promotion");
}
assert.equal(JSON.stringify(CARDS), original);
if (process.argv.includes("--fixtures")) {
  mkdirSync("../in-season-qa", { recursive: true });
  const start = fixture(); writeFileSync("../in-season-qa/start.json", JSON.stringify(start));
  writeFileSync("../in-season-qa/purchase.json", JSON.stringify(purchase)); writeFileSync("../in-season-qa/transfer.json", JSON.stringify(transfer));
  writeFileSync("../in-season-qa/sale.json", JSON.stringify(sale));
  writeFileSync("../in-season-qa/transfer-before.json", JSON.stringify(transferBefore)); writeFileSync("../in-season-qa/sale-before.json", JSON.stringify(saleBefore));
}
console.log("OK in-season transfers complete; real source cards unchanged", payrollSoftCap(fixture(), "LCK"), TM.SGU.short);
