// 커리어 상태, 일정, 순위, 진행 루프, 뉴스 (뉴스는 게임 안 결과로만 만듭니다)
import { CORE, TM, PL } from "../data";
import { DraftState, DPick, Side, autoDraft, newDraft, other } from "./draft";
import { GameResult, simulateGame } from "./sim";
import { Rng } from "./rng";
import type { StoryState } from "./story";
import { prepareSeriesTraining, matchTraining, type TrainingState } from "./trainingRuntime";
import type { TrainingSummary } from "./training";
import { prepareInSeason, type InSeasonState } from "./inSeason";
import { matchTactics, type TacticPlan, type Focus, type TacticsRecord } from "./tactics";
import { prepareSeriesLineups, recordAppearances, type AppearanceRecord, type LineupDecision, type RotationState } from "./rotation";
import type { ScoutingState } from "./scouting";
import { captureClubNews, type ClubTimelineState } from "./clubTimeline";

export const SAVE_V = 2;
export type Stage = "R" | "SW" | "PO1" | "SF" | "F";
export const STAGE_KO: Record<Stage, string> = { R: "정규 시즌", SW: "월즈 스위스", PO1: "플레이오프 1라운드", SF: "플레이오프 준결승", F: "결승" };
export interface GameRec {
  blue: string; red: string; winner: string; firstSide: Side; holder: string;
  bans: Record<Side, string[]>; picks: Record<Side, DPick[]>; lineup: Record<Side, string[]>;
  dur: number; kills: [number, number]; gold15: number; mvp: string; pPre: number; res?: GameResult;
  training?: TrainingSummary;
  tactics?: TacticsRecord;
  appearances?: AppearanceRecord;
}
export interface SeriesRec { id: string; day: number; stage: Stage; a: string; b: string; bo: 1 | 3 | 5; games: GameRec[]; winner?: string; sa: number; sb: number; holder1?: string; swiss?: { round: number; w: number; l: number }; rotation?: Record<string, LineupDecision> }
export interface Day { date: string; week: number; stage: Stage; label: string }
export interface News { id: number; day: number; date: string; kind: "result" | "upset" | "streak" | "leader" | "season" | "welcome" | "mvp" | "playoff"; title: string; body: string; team?: string; read: boolean }
export interface PStat { g: number; w: number; k: number; d: number; a: number; mvp: number; rsum: number }
export interface Session {
  seriesId: string; gameIdx: number; holder: string;
  stage: "press" | "lineup" | "select" | "draft" | "meet" | "sim" | "pog" | "result" | "locker" | "end";
  blue?: string; red?: string; firstSide?: Side; choiceNote?: string; aiTook?: "first" | "blue";
  draft?: DraftState; result?: GameResult; simStep: number;
  pressTone?: string; meetPlan?: "atk" | "bal" | "safe"; locker?: { target: "team" | "one"; tone: "calm" | "firm" | "harsh"; key?: string };
  meetFocus?: Focus;
  lineup?: Record<string, string[]>;
}
export type Mode = "story" | "club" | "roster" | "fantasy";
export type CareerBg = "amateur" | "academy" | "pro" | "worlds";
export interface Manager { name: string; birth: string; nation: string; career: CareerBg; signature?: string }
export interface ClubInfo { name: string; short: string; color: string; replaced?: string }
export interface Economy {
  difficulty: "easy" | "normal" | "hard"; cap: number; cash: number;
  trust: number; fans: number;
  goal: "win" | "final" | "sf" | "po" | "top8";
  grant: number; bonus: number; trustHit: number; trustWin: number;
  sponsor?: { name: string; amount: number; goal: string; years: number };
}
export type DayAct = "train" | "scrim" | "rest" | "";
export interface Save {
  v: number; slot: number; seed: number; rng: number; team: string; manager: string; created: string; updated: string;
  mode: Mode; managerInfo: Manager; club?: ClubInfo; eco: Economy; cards: string[];
  day: number; days: Day[]; series: SeriesRec[]; news: News[]; newsSeq: number;
  form: Record<string, number[]>; starters: Record<string, string[]>; pstats: Record<string, PStat>;
  sched: Record<string, DayAct[]>; schedOk: boolean;
  session?: Session; phase: "regular" | "playoffs" | "done"; champion?: string; seen: string; seeds?: string[];
  ownerNote?: string;
  story?: StoryState;
  training?: TrainingState;
  inSeason?: InSeasonState;
  tactics?: Record<string, TacticPlan>;
  rotation?: RotationState;
  scouting?: ScoutingState;
  clubTimeline?: ClubTimelineState;
}
export interface CareerOpts {
  mode?: Mode; managerInfo?: Manager; club?: ClubInfo; eco?: Partial<Economy>;
  cards?: string[]; replace?: string; starters?: Record<string, string[]>;
}

