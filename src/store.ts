// 저장/불러오기: localStorage 슬롯 3개 + 자동 저장, JSON 내보내기/불러오기
import { useSyncExternalStore } from "react";
import { Save, SAVE_V, aiSelection, finishDay, lockedChamps, mySeriesToday, recordGame, selectionFor } from "./game/season";
import { DraftState, Side, aiStep, apply, autoDraft, newDraft, turn } from "./game/draft";
import { simulateGame } from "./game/sim";
import { formMap } from "./game/season";
import { Rng } from "./game/rng";
import type { PosIdx } from "./types";
import { hydrateSave } from "./game/cards";
import { finishStoryDay, isStory, simRestOfPhase, resolveFranchise, pumpStory, applyStoryWorld, FRANCHISE_BUYIN } from "./game/story";
import "./game/stove";
import { autoAdvanceOffseason, finishOffseason } from "./game/stove";
import { practiceMap, setChampFocus, initializeTraining, prepareSeriesTraining, matchTraining, recommendedTraining, trainingDate, trainingPerson, setTrainingPlan } from "./game/trainingRuntime";
import { prepareInSeason } from "./game/inSeason";
import { matchTactics, normalizeTactic, recommendTactic, type TacticPlan } from "./game/tactics";
import { prepareSeriesLineups, makePromise, cancelPromise, setRotationAutomatic } from "./game/rotation";
import { CARDS, PL } from "./data";

const KEY = (slot: number): string => `lolm.slot.${slot}`;
const LAST = "lolm.last";
let cur: Save | null = null;
let ver = 0;
const subs = new Set<() => void>();
const emit = (): void => { ver++; subs.forEach((f) => f()); };
export function useSave(): Save | null {
  useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => ver);
  return cur;
}
export const getSave = (): Save | null => cur;

export interface SlotInfo { slot: number; team: string; manager: string; updated: string; date: string; label: string; phase: string }
export function slots(): (SlotInfo | null)[] {
  return [1, 2, 3].map((n) => {
    try {
      const raw = localStorage.getItem(KEY(n)); if (!raw) return null;
      const s = JSON.parse(raw) as Save;
      const d = s.days[Math.min(s.day, s.days.length - 1)];
      return { slot: n, team: s.team, manager: s.manager, updated: s.updated, date: d.date, label: s.phase === "done" ? "시즌 종료" : d.label, phase: s.phase };
    } catch { return null; }
  });
}
export const lastSlot = (): number | null => { const v = Number(localStorage.getItem(LAST)); return v >= 1 && v <= 3 ? v : null; };
export function persist(): boolean {
  if (!cur) return false;
  cur.updated = new Date().toISOString();
  try { localStorage.setItem(KEY(cur.slot), JSON.stringify(cur)); localStorage.setItem(LAST, String(cur.slot)); return true; } catch { return false; }
}
export function setSave(s: Save | null): void { cur = s; if (s) { hydrateSave(s); if (s.mode === "story") { applyStoryWorld(s); initializeTraining(s); } persist(); } emit(); }
/** 운영자가 명단에서 뺀 선수(tools/excluded_players.json)가 내 명단에 남은 예전 저장은 열지 않고 안내합니다 (2026-11-22).
 *  스토리 모드 AI 구단 명단은 applyStoryWorld가 해당 구단만 다시 짭니다. 판타지 저장은 모든 구단 지명을 봅니다. */
const REMOVED_MSG = "이 저장에는 명단에서 뺀 선수가 들어 있어 열 수 없습니다. 새 게임을 시작해 주세요.";
let loadProblem: string | null = null;
export const getLoadProblem = (): string | null => loadProblem;
function hasRemovedCard(s: Save): boolean {
  const own = [...(s.cards ?? []), ...(s.starters?.[s.team] ?? []), ...(s.story?.contracts ?? []).map((c) => c.cardId)];
  const ids = s.mode === "story" ? own : [...own, ...Object.values(s.starters ?? {}).flat()];
  return ids.some((id) => !!id && /-\d{4}$/.test(id) && !CARDS[id]);
}
export function loadSlot(n: number): boolean {
  try { const raw = localStorage.getItem(KEY(n)); if (!raw) return false; const s = JSON.parse(raw) as Save; if (s.v !== SAVE_V) return false; loadProblem = null; if (hasRemovedCard(s)) { loadProblem = REMOVED_MSG; return false; } hydrateSave(s); if (s.mode === "story") { applyStoryWorld(s); initializeTraining(s); } cur = s; localStorage.setItem(LAST, String(n)); emit(); return true; } catch { return false; }
}
export function deleteSlot(n: number): void { localStorage.removeItem(KEY(n)); if (cur?.slot === n) cur = null; emit(); }
export function exportJson(): string { return JSON.stringify(cur); }
export function importJson(text: string, slot: number): string | null {
  try {
    const s = JSON.parse(text) as Save;
    if (!s || s.v !== SAVE_V || !Array.isArray(s.series) || !s.team) return "LOL Manager 세이브 파일이 아니거나 버전이 다릅니다. v2부터는 새 형식이라 이전 세이브는 불러올 수 없습니다.";
    s.slot = slot; if (hasRemovedCard(s)) return REMOVED_MSG; hydrateSave(s); if (s.mode === "story") { applyStoryWorld(s); initializeTraining(s); } cur = s; persist(); emit(); return null;
  } catch { return "파일을 읽지 못했습니다. JSON 형식인지 확인해 주세요."; }
}

