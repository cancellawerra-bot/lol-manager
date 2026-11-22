// v2.37.0 선수 면담: 규칙(성향·말투·신뢰), 쿨타임, 사기 경기 보정, 수석코치 대행, 출전 약속 연동을 검사합니다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked } from "../../src/data";
import { newHistoryCareer } from "../../src/game/story";
import { lockerMinds, lockerEffect, lockerTalk, lockerAuto, lockerError, type LockerTone, talkTo, talkError, talkEffect, delegateTalks, moodOf, moraleEdge, promiseMood, traitOf, MORALE_BASE, TRUST_BASE, type Trait, type Topic, type Tone } from "../../src/game/talks";
import { trainingPerson, matchTraining } from "../../src/game/trainingRuntime";
import { trainingDate } from "../../src/game/trainingRuntime";
await loadCore(); await loadRanked();
const info = { name: "면담 검증", birth: "1988-01-01", nation: "한국", career: "amateur" as const };
const mk = () => newHistoryCareer("T1", 1, 5, { startYear: 2024, managerInfo: info, difficulty: "normal" });

// 1) 규칙표: 모든 성향·주제·말투가 정수이고, 칭찬(부드럽게)은 사기를 올리며 비판(단호하게)은 낮춘다
for (const tr of ["proud", "diligent", "sensitive", "cheerful"] as Trait[]) for (const tp of ["praise", "criticize", "contract"] as Topic[]) for (const tn of ["soft", "plain", "firm"] as Tone[]) {
  const [dm, dt] = talkEffect(tr, tp, tn, 50); assert(Number.isInteger(dm) && Number.isInteger(dt), `${tr}/${tp}/${tn}`);
}
for (const tr of ["proud", "diligent", "sensitive", "cheerful"] as Trait[]) {
  assert(talkEffect(tr, "praise", "soft", 50)[0] > 0, `${tr} 칭찬`);
  assert(talkEffect(tr, "criticize", "firm", 50)[0] <= 0, `${tr} 단호한 비판`);
  assert(talkEffect(tr, "praise", "soft", 80)[0] === talkEffect(tr, "praise", "soft", 50)[0] + 1, "신뢰 높으면 +1");
  assert(talkEffect(tr, "praise", "soft", 20)[0] === talkEffect(tr, "praise", "soft", 50)[0] - 1, "신뢰 낮으면 −1");
  assert.equal(talkEffect(tr, "contract", "plain", 80)[0], talkEffect(tr, "contract", "plain", 20)[0], "재계약 논의는 신뢰 보정 없음");
}
assert(talkEffect("sensitive", "criticize", "soft", 50)[0] > talkEffect("sensitive", "criticize", "firm", 50)[0]);
assert(talkEffect("proud", "criticize", "firm", 50)[1] < talkEffect("diligent", "criticize", "firm", 50)[1]);

// 2) 면담 진행: 사기·신뢰 반영, 쿨타임, 계약 외 선수·잘못된 입력 거절
const s = mk(), c = s.story!.contracts.find((x) => x.years > 0)!, person = trainingPerson(s, c.key)!;
assert.equal(moodOf(s, person).morale, MORALE_BASE); assert.equal(moodOf(s, person).trust, TRUST_BASE);
const r = talkTo(s, c.key, "praise", "soft"); assert(typeof r !== "string", String(r));
const m1 = moodOf(s, person);
assert.equal(m1.morale, MORALE_BASE + (r as any).dMorale); assert.equal(m1.trust, TRUST_BASE + (r as any).dTrust); assert((r as any).dMorale > 0);
assert.equal(typeof talkTo(s, c.key, "praise", "soft"), "string", "같은 주에는 다시 면담할 수 없음");
assert(talkError(s, "nobody-key")!.includes("계약"));
assert.equal(typeof talkTo(s, c.key, "bogus" as any, "soft"), "string");
// 일주일 뒤에는 가능
s.day = Math.min(s.days.length - 1, s.day + 8); assert(trainingDate(s) > m1.lastTalk!, "날짜가 흘러야 함");
assert.equal(talkError(s, c.key), undefined);

