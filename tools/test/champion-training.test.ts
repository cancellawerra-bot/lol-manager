// v2.34.0 챔피언 훈련: 규칙(연습 쌓기·주간 5점 공유·과훈련), 일정 미리보기가 실제 처리와 같은지, 경기 숙련도 반영을 검사합니다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS } from "../../src/data";
import { newStoryCareer, marketCards } from "../../src/game/story";
import { advanceTeamTraining, previewWeek, setChampFocus, setTrainingPlan, trainingDate, trainingPlan, practiceMap } from "../../src/game/trainingRuntime";
import { trainingSession, WEEKLY_POINTS } from "../../src/game/training";
import { comfort, newDraft, autoDraft, PRACTICE_PER_GAME } from "../../src/game/draft";
import { simulateGame, COEF } from "../../src/game/sim";
import { formMap } from "../../src/game/season";
import { Rng } from "../../src/game/rng";
import type { DayAct } from "../../src/game/season";
await loadCore(); await loadRanked();
const original = JSON.stringify(CARDS);
const addDays = (d: string, n: number): string => new Date(Date.parse(d + "T00:00:00Z") + n * 86400000).toISOString().slice(0, 10);

function fixture(seed = 17) {
  const cards = [0, 1, 2, 3, 4].map((pos) => marketCards(2018).filter((c) => c.posIdx === pos).sort((a, b) => a.salary - b.salary)[0].id);
  return newStoryCareer("SGU", "챔피언 훈련 검증", 1, seed, { cards, starters: cards, difficulty: "normal", club: { name: "훈련 구단", short: "SGU", color: "#2DD4BF" }, managerInfo: { name: "검증", birth: "1988-01-01", nation: "한국", career: "amateur" } });
}

// 1) 챔피언 훈련 한 번: 성장·XP는 그대로, 연습만 +1, 훈련 포인트와 피로는 다른 훈련과 같이 씀
{
  const p0 = { person: "x", mechanicsXp: 10, strategyXp: 10, fatigue: 0, champFocus: "Ahri", physGain: 1, brainGain: 1 };
  const ctx = { base: 85, potential: 100, speed: 1 };
  const r = trainingSession(p0, "champion", "2018-01-22", undefined, ctx).progress;   // 월요일
  assert.equal(r.mechanicsXp, 10); assert.equal(r.strategyXp, 10); assert.equal(r.physGain, 1); assert.equal(r.brainGain, 1);
  assert.equal(r.champs?.Ahri, 1); assert.equal(r.weekPts, 1); assert(r.fatigue > 0);
  const m = trainingSession(p0, "mechanics", "2018-01-22", undefined, ctx).progress;
  assert.equal(r.fatigue, m.fatigue, "챔피언 훈련의 피로는 다른 훈련과 같음");
  assert.equal(m.champs, undefined);
  console.log("OK champion session: practice only, shared weekly point and fatigue");
}