const addDays = (iso: string, n: number): string => { const d = new Date(iso + "T12:00:00+09:00"); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const dateKo = (iso: string): string => { const d = new Date(iso + "T12:00:00+09:00"); return `${d.getMonth() + 1}월 ${d.getDate()}일 (${"일월화수목금토"[d.getDay()]})`; };
export function leagueShorts(s: { club?: ClubInfo; story?: StoryState; mode?: Mode }): string[] {
  if (s.mode === "story" && s.story) return s.story.tier === "LCK" ? s.story.lck : s.story.ck;
  return CORE.teams.map((t) => (s.club && t.short === s.club.replaced ? s.club.short : t.short));
}

export function newCareer(team: string, manager: string, slot: number, seed: number, opt: CareerOpts = {}): Save {
  const rng = new Rng(seed);
  const mode = opt.mode ?? "roster";
  const replaced = opt.club?.replaced ?? opt.replace;
  const shorts = CORE.teams.map((t) => (replaced && t.short === replaced && opt.club ? opt.club.short : t.short));
  const teams = rng.shuffle(shorts);
  // 원형 방식 라운드로빈 9라운드 + 홈/어웨이 바꿔 9라운드 = 팀당 18시리즈 (2026 Rounds 1-2 구조, Bo3)
  const rounds: [string, string][][] = [];
  const arr = [...teams];
  for (let r = 0; r < 9; r++) {
    const pairs: [string, string][] = [];
    for (let i = 0; i < 5; i++) { const a = arr[i], b = arr[9 - i]; pairs.push(r % 2 ? [b, a] : [a, b]); }
    rounds.push(pairs);
    arr.splice(1, 0, arr.pop()!);
  }
  const all = [...rounds, ...rounds.map((p) => p.map(([a, b]) => [b, a] as [string, string]))];
  const days: Day[] = []; const series: SeriesRec[] = [];
  const starts = CORE.meta.rounds12;
  all.forEach((pairs, i) => {
    const week = Math.floor(i / 2) + 1;
    const date = addDays(starts[week - 1] ?? addDays(starts[0], (week - 1) * 7), i % 2 ? 3 : 0);
    days.push({ date, week, stage: "R", label: `${week}주차 ${i % 2 ? "2" : "1"}경기일` });
    pairs.forEach(([a, b], j) => series.push({ id: `R${i}-${j}`, day: i, stage: "R", a, b, bo: 3, games: [], sa: 0, sb: 0 }));
  });
  const last = days[days.length - 1].date;
  days.push({ date: addDays(last, 5), week: 10, stage: "PO1", label: "플레이오프 1라운드" });
  days.push({ date: addDays(last, 12), week: 11, stage: "SF", label: "플레이오프 준결승" });
  days.push({ date: addDays(last, 19), week: 12, stage: "F", label: "결승" });
  const starters: Record<string, string[]> = { ...(opt.starters ?? {}) };
  for (const t of CORE.teams) {
    if (replaced && t.short === replaced) continue;
    if (!starters[t.short]) starters[t.short] = [...t.starters];
  }
  const now = new Date().toISOString();
  const info = opt.managerInfo ?? { name: manager, birth: "", nation: "한국", career: "amateur" as const };
  const eco: Economy = {
    difficulty: "normal", cap: 100, cash: 100, trust: 55, fans: 50,
    goal: "top8", grant: 1.5, bonus: 5, trustHit: 10, trustWin: 9,
    ...(opt.eco ?? {}),
  };
  eco.cash = eco.cap;
  const teamName = opt.club?.name ?? TM[team]?.ko ?? team;
  const s: Save = {
    v: SAVE_V, slot, seed, rng: rng.s, team, manager: info.name, created: now, updated: now,
    mode, managerInfo: info, club: opt.club, eco, cards: opt.cards ?? [],
    day: 0, days, series, news: [], newsSeq: 0, form: {}, starters, pstats: {},
    sched: {}, schedOk: false, phase: "regular", seen: "",
  };
  const first = s.series.find((x) => x.day === 0 && (x.a === team || x.b === team));
  const vs = first ? (first.a === team ? first.b : first.a) : "";
  addNews(s, "welcome", `${info.name} 감독, ${teamName} 지휘봉`, `${teamName}이(가) ${info.name} 감독 체제로 2026 LCK 정규 시즌을 시작합니다.${vs ? ` 첫 경기는 ${dateKo(days[0].date)} ${vs}전입니다.` : ""}`, team);
  return s;
}
export const opp = (s: Save, sr: SeriesRec): string => (sr.a === s.team ? sr.b : sr.a);
export function addNews(s: Save, kind: News["kind"], title: string, body: string, team?: string): void {
  s.newsSeq += 1;
  s.news.unshift({ id: s.newsSeq, day: s.day, date: s.days[Math.min(s.day, s.days.length - 1)].date, kind, title, body, team, read: false });
  captureClubNews(s, s.news[0]);
  if (s.news.length > 200) s.news.length = 200;
}
export const formVal = (s: Save, key: string): number => { const f = s.form[key]; if (!f || !f.length) return 0; const a = f.reduce((x, y) => x + y, 0) / f.length; return Math.max(-1, Math.min(1, (a - 6.3) / 1.5)); };
export function formMap(s: Save, keys: string[]): Record<string, number> { const m: Record<string, number> = {}; for (const k of keys) m[k] = formVal(s, k); return m; }

export interface Row { t: string; w: number; l: number; gw: number; gl: number; streak: string; last: string[] }
export function standings(s: Save): Row[] {
  const R: Record<string, Row> = {};
  for (const short of leagueShorts(s)) R[short] = { t: short, w: 0, l: 0, gw: 0, gl: 0, streak: "", last: [] };
  const done = s.series.filter((x) => x.stage === "R" && x.winner && !x.id.startsWith("MSI-") && !x.id.startsWith("W-G")).sort((a, b) => a.day - b.day);
  for (const x of done) {
    if (!R[x.a] || !R[x.b]) continue; // 승격·다른 리그·국제전 잔여 경기
    const aw = x.winner === x.a;
    R[x.a].w += aw ? 1 : 0; R[x.a].l += aw ? 0 : 1; R[x.b].w += aw ? 0 : 1; R[x.b].l += aw ? 1 : 0;
    R[x.a].gw += x.sa; R[x.a].gl += x.sb; R[x.b].gw += x.sb; R[x.b].gl += x.sa;
    R[x.a].last.push(aw ? "W" : "L"); R[x.b].last.push(aw ? "L" : "W");
  }
  const h2h = (a: string, b: string): number => done.filter((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a)).reduce((n, x) => n + (x.winner === a ? 1 : -1), 0);
  const rows = Object.values(R);
  for (const r of rows) { let n = 0; const L = r.last; for (let i = L.length - 1; i >= 0 && L[i] === L[L.length - 1]; i--) n++; r.streak = L.length ? `${n}${L[L.length - 1] === "W" ? "연승" : "연패"}` : "–"; r.last = L.slice(-5); }
  return rows.sort((a, b) => b.w - a.w || (b.gw - b.gl) - (a.gw - a.gl) || -h2h(a.t, b.t) || (a.t < b.t ? -1 : a.t > b.t ? 1 : 0));
}

// ----- 세트 준비 -----
export function selectionFor(sr: SeriesRec, gameIdx: number, rng: Rng): string {
  if (gameIdx === 0) return sr.holder1 ?? (sr.holder1 = rng.chance(0.5) ? sr.a : sr.b);
  const prev = sr.games[gameIdx - 1];
  return prev.winner === prev.blue ? prev.red : prev.blue; // 직전 세트 패배 팀이 다음 세트 선택권
}
// AI 선택권 규칙(게임 규칙): 선택권 팀은 60% 확률로 선픽, 40% 확률로 블루 진영. 상대는 남은 쪽에서 유리한 것을 고름.
export function aiSelection(holder: string, other_: string, rng: Rng): { blue: string; red: string; firstSide: Side; note: string } {
  if (rng.chance(0.6)) return { blue: other_, red: holder, firstSide: "R", note: `${holder}가 선픽을 고르고, ${other_}가 블루 진영을 골랐습니다.` };
  return { blue: holder, red: other_, firstSide: "R", note: `${holder}가 블루 진영을 고르고, ${other_}가 선픽(레드)을 골랐습니다.` };
}
export function lockedChamps(sr: SeriesRec): string[] { return sr.games.flatMap((g) => [...g.picks.B, ...g.picks.R].map((p) => p.c)); }

export function recordGame(s: Save, sr: SeriesRec, d: DraftState, res: GameResult, holder: string, keepDetail: boolean): void {
  const winner = d.teams[res.winner];
  sr.games.push({
    blue: d.teams.B, red: d.teams.R, winner, firstSide: d.firstSide, holder, bans: d.bans, picks: d.picks, lineup: d.lineup,
    dur: res.dur, kills: [res.kills.B, res.kills.R], gold15: res.gold15, mvp: res.mvp, pPre: res.pPre, res: keepDetail ? res : undefined, training: res.training, tactics: res.tactics,
  });
  if (winner === sr.a) sr.sa++; else sr.sb++;
  for (const p of res.perf) {
    const st = (s.pstats[p.key] ??= { g: 0, w: 0, k: 0, d: 0, a: 0, mvp: 0, rsum: 0 });
    st.g++; st.w += p.side === res.winner ? 1 : 0; st.k += p.k; st.d += p.d; st.a += p.a; st.rsum += p.rating; st.mvp += p.key === res.mvp ? 1 : 0;
    const f = (s.form[p.key] ??= []); f.push(p.rating); if (f.length > 3) f.shift();
  }
  const need = Math.ceil(sr.bo / 2);
  if (sr.sa >= need || sr.sb >= need) sr.winner = sr.sa > sr.sb ? sr.a : sr.b;
  recordAppearances(s, sr, sr.games.length - 1);
}

export function simSeries(s: Save, sr: SeriesRec, rng: Rng): void {
  if (sr.day === s.day && !sr.winner) prepareInSeason(s);
  prepareSeriesTraining(s, sr);
  prepareSeriesLineups(s, sr);
  while (!sr.winner) {
    const gi = sr.games.length;
    const holder = selectionFor(sr, gi, rng);
    const sel = aiSelection(holder, holder === sr.a ? sr.b : sr.a, rng);
    const d0 = newDraft(sel.blue, sel.red, s.starters[sel.blue], s.starters[sel.red], sel.firstSide, lockedChamps(sr));
    const d = autoDraft(d0, rng);
    const res = simulateGame(d, formMap(s, [...d.lineup.B, ...d.lineup.R]), rng, matchTraining(s, [...d.lineup.B, ...d.lineup.R]), matchTactics(d, s.tactics));
    recordGame(s, sr, d, res, holder, false);
  }
}

function seriesNews(s: Save, sr: SeriesRec, before: Row[]): void {
  const w = sr.winner!, l = w === sr.a ? sr.b : sr.a;
  const ws = w === sr.a ? sr.sa : sr.sb, ls = w === sr.a ? sr.sb : sr.sa;
  const mine = w === s.team || l === s.team;
  const mvpCount: Record<string, number> = {};
  sr.games.filter((g) => g.winner === w).forEach((g) => { mvpCount[g.mvp] = (mvpCount[g.mvp] ?? 0) + 1; });
  const pom = Object.entries(mvpCount).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))[0]?.[0];
  const rank = (t: string): number => before.findIndex((r) => r.t === t) + 1;
  const stageTxt = STAGE_KO[sr.stage];
  const gameTxt = sr.games.map((g, i) => `${i + 1}세트 ${g.winner}(${g.dur}분)`).join(", ");
  if (sr.stage !== "R") {
    addNews(s, "playoff", `[${stageTxt}] ${w}, ${l}에 ${ws}:${ls} 승리`, `${gameTxt}. 시리즈 MVP 평점 1위: ${pom ? PL[pom].name : "–"}.`, mine ? s.team : w);
    return;
  }
  const playedR = s.series.filter((x) => x.stage === "R" && x.winner).length;
  const upset = playedR > 10 && rank(w) - rank(l) >= 4;
  if (mine || upset) addNews(s, upset ? "upset" : "result", upset ? `이변: ${before.length ? rank(w) : ""}위 ${w}, ${rank(l)}위 ${l} 격파 (${ws}:${ls})` : `${w}, ${l}에 ${ws}:${ls} 승리`,
    `${gameTxt}. ${pom ? `승리 팀 최고 평점: ${PL[pom].name}.` : ""}`, mine ? s.team : w);
}

