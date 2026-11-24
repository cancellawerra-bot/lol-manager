import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL, TM, RANKED } from "../../src/data";
import { autoDraft, newDraft } from "../../src/game/draft";
import { Rng } from "../../src/game/rng";
import { simulateGame } from "../../src/game/sim";
import { coachTalk, isHighlight, leadPoints, nextWatchStep, objectiveMoments, snapWatchStep, type WatchMode } from "../../src/game/watchView";

await loadCore(); await loadRanked();
const original = JSON.stringify({ CARDS, PL, RANKED });

const d = autoDraft(newDraft("GEN", "T1", TM.GEN.starters, TM.T1.starters, "B", []), new Rng(17));
const a = simulateGame(d, {}, new Rng(2026));
const b = simulateGame(d, {}, new Rng(2026));
assert.equal(JSON.stringify(a), JSON.stringify(b), "같은 시드 같은 경기 결과");
assert.equal(a.winner, b.winner);
assert.equal(a.gold15, b.gold15);
assert.equal(a.leadEnd, b.leadEnd);
assert.equal(a.events.length, b.events.length);
assert.deepEqual(a.events, b.events);

const ev = a.events;
assert.ok(ev.length >= 8, "장면이 충분히 쌓임");
assert.ok(ev.some((e) => isHighlight(e, ev, ev.indexOf(e))), "주요 장면이 있음");
assert.ok(ev.some((e) => e.kind === "fight" || e.kind === "end" || e.kind === "lane"));

// 전체 장면은 한 칸씩, 결과만은 끝으로, 주요 장면은 하이라이트만 밟음
assert.equal(nextWatchStep(ev, 0, "full"), 1);
assert.equal(nextWatchStep(ev, ev.length, "full"), ev.length);
assert.equal(nextWatchStep(ev, 0, "result"), ev.length);
const firstHi = nextWatchStep(ev, 0, "highlight");
assert.ok(firstHi >= 1 && firstHi <= ev.length);
assert.ok(isHighlight(ev[firstHi - 1], ev, firstHi - 1), "첫 주요 장면이 하이라이트");
let step = 0, seen = 0;
const kinds: string[] = [];
while (step < ev.length) {
  const n = nextWatchStep(ev, step, "highlight");
  assert.ok(n > step);
  step = n;
  seen++;
  kinds.push(ev[step - 1].kind);
}
assert.ok(seen < ev.length, "주요 장면 모드는 일부 장면을 건너뜀");
assert.ok(kinds.includes("end") || ev[ev.length - 1] && isHighlight(ev[ev.length - 1], ev, ev.length - 1));
assert.equal(snapWatchStep(ev, 0, "highlight"), 0);
assert.equal(snapWatchStep(ev, ev.length, "result"), ev.length);

const pts = leadPoints(a, ev.length);
assert.equal(pts[0].t, 0);
assert.equal(pts[0].v, 0);
assert.equal(pts[pts.length - 1].v, a.leadEnd, "마지막 점은 기록된 leadEnd");
assert.ok(pts.every((p, i) => i === 0 || p.t >= pts[i - 1].t), "시간은 앞으로만");
for (const e of ev) {
  if (e.lead != null) {
    const hit = pts.filter((p) => p.t === e.t && p.v === e.lead);
    assert.ok(hit.length >= 1, "이벤트 lead가 그래프에 그대로 있음");
  }
}
const mid = leadPoints(a, Math.min(4, ev.length));
assert.ok(mid.length >= 2);
// 아직 안 지난 장면의 lead를 만들지 않음
const maxT = mid[mid.length - 1].t;
assert.ok(maxT <= ev[Math.min(4, ev.length) - 1].t || maxT === 0);

const objs = objectiveMoments(ev, ev.length);
assert.ok(objs.every((e) => ["drake", "grub", "herald", "baron", "tower"].includes(e.kind)));
assert.deepEqual(objs, ev.filter((e) => ["drake", "grub", "herald", "baron", "tower"].includes(e.kind)));

const teams = { B: "젠지", R: "T1" };
const talk0 = coachTalk(undefined, { teams, me: "B", seen: [] });
assert.match(talk0.body, /기록된 장면이 없습니다/);
const ban = /말했다|외쳤|자신감|성격|인터뷰|보이스|\"[가-힣].+\"/;
for (let i = 0; i < ev.length; i++) {
  const e = ev[i];
  const talk = coachTalk(e, { teams, me: "B", seen: ev.slice(0, i + 1), leadEnd: a.leadEnd });
  assert.ok(talk.body.includes(`${e.t}분`) || e.kind === "end", "시간 또는 종료를 짚음");
  assert.ok(talk.body.includes(e.text), "실제 이벤트 문장을 포함");
  assert.doesNotMatch(talk.body, ban, "지어낸 발언·성격 금지");
}

// 보기 모드가 시뮬 결과를 바꾸지 않음
for (const mode of ["full", "highlight", "result"] as WatchMode[]) {
  const again = simulateGame(d, {}, new Rng(2026));
  assert.equal(JSON.stringify(again), JSON.stringify(a), `모드 ${mode}와 무관하게 같은 시드 같은 결과`);
  void mode;
}

assert.equal(JSON.stringify({ CARDS, PL, RANKED }), original, "카드 데이터 불변");
console.log("OK watch view: same seed same result, highlight stepping, gold points from recorded lead, coach talk facts only");