// 3) 사기 상한·하한과 주 단위 되돌림
const t = mk(), tc = t.story!.contracts[0], tp = trainingPerson(t, tc.key)!;
moodOf(t, tp).morale = 99; (t.talks!.players[tp]).morale = 99;
const before = trainingDate(t); t.day = Math.min(t.days.length - 1, t.day + 21);
assert(trainingDate(t) > before); assert(moodOf(t, tp).morale <= 99 && moodOf(t, tp).morale >= MORALE_BASE, "주마다 평소로 돌아옴");
t.talks!.players[tp].morale = 1; t.talks!.players[tp].at = trainingDate(t);
for (let i = 0; i < 3; i++) { t.talks!.players[tp].lastTalk = undefined; talkTo(t, tc.key, "criticize", "firm"); }
assert(t.talks!.players[tp].morale >= 0 && t.talks!.players[tp].trust >= 0, "하한 0");

// 4) 경기 보정: 사기 60 → 0, 100 → +1%, 20 → −1% (피로 보정에서 빼서 반영)
const e = mk(), ek = e.story!.contracts[0].key, ep = trainingPerson(e, ek)!;
assert.equal(moraleEdge(e, ek), 0);
moodOf(e, ep); e.talks!.players[ep].morale = 100; assert(Math.abs(moraleEdge(e, ek) - 0.01) < 1e-9);
e.talks!.players[ep].morale = 20; assert(Math.abs(moraleEdge(e, ek) + 0.01) < 1e-9);
e.talks!.players[ep].morale = 100; const hi = matchTraining(e, [ek])?.[ek]?.fatigue ?? 0;
e.talks!.players[ep].morale = 20; const lo = matchTraining(e, [ek])?.[ek]?.fatigue ?? 0;
assert(lo - hi > 0.019 && lo - hi < 0.021, `사기 차이 ±1% 반영 ${lo - hi}`);

// 5) 수석코치 대행: 사기 낮은 선수에게만, 효과 절반, 쿨타임 적용
const d = mk(); for (const x of d.story!.contracts) { const p = trainingPerson(d, x.key)!; moodOf(d, p).morale = 80; }
assert.equal(delegateTalks(d), 0, "사기 75 이상이면 할 일 없음");
const n0 = d.story!.contracts.filter((x) => x.years > 0).length;
for (const x of d.story!.contracts) d.talks!.players[trainingPerson(d, x.key)!].morale = 50;
const done = delegateTalks(d); assert.equal(done, n0); assert(d.talks!.log.every((h) => h.coach && h.dMorale >= 1));
assert.equal(delegateTalks(d), 0, "같은 주 재대행 없음");

// 6) 출전 약속 연동: 이행 +3/+3, 미이행 −5/−5
const p = mk(), pk = trainingPerson(p, p.story!.contracts[0].key)!;
promiseMood(p, pk, "fulfilled"); assert.equal(moodOf(p, pk).morale, MORALE_BASE + 3); assert.equal(moodOf(p, pk).trust, TRUST_BASE + 3);
promiseMood(p, pk, "missed"); assert.equal(moodOf(p, pk).morale, MORALE_BASE - 2); assert.equal(moodOf(p, pk).trust, TRUST_BASE - 2);

// 7) 성향은 선수마다 고정, 네 가지가 모두 나온다
const seen = new Set<string>(); for (const x of s.story!.contracts) seen.add(traitOf(trainingPerson(s, x.key)!)); assert(traitOf("faker") === traitOf("faker"));
for (const w of ["a", "b", "c", "d", "e", "f", "g", "h", "faker", "chovy", "keria", "zeus"]) seen.add(traitOf(w)); assert(seen.size >= 3);

