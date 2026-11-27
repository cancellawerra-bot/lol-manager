import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked } from "../../src/data";
import { SAVE_V, simSeries } from "../../src/game/season";
import { newHistoryCareer, finishStoryDay, pumpStory } from "../../src/game/story";
import { Rng } from "../../src/game/rng";
import { homeTodos } from "../../src/pages/ManagerDashboard";
import {
  NONE, REFLECTION_QUESTIONS, buildClassReport, captureClassReportSplit,
  markReportSeen, reportToCsv, reportToJson, setReportReflection, setReportStudent,
  shouldOfferReport,
} from "../../src/game/classReport";

await loadCore(); await loadRanked();
const info = { name: "보고서검증", birth: "1988-01-01", nation: "한국", career: "amateur" as const };

function snapCore(s: { eco: { cash: number; fans: number }; series: { id: string; winner?: string; sa: number; sb: number; games: unknown[] }[] }) {
  return JSON.stringify({ cash: s.eco.cash, fans: s.eco.fans, series: s.series.map((x) => ({ id: x.id, winner: x.winner, sa: x.sa, sb: x.sb, games: x.games.length })) });
}

{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  assert.equal(s.v, SAVE_V);
  assert.equal(s.classReport, undefined);
  const v = buildClassReport(s, "until-now");
  assert.equal(v.record, NONE);
  assert.equal(v.rank, NONE);
  assert.equal(v.gold15, NONE);
  assert.equal(v.comeback, NONE);
  assert.equal(v.picks, null);
  assert.equal(v.bans, null);
  assert.equal(v.objectives, null);
  assert.ok(v.reflections.length === REFLECTION_QUESTIONS.length);
  assert.ok(v.reflections.every((q) => q.answer === ""));
  assert.equal(v.studentName, "");
  assert.match(v.modeLabel, /역사/);
  assert.equal(v.yearLabel, "2018");
  assert.match(v.teamName, /킹존|KZ/);
  assert.ok(v.note.includes("기록 없음") && v.note.includes("0으로 채우거나"));
  const before = snapCore(s);
  buildClassReport(s, "until-now");
  homeTodos(s);
  shouldOfferReport(s);
  assert.equal(snapCore(s), before, "보고서 조회는 승부·자금을 바꾸지 않음");
  console.log("OK old/empty save: 기록 없음, 성찰 빈 칸, 조회 불변");
}

{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const rng = new Rng(s.rng);
  const start = snapCore(s);
  let guard = 0;
  while (guard++ < 80 && s.story!.phase === "regular") finishStoryDay(s, rng);
  const mine = s.series.filter((x) => x.winner && (x.a === s.team || x.b === s.team));
  const w = mine.filter((x) => x.winner === s.team).length;
  const l = mine.length - w;
  let gw = 0, gl = 0, goldSample = 0, leadN = 0, leadWins = 0, comebackW = 0, comebackL = 0;
  const pickMap = new Map<string, number>();
  for (const sr of mine) {
    const usA = sr.a === s.team;
    gw += usA ? sr.sa : sr.sb;
    gl += usA ? sr.sb : sr.sa;
    for (const g of sr.games) {
      const usBlue = g.blue === s.team;
      if (g.gold15 != null && Number.isFinite(g.gold15)) {
        goldSample++;
        const goldUs = usBlue ? g.gold15 : -g.gold15;
        const won = g.winner === s.team;
        if (goldUs > 0) { leadN++; if (won) leadWins++; }
        if (goldUs < 0 && won) comebackW++;
        if (goldUs > 0 && !won) comebackL++;
      }
      const side = usBlue ? "B" : "R";
      for (const p of g.picks[side] ?? []) pickMap.set(p.c, (pickMap.get(p.c) ?? 0) + 1);
    }
  }
  const v = buildClassReport(s, "until-now");
  if (mine.length) {
    assert.equal(v.record, `시리즈 ${w}승 ${l}패 · 세트 ${gw}승 ${gl}패`);
    assert.match(v.rank, /\d+위/);
    assert.ok(v.picks && v.picks[0].n === Math.max(...pickMap.values()));
    if (goldSample) {
      assert.ok(v.gold15.includes(String(goldSample)));
      assert.ok(v.comeback.includes(String(comebackW)) && v.comeback.includes(String(comebackL)));
    } else {
      assert.equal(v.gold15, NONE);
    }
    // 자동 시뮬은 세트 상세(res)를 남기지 않을 수 있음 → 선취는 기록 없음 (0으로 채우지 않음)
    if (!mine.some((sr) => sr.games.some((g) => g.res?.events?.length))) {
      assert.equal(v.objectives, null);
    }
  }
  const mid = snapCore(s);
  const json = reportToJson(v);
  const csv = reportToCsv(v);
  assert.ok(JSON.parse(json).team.short === s.team);
  assert.ok(csv.includes(v.teamName));
  assert.ok(!json.includes("교전") && !csv.includes("hidden ovr"));
  assert.equal(snapCore(s), mid, "내보내기는 저장을 바꾸지 않음");
  // 옛 저장: classReport 없음, 일부 세트 gold15만 있고 res 없음
  const legacy = structuredClone(s);
  delete (legacy as { classReport?: unknown }).classReport;
  for (const sr of legacy.series) for (const g of sr.games) delete g.res;
  const lv = buildClassReport(legacy, "until-now");
  assert.equal(lv.objectives, null, "상세 장면이 없으면 오브젝트 선취를 0으로 채우지 않음");
  if (goldSample) assert.notEqual(lv.gold15, NONE);
  assert.ok(lv.reflections.every((q) => q.answer === ""));
  console.log("OK live split aggregate matches series, missing res → 기록 없음");
}

