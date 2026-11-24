import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL, RANKED } from "../../src/data";
import { newHistoryCareer, newStoryCareer, marketCards, storySalary } from "../../src/game/story";
import { addScoutReport, isOurPlayer, scoutReports, setScoutPreferences, toggleScoutWatch, MAX_SCOUT_REPORTS } from "../../src/game/scouting";
import { estimateOvr, formatStars, ratingToHalf, starWindow, STAR_MIN, STAR_MAX } from "../../src/game/scoutEstimate";
import { cardRating, ratingOf } from "../../src/rating";
import { Rng } from "../../src/game/rng";
import { simSeries } from "../../src/game/season";

await loadCore(); await loadRanked();
const cardsSnap = JSON.stringify(CARDS), rankedSnap = JSON.stringify(RANKED);

const info = { name: "스카우트추정", birth: "1988-01-01", nation: "한국", career: "amateur" as const };
const hist = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
assert.equal(hist.scouting, undefined, "old-save shape: no scouting field");
assert.equal(hist.v, 2);

// 별점 변환·표기
assert.equal(formatStars(6, 9), "★★★~★★★★½");
assert.equal(formatStars(10, 10), "★★★★★");
assert.equal(ratingToHalf(60), 2);
assert.equal(ratingToHalf(92), 10);
assert.equal(ratingToHalf(99), 10);
assert.equal(ratingToHalf(88), 9);

// 우리 팀은 정확값
for (const ct of hist.story!.contracts) {
  const r = ratingOf(PL[ct.key]);
  const est = estimateOvr(hist, ct.person, r, CARDS[ct.cardId], PL[ct.key]);
  assert.equal(est.kind, "exact");
  assert.equal(est.text, String(r));
  assert.equal(isOurPlayer(hist, ct.person), true);
}

// 상대 선수는 범위가 실제 별점을 포함, 결정적, 리포트로 좁아짐·부분집합
const others = marketCards(2018).filter(c => !hist.story!.contracts.some(ct => ct.person === c.pkey));
assert(others.length >= 20);
const snapshots: Record<string, [number, number][]> = {};
for (const c of others.slice(0, 80)) {
  const v = cardRating(c, c.year < 2018);
  const half = ratingToHalf(v);
  const clone = structuredClone(hist);
  assert.equal(clone.scouting, undefined);
  const seen: [number, number][] = [];
  for (let step = 0; step <= MAX_SCOUT_REPORTS; step++) {
    const est = estimateOvr(clone, c.pkey, v, c);
    if (step === 0) {
      assert.notEqual(est.kind, "none");
      if (est.kind === "exact") {
        // 해당 연도 표본이 충분하면 한 번의 리포트 전에 이미 좁을 수 있으나, 2018 카드는 보통 범위
      } else {
        assert.equal(est.kind, "range");
        assert.match(est.text, /★/);
        assert.ok(est.lo <= half && half <= est.hi, `${c.pkey} ${v} half=${half} ${est.lo}-${est.hi}`);
      }
    }
    if (est.kind === "range") assert.ok(est.lo <= half && half <= est.hi);
    if (est.kind === "exact") { assert.equal(est.value, v); assert.equal(est.lo, half); assert.equal(est.hi, half); }
    seen.push([est.lo, est.hi]);
    if (step < MAX_SCOUT_REPORTS && est.kind !== "exact") {
      const beforeCash = clone.eco.cash, beforeSal = JSON.stringify(clone.story!.contracts.map(x => [x.person, x.salary]));
      assert.equal(addScoutReport(clone, c.pkey), undefined);
      assert.equal(scoutReports(clone, c.pkey), step + 1);
      assert.equal(clone.eco.cash, beforeCash);
      assert.equal(JSON.stringify(clone.story!.contracts.map(x => [x.person, x.salary])), beforeSal);
    } else if (step < MAX_SCOUT_REPORTS && est.kind === "exact") {
      addScoutReport(clone, c.pkey);
    }
  }
  for (let i = 1; i < seen.length; i++) {
    const [a, b] = seen[i - 1], [cLo, cHi] = seen[i];
    assert.ok(cHi - cLo <= b - a, `width should shrink or stay ${c.pkey} ${a}-${b} -> ${cLo}-${cHi}`);
    assert.ok(cLo >= a && cHi <= b, `later range must be subset ${c.pkey}`);
  }
  const last = estimateOvr(clone, c.pkey, v, c);
  assert.equal(last.kind, "exact", c.pkey);
  assert.equal(last.value, v);
  const again = structuredClone(hist);
  for (let i = 0; i < scoutReports(clone, c.pkey); i++) addScoutReport(again, c.pkey);
  assert.deepEqual(estimateOvr(again, c.pkey, v, c), estimateOvr(clone, c.pkey, v, c));
  snapshots[c.pkey] = seen;
}
// 새로고침(동일 세이브)에도 같음
const sample = others[0];
const v0 = cardRating(sample, sample.year < 2018);
const a = estimateOvr(hist, sample.pkey, v0, sample);
const b = estimateOvr(JSON.parse(JSON.stringify(hist)), sample.pkey, v0, sample);
assert.deepEqual(a, b);
assert.equal(hist.scouting, undefined);

