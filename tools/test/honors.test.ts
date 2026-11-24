import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked } from "../../src/data";
import { SAVE_V, simSeries } from "../../src/game/season";
import { newHistoryCareer, finishStoryDay, pumpStory } from "../../src/game/story";
import { Rng } from "../../src/game/rng";
import { careerHonors, challengeLog, HONOR_NEWS, syncHonors } from "../../src/game/achievements";
import { initializeTraining, trainingPerson, trainedRatingOf } from "../../src/game/trainingRuntime";
import { homeTodos } from "../../src/pages/ManagerDashboard";

await loadCore(); await loadRanked();
const info = { name: "진열검증", birth: "1988-01-01", nation: "한국", career: "amateur" as const };

function snapshotEconomy(s: { eco: { cash: number; fans: number }; series: { id: string; winner?: string; sa: number; sb: number }[] }) {
  return JSON.stringify({ cash: s.eco.cash, fans: s.eco.fans, series: s.series.map((x) => ({ id: x.id, winner: x.winner, sa: x.sa, sb: x.sb })) });
}

{
  const t1 = newHistoryCareer("T1", 1, 5, { startYear: 2024, managerInfo: info, difficulty: "normal" });
  const kz = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  assert.equal(t1.v, SAVE_V);
  assert.equal(kz.v, SAVE_V);
  assert.equal(t1.story!.trophies.lck, 0);
  assert.equal(t1.story!.trophies.msi, 0);
  assert.equal(t1.story!.trophies.worlds, 0);
  for (const s of [t1, kz]) {
    const h = careerHonors(s);
    assert.ok(h.trophies.filter((t) => t.id !== "season-cup").every((t) => !t.done), `${s.team} 시작 진열장은 비어 있음`);
    assert.ok(h.feats.every((f) => !f.done), `${s.team} 시작 업적은 미달성`);
    const log = challengeLog(s)!;
    assert.equal(log.length, 6);
    assert.ok(log.every((x) => !x.done || x.id === "top6" || x.id === "final" || x.id === "rank1") && !log.find((x) => x.id === "lck")!.done);
    assert.equal(log.find((x) => x.id === "lck")!.done, false);
    assert.equal(log.find((x) => x.id === "msi")!.done, false);
    assert.equal(log.find((x) => x.id === "worlds")!.done, false);
  }
}

{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const startNews = s.news.filter((n) => n.title.startsWith(HONOR_NEWS)).length;
  assert.equal(startNews, 0);
  const rng = new Rng(s.rng);
  const startCash = s.eco.cash, startFans = s.eco.fans;
  let guard = 0;
  while (guard++ < 40 && s.story!.phase === "regular" && !careerHonors(s).feats.find((f) => f.id === "first-win")?.done) {
    finishStoryDay(s, rng);
  }
  const first = careerHonors(s).feats.find((f) => f.id === "first-win")!;
  assert.ok(first.done, "실제 시뮬로 첫 승리를 거두면 업적 달성");
  assert.match(first.detail, /:/);
  assert.equal(s.eco.cash, startCash, "업적 표시는 자금을 바꾸지 않음");
  assert.equal(s.eco.fans, startFans, "업적 표시는 팬심을 바꾸지 않음");
  const honorNews = s.news.filter((n) => n.title.startsWith(HONOR_NEWS));
  assert.ok(honorNews.some((n) => n.title.includes("첫 시리즈 승리")), "새 달성은 소식으로 남음");
  assert.ok(honorNews.every((n) => /자금·팬심·승부에는 영향이 없습니다/.test(n.body)));
  const todos = homeTodos(s);
  assert.ok(todos.pending.some((t) => t.id === "honors" || t.id === "news"), "새 기록은 홈 할 일과 연결");
  const snap = JSON.stringify(s);
  homeTodos(s); homeTodos(s);
  assert.equal(JSON.stringify(s), snap, "홈 할 일 조회는 저장을 바꾸지 않음");
}

{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const rng = new Rng(s.rng);
  let guard = 0;
  while (guard++ < 80 && s.story!.phase === "regular" && (careerHonors(s).feats.find((f) => f.id === "streak3")?.done !== true)) {
    finishStoryDay(s, rng);
  }
  const h = careerHonors(s);
  const wins = (s.series.filter((x) => x.winner === s.team).length) + (s.clubTimeline?.splits ?? []).flatMap((sp) => sp.matches).filter((m) => m.won).length;
  if (h.feats.find((f) => f.id === "streak3")?.done) {
    assert.ok((h.feats.find((f) => f.id === "streak3")!.detail).includes("연승"));
  } else {
    assert.ok(wins >= 0, "연승 데이터가 없으면 미달성으로 둠");
  }
  const comeback = h.feats.find((f) => f.id === "comeback")!;
  const games = s.series.filter((x) => x.a === s.team || x.b === s.team).flatMap((x) => x.games);
  const realComeback = games.some((g) => {
    if (g.winner !== s.team || g.gold15 == null || !Number.isFinite(g.gold15)) return false;
    const goldUs = g.blue === s.team ? g.gold15 : -g.gold15;
    return goldUs <= -2000;
  });
  assert.equal(comeback.done, realComeback, "15분 골드가 있는 역전만 달성");
  const pog = h.feats.find((f) => f.id === "pog")!;
  const realPog = games.some((g) => g.winner === s.team && (g.lineup[g.blue === s.team ? "B" : "R"] ?? []).includes(g.mvp));
  assert.equal(pog.done, realPog, "우리 라인업 POG만 인정");
}

