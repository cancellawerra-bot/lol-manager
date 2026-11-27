import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS } from "../../src/data";
import { newStoryCareer, marketCards, settlePayrollAndSolvency } from "../../src/game/story";
import { simSeries } from "../../src/game/season";
import { autoDraft, newDraft } from "../../src/game/draft";
import { Rng } from "../../src/game/rng";
import { trainingSession, trainedRating, potentialFor } from "../../src/game/training";
import { advanceTeamTraining, initializeTraining, setTrainingPlan, growthCtxAt, trainingPerson } from "../../src/game/trainingRuntime";
import { historyGrowthSpeed } from "../../src/game/historyGrowth";
import { FANTASY_BUDGETS } from "../../src/game/cards";
import { moneyRound } from "../../src/game/money";
import { projectLedger } from "../../src/game/ledger";
import { buildClassReport, NONE, reportToJson } from "../../src/game/classReport";
import { homeTodos } from "../../src/pages/ManagerDashboard";
import { SAVE_V } from "../../src/game/season";
import {
  STAFF_ADVICE_CAP, STAFF_CATALOG, STAFF_DEFAULT_TEMP, STAFF_FATIGUE_FLOOR, STAFF_RECOVER_CAP, STAFF_TRAIN_CAP,
  fireStaff, hireStaff, hiredOf, staffAdviceTemp, staffById, staffDraftOpt, staffPayroll, staffSessionBoost,
} from "../../src/game/staff";

await loadCore(); await loadRanked();

function fixture(seed = 21) {
  const cards = [0, 1, 2, 3, 4].map((pos) => marketCards(2018).filter((c) => c.posIdx === pos).sort((a, b) => a.salary - b.salary)[0].id);
  const s = newStoryCareer("SGU", "스태프검증", 1, seed, {
    cards, starters: cards, difficulty: "normal",
    club: { name: "스태프 구단", short: "SGU", color: "#2DD4BF" },
    managerInfo: { name: "스태프검증", birth: "1988-01-01", nation: "한국", career: "amateur" },
  });
  s.schedOk = true;
  return s;
}

function snap(s: ReturnType<typeof fixture>) {
  return JSON.stringify({
    cash: s.eco.cash, rng: s.rng, winners: s.series.map((x) => ({ id: x.id, w: x.winner, sa: x.sa, sb: x.sb })),
    training: s.training, fans: s.eco.fans, trust: s.eco.trust,
  });
}

{
  assert.equal(SAVE_V, 2);
  assert.equal(FANTASY_BUDGETS.easy, 90);
  assert.equal(FANTASY_BUDGETS.normal, 85);
  assert.equal(FANTASY_BUDGETS.hard, 80);
  const vet = staffById("phys-veteran")!;
  assert.equal(vet.train, STAFF_TRAIN_CAP);
  assert.equal(staffById("cond-veteran")!.recover, STAFF_RECOVER_CAP);
  assert.equal(staffById("cond-veteran")!.fatigueLoad, STAFF_FATIGUE_FLOOR);
  assert.equal(staffById("head-veteran")!.advice, STAFF_ADVICE_CAP);
  assert.ok(STAFF_DEFAULT_TEMP * (1 - STAFF_ADVICE_CAP) >= 0.315 - 1e-12);
  console.log("OK staff caps and fantasy budgets unchanged");
}

{
  const a = fixture(21);
  assert.equal(a.staff, undefined);
  const empty = structuredClone(a);
  empty.staff = { hires: [] };
  const missing = structuredClone(a);
  delete (missing as { staff?: unknown }).staff;
  assert.equal(staffPayroll(a), 0);
  assert.equal(staffPayroll(empty), 0);
  assert.equal(staffSessionBoost(a), undefined);
  assert.equal(staffSessionBoost(empty), undefined);
  assert.equal(staffAdviceTemp(a), STAFF_DEFAULT_TEMP);
  assert.equal(staffAdviceTemp(empty), STAFF_DEFAULT_TEMP);
  assert.equal(staffDraftOpt(a, a.team, "E8W"), undefined);

  const srA = a.series.find((x) => x.a === a.team || x.b === a.team)!;
  const i = a.series.indexOf(srA);
  const rngA = new Rng(a.rng), rngE = new Rng(empty.rng), rngM = new Rng(missing.rng);
  simSeries(a, a.series[i], rngA);
  simSeries(empty, empty.series[i], rngE);
  simSeries(missing, missing.series[i], rngM);
  a.rng = rngA.s; empty.rng = rngE.s; missing.rng = rngM.s;
  assert.equal(snap(a), snap(empty), "빈 스태프 목록은 필드 없음과 같은 승부·경제");
  assert.equal(snap(a), snap(missing), "옛 저장(필드 없음)은 코치 없음과 같은 결과");

  const d1 = autoDraft(newDraft(a.team, "E8W", a.starters[a.team], a.starters[a.team], "B", [], 2018), new Rng(9));
  const d2 = autoDraft(newDraft(a.team, "E8W", a.starters[a.team], a.starters[a.team], "B", [], 2018), new Rng(9));
  assert.equal(JSON.stringify(d1.picks), JSON.stringify(d2.picks));
  console.log("OK no-hire identity: old save, empty staff, same seed same result");
}

