import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL, CARDS_BY_PERSON } from "../../src/data";
import { newStoryCareer, marketCards, ensurePlayer, simRestOfPhase } from "../../src/game/story";
import { prepareSeriesTraining, advanceTeamTraining, initializeTraining, trainingDate, trainingPlan, setTrainingPlan, beginTrainingPeriod, matchTraining } from "../../src/game/trainingRuntime";
import { PLAYER_BIRTHDATES } from "../../src/game/playerBirthdates";
import { trainingProfile } from "../../src/game/training";
import { simSeries, selectionFor, aiSelection, lockedChamps, formMap, recordGame } from "../../src/game/season";
import { newDraft, autoDraft } from "../../src/game/draft";
import { simulateGame, factorsFor } from "../../src/game/sim";
import { Rng } from "../../src/game/rng";
await loadCore(); await loadRanked();
const originalCards = JSON.stringify(CARDS);
function fixture(seed = 17) {
  const cards = [0, 1, 2, 3, 4].map((pos) => pos === 2 ? "faker-2018" : marketCards(2018).filter((c) => c.posIdx === pos).sort((a, b) => a.salary - b.salary)[0].id);
  return newStoryCareer("SGU", "훈련 검증", 1, seed, { cards, starters: cards, difficulty: "normal", club: { name: "훈련 구단", short: "SGU", color: "#2DD4BF" }, managerInfo: { name: "훈련 검증", birth: "1988-01-01", nation: "한국", career: "amateur" } });
}
for (const [person, birth] of Object.entries(PLAYER_BIRTHDATES)) {
  assert(CARDS_BY_PERSON[person]?.length, "생년 자료와 실제 선수 ID 일치: " + person);
  assert(trainingProfile(birth, "2027-01-01").known);
}
console.log("OK verified public birth registry", Object.keys(PLAYER_BIRTHDATES).length);
{
  const s = fixture(); const untouchedPlayers = JSON.stringify(PL);
  const date = "2018-02-01";
  advanceTeamTraining(s, s.team, date);
  const p = s.training!.players.faker;
  assert(p.mechanicsXp > 0 && p.strategyXp > 0);
  assert(p.fatigue >= 0 && p.fatigue <= 100);
  const done = JSON.stringify(s.training);
  advanceTeamTraining(s, s.team, date); assert.equal(JSON.stringify(s.training), done, "같은 날짜 재처리 금지");
  const restored = JSON.parse(JSON.stringify(s));
  initializeTraining(restored); advanceTeamTraining(restored, restored.team, date);
  assert.equal(JSON.stringify(restored.training), done, "저장 복구로 훈련 반복 적립 불가");
  assert.equal(JSON.stringify(PL), untouchedPlayers, "훈련이 원본 선수 지표를 수정하지 않음");
  const next = CARDS["faker-2026"], key = ensurePlayer(next, 2027, false);
  s.story!.contracts[2] = { key, person: "faker", cardId: next.id, years: 1, salary: 1, prepaid: true };
  s.starters[s.team][2] = key;
  beginTrainingPeriod(s, "2027-01-20");
  assert.equal(s.training!.players.faker.mechanicsXp, p.mechanicsXp, "연도/카드 교체 후 개인 성장 유지");
  assert.equal(s.training!.players.faker.fatigue, 0, "긴 시즌 공백은 회복");
  assert.equal(s.training!.players.faker.lastDate, "2027-01-19", "공백 기간 훈련 소급 없음");
  console.log("OK growth, load idempotence, original stats, season carryover and offseason recovery");
}
{
  const old = fixture(); delete old.training;
  old.day = 4; const date = trainingDate(old);
  initializeTraining(old);
  assert.equal(old.training!.periodStart, date);
  assert.deepEqual(old.training!.players, {}, "구세이브는 현재 시점에서 성장 0으로 시작");
  const key = old.starters[old.team][2];
  setTrainingPlan(old, key, ["train", "train", "train", "train", "train", "train", "train"]);
  assert(!trainingPlan(old, key).includes("rest"), "미완성 수동 계획을 몰래 유효 계획으로 표시하지 않음");
  setTrainingPlan(old, key, ["train", "train", "scrim", "rest", "train", "scrim", "rest"]);
  prepareSeriesTraining(old, old.series.find((sr) => sr.day === old.day && (sr.a === old.team || sr.b === old.team))!);
  assert(old.training!.players.faker.mechanicsXp + old.training!.players.faker.strategyXp < 25, "구세이브에 과거 성장 소급 없음");
  console.log("OK legacy save migration and explicit plan validation");
}
{
  const a = fixture(27), b = JSON.parse(JSON.stringify(a));
  const sa = a.series.find((sr) => sr.a === a.team || sr.b === a.team)!;
  const sb = b.series.find((sr) => sr.id === sa.id)!;
  const ra = new Rng(a.rng), rb = new Rng(b.rng);
  simSeries(a, sa, ra);
  prepareSeriesTraining(b, sb);
  while (!sb.winner) {
    const holder = selectionFor(sb, sb.games.length, rb);
    const sel = aiSelection(holder, holder === sb.a ? sb.b : sb.a, rb);
    const d = autoDraft(newDraft(sel.blue, sel.red, b.starters[sel.blue], b.starters[sel.red], sel.firstSide, lockedChamps(sb)), rb);
    const result = simulateGame(d, formMap(b, [...d.lineup.B, ...d.lineup.R]), rb, matchTraining(b, [...d.lineup.B, ...d.lineup.R]));
    recordGame(b, sb, d, result, holder, false);
  }
  assert.deepEqual(sa.games, sb.games, "수동/자동과 같은 경기 입력의 훈련/결과 일치");
  assert.deepEqual(a.training, b.training); assert.equal(ra.s, rb.s);
  assert(sa.games.every((g) => g.training));
  const recorded = JSON.stringify(sa.games.map((g) => g.training));
  advanceTeamTraining(a, a.team, "2018-03-01");
  assert.equal(JSON.stringify(sa.games.map((g) => g.training)), recorded, "경기 당시 훈련 효과 보존");
  console.log("OK same manual/auto path, NPC training and historical effect snapshot");
}
{
  const s = fixture(39), sr = s.series.find((sr) => sr.a === s.team || sr.b === s.team)!;
  const rng = new Rng(90);
  const d = autoDraft(newDraft(sr.a, sr.b, s.starters[sr.a], s.starters[sr.b], "B", []), rng);
  const mods = Object.fromEntries(d.lineup.B.map((key) => [key, { mechanics: .03, strategy: .03, fatigue: 0 }]));
  const baseline = factorsFor(d, {}), trained = factorsFor(d, {}, mods);
  assert(!baseline.some((f) => f.key === "training"));
  assert(trained.find((f) => f.key === "training")!.v > 0);
  const untrainedGame = simulateGame(d, {}, new Rng(123));
  const trainedGame = simulateGame(d, {}, new Rng(123), mods);
  assert(trainedGame.pPre > untrainedGame.pPre, "훈련이 경기 전 확률 계산에 반영됨");
  assert(trainedGame.lanes15.reduce((a, b) => a + b, 0) > untrainedGame.lanes15.reduce((a, b) => a + b, 0), "피지컬이 라인 실행력에 반영됨");
  assert(trainedGame.pPre < 1, "훈련이 승리를 보장하지 않음");
  console.log("OK real probability and lane effects without forcing winners");
}
{
  const s = fixture(); simRestOfPhase(s, new Rng(s.rng), true);
  assert(s.series.filter((sr) => sr.winner).every((sr) => sr.day === s.day), "다른 팀만 진행해 미래 날짜의 훈련을 먼저 적립하지 않음");
}
assert.equal(JSON.stringify(CARDS), originalCards, "원본 시즌 데이터 불변");
console.log("OK training runtime integration complete");