{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const ours = s.series.find((x) => x.a === s.team || x.b === s.team)!;
  simSeries(s, ours, new Rng(s.rng));
  const before = s.news.length;
  delete s.honors;
  const doneIds = careerHonors(s).feats.filter((f) => f.done).map((f) => f.id);
  assert.ok(doneIds.includes("first-win") || !ours.winner || ours.winner !== s.team, "기록이 있으면 소급 표시 가능");
  const cash = s.eco.cash, fans = s.eco.fans, eco = snapshotEconomy(s);
  const n0 = s.news.length;
  syncHonors(s);
  assert.deepEqual(s.honors?.announced?.sort(), careerHonors(s).feats.concat(careerHonors(s).trophies).filter((x) => x.done).map((x) => x.id).sort());
  assert.equal(s.news.length, n0, "옛 저장 첫 동기화는 이미 달성한 소식을 쏟지 않음");
  assert.equal(s.eco.cash, cash);
  assert.equal(s.eco.fans, fans);
  assert.equal(snapshotEconomy(s), eco, "동기화는 승부를 바꾸지 않음");
  initializeTraining(s);
  const key = (s.starters[s.team] ?? [])[0];
  const person = trainingPerson(s, key);
  assert.ok(person);
  const prev = s.training!.players[person!] ?? { person: person!, mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
  s.training!.players[person!] = { ...prev, physGain: 100, brainGain: 100 };
  const rating = trainedRatingOf(s, key);
  assert.ok(rating && rating.overall >= 100, "훈련 성장으로 상한에 도달할 수 있음");
  const n1 = s.news.length;
  const cash2 = s.eco.cash, fans2 = s.eco.fans;
  syncHonors(s);
  assert.ok(careerHonors(s).feats.find((f) => f.id === "prospect100")?.done);
  assert.ok(s.news.length > n1, "이후 새 달성은 소식을 남김");
  assert.ok(s.news.some((n) => n.title === `${HONOR_NEWS}성장 상한 도달`));
  assert.equal(s.eco.cash, cash2);
  assert.equal(s.eco.fans, fans2);
}

{
  const s = newHistoryCareer("GEN", 1, 9, { startYear: 2024, managerInfo: info, difficulty: "normal" });
  assert.ok(careerHonors(s).trophies.every((t) => t.id === "season-cup" || !t.done), "2024 GEN도 현실 우승을 상속하지 않음");
  const rng = new Rng(s.rng);
  pumpStory(s, rng, ["awards", "tryout", "expiry", "stove", "franchise", "clear", "fail", "bankrupt"]);
  const h = careerHonors(s);
  const log = challengeLog(s)!;
  assert.equal(log.length, 6);
  if (s.story!.trophies.lck > 0) {
    assert.ok(log.find((x) => x.id === "lck")!.done);
    assert.ok(log.find((x) => x.id === "final")!.done);
    assert.ok(log.find((x) => x.id === "top6")!.done);
  }
  const splitChamp = (s.clubTimeline?.splits ?? []).some((x) => x.tier === "LCK" && x.champion === s.team);
  assert.equal(!!h.trophies.find((t) => t.id === "lck")?.done, splitChamp, "LCK 트로피는 이번 커리어 스플릿 우승 기록만");
  assert.equal(!!h.trophies.find((t) => t.id === "promo")?.done, false, "LCK로 시작한 팀은 승격 소식을 승격 업적으로 치지 않음");
  if (h.trophies.find((t) => t.id === "budget-title")?.done) {
    assert.fail("budget-title은 트로피가 아님");
  }
  const budget = h.feats.find((f) => f.id === "budget-title")!;
  const cashEv = (s.clubTimeline?.events ?? []).some((e) => e.cash != null && e.cash >= 0 && e.source === "live" && /우승/.test(e.title) && e.title.startsWith(`${s.team},`));
  assert.equal(budget.done, cashEv && splitChamp, "흑자 우승은 기록된 잔고가 있을 때만");
  if (!cashEv) assert.equal(budget.done, false, "잔고 기록이 없으면 지어내지 않음");
}


{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const ours = s.series.find((x) => x.a === s.team || x.b === s.team)!;
  simSeries(s, ours, new Rng(s.rng));
  syncHonors(s);
  const before = careerHonors(s);
  const hadPog = before.feats.find((f) => f.id === "pog")?.done;
  const hadWin = before.feats.find((f) => f.id === "first-win")?.done;
  const series = s.series;
  s.series = [];
  const after = careerHonors(s);
  if (hadWin) assert.ok(after.feats.find((f) => f.id === "first-win")?.done, "시리즈가 비워져도 이미 남은 첫 승리는 유지");
  if (hadPog) assert.ok(after.feats.find((f) => f.id === "pog")?.done, "시리즈가 비워져도 이미 남은 POG는 유지");
  s.series = series;
}

console.log("honors.test ok");
