// 저장/불러오기: localStorage 슬롯 3개 + 자동 저장, JSON 내보내기/불러오기
import { useSyncExternalStore } from "react";
import { Save, SAVE_V, aiSelection, finishDay, lockedChamps, mySeriesToday, recordGame, selectionFor } from "./game/season";
import { DraftState, Side, aiStep, apply, autoDraft, newDraft, turn } from "./game/draft";
import { simulateGame } from "./game/sim";
import { formMap } from "./game/season";
import { Rng } from "./game/rng";
import type { PosIdx } from "./types";
import { hydrateSave } from "./game/cards";
import { finishStoryDay, isStory, simRestOfPhase, resolveFranchise, pumpStory, applyStoryWorld } from "./game/story";
import "./game/stove";
import { autoAdvanceOffseason, finishOffseason } from "./game/stove";

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
export function setSave(s: Save | null): void { cur = s; if (s) { hydrateSave(s); if (s.mode === "story") applyStoryWorld(s); persist(); } emit(); }
export function loadSlot(n: number): boolean {
  try { const raw = localStorage.getItem(KEY(n)); if (!raw) return false; const s = JSON.parse(raw) as Save; if (s.v !== SAVE_V) return false; hydrateSave(s); if (s.mode === "story") applyStoryWorld(s); cur = s; localStorage.setItem(LAST, String(n)); emit(); return true; } catch { return false; }
}
export function deleteSlot(n: number): void { localStorage.removeItem(KEY(n)); if (cur?.slot === n) cur = null; emit(); }
export function exportJson(): string { return JSON.stringify(cur); }
export function importJson(text: string, slot: number): string | null {
  try {
    const s = JSON.parse(text) as Save;
    if (!s || s.v !== SAVE_V || !Array.isArray(s.series) || !s.team) return "LOL Manager 세이브 파일이 아니거나 버전이 다릅니다. v2부터는 새 형식이라 이전 세이브는 불러올 수 없습니다.";
    s.slot = slot; hydrateSave(s); if (s.mode === "story") applyStoryWorld(s); cur = s; persist(); emit(); return null;
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
  const my = mySeriesToday(s);
  if (my) {
    if (!s.schedOk) return "sched";
    mutate((x) => { x.session = { seriesId: my.id, gameIdx: my.games.length, holder: "", stage: "press", simStep: 0 }; }); return "match";
  }
  mutate((x, rng) => { if (isStory(x)) finishStoryDay(x, rng); else finishDay(x, rng); });
  return (s.phase as string) === "done" || s.story?.ended ? (s.story?.ended ? "endstory" : "done") : "day";
}
export function autoSimSplit(onlyOthers = false): void {
  mutate((s, rng) => { if (isStory(s)) simRestOfPhase(s, rng, onlyOthers); });
}
export function autoToOffseason(): void {
  mutate((s, rng) => { if (isStory(s)) pumpStory(s, rng); });
}
export function autoStove(signStars = false): void {
  mutate((s, rng) => { if (isStory(s)) autoAdvanceOffseason(s, rng, { signStars }); });
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
    if (turn(d)) return;
    ss.result = simulateGame(d, formMap(s, [...d.lineup.B, ...d.lineup.R]), rng);
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
  mutate((s, rng) => { s.session = undefined; finishDay(s, rng); });
}
export function setStarter(team: string, pos: number, key: string): void { mutate((s) => { s.starters[team][pos] = key; }); }

export function setPress(tone: string): void { mutate((s) => { if (s.session) s.session.pressTone = tone; }); }
export function afterPress(): void { mutate((s) => { if (s.session) s.session.stage = "lineup"; }); }
export function confirmLineup(): void { toSelection(); }
export function setMeet(plan: "atk" | "bal" | "safe"): void { mutate((s) => { if (s.session) s.session.meetPlan = plan; }); }
export function afterMeet(): void { runSim(); }
export function afterPog(): void { toResult(); }
export function afterResult(): void {
  mutate((s) => {
    const ss = s.session!; const sr = sessionSeries(s);
    ss.stage = sr.winner ? "end" : "locker";
  });
}
export function afterLocker(): void { nextGame(); }
export function markSchedOk(ok: boolean): void { mutate((s) => { s.schedOk = ok; }); }
export function fillSchedule(): void {
  mutate((s) => {
    const keys = s.starters[s.team] ?? [];
    const week: ("train" | "scrim" | "rest")[] = ["train", "train", "scrim", "rest", "train", "scrim", "rest"];
    for (const k of keys) s.sched[k] = [...week];
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