// 2) 주간 5점 공유: 6번째 훈련은 과훈련 — 연습도 쌓이지 않음. 연습 챔피언이 없으면 쌓이지 않음
{
  let p: any = { person: "x", mechanicsXp: 0, strategyXp: 0, fatigue: 0, champFocus: "Ahri" };
  const ctx = { base: 85, potential: 100, speed: 1 };
  for (let i = 0; i < 7; i++) p = trainingSession(p, "champion", addDays("2018-01-22", i), undefined, ctx).progress;
  assert.equal(p.champs.Ahri, WEEKLY_POINTS, "한 주 5점까지만 연습이 쌓임");
  assert.equal(p.overDays, 2);
  let q: any = { person: "y", mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
  q = trainingSession(q, "champion", "2018-01-22", undefined, ctx).progress;
  assert.equal(q.champs, undefined, "연습 챔피언을 정하지 않으면 쌓이지 않음");
  console.log("OK weekly points shared with other training; no focus means no practice");
}

// 3) 미리보기 = 실제 처리: 같은 일정을 실제로 하루씩 처리한 결과와 같아야 함
{
  const s = fixture();
  const key = s.starters[s.team][2];
  const date = trainingDate(s);
  setChampFocus(s, key, "Ahri");
  const plan: DayAct[] = ["champ", "champ", "scrim", "rest", "train", "champ", "rest"];
  setTrainingPlan(s, key, plan, false);
  assert.deepEqual(trainingPlan(s, key), plan);
  const pv = previewWeek(s, key, plan, date)!;
  assert(pv && pv.days.length === 7 && pv.champDays === 3 && !pv.needFocus);
  const person = s.training!.players;
  const p0 = JSON.stringify(s.training);
  const actual: number[] = [];
  for (let i = 0; i < 7; i++) {
    advanceTeamTraining(s, s.team, addDays(date, i));
    const pr = Object.values(s.training!.players).find((x) => x.champFocus === "Ahri")!;
    actual.push(pr.fatigue);
  }
  void person;
  pv.days.forEach((d, i) => assert(Math.abs(d.fatigue - actual[i]) < 1e-9, `미리보기 피로 ${i}일차 ${d.fatigue} vs 실제 ${actual[i]}`));
  const done = Object.values(s.training!.players).find((x) => x.champFocus === "Ahri")!;
  assert.equal(done.champs?.Ahri, 3, "실제로 챔피언 훈련 3일 = 연습 3일");
  assert(JSON.stringify(s.training) !== p0);
  // 미리보기는 저장 상태를 바꾸지 않음
  const s2 = fixture(); const k2 = s2.starters[s2.team][2]; setChampFocus(s2, k2, "Ahri");
  const before = JSON.stringify(s2);
  previewWeek(s2, k2, plan, trainingDate(s2));
  assert.equal(JSON.stringify(s2), before, "미리보기는 읽기 전용");
  const noFocus = fixture(); const k3 = noFocus.starters[noFocus.team][1];
  assert.equal(previewWeek(noFocus, k3, plan, trainingDate(noFocus))!.needFocus, true, "연습 챔피언을 안 정했으면 경고");
  console.log("OK preview equals real processing, read-only, warns without focus");
}

// 4) 경기: 연습이 숙련도 보정에 들어가고, 연습 2일 = 1경기 상당
{
  assert.equal(comfort(undefined, "Ahri", 5).n, Math.floor(5 / PRACTICE_PER_GAME));
  const s = fixture();
  const rng = new Rng(3);
  const d = autoDraft(newDraft(s.team, "E8W", s.starters[s.team], fixture(5).starters[s.team], "B", []), rng);
  const pk = d.picks.B[0], key = d.lineup.B[pk.pos];
  const factor = (dd: typeof d) => simulateGame(dd, formMap(s, [...dd.lineup.B, ...dd.lineup.R]), new Rng(11), undefined, undefined).factors.find((f) => f.key === "comfort")!.v;
  const base = factor(d);
  const trained = factor({ ...d, practice: { [key]: { [pk.c]: 30 } } });
  const expect = COEF.comfortHi + 15 * COEF.comfortStep - COEF.comfortNone;
  assert(Math.abs((trained - base) - expect) < 1e-9, `연습 숙련 보정 ${(trained - base).toFixed(3)} vs ${expect.toFixed(3)}`);
  // 연습이 적으면(4경기 상당 미만) 기록 없음 감점만 사라짐
  const few = factor({ ...d, practice: { [key]: { [pk.c]: 2 } } });
  assert(Math.abs((few - base) - (0 - COEF.comfortNone)) < 1e-9, "1경기 상당이면 감점만 사라짐");
  // 연습 기록 map: 연습한 선수만, 없으면 undefined
  assert.equal(practiceMap(s, d.lineup.B), undefined);
  console.log("OK match comfort uses practice (2 days = 1 game), penalty removed first");
}
assert.equal(JSON.stringify(CARDS), original, "원본 카드는 수정하지 않음");