/** 상태를 바꾸고 자동 저장합니다. */
export function mutate(fn: (s: Save, rng: Rng) => void): void {
  if (!cur) return;
  const rng = new Rng(cur.rng);
  fn(cur, rng);
  cur.rng = rng.s;
  persist(); emit();
}

// ---------- 진행 루프 ----------
/** '진행하기': 오늘 우리 경기가 있으면 경기 화면으로, 없으면 하루를 시뮬합니다. 반환: 'match' | 'day' | 'done' */
export function advance(): "match" | "day" | "done" | "sched" | "franchise" | "stove" | "endstory" {
  const s = cur; if (!s) return "done";
  if (s.phase === "done" || s.story?.ended) return s.story?.ended ? "endstory" : "done";
  if (s.session) return "match";
  if (isStory(s) && s.story!.phase === "franchise") return "franchise";
  if (isStory(s) && ["awards", "tryout", "expiry", "stove"].includes(s.story!.phase)) return "stove";
  mutate((x) => prepareInSeason(x));
  const my = mySeriesToday(s);
  if (my) {
    if (!s.schedOk) return "sched";
    mutate((x) => { prepareSeriesTraining(x, my); prepareSeriesLineups(x, my); x.session = { seriesId: my.id, gameIdx: my.games.length, holder: "", stage: "press", simStep: 0 }; }); return "match";
  }
  mutate((x, rng) => { if (isStory(x)) finishStoryDay(x, rng); else finishDay(x, rng); });
  return (s.phase as string) === "done" || s.story?.ended ? (s.story?.ended ? "endstory" : "done") : "day";
}
export function autoSimSplit(onlyOthers = false): void {
  mutate((s, rng) => { if (isStory(s) && (!s.session || onlyOthers)) simRestOfPhase(s, rng, onlyOthers); });
}
export function autoToOffseason(): void {
  mutate((s, rng) => { if (isStory(s) && !s.session) pumpStory(s, rng); });
}
export function autoStove(signStars = false): void {
  mutate((s, rng) => {
    if (!isStory(s)) return;
    const reserveCash = !s.story!.franchised && s.story!.year <= 2020 ? FRANCHISE_BUYIN[s.eco.difficulty] : 0;
    autoAdvanceOffseason(s, rng, { signStars, reserveCash });
  });
}

export const sessionSeries = (s: Save) => s.series.find((x) => x.id === s.session?.seriesId)!;