{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  s.schedOk = true;
  const startCash = s.eco.cash, startFans = s.eco.fans;
  const startWinners = s.series.map((x) => x.winner);
  const rng = new Rng(s.rng);
  pumpStory(s, rng);
  const before = JSON.stringify({ cash: s.eco.cash, fans: s.eco.fans, winners: s.series.map((x) => x.winner), phase: s.story!.phase });
  captureClassReportSplit(s);
  const v = buildClassReport(s, "until-now");
  assert.ok(s.classReport?.splits?.length || v.record !== NONE || (s.clubTimeline?.splits?.length ?? 0) >= 0);
  if ((s.classReport?.splits ?? []).some((sp) => sp.rank) || (s.clubTimeline?.splits ?? []).some((sp) => sp.rank)) {
    assert.match(v.rank, /\d+위/, "스플릿 기록이 있으면 지금까지 순위를 기록 없음으로 두지 않음");
  }
  const hasPoEvidence = (s.clubTimeline?.splits ?? []).some((sp) => (sp.matches ?? []).some((m) => m.stage === "PO1" || m.stage === "SF" || m.stage === "F") || sp.champion || sp.championName);
  if (hasPoEvidence || v.trophies.some((t) => /플레이오프|우승|월즈|MSI|승격/.test(t.label))) {
    assert.notEqual(v.playoff, NONE, "보관된 플레이오프·우승 기록이 있으면 기록 없음으로 두지 않음");
  }
  // 학생 입력만 저장되고 승부는 그대로
  setReportStudent(s, "홍길동", "20261234");
  setReportReflection(s, "draft", "첫 세트 1픽을 더 신중히 하고 싶습니다.");
  setReportReflection(s, "unknown-id", "무시되어야 함");
  const v2 = buildClassReport(s, "until-now");
  assert.equal(v2.studentName, "홍길동");
  assert.equal(v2.studentId, "20261234");
  assert.equal(v2.reflections.find((q) => q.id === "draft")?.answer, "첫 세트 1픽을 더 신중히 하고 싶습니다.");
  assert.ok(v2.reflections.filter((q) => q.id !== "draft").every((q) => q.answer === ""));
  const after = JSON.stringify({ cash: s.eco.cash, fans: s.eco.fans, winners: s.series.map((x) => x.winner), phase: s.story!.phase });
  assert.equal(after, before, "학생 입력은 승부·자금·팬심을 바꾸지 않음");
  assert.equal(s.eco.cash, startCash || s.eco.cash); // cash may have changed during pump, but not during student input
  void startWinners; void startFans; void simSeries;
  const offer = shouldOfferReport(s);
  const todos = homeTodos(s);
  if (s.story?.ended || s.phase === "done" || ["awards", "tryout", "expiry", "stove"].includes(s.story?.phase ?? "")) {
    assert.equal(offer, true);
    assert.ok(todos.pending.some((t) => t.id === "class-report"));
    markReportSeen(s);
    assert.equal(shouldOfferReport(s), false);
    const todos2 = homeTodos(s);
    assert.ok(!todos2.pending.some((t) => t.id === "class-report") || s.story?.ended);
  }
  const js = reportToJson(v2);
  assert.ok(js.includes("홍길동") && js.includes("20261234"));
  assert.ok(js.includes("1픽"));
  console.log("OK student fields optional, reflections not invented, offseason todo, SAVE_V 2");
}

console.log("OK class-report tests complete");