// 관심 저장·목적 변경이 리포트를 지우지 않음
const keep = structuredClone(hist);
assert.equal(addScoutReport(keep, sample.pkey), undefined);
assert.equal(toggleScoutWatch(keep, sample.pkey), undefined);
setScoutPreferences(keep, { goal: "value", pos: 0, affordableOnly: false });
assert.equal(scoutReports(keep, sample.pkey), 1);
assert.equal(keep.scouting!.watch[0], sample.pkey);
assert.equal(keep.scouting!.goal, "value");

// 우리 팀에는 리포트를 쓰지 않음
const ours = hist.story!.contracts[0].person;
assert(addScoutReport(structuredClone(hist), ours)?.includes("우리 구단"));

// 기록 없는 이름은 추정하지 않음
const missing = estimateOvr(hist, "없는신인-xyz", null);
assert.equal(missing.kind, "none");
assert.equal(missing.text, "기록 없음");
assert(addScoutReport(structuredClone(hist), "없는신인-xyz")?.includes("기록"));

// 같은 시드 같은 경기 결과, 리포트는 표시만
const aa = structuredClone(hist), bb = structuredClone(hist);
for (const c of others.slice(0, 5)) addScoutReport(bb, c.pkey);
const ra = new Rng(aa.rng), rb = new Rng(bb.rng);
simSeries(aa, aa.series[0], ra);
simSeries(bb, bb.series[0], rb);
assert.deepEqual(aa.series[0].games, bb.series[0].games);
assert.equal(ra.s, rb.s);
assert.equal(aa.eco.cash, hist.eco.cash);

// 창단 스토리 저장에도 동일 규칙, CARDS/RANKED 불변
const storyCards = [0, 1, 2, 3, 4].map(pos => marketCards(2018).filter(c => c.posIdx === pos).sort((a, b) => storySalary(a, "CK") - storySalary(b, "CK") || a.id.localeCompare(b.id))[0].id);
const story = newStoryCareer("SGU", "스카우트추정", 1, 21, { club: { name: "스카우트추정", short: "SGU", color: "#2DD4BF" }, managerInfo: { name: "스카우트추정", birth: "1988-01-01", nation: "한국", career: "amateur" }, cards: [...storyCards], starters: [...storyCards], difficulty: "normal" });
const outsider = marketCards(2018).find(c => !story.story!.contracts.some(ct => ct.person === c.pkey))!;
const ev = cardRating(outsider, outsider.year < 2018);
const e1 = estimateOvr(story, outsider.pkey, ev, outsider);
assert.ok(e1.kind === "range" || e1.kind === "exact");
if (e1.kind === "range") assert.ok(e1.lo <= ratingToHalf(ev) && ratingToHalf(ev) <= e1.hi);

// 결정적 창: 모든 별점·모든 너비에서 포함·부분집합
for (let half = STAR_MIN; half <= STAR_MAX; half++) {
  let prev: [number, number] | undefined;
  for (let w = 4; w >= 0; w--) {
    const win = starWindow(half, w, `ovr:test-${half}`);
    assert.ok(win[0] <= half && half <= win[1]);
    if (prev) { assert.ok(win[0] >= prev[0] && win[1] <= prev[1]); }
    prev = win;
    assert.deepEqual(starWindow(half, w, `ovr:test-${half}`), win);
  }
}

assert.equal(JSON.stringify(CARDS), cardsSnap);
assert.equal(JSON.stringify(RANKED), rankedSnap);
console.log("OK scout estimate ranges include true values, nest as reports grow, stay deterministic, leave economy and match results unchanged");