export function toSelection(): void {
  mutate((s, rng) => {
    const ss = s.session!; const sr = sessionSeries(s);
    ss.holder = selectionFor(sr, ss.gameIdx, rng);
    ss.blue = undefined; ss.red = undefined; ss.firstSide = undefined; ss.choiceNote = undefined;
    if (ss.holder !== s.team) {
      // 상대 선택권: 선픽(60%) 또는 블루(40%)를 먼저 고르고, 우리가 남은 쪽을 고릅니다.
      const sel = aiSelection(ss.holder, s.team, rng);
      ss.choiceNote = sel.blue === s.team ? `${ss.holder}가 선픽을 골랐습니다. 진영을 골라 주세요.` : `${ss.holder}가 블루 진영을 골랐습니다. 순서를 골라 주세요.`;
      ss.aiTook = sel.blue === s.team ? "first" : "blue";
    }
    ss.stage = "select";
  });
}
/** 선택권 결정. choice: 'blue'|'red'|'first'|'last' (우리 팀 입장) */
export function choose(choice: "blue" | "red" | "first" | "last"): void {
  mutate((s) => {
    const ss = s.session!; const sr = sessionSeries(s);
    const me = s.team, op = sr.a === me ? sr.b : sr.a;
    let blue: string, firstTeam: string;
    if (ss.holder === me) {
      if (choice === "blue" || choice === "red") { blue = choice === "blue" ? me : op; firstTeam = op; ss.choiceNote = `우리가 ${choice === "blue" ? "블루" : "레드"} 진영을 골랐고, ${op}가 선픽을 골랐습니다.`; }
      else { firstTeam = choice === "first" ? me : op; blue = op; ss.choiceNote = `우리가 ${choice === "first" ? "선픽" : "후픽"}을 골랐고, ${op}가 블루 진영을 골랐습니다.`; }
    } else if (ss.aiTook === "first") { firstTeam = op; blue = choice === "blue" ? me : op; ss.choiceNote = `${op}가 선픽, 우리가 ${choice === "blue" ? "블루" : "레드"} 진영을 골랐습니다.`; }
    else { blue = op; firstTeam = choice === "first" ? me : op; ss.choiceNote = `${op}가 블루 진영, 우리가 ${choice === "first" ? "선픽" : "후픽"}을 골랐습니다.`; }
    const red = blue === me ? op : me;
    ss.blue = blue; ss.red = red; ss.firstSide = firstTeam === blue ? "B" : "R";
    ss.draft = newDraft(blue, red, s.starters[blue] ?? [], s.starters[red] ?? [], ss.firstSide ?? "B", lockedChamps(sr) ?? []);
    const pm = practiceMap(s, [...ss.draft.lineup.B, ...ss.draft.lineup.R]); if (pm) ss.draft.practice = pm;   // 챔피언 훈련 기록을 이 세트의 숙련도에 반영
    ss.stage = "draft";
  });
}
export const mySide = (s: Save): Side => (s.session?.blue === s.team ? "B" : "R");
export function userAct(c: string, pos: PosIdx | null, why: string[]): void {
  mutate((s) => { const ss = s.session!; ss.draft = apply(ss.draft!, c, pos, "user", why); });
}
export function aiAct(): void {
  mutate((s, rng) => { const ss = s.session!; ss.draft = aiStep(ss.draft!, rng); });
}
export function autoRest(): void {
  mutate((s, rng) => { const ss = s.session!; ss.draft = autoDraft(ss.draft!, rng); });
}
export function runSim(): void {
  mutate((s, rng) => {
    const ss = s.session!; const d = ss.draft as DraftState;
    if (ss.result || turn(d)) return;
    prepareSeriesTraining(s, sessionSeries(s));
    const orders = matchTactics(d, s.tactics), side = mySide(s);
    orders[side] = normalizeTactic({ tempo: ss.meetPlan ?? orders[side].tempo, focus: ss.meetFocus ?? orders[side].focus });
    ss.result = simulateGame(d, formMap(s, [...d.lineup.B, ...d.lineup.R]), rng, matchTraining(s, [...d.lineup.B, ...d.lineup.R]), orders);
    ss.simStep = 0; ss.stage = "sim";
  });
}
export function simNext(all = false): void { mutate((s) => { const ss = s.session!; ss.simStep = all ? ss.result!.events.length : Math.min(ss.result!.events.length, ss.simStep + 1); }); }
export function toResult(): void {
  mutate((s) => {
    const ss = s.session!; const sr = sessionSeries(s);
    if (sr.games.length === ss.gameIdx) recordGame(s, sr, ss.draft!, ss.result!, ss.holder, true);
    ss.stage = "result";
  });
}
export function nextGame(): void {
  mutate((s) => {
    const ss = s.session!; const sr = sessionSeries(s);
    if (sr.winner) { ss.stage = "end"; return; }
    s.session = { seriesId: sr.id, gameIdx: sr.games.length, holder: "", stage: "lineup", simStep: 0 };
  });
}
export function endSeries(): void {
  mutate((s, rng) => { s.session = undefined; if (isStory(s)) finishStoryDay(s, rng); else finishDay(s, rng); });
}
export function setStarter(team: string, pos: number, key: string): void {
  mutate((s) => {
    if (team !== s.team || !Number.isInteger(pos) || pos < 0 || pos > 4 || PL[key]?.pos !== pos) return;
    if (s.story?.ended) return;
    if (s.session && !["press", "lineup"].includes(s.session.stage)) return;
    if (s.mode === "story" ? !s.story?.contracts.some(c => c.key === key && c.years > 0) : ![...s.cards, ...(s.starters[team] ?? [])].includes(key)) return;
    s.starters[team][pos] = key;
  });
}
export function promisePlayingTime(key: string, target: number): string | undefined {
  let error: string | undefined; mutate(s => { error = makePromise(s, key, target); }); return error;
}
export function withdrawPlayingTime(person: string): void { mutate(s => cancelPromise(s, person)); }
export function manageRotation(automatic: boolean): void { mutate(s => setRotationAutomatic(s, automatic)); }