export function finishDay(s: Save, rng: Rng): void {
  const before = standings(s);
  const leaderBefore = s.series.some((x) => x.stage === "R" && x.winner) ? before[0].t : null;
  for (const sr of s.series.filter((x) => x.day === s.day)) {
    if (!sr.winner) simSeries(s, sr, rng);
    seriesNews(s, sr, before);
  }
  const after = standings(s);
  const st = s.days[s.day].stage;
  if (st === "R") {
    if (leaderBefore && after[0].t !== leaderBefore) addNews(s, "leader", `${after[0].t}, 단독 선두로`, `${dateKo(s.days[s.day].date)} 경기 후 ${after[0].t}가 ${after[0].w}승 ${after[0].l}패(세트 ${after[0].gw - after[0].gl >= 0 ? "+" : ""}${after[0].gw - after[0].gl})로 1위에 올랐습니다.`, after[0].t);
    for (const r of after) if (/^[4-9]\d*연승$|^\d{2,}연승$/.test(r.streak) && r.streak !== before.find((b) => b.t === r.t)?.streak) addNews(s, "streak", `${r.t} ${r.streak}`, `${r.t}가 정규 시즌 ${r.streak}을 달리고 있습니다. 현재 ${after.findIndex((x) => x.t === r.t) + 1}위 (${r.w}승 ${r.l}패).`, r.t);
  }
  s.day += 1;
  if (st === "R" && s.days[s.day]?.stage === "PO1") seedPlayoffs(s, after);
  else if (st === "PO1") advanceBracket(s, "SF");
  else if (st === "SF") advanceBracket(s, "F");
  else if (st === "F") {
    const f = s.series.find((x) => x.stage === "F")!;
    s.phase = "done"; s.champion = f.winner;
    judgeSeason(s);
    addNews(s, "season", `${f.winner}, 2026 LOL Manager 시즌 우승`, `결승에서 ${f.winner}가 ${f.winner === f.a ? f.b : f.a}를 ${Math.max(f.sa, f.sb)}:${Math.min(f.sa, f.sb)}로 꺾었습니다.${f.winner === s.team ? ` ${s.manager} 감독의 우승입니다.` : ""} ${s.ownerNote ?? ""}`, f.winner);
  }
}
function judgeSeason(s: Save): void {
  if (!s.eco) return;
  const rows = standings(s);
  const rank = rows.findIndex((r) => r.t === s.team) + 1;
  const seeds = s.seeds ?? [];
  const played = (st: Stage): boolean => s.series.some((x) => x.stage === st && (x.a === s.team || x.b === s.team));
  const g = s.eco.goal;
  const ok = g === "win" ? s.champion === s.team
    : g === "final" ? played("F")
    : g === "sf" ? played("SF") || played("F")
    : g === "po" ? seeds.includes(s.team)
    : rank >= 1 && rank <= 8;
  if (ok) {
    s.eco.trust = Math.min(100, (s.eco.trust ?? 55) + s.eco.trustWin);
    s.eco.cash = (s.eco.cash ?? 0) + s.eco.bonus;
    s.ownerNote = `구단주 평가: 목표를 달성했습니다 (정규 ${rank}위). 신뢰 +${s.eco.trustWin}, 보너스 ${s.eco.bonus}억.`;
  } else {
    s.eco.trust = Math.max(0, (s.eco.trust ?? 55) - s.eco.trustHit);
    s.ownerNote = `구단주 평가: 목표에 미치지 못했습니다 (정규 ${rank}위). 신뢰 −${s.eco.trustHit}.`;
  }
}