{
  const p = { person: "t", mechanicsXp: 0, strategyXp: 0, fatigue: 40, physGain: 0, brainGain: 0 };
  const ctx = { base: 85, potential: 100, speed: 1 };
  const birth = { date: "1996-05-07", sourceUrl: "https://example.invalid", checkedAt: "2026-01-01" };
  const plain = trainingSession(p, "mechanics", "2018-01-21", birth, ctx);
  const ones = trainingSession(p, "mechanics", "2018-01-21", birth, ctx, { mechanics: 1, strategy: 1, recovery: 1, fatigueLoad: 1 });
  assert.deepEqual(plain.progress, ones.progress, "배율 1은 기본 훈련과 비트 단위로 같음");
  const boost = trainingSession(p, "mechanics", "2018-01-21", birth, ctx, { mechanics: STAFF_TRAIN_CAP });
  assert.ok((boost.progress.physGain ?? 0) > (plain.progress.physGain ?? 0), "피지컬 코치 고용 시 성장이 더 큼");
  const restP = trainingSession({ ...p, fatigue: 80 }, "recovery", "2018-01-22", birth, ctx);
  const restB = trainingSession({ ...p, fatigue: 80 }, "recovery", "2018-01-22", birth, ctx, { recovery: STAFF_RECOVER_CAP });
  assert.ok(restB.progress.fatigue < restP.progress.fatigue, "컨디션 코치 고용 시 피로 회복이 더 큼");
  const cap = trainedRating({ person: "t", mechanicsXp: 0, strategyXp: 0, fatigue: 0, physGain: 50, brainGain: 50 }, { base: 85, potential: potentialFor(), speed: 1 });
  assert.ok(cap.overall <= 100 && cap.phys <= 100 && cap.brain <= 100);
  console.log("OK hire effect raises training/recovery with cap 100");
}

{
  const s = fixture(33);
  initializeTraining(s);
  const start = s.eco.cash;
  assert.equal(hireStaff(s, "nope"), "그 코치를 찾을 수 없습니다.");
  s.eco.cash = 0.5;
  assert.match(hireStaff(s, "head-veteran") ?? "", /자금이 부족/);
  assert.equal(hiredOf(s, "head"), undefined);
  s.eco.cash = 20;
  const startCash = s.eco.cash;
  const err = hireStaff(s, "phys-skilled");
  assert.equal(err, null);
  assert.equal(hiredOf(s, "phys")?.name, "피지컬 코치 B");
  assert.equal(s.eco.cash, moneyRound(startCash - 2));
  assert.equal(staffPayroll(s), 2);
  assert.equal(staffSessionBoost(s)?.mechanics, 1.07);
  assert.equal(hireStaff(s, "phys-skilled"), "이미 고용한 코치입니다.");
  const mid = s.eco.cash;
  assert.equal(hireStaff(s, "phys-veteran"), null);
  assert.equal(hiredOf(s, "phys")?.grade, "veteran");
  assert.equal(s.eco.cash, moneyRound(mid - 3));
  assert.equal(fireStaff(s, "phys"), null);
  assert.equal(hiredOf(s, "phys"), undefined);
  assert.equal(s.eco.cash, moneyRound(mid - 3), "해임 환불 없음");
  console.log("OK hire deducts salary, reject if broke, fire does not refund");
}

{
  const s = fixture(44);
  s.eco.cash = 80;
  assert.equal(hireStaff(s, "head-normal"), null);
  assert.equal(hireStaff(s, "cond-normal"), null);
  // 고용 해는 prepaid라 정산에서 스태프 연봉을 다시 떼지 않음
  const before = s.eco.cash;
  const playerDue = s.story!.contracts.filter((c) => !c.prepaid).reduce((n, c) => n + c.salary, 0);
  settlePayrollAndSolvency(s);
  assert.equal(s.eco.cash, moneyRound(before - playerDue));
  // 다음 정산에서는 스태프 연봉이 나감
  s.eco.cash = 80;
  const playerDue2 = s.story!.contracts.filter((c) => !c.prepaid).reduce((n, c) => n + c.salary, 0);
  settlePayrollAndSolvency(s);
  assert.equal(s.eco.cash, moneyRound(80 - playerDue2 - 1 - 1));
  console.log("OK staff salary is prepaid the first year then deducted at settlement");
}