export function setPress(tone: string): void { mutate((s) => { if (s.session) s.session.pressTone = tone; }); }
export function afterPress(): void { mutate((s) => { if (s.session) s.session.stage = "lineup"; }); }
export function confirmLineup(): void { toSelection(); }
export function setTacticPlan(plan: TacticPlan): void {
  mutate((s) => {
    if (s.session && (s.session.result || ["sim", "pog", "result", "locker", "end"].includes(s.session.stage))) return;
    const normalized = normalizeTactic(plan); (s.tactics ??= {})[s.team] = normalized;
    if (s.session) { s.session.meetPlan = normalized.tempo; s.session.meetFocus = normalized.focus; }
  });
}
export function setMeet(plan: "atk" | "bal" | "safe"): void {
  const s = getSave(); if (s) setTacticPlan({ ...normalizeTactic(s.tactics?.[s.team]), tempo: plan });
}
export function afterMeet(): void { runSim(); }
export function afterPog(): void { toResult(); }
export function afterResult(): void {
  mutate((s) => {
    const ss = s.session!; const sr = sessionSeries(s);
    ss.stage = sr.winner ? "end" : "locker";
  });
}
export function afterLocker(): void { nextGame(); }
/** 이번 세트를 수석코치에게 통째로 맡깁니다. 지금 단계부터 경기가 끝나 MVP 화면 앞까지 순서대로 진행하고 거기서 멈춥니다.
 *  이미 정해 둔 기자회견 말투와 이번 경기 작전은 그대로 쓰고, 정하지 않은 것만 코치가 고릅니다(말투 신중, 선발 유지, 선택권은 블루/선픽, 밴픽은 AI, 작전은 코치 추천).
 *  경기 결과는 평소와 같은 시뮬레이션이며 승패를 조작하지 않습니다. */
export function autoGame(): void {
  for (let guard = 0; guard < 16; guard++) {
    const s = cur; const ss = s?.session;
    if (!s || !ss) return;
    switch (ss.stage) {
      case "press": if (!ss.pressTone) setPress("신중"); afterPress(); break;
      case "lineup": confirmLineup(); break;
      case "select": choose(ss.holder === s.team || ss.aiTook === "first" ? "blue" : "first"); break;
      case "draft": {
        autoRest();
        if (turn(cur!.session!.draft!)) return;   // 밴픽이 아직 안 끝났으면 멈춥니다(안전장치)
        toMeet(); break;
      }
      case "meet": {
        if (ss.meetPlan == null) {
          const adv = recommendTactic(ss.draft as DraftState, mySide(s));
          mutate((x) => { if (x.session) { x.session.meetPlan = adv.plan.tempo; x.session.meetFocus = adv.plan.focus; } });
        }
        afterMeet(); break;
      }
      case "sim": simNext(true); toPog(); return;
      default: return;
    }
  }
}
export function setChampionFocus(key: string, champ: string): void { mutate((s) => setChampFocus(s, key, champ)); }
export function markSchedOk(ok: boolean): void { mutate((s) => { s.schedOk = ok; }); }
export function fillSchedule(): void {
  mutate((s) => {
    const keys = s.starters[s.team] ?? [];
    const week: ("train" | "scrim" | "rest")[] = ["train", "train", "scrim", "rest", "train", "scrim", "rest"];
    for (const k of keys) setTrainingPlan(s, k, s.mode === "story" ? recommendedTraining(trainingPerson(s, k), trainingDate(s)) : week, true);
    s.schedOk = true;
  });
}

export function toMeet(): void { mutate((s) => { if (s.session) s.session.stage = "meet"; }); }
export function toPog(): void { mutate((s) => { if (s.session) s.session.stage = "pog"; }); }

export function acceptFranchise(ok: boolean): string | null {
  let err: string | null = null;
  mutate((s) => { if (s.story) err = resolveFranchise(s, ok); });
  return err;
}
export function confirmStove(): void { mutate((s, rng) => { if (s.story) finishOffseason(s, rng); }); }