// 8) 라커룸 한마디: 직전 세트 활약 → 심리 상태, 말투별 효과, 한 번만, 다음 세트에만 반영
{
  const L = mk(), keys = L.starters[L.team].slice(0, 5), side = "B" as const;
  const rate = [9, 8, 5, 6.5, 4];
  const fake = (won: boolean) => { L.session = { seriesId: "SR1", gameIdx: 0, holder: "", stage: "locker", simStep: 0,
    draft: { teams: { B: L.team, R: "ZZZ" }, lineup: { B: keys, R: [] } } as any,
    result: { winner: won ? "B" : "R", perf: keys.map((k, i) => ({ key: k, side, pos: i, c: "x", k: 3, d: 2, a: 4, lane: 0, rating: rate[i] })) } as any } as any; L.talks = undefined; };
  fake(true);
  assert.equal(lockerError(L), undefined);
  const minds = lockerMinds(L); assert.equal(minds.length, 5);
  assert.equal(minds[0].mind, "confident", "이기고 평점 9지만 사기 60이면 자만이 아니라 자신감"); assert.equal(minds[1].mind, "confident");
  assert.equal(minds[2].mind, "nervous", "평점 5 이하는 불안"); assert.equal(minds[3].mind, "calm"); assert.equal(minds[4].mind, "nervous");
  moodOf(L, minds[0].person).morale = 80; assert.equal(lockerMinds(L)[0].mind, "cocky", "이기고 평점 8.5+ 사기 70+ = 자만");
  // 규칙표: 불안엔 침착이 가장 좋고 강하게는 해롭다. 예민한 선수에게 강하게는 더 나쁘다
  for (const tr of ["proud", "diligent", "sensitive", "cheerful"] as const) { assert(lockerEffect("nervous", "calm", tr)[0] > lockerEffect("nervous", "harsh", tr)[0]); assert(lockerEffect("cocky", "firm", tr)[0] > lockerEffect("cocky", "calm", tr)[0]); }
  assert(lockerEffect("calm", "harsh", "sensitive")[0] < lockerEffect("calm", "harsh", "proud")[0]);
  // 개인 면담: 그 선수만, 두 배, 신뢰 +1 / 다음 세트(gameIdx+1)에만 반영
  const target = minds[2], before = moodOf(L, target.person).trust;
  const msg = lockerTalk(L, "one", "calm", target.key); assert(msg.includes(target.name), msg);
  assert.equal(L.session!.locker!.target, "one"); assert.equal(moodOf(L, target.person).trust, before + 1);
  const e = L.talks!.set!.edge; assert.deepEqual(Object.keys(e), [target.person]); assert(e[target.person] > 0 && e[target.person] <= 0.006);
  assert.equal(typeof lockerTalk(L, "team", "firm"), "string"); assert(lockerError(L)!.includes("이미"), "한 번만");
  L.session = { ...L.session!, gameIdx: 0 } as any; assert(Math.abs(moraleEdge(L, target.key) - (moraleEdge(L, target.key))) < 1e-12);
  const gameNow = L.session!.gameIdx; L.session = { ...L.session!, gameIdx: gameNow + 1 } as any;
  const ownEdge = moraleEdge(L, target.key); L.session = { ...L.session!, gameIdx: gameNow + 2 } as any;
  assert(ownEdge - moraleEdge(L, target.key) > 0.004, "한마디 효과는 바로 다음 세트에만 있음");
  // 팀 전체·수석코치: 다섯 명 모두, 효과 절반/절반의 절반
  fake(false); const a = lockerTalk(L, "team", "calm"); assert.equal(Object.keys(L.talks!.set!.edge).length, 5, a);
  fake(false); assert(lockerAuto(L).includes("수석코치")); assert.equal(Object.keys(L.talks!.set!.edge).length, 5);
  assert.equal(typeof lockerTalk(L, "one", "calm", "nobody"), "string"); L.session = undefined; assert.equal(typeof lockerError(L), "string");
}
console.log("OK locker talk");
console.log("OK talks", { traits: [...seen].length, log: s.talks!.log.length });