{
  const s = fixture(55);
  s.story!.history = { startYear: 2018, growth: 1.8, support: 5, grade: "C" };
  const key = s.starters[s.team][0];
  const speed = growthCtxAt(s, key, 95)?.speed;
  // 스태프를 고용해도 historyGrowthSpeed 공식 자체는 그대로
  assert.ok(speed != null);
  const talentish = speed! / historyGrowthSpeed(1.8, 95);
  s.eco.cash = 20;
  assert.equal(hireStaff(s, "phys-veteran"), null);
  const speed2 = growthCtxAt(s, key, 95)?.speed;
  assert.equal(speed2, speed, "스태프는 historyGrowthSpeed를 바꾸지 않음");
  void talentish;
  initializeTraining(s);
  setTrainingPlan(s, key, ["train", "train", "scrim", "rest", "train", "scrim", "rest"]);
  const person = trainingPerson(s, key)!;
  const baseP = { person, mechanicsXp: 0, strategyXp: 0, fatigue: 0, physGain: 0, brainGain: 0, lastDate: "2018-01-19" };
  s.training!.players[person] = { ...baseP };
  const clone = structuredClone(s);
  fireStaff(clone, "phys");
  clone.training!.players[person] = { ...baseP };
  advanceTeamTraining(s, s.team, "2018-01-25");
  advanceTeamTraining(clone, clone.team, "2018-01-25");
  const hiredGain = s.training!.players[person].physGain ?? 0;
  const plainGain = clone.training!.players[person].physGain ?? 0;
  assert.ok(hiredGain > plainGain, `hired ${hiredGain} vs plain ${plainGain}`);
  assert.ok(hiredGain < 20);
  console.log("OK historyGrowthSpeed preserved, hired phys coach grows more within cap");
}

{
  const s = fixture(66);
  s.eco.cash = 20;
  assert.equal(hireStaff(s, "head-veteran"), null);
  const opt = staffDraftOpt(s, s.team, "E8W");
  assert.ok(opt?.sideTemp?.B != null || opt?.sideTemp?.R != null);
  if (s.team) {
    const side = opt!.sideTemp!.B != null ? "B" : "R";
    assert.equal(opt!.sideTemp![side], STAFF_DEFAULT_TEMP * (1 - STAFF_ADVICE_CAP));
  }
  const asOpp = staffDraftOpt(s, "E8W", "KT");
  assert.equal(asOpp, undefined, "우리 팀이 아니면 밴픽 온도를 바꾸지 않음");
  const d0 = newDraft(s.team, "E8W", s.starters[s.team], s.starters[s.team], "B", [], 2018);
  const no = autoDraft(structuredClone(d0), new Rng(3));
  const yes = autoDraft(structuredClone(d0), new Rng(3), staffDraftOpt({ ...s, team: s.team }, d0.teams.B, d0.teams.R));
  // 같은 시드라도 온도가 달라지면 선택이 달라질 수 있음. 호출 횟수(시드 진행)는 단계마다 rng.next 1회라 단계는 같음.
  assert.equal(yes.step, no.step);
  console.log("OK head coach draft temp applies only to our side");
}

{
  const legacy = fixture(77);
  delete (legacy as { staff?: unknown }).staff;
  const v = buildClassReport(legacy, "until-now");
  assert.ok(v.staff.every((st) => st.name === NONE));
  assert.equal(v.staffPay, NONE);
  const todos = homeTodos(legacy);
  assert.ok(todos.pending.some((t) => t.id === "staff"));
  const hired = structuredClone(legacy);
  hired.eco.cash = 20;
  assert.equal(hireStaff(hired, "ops-normal"), null);
  const v2 = buildClassReport(hired, "until-now");
  assert.ok(v2.staff.some((st) => st.name === "운영 코치 A" && st.salary.includes("1")));
  assert.notEqual(v2.staffPay, NONE);
  const js = JSON.parse(reportToJson(v2));
  assert.ok(js.staff.some((st: { name: string }) => st.name === "운영 코치 A"));
  const led0 = projectLedger(legacy);
  const ledEmpty = projectLedger({ ...legacy, staff: { hires: [] } });
  assert.equal(JSON.stringify(led0), JSON.stringify(ledEmpty), "미고용 장부는 동일");
  console.log("OK old save report/todo/ledger, hired staff appears in report");
}

console.log("OK staff tests complete");
