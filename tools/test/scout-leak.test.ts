import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL, RANKED } from "../../src/data";
import { newHistoryCareer, marketCards } from "../../src/game/story";
import { addScoutReport } from "../../src/game/scouting";
import { estimateOvr, compareByVisibleOvr, ownedCompareText, visibleSortValue, halfToRatingLo, halfToRatingHi } from "../../src/game/scoutEstimate";
import { cardRating, ratingOf } from "../../src/rating";
import { preMatchBrief } from "../../src/game/matchup";
import { challengeLog, careerHonors } from "../../src/game/achievements";
import { initializeClubTimeline } from "../../src/game/clubTimeline";
import type { ClubSplitRecord } from "../../src/game/clubTimeline";

await loadCore(); await loadRanked();
const cardsSnap = JSON.stringify(CARDS), rankedSnap = JSON.stringify(RANKED);
const info = { name: "누설방지", birth: "1988-01-01", nation: "한국", career: "amateur" as const };
const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });

const others = marketCards(2018).filter((c) => !s.story!.contracts.some((ct) => ct.person === c.pkey));
assert.ok(others.length >= 20);

// 1) 능력치 높은 순은 보이는 구간 중간값(+결정적 id)이며, 숨은 실제값·퍼센타일로 뒤집히지 않는다.
{
  const rows = others.map((c) => {
    const value = cardRating(c, c.year < 2018);
    const est = estimateOvr(s, c.pkey, value, c);
    return { c, value, vis: visibleSortValue(est), id: c.id, person: c.pkey, est };
  });
  const byVisible = [...rows].sort((a, b) => b.vis - a.vis || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const sorted = [...rows].sort((a, b) => compareByVisibleOvr(s, { person: a.person, value: a.value, card: a.c, id: a.id }, { person: b.person, value: b.value, card: b.c, id: b.id }));
  assert.deepEqual(sorted.map((x) => x.id), byVisible.map((x) => x.id), "정렬은 보이는 중간값 내림차순, 동점은 id");

  // 실제값 순과 보이는 순이 다른 쌍이 있으면, 보이는 쪽이 이긴다.
  const clone = structuredClone(s);
  // 높은 실제값·넓은 구간 vs 조금 낮은 실제값·좁은 구간이 순서가 뒤집히도록 리포트로 좁힌다.
  let inverted = false;
  for (const high of rows.filter((x) => x.est.kind === "range")) {
    for (const low of rows.filter((x) => x.est.kind === "range" && x.value < high.value - 0.5 && x.id !== high.id)) {
      const trial = structuredClone(clone);
      // 낮은 쪽만 관찰해 구간을 좁힌다
      for (let i = 0; i < 3; i++) addScoutReport(trial, low.person);
      const hv = visibleSortValue(estimateOvr(trial, high.person, high.value, high.c));
      const lv = visibleSortValue(estimateOvr(trial, low.person, low.value, low.c));
      if (lv > hv && low.value < high.value) {
        const cmp = compareByVisibleOvr(trial, { person: high.person, value: high.value, card: high.c, id: high.id }, { person: low.person, value: low.value, card: low.c, id: low.id });
        assert.ok(cmp > 0, `실제값은 ${high.value} > ${low.value}여도 보이는 값 ${hv} < ${lv}이면 낮은 실제값이 앞선다`);
        inverted = true;
        break;
      }
    }
    if (inverted) break;
  }
  assert.ok(inverted, "테스트 표본에서 실제값과 보이는 순이 다른 쌍을 만들어야 함");

  // 동점 타이브레이커는 퍼센타일이 아니라 id
  const sameVis = rows.filter((x) => x.est.kind === "range");
  let tied = false;
  for (let i = 0; i < sameVis.length; i++) {
    for (let j = i + 1; j < sameVis.length; j++) {
      const a = sameVis[i], b = sameVis[j];
      if (a.vis !== b.vis) continue;
      const cmp = compareByVisibleOvr(s, { person: a.person, value: a.value, card: a.c, id: a.id }, { person: b.person, value: b.value, card: b.c, id: b.id });
      const expect = a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
      assert.equal(Math.sign(cmp), expect, "동점은 결정적 id, 퍼센타일·실제값 아님");
      tied = true;
      break;
    }
    if (tied) break;
  }
}

// 2) 「보유 최고 대비 +N」은 미관찰이면 실제 차이를 쓰지 않고 구간으로만 적는다.
{
  const base = 78;
  const c = others.find((x) => {
    const v = cardRating(x, x.year < 2018);
    const est = estimateOvr(s, x.pkey, v, x);
    return est.kind === "range" && Number.isFinite(v) && Math.round(v - base) !== 0;
  })!;
  const v = cardRating(c, c.year < 2018);
  const text = ownedCompareText(s, base, c.pkey, v, c);
  const trueDelta = Math.round(v - base);
  assert.match(text, /추정/);
  assert.match(text, /구간/);
  assert.doesNotMatch(text, new RegExp(`대비 \\+?${trueDelta}(?!\\d)`), `실제 차이 ${trueDelta}를 문장에 쓰지 않음: ${text}`);
  const ours = s.story!.contracts[0];
  const ourV = ratingOf(PL[ours.key])!;
  const exact = ownedCompareText(s, base, ours.person, ourV, CARDS[ours.cardId]);
  assert.match(exact, /대비 \+?-?\d+/);
  assert.doesNotMatch(exact, /추정/);
}

// 3) 경기 전 맞대결: 미관찰 상대 조언·평균·ovrText에 숨은 종합이 숫자로 안 나온다. 시즌 카드 공개 기록은 허용.
{
  const first = s.series.find((x) => x.a === "KZ" || x.b === "KZ")!;
  const op = first.a === "KZ" ? first.b : first.a;
  const b = preMatchBrief(s, "KZ", op, first);
  assert.ok(b.lanes.some((ln) => ln.op.estKind === "range"), "시작 커리어 상대는 미관찰 구간이 있어야 함");
  assert.equal(b.opAvg, null);
  assert.equal(b.opAvgText, "추정 구간");
  assert.ok(b.advice.some((t) => t.includes("추정 구간")));
  for (const ln of b.lanes) {
    assert.ok(ln.my.estKind === "exact", "우리 팀은 정확값");
    if (ln.op.estKind !== "range") continue;
    const trueV = ratingOf(PL[ln.op.key]);
    assert.equal(ln.op.ovr, null);
    assert.match(ln.op.ovrText, /★/);
    if (trueV != null) {
      assert.notEqual(ln.op.ovrText, String(trueV));
      const leak = new RegExp(`상대([^\\d★]{0,40})${trueV}(?!\\d)`);
      for (const t of b.advice) {
        // 시즌 카드 KDA·GD@15 숫자는 공개 기록. 종합 능력치 문장만 검사.
        if (/KDA|골드|경기|승률/.test(t)) continue;
        assert.doesNotMatch(t, leak, "조언에 상대 숨은 종합: " + t);
        assert.doesNotMatch(t, new RegExp(`우리가 ${trueV} `), "숨은 상대 값으로 차이를 적지 않음: " + t);
      }
    }
    if (ln.my.visible != null && ln.op.visible != null) {
      assert.equal(ln.ovrDiff, Math.round(ln.my.visible - ln.op.visible));
    }
  }
  if (b.keyPos != null) {
    const key = b.lanes[b.keyPos];
    const max = Math.max(...b.lanes.map((ln) => (ln.ovrDiff == null ? -1 : Math.abs(ln.ovrDiff))));
    assert.equal(Math.abs(key.ovrDiff!), max);
  }
}

// 4) challengeLog 6항. LCK 우승은 1부만, 2부는 2부 우승. trophies.lck만으로는 켜지지 않음.
{
  assert.equal(challengeLog(s)!.length, 6);
  const fresh = challengeLog(s)!.find((x) => x.id === "lck")!;
  assert.equal(fresh.done, false);
  assert.equal(fresh.label, "LCK 우승");

  const onlyCounter = structuredClone(s);
  onlyCounter.story!.trophies.lck = 2;
  const bare = challengeLog(onlyCounter)!.find((x) => x.id === "lck")!;
  assert.equal(bare.done, false, "trophies.lck만 있고 스플릿·결승 증거가 없으면 우승으로 치지 않음(2부/1부를 지어내지 않음)");
  assert.equal(bare.label, "LCK 우승");

  const ck = structuredClone(s);
  initializeClubTimeline(ck, false);
  const ckSplit: ClubSplitRecord = {
    id: "test-ck-2018-summer", year: 2018, split: "summer", tier: "CK", date: "2018-08-01",
    rank: 1, w: 10, l: 4, gw: 20, gl: 10, complete: true, champion: ck.team, championName: "KZ",
    roster: [],
    matches: [{ id: "CK-F-test", date: "2018-08-01", opponent: "EEW", opponentName: "EEW", stage: "F", scored: 3, conceded: 1, won: true }],
  };
  ck.clubTimeline!.splits.push(ckSplit);
  ck.story!.trophies.lck = 1;
  const ckLog = challengeLog(ck)!;
  assert.equal(ckLog.length, 6);
  const ckItem = ckLog.find((x) => x.id === "lck")!;
  assert.equal(ckItem.done, true);
  assert.equal(ckItem.label, "2부 우승");
  assert.match(ckItem.detail, /2018/);
  assert.equal(careerHonors(ck).trophies.find((t) => t.id === "ck")!.done, true);
  assert.equal(careerHonors(ck).trophies.find((t) => t.id === "lck")!.done, false);

  const lck = structuredClone(ck);
  lck.clubTimeline!.splits.push({
    id: "test-lck-2019-spring", year: 2019, split: "spring", tier: "LCK", date: "2019-04-01",
    rank: 1, w: 14, l: 4, gw: 28, gl: 12, complete: true, champion: lck.team, championName: "KZ",
    roster: [],
    matches: [{ id: "LCK-F-test", date: "2019-04-01", opponent: "T1", opponentName: "T1", stage: "F", scored: 3, conceded: 2, won: true }],
  });
  const lckItem = challengeLog(lck)!.find((x) => x.id === "lck")!;
  assert.equal(lckItem.done, true);
  assert.equal(lckItem.label, "LCK 우승", "1부 우승이 있으면 LCK 우승 라벨을 쓴다");
  assert.match(lckItem.detail, /2019/);

  // 옛 저장: honors.earned만 있는 2부 우승
  const legacy = structuredClone(s);
  legacy.honors = { version: 1, announced: ["ck"], earned: { ck: { detail: "2018 서머", count: 1, when: ["2018 서머"] } } };
  const leg = challengeLog(legacy)!.find((x) => x.id === "lck")!;
  assert.equal(leg.done, true);
  assert.equal(leg.label, "2부 우승");
}

assert.equal(JSON.stringify(CARDS), cardsSnap);
assert.equal(JSON.stringify(RANKED), rankedSnap);
console.log("OK scout-leak: visible sort, compare text, pre-match advice, challengeLog LCK vs CK");
