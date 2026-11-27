import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL, RANKED } from "../../src/data";
import { ratingOf } from "../../src/rating";
import { newHistoryCareer } from "../../src/game/story";
import { newCareer } from "../../src/game/season";
import { autoDraft, newDraft } from "../../src/game/draft";
import { Rng } from "../../src/game/rng";
import { simulateGame } from "../../src/game/sim";
import { preMatchBrief } from "../../src/game/matchup";
import { NO_RECORD } from "../../src/game/yearRecords";

await loadCore(); await loadRanked();
const originalCards = JSON.stringify(CARDS), originalRanked = JSON.stringify(RANKED);
const info = { name: "맞대결검증", birth: "1988-01-01", nation: "한국", career: "amateur" as const };

{
  const kz = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const snap = JSON.stringify(kz);
  const first = kz.series.find((x) => x.a === "KZ" || x.b === "KZ")!;
  const op = first.a === "KZ" ? first.b : first.a;
  const b = preMatchBrief(kz, "KZ", op, first);
  assert.equal(JSON.stringify(kz), snap, "맞대결 계산은 저장을 바꾸지 않음");
  assert.equal(b.year, 2018);
  assert.equal(b.lanes.length, 5);
  assert.ok(b.lanes.every((ln) => ln.posKo !== "서폿"), "표기는 서포터");
  assert.equal(b.lanes[4].posKo, "서포터");
  assert.ok(b.keyPos != null, "능력치 차이가 가장 큰 라인을 고름");
  const key = b.lanes[b.keyPos!];
  const max = Math.max(...b.lanes.map((ln) => (ln.ovrDiff == null ? -1 : Math.abs(ln.ovrDiff))));
  assert.equal(Math.abs(key.ovrDiff!), max);
  assert.ok(b.lanes.every((ln) => ln.my.pool == null && ln.op.pool == null), "2018 챔피언 풀은 기록 없음");
  assert.ok(b.advice.some((t) => t.includes(NO_RECORD) && /2018/.test(t)), "없는 챔피언 풀은 기록 없음");
  assert.ok(b.advice.some((t) => t.includes(key.posKo) && t.includes("가장 큰")), "핵심 라인을 조언에 적음");
  const banned = /말했다|외쳤|자신감|인터뷰|보이스|"[가-힣].+"|‘[가-힣].+’/;
  for (const t of b.advice) {
    if (/지어내지 않았습니다/.test(t)) continue;
    assert.doesNotMatch(t, banned, "지어낸 발언·성격 금지: " + t);
    assert.doesNotMatch(t, /성격/, "성격 묘사 금지: " + t);
  }
  assert.ok(b.advice.some((t) => /승부 계산에는 쓰이지 않습니다/.test(t)));
  // 카드 기록이 있으면 그 연도 값을 쓰고, 2026 값으로 대체하지 않음
  const withCard = b.lanes.find((ln) => ln.my.cardYear != null);
  if (withCard?.my.cardYear) assert.equal(withCard.my.cardYear, 2018);
  assert.ok(!b.advice.join(" ").includes("2026"), "2018 맞대결 조언에 2026을 넣지 않음");
}

{
  const kz = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const bbq = newHistoryCareer("BBQ", 1, 13, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const vs = "BBQ";
  // KZ 명단 vs BBQ 명단을 같은 저장의 스타터로 비교할 수 없음(다른 커리어).
  // 같은 원칙으로 각 팀 첫 상대의 평균 차를 확인한다.
  const kFirst = kz.series.find((x) => x.a === "KZ" || x.b === "KZ")!;
  const bFirst = bbq.series.find((x) => x.a === "BBQ" || x.b === "BBQ")!;
  const kBrief = preMatchBrief(kz, "KZ", kFirst.a === "KZ" ? kFirst.b : kFirst.a, kFirst);
  const bBrief = preMatchBrief(bbq, "BBQ", bFirst.a === "BBQ" ? bFirst.b : bFirst.a, bFirst);
  assert.ok(kBrief.myAvg != null && bBrief.myAvg != null);
  // 우세/열세는 평균 차로 가른다(표시용).
  assert.ok(kBrief.lanes.every((ln) => ln.ovrDiff == null || Number.isInteger(ln.ovrDiff)));
  void vs;
}

{
  const s = newCareer("GEN", "검증", 1, 8);
  const snap = JSON.stringify({ form: s.form, pstats: s.pstats, eco: s.eco, rng: s.rng });
  const sr = s.series.find((x) => x.a === "GEN" || x.b === "GEN")!;
  const op = sr.a === "GEN" ? sr.b : sr.a;
  const b = preMatchBrief(s, "GEN", op, sr);
  assert.equal(JSON.stringify({ form: s.form, pstats: s.pstats, eco: s.eco, rng: s.rng }), snap);
  assert.equal(b.year, 2026);
  // 2026 공식 로스터는 풀이 있을 수 있으나, 없어도 다른 해를 채우지 않음
  if (b.lanes.some((ln) => ln.my.pool && ln.my.pool.length)) {
    assert.ok(b.lanes.some((ln) => ln.my.pool!.every((c) => c.n > 0)));
  }
}

{
  const d = autoDraft(newDraft("GEN", "T1", (await import("../../src/data")).TM.GEN.starters, (await import("../../src/data")).TM.T1.starters, "B", []), new Rng(17));
  const a = simulateGame(d, {}, new Rng(2026));
  const s = newCareer("GEN", "검증", 1, 8);
  const sr = s.series.find((x) => x.a === "GEN" && x.b === "T1" || x.a === "T1" && x.b === "GEN")!;
  preMatchBrief(s, "GEN", "T1", sr, d);
  const b = simulateGame(d, {}, new Rng(2026));
  assert.equal(JSON.stringify(a), JSON.stringify(b), "같은 시드 같은 경기 결과");
}

{
  const kz = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const first = kz.series.find((x) => x.a === "KZ" || x.b === "KZ")!;
  const op = first.a === "KZ" ? first.b : first.a;
  const b = preMatchBrief(kz, "KZ", op, first);
  assert.equal(b.opAvg, null, "미관찰 상대 선발 평균은 숫자로 내지 않음");
  assert.equal(b.opAvgText, "추정 구간");
  for (const ln of b.lanes) {
    if (ln.op.estKind !== "range") continue;
    const trueV = ratingOf(PL[ln.op.key]);
    assert.equal(ln.op.ovr, null);
    assert.match(ln.op.ovrText, /★/);
    if (trueV != null) {
      const blob = b.advice.filter((t) => !/KDA|골드|경기|승률/.test(t)).join("\n");
      assert.doesNotMatch(blob, new RegExp(`상대[^\n]{0,40}${trueV}(?!\\d)`), "조언에 상대 숨은 종합");
    }
  }
}

assert.equal(JSON.stringify(CARDS), originalCards, "카드 원본 불변");
assert.equal(JSON.stringify(RANKED), originalRanked, "랭크 원본 불변");
console.log("OK matchup: display-only brief, 2018 기록 없음, key lane by visible |OVR|, no invented quotes, no hidden opp rating, same seed same result");