function seedPlayoffs(s: Save, rows: Row[]): void {
  s.phase = "playoffs";
  const seeds = rows.slice(0, 6).map((r) => r.t);
  const d = s.day;
  s.series.push({ id: "PO1-0", day: d, stage: "PO1", a: seeds[2], b: seeds[5], bo: 5, games: [], sa: 0, sb: 0, holder1: seeds[2] });
  s.series.push({ id: "PO1-1", day: d, stage: "PO1", a: seeds[3], b: seeds[4], bo: 5, games: [], sa: 0, sb: 0, holder1: seeds[3] });
  s.seeds = seeds;
  const inPO = seeds.includes(s.team);
  addNews(s, "season", "정규 시즌 종료, 플레이오프 대진 확정", `1위 ${seeds[0]}, 2위 ${seeds[1]}는 준결승 직행. 1라운드: ${seeds[2]} vs ${seeds[5]}, ${seeds[3]} vs ${seeds[4]} (Bo5). ${inPO ? `${s.team}는 ${seeds.indexOf(s.team) + 1}번 시드입니다.` : `${s.team}는 ${rows.findIndex((r) => r.t === s.team) + 1}위로 시즌을 마쳤습니다.`}`, s.team);
}
function advanceBracket(s: Save, next: "SF" | "F"): void {
  const seeds = s.seeds!;
  const seedOf = (t: string): number => seeds.indexOf(t);
  if (next === "SF") {
    const w = s.series.filter((x) => x.stage === "PO1").map((x) => x.winner!).sort((a, b) => seedOf(a) - seedOf(b));
    s.series.push({ id: "SF-0", day: s.day, stage: "SF", a: seeds[0], b: w[1], bo: 5, games: [], sa: 0, sb: 0, holder1: seeds[0] });
    s.series.push({ id: "SF-1", day: s.day, stage: "SF", a: seeds[1], b: w[0], bo: 5, games: [], sa: 0, sb: 0, holder1: seeds[1] });
  } else {
    const w = s.series.filter((x) => x.stage === "SF").map((x) => x.winner!).sort((a, b) => seedOf(a) - seedOf(b));
    s.series.push({ id: "F-0", day: s.day, stage: "F", a: w[0], b: w[1], bo: 5, games: [], sa: 0, sb: 0, holder1: w[0] });
  }
}
export const mySeriesToday = (s: Save): SeriesRec | undefined => s.series.find((x) => x.day === s.day && (x.a === s.team || x.b === s.team) && !x.winner);
export const nextMySeries = (s: Save): SeriesRec | undefined => s.series.filter((x) => (x.a === s.team || x.b === s.team) && !x.winner).sort((a, b) => a.day - b.day)[0];
export { other };
