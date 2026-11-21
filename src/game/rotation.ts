import { PL } from "../data";
import { addNews, type Save, type SeriesRec } from "./season";
import { initializeTraining, playerTraining, trainingDate, trainingPerson, growthCtx } from "./trainingRuntime";
import { trainingProfile, matchExperience } from "./training";
import { PLAYER_BIRTHDATES } from "./playerBirthdates";

export const ROLE_LABEL = { 3: "주전", 2: "로테이션", 1: "육성" };
export interface PlayingPromise { person: string; name: string; pos: number; target: 1 | 2 | 3; starts: number; opportunities: number; since: string }
export interface PromiseOutcome extends PlayingPromise { date: string; outcome: "fulfilled" | "missed" | "cancelled" | "departed"; trust: number }
export interface Appearance { person: string; name: string; key: string; pos: number; first: boolean; load: number; before: number; after: number }
export type AppearanceRecord = Record<"B" | "R", Appearance[]>;
export interface LineupDecision { keys: string[]; reasons: string[] }
export interface RotationState {
  version: 1; automatic: boolean; promises: Record<string, PlayingPromise>; history: PromiseOutcome[];
  players: Record<string, { sets: number; starts: number; lastDate: string }>;
}
const active = (s: Save): boolean => s.mode === "story" && !!s.story;
const compare = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;
function roster(s: Save, team: string): string[] {
  const contracts = team === s.team ? s.story?.contracts : s.inSeason?.year === s.story?.year ? s.inSeason?.rosters[team] : undefined;
  return [...new Set(contracts ? contracts.filter(c => c.years > 0).map(c => c.key) : s.starters[team] ?? [])].filter(k => !!PL[k]);
}
const owned = (s: Save, key: string): boolean => !!s.story?.contracts.some(c => c.key === key && c.years > 0);
export function initializeRotation(s: Save): RotationState | undefined {
  if (!active(s)) return;
  return s.rotation ??= { version: 1, automatic: true, promises: {}, history: [], players: {} };
}
export function rotationLocked(s: Save): boolean { return !!s.session || !!s.story?.ended; }
function close(s: Save, p: PlayingPromise, outcome: PromiseOutcome["outcome"]): void {
  const state = initializeRotation(s)!;
  const requested = outcome === "fulfilled" ? 1 : outcome === "departed" ? 0 : -2;
  const before = s.eco.trust; s.eco.trust = Math.max(0, Math.min(100, before + requested));
  state.history.unshift({ ...p, date: trainingDate(s), outcome, trust: s.eco.trust - before });
  state.history.length = Math.min(80, state.history.length); delete state.promises[p.person];
  addNews(s, "season", `${p.name} 출전 약속 ${outcome === "fulfilled" ? "이행" : outcome === "missed" ? "미이행" : outcome === "cancelled" ? "철회" : "소속 종료"}`,
    `정규 시리즈 첫 세트 선발 ${p.starts}/${p.target}회, 기회 ${p.opportunities}/4회. 구단 신뢰 ${s.eco.trust - before >= 0 ? "+" : ""}${s.eco.trust - before}. 게임 내 운영 약속 기록입니다.`, s.team);
}
export function syncPromises(s: Save): void {
  if (!s.rotation || !active(s)) return;
  const people = new Set(s.story!.contracts.map(c => c.person));
  for (const p of Object.values(s.rotation.promises)) if (!people.has(p.person)) close(s, p, "departed");
}
/** 같은 포지션의 남은 의무가 어떤 기한에도 선발 자리 수를 넘지 않도록 검사합니다. */
export function promiseCapacity(promises: PlayingPromise[]): boolean {
  for (let pos = 0; pos < 5; pos++) for (let deadline = 1; deadline <= 4; deadline++) {
    const due = promises.filter(p => p.pos === pos && 4 - p.opportunities <= deadline).reduce((n, p) => n + Math.max(0, p.target - p.starts), 0);
    if (due > deadline) return false;
  }
  return true;
}
export function promiseError(s: Save, key: string, target: number): string | undefined {
  if (!active(s) || s.story!.phase !== "regular" || rotationLocked(s)) return "출전 약속은 경기 밖 정규 시즌에 정할 수 있습니다.";
  if (s.story!.year >= 2027 && s.story!.split === "summer" && s.series.filter(sr => sr.stage === "R" && !sr.winner && [sr.a, sr.b].includes(s.team)).length < 4) return "커리어 마지막 정규 시즌에 4시리즈가 남지 않아 새 약속을 정할 수 없습니다.";
  if (!owned(s, key) || ![1, 2, 3].includes(target)) return "계약 중인 선수와 유효한 역할을 선택해 주세요.";
  const person = trainingPerson(s, key)!;
  if (s.rotation?.promises[person]) return "진행 중인 약속을 바꿀 수 없습니다. 철회하면 구단 신뢰가 2 감소합니다.";
  const p: PlayingPromise = { person, name: PL[key].name, pos: PL[key].pos, target: target as 1 | 2 | 3, starts: 0, opportunities: 0, since: trainingDate(s) };
  if (!promiseCapacity([...Object.values(s.rotation?.promises ?? {}).filter(x => x.pos === p.pos), p])) return "같은 포지션의 선발 기회보다 약속이 많습니다. 기존 약속을 먼저 이행해 주세요.";
}
export function makePromise(s: Save, key: string, target: number): string | undefined {
  const error = promiseError(s, key, target); if (error) return error;
  const state = initializeRotation(s)!, person = trainingPerson(s, key)!;
  state.promises[person] = { person, name: PL[key].name, pos: PL[key].pos, target: target as 1 | 2 | 3, starts: 0, opportunities: 0, since: trainingDate(s) };
}
export function cancelPromise(s: Save, person: string): void {
  if (!rotationLocked(s) && s.rotation?.promises[person]) close(s, s.rotation.promises[person], "cancelled");
}
export function setRotationAutomatic(s: Save, automatic: boolean): void {
  if (!rotationLocked(s)) { const state = initializeRotation(s); if (state) state.automatic = automatic; }
}
function select(s: Save, team: string, regular: boolean): LineupDecision {
  const current = s.starters[team] ?? [], keys = [...current], reasons = keys.map(() => "현재 선발 유지");
  if (team === s.team && !s.rotation!.automatic) return { keys, reasons: keys.map(() => "감독 수동 기용") };
  const candidates = roster(s, team);
  const score = (key: string): number => (PL[key]?.pct.ovr ?? 0) - (playerTraining(s, key)?.fatigue ?? 0) * .12;
  for (let pos = 0; pos < 5; pos++) {
    const options = candidates.filter(k => PL[k]?.pos === pos);
    if (!options.length) continue;
    const promises = team === s.team && regular ? Object.values(s.rotation!.promises).filter(p => p.pos === pos && p.starts < p.target).sort((a, b) => (4 - a.opportunities - (a.target - a.starts)) - (4 - b.opportunities - (b.target - b.starts)) || b.opportunities - a.opportunities || compare(a.person, b.person)) : [];
    const urgent = promises.find(p => p.target - p.starts >= 4 - p.opportunities);
    const paced = promises.find(p => p.starts < Math.floor(p.target * (p.opportunities + 1) / 4));
    const due = urgent ?? paced, promised = due && options.find(k => trainingPerson(s, k) === due.person);
    if (promised && due) { keys[pos] = promised; reasons[pos] = `${urgent ? "약속 기한 우선" : "출전 약속 배분"}: 선발 ${due.starts}/${due.target}, 남은 기회 ${4 - due.opportunities}`; continue; }
    const best = options.sort((a, b) => score(b) - score(a) || (a === current[pos] ? -1 : b === current[pos] ? 1 : compare(a, b)))[0];
    if (!options.includes(current[pos]) || score(best) > score(current[pos]) + 1) { keys[pos] = best; reasons[pos] = "종합·현재 피로를 비교한 로테이션"; }
  }
  return { keys, reasons };
}
/** 첫 세트 전 한 번만. 다음 세트의 수동 교체·이미 시작한 밴픽을 덮어쓰지 않습니다. */
export function prepareSeriesLineups(s: Save, sr: SeriesRec): void {
  if (!active(s) || sr.winner || sr.games.length || sr.rotation) return;
  initializeRotation(s); syncPromises(s);
  const regular = sr.stage === "R" && s.story!.phase === "regular";
  sr.rotation = {};
  for (const team of [sr.a, sr.b]) {
    const decision = select(s, team, regular); sr.rotation[team] = decision;
    s.starters[team] = [...decision.keys];
  }
}
/** 실제 기록된 세트만 처리합니다. 조회/로드/다음 세트 준비로 중복 적용하지 않습니다. */
export function recordAppearances(s: Save, sr: SeriesRec, index: number): void {
  if (!active(s)) return;
  const g = sr.games[index]; if (!g || g.appearances) return;
  const state = initializeRotation(s)!, training = initializeTraining(s)!;
  g.appearances = { B: [], R: [] };
  for (const side of ["B", "R"] as const) for (const [pos, key] of g.lineup[side].entries()) {
    const person = trainingPerson(s, key); if (!person) continue;
    const date = s.days[sr.day].date, old = playerTraining(s, key)!;
    const load = 2 * trainingProfile(PLAYER_BIRTHDATES[person], date).fatigueLoad;
    const after = Math.min(100, old.fatigue + load);
    training.players[person] = { ...matchExperience(old, growthCtx(s, key, date)), fatigue: after };
    const appearance = { person, name: PL[key].name, key, pos, first: index === 0, load: after - old.fatigue, before: old.fatigue, after };
    g.appearances[side].push(appearance);
    if ((side === "B" ? g.blue : g.red) === s.team) {
      const p = state.players[person] ??= { sets: 0, starts: 0, lastDate: date };
      p.sets++; p.starts += index === 0 ? 1 : 0; p.lastDate = date;
    }
  }
  if (sr.winner && sr.stage === "R" && s.story!.phase === "regular" && [sr.a, sr.b].includes(s.team)) {
    syncPromises(s);
    const first = sr.games[0], side = first.blue === s.team ? "B" : "R";
    const starters = new Set(first.appearances?.[side].map(p => p.person) ?? []);
    for (const p of Object.values(state.promises)) {
      p.opportunities++; if (starters.has(p.person)) p.starts++;
      if (p.opportunities >= 4) close(s, p, p.starts >= p.target ? "fulfilled" : "missed");
    }
  }
}
