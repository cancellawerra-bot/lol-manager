// 수업용 한 장 보고서. 표시·과제 제출만 다루며 승부·자금·난이도 공식은 읽기만 합니다.
// 없는 값은 「기록 없음」이며 0으로 채우거나 다른 연도로 대체하지 않습니다.
import { CARDS, CH, PL, POS_KO, TM } from "../data";
import { careerHonors } from "./achievements";
import { fmtMoney } from "./money";
import { fanOpinion, teamKo } from "./newsFeed";
import type { GameRec, Mode, Save, SeriesRec } from "./season";
import { STAGE_KO, standings } from "./season";
import { trainedRatingOf } from "./trainingRuntime";

export const NONE = "기록 없음";
export const CLASS_REPORT_LIMITS = {
  name: 40,
  studentId: 24,
  reflection: 800,
  snaps: 24,
  prompts: 24,
} as const;

export const REFLECTION_QUESTIONS: { id: string; prompt: string }[] = [
  { id: "draft", prompt: "가장 중요했던 밴픽 결정과 그 이유를 적어 주세요." },
  { id: "transfer", prompt: "다시 한다면 바꾸고 싶은 영입·방출이 있나요? 이유는 무엇인가요?" },
  { id: "weakness", prompt: "데이터가 보여 준 우리 팀의 약점은 무엇이었나요?" },
  { id: "next", prompt: "다음 스플릿(또는 다음 시즌)에 우선하고 싶은 과제는 무엇인가요?" },
];

export interface ChampCount { id: string; name: string; n: number; wins: number; wr: number | null }
export interface PressCount { tone: string; n: number }
export interface ObjFirst { label: string; ours: number; opp: number; sample: number; missing: number }
export interface GrowthRow { key: string; name: string; pos: string; base: number; overall: number; delta: number }
export interface RosterMove { date: string; title: string; body: string; cash?: number }
export interface SplitOption { id: string; label: string }
export interface ClassReportSnap {
  id: string;
  year?: number;
  split?: string;
  tier?: string;
  games: number;
  seriesW: number;
  seriesL: number;
  setW: number;
  setL: number;
  rank?: number;
  champion?: string;
  goldSample: number;
  goldLeadWins: number;
  goldLeadN: number;
  comebackW: number;
  comebackL: number;
  picks: ChampCount[];
  bans: ChampCount[];
  press: PressCount[];
  obj?: ObjFirst[];
  cash?: number;
  payroll?: number;
}

export interface ClassReportState {
  studentName?: string;
  studentId?: string;
  reflections?: Record<string, string>;
  seenPrompts?: string[];
  splits?: ClassReportSnap[];
}

export type ReportScope = "until-now" | "live" | string;

export interface ClassReportView {
  scopeId: string;
  scopeLabel: string;
  scopes: SplitOption[];
  studentName: string;
  studentId: string;
  manager: string;
  modeLabel: string;
  yearLabel: string;
  team: string;
  teamName: string;
  record: string;
  rank: string;
  playoff: string;
  trophies: { label: string; detail: string }[];
  feats: { label: string; detail: string }[];
  picks: ChampCount[] | null;
  bans: ChampCount[] | null;
  gold15: string;
  comeback: string;
  objectives: ObjFirst[] | null;
  moves: RosterMove[];
  cashNow: string;
  cashNote: string;
  payroll: string;
  growth: GrowthRow[] | null;
  press: string;
  opinion: string;
  form: string;
  reflections: { id: string; prompt: string; answer: string }[];
  note: string;
}

const SPLIT_KO: Record<string, string> = { spring: "스프링", summer: "썸머" };
const MODE_KO: Record<Mode, string> = { story: "프랜차이즈 스토리", club: "구단", roster: "2026 로스터", fantasy: "판타지 드래프트" };

const clip = (s: string, n: number): string => s.replace(/\s+/g, " ").trim().slice(0, n);

function ourGames(s: Save, series: SeriesRec[]): { sr: SeriesRec; g: GameRec; usBlue: boolean }[] {
  const out: { sr: SeriesRec; g: GameRec; usBlue: boolean }[] = [];
  for (const sr of series) {
    if (sr.a !== s.team && sr.b !== s.team) continue;
    for (const g of sr.games) {
      const usBlue = g.blue === s.team;
      const usRed = g.red === s.team;
      if (!usBlue && !usRed) continue;
      out.push({ sr, g, usBlue });
    }
  }
  return out;
}

function ourSeries(s: Save, series: SeriesRec[]): SeriesRec[] {
  return series.filter((x) => (x.a === s.team || x.b === s.team) && x.winner);
}

function tallyChamps(rows: { ids: string[]; won: boolean }[]): ChampCount[] {
  const map = new Map<string, { n: number; wins: number }>();
  for (const r of rows) for (const id of r.ids) {
    const cur = map.get(id) ?? { n: 0, wins: 0 };
    cur.n++; if (r.won) cur.wins++;
    map.set(id, cur);
  }
  return [...map.entries()].map(([id, v]) => ({
    id, name: CH[id]?.ko ?? id, n: v.n, wins: v.wins, wr: v.n ? v.wins / v.n : null,
  })).sort((a, b) => b.n - a.n || b.wins - a.wins || a.id.localeCompare(b.id));
}

function sideChamps(g: GameRec, usBlue: boolean, kind: "picks" | "bans"): string[] {
  const side = usBlue ? "B" : "R";
  return kind === "picks" ? (g.picks[side] ?? []).map((p) => p.c) : (g.bans[side] ?? []);
}

function firstOf(ev: { kind: string; side?: string }[] | undefined, kind: string): string | undefined {
  return ev?.find((e) => e.kind === kind && e.side)?.side;
}

function objectivesOf(games: { g: GameRec; usBlue: boolean }[]): ObjFirst[] | null {
  if (!games.length) return null;
  const kinds: { kind: string; label: string }[] = [
    { kind: "kill", label: "퍼스트 블러드" },
    { kind: "drake", label: "첫 드래곤" },
    { kind: "herald", label: "협곡의 전령" },
    { kind: "baron", label: "내셔 남작" },
  ];
  const rows: ObjFirst[] = kinds.map((k) => {
    let ours = 0, opp = 0, sample = 0, missing = 0;
    for (const { g, usBlue } of games) {
      const ev = g.res?.events;
      if (!ev?.length) { missing++; continue; }
      const side = k.kind === "kill" ? ev.find((e) => e.kind === "kill" && e.side)?.side : firstOf(ev, k.kind);
      if (!side) { missing++; continue; }
      sample++;
      const oursSide = usBlue ? "B" : "R";
      if (side === oursSide) ours++; else opp++;
    }
    return { label: k.label, ours, opp, sample, missing };
  });
  if (rows.every((r) => r.sample === 0)) return null;
  return rows;
}

function goldStats(s: Save, games: { g: GameRec; usBlue: boolean }[]): { sample: number; leadN: number; leadWins: number; comebackW: number; comebackL: number } {
  let sample = 0, leadN = 0, leadWins = 0, comebackW = 0, comebackL = 0;
  for (const { g, usBlue } of games) {
    if (g.gold15 == null || !Number.isFinite(g.gold15)) continue;
    sample++;
    const goldUs = usBlue ? g.gold15 : -g.gold15;
    const won = g.winner === s.team;
    if (goldUs > 0) { leadN++; if (won) leadWins++; }
    if (goldUs < 0 && won) comebackW++;
    if (goldUs > 0 && !won) comebackL++;
  }
  return { sample, leadN, leadWins, comebackW, comebackL };
}

function pressOf(series: SeriesRec[]): PressCount[] {
  const map = new Map<string, number>();
  for (const sr of series) {
    if (!sr.pressTone) continue;
    map.set(sr.pressTone, (map.get(sr.pressTone) ?? 0) + 1);
  }
  return [...map.entries()].map(([tone, n]) => ({ tone, n })).sort((a, b) => b.n - a.n || a.tone.localeCompare(b.tone));
}

function liveSeries(s: Save): SeriesRec[] {
  return s.series.filter((x) => !/^(PR-|W-|MSI-|RTM-)/.test(x.id));
}

function currentSnapId(s: Save): string {
  if (s.story) return `${s.story.year}-${s.story.split}`;
  if (s.mode === "roster") return "2026-season";
  return `career-${s.created?.slice(0, 10) || "now"}`;
}

function currentSnapLabel(s: Save): string {
  if (s.story) {
    const y = s.story.year;
    const sp = SPLIT_KO[s.story.split] ?? s.story.split;
    const tier = s.story.tier === "CK" ? "2부" : "LCK";
    return `${y} ${sp} (${tier})`;
  }
  if (s.mode === "roster") return "2026 시즌";
  return "이번 시즌";
}

export function splitOptions(s: Save): SplitOption[] {
  const snaps = s.classReport?.splits ?? [];
  const seen = new Set<string>();
  const out: SplitOption[] = [{ id: "until-now", label: "지금까지" }];
  for (const sp of snaps) {
    if (seen.has(sp.id)) continue;
    seen.add(sp.id);
    const y = sp.year != null ? String(sp.year) : "";
    const split = sp.split ? (SPLIT_KO[sp.split] ?? sp.split) : "";
    const tier = sp.tier === "CK" ? "2부" : sp.tier === "LCK" ? "LCK" : "";
    out.push({ id: sp.id, label: [y, split, tier && `(${tier})`].filter(Boolean).join(" ") || sp.id });
  }
  const liveId = currentSnapId(s);
  if (!seen.has(liveId) && ourSeries(s, liveSeries(s)).length) {
    out.push({ id: "live", label: `${currentSnapLabel(s)} · 진행 중` });
  }
  return out;
}

function seriesRecord(s: Save, series: SeriesRec[]): { w: number; l: number; gw: number; gl: number } {
  let w = 0, l = 0, gw = 0, gl = 0;
  for (const sr of ourSeries(s, series)) {
    if (sr.winner === s.team) w++; else l++;
    const usA = sr.a === s.team;
    gw += usA ? sr.sa : sr.sb;
    gl += usA ? sr.sb : sr.sa;
  }
  return { w, l, gw, gl };
}

function rankOf(s: Save): number | undefined {
  const local = liveSeries(s).filter((x) => x.stage === "R" && x.winner);
  if (!local.length) return undefined;
  const teams = new Map<string, { w: number; l: number; gw: number; gl: number }>();
  const add = (t: string) => { if (!teams.has(t)) teams.set(t, { w: 0, l: 0, gw: 0, gl: 0 }); return teams.get(t)!; };
  for (const sr of local) {
    const A = add(sr.a), B = add(sr.b);
    A.gw += sr.sa; A.gl += sr.sb; B.gw += sr.sb; B.gl += sr.sa;
    if (sr.winner === sr.a) { A.w++; B.l++; } else { B.w++; A.l++; }
  }
  const rows = [...teams.entries()].sort((a, b) => b[1].w - a[1].w || (b[1].gw - b[1].gl) - (a[1].gw - a[1].gl) || a[0].localeCompare(b[0]));
  const i = rows.findIndex((r) => r[0] === s.team);
  return i >= 0 ? i + 1 : undefined;
}

function payrollOf(s: Save): number | undefined {
  const contracts = s.story?.contracts;
  if (contracts?.length) return contracts.filter((c) => c.years > 0).reduce((n, c) => n + (c.salary ?? 0), 0);
  if (s.cards?.length) {
    const sum = s.cards.reduce((n, k) => n + (CARDS[k]?.salary ?? 0), 0);
    return sum > 0 ? sum : undefined;
  }
  return undefined;
}

function modeLabel(s: Save): string {
  if (s.mode === "story" && s.story?.history) return `역사 모드${s.story.history.startYear ? ` · ${s.story.history.startYear} 시작` : ""}`;
  if (s.mode === "story") return "프랜차이즈 스토리(창단)";
  return MODE_KO[s.mode] ?? s.mode;
}

function yearLabel(s: Save, snap?: ClassReportSnap): string {
  const y = snap?.year ?? s.story?.year;
  if (y != null) return String(y);
  if (s.mode === "roster") return "2026";
  return NONE;
}

function playoffFromArchive(s: Save): string | undefined {
  const bits: string[] = [];
  for (const sp of s.clubTimeline?.splits ?? []) {
    const po = (sp.matches ?? []).filter((m) => m.stage === "PO1" || m.stage === "SF" || m.stage === "F");
    const label = `${sp.year} ${SPLIT_KO[sp.split] ?? sp.split ?? ""}`.trim();
    if (po.length) {
      bits.push(`${label} ` + po.map((m) => {
        const st = STAGE_KO[m.stage as keyof typeof STAGE_KO] ?? m.stage;
        return `${st} vs ${m.opponentName} ${m.scored}:${m.conceded}${m.won ? " 승" : " 패"}`;
      }).join(", "));
    } else if (sp.championName || sp.champion) {
      bits.push(`${label} 우승 ${sp.championName ?? teamKo(s, sp.champion!)}`);
    }
  }
  if (bits.length) return bits.join(" · ");
  const honors = careerHonors(s).trophies.filter((x) => x.done && /플레이오프|우승|준우승|월즈|MSI|승격/.test(x.label));
  if (honors.length) return honors.map((x) => x.detail ? `${x.label} (${x.detail})` : x.label).join(" · ");
  return;
}

function playoffLine(s: Save, series: SeriesRec[]): string {
  const mine = ourSeries(s, series);
  const po = mine.filter((x) => x.stage === "PO1" || x.stage === "SF" || x.stage === "F");
  if (!po.length) {
    const archived = playoffFromArchive(s);
    if (archived) return archived;
    const regularDone = liveSeries(s).filter((x) => x.stage === "R").every((x) => !!x.winner) && liveSeries(s).some((x) => x.stage === "R");
    if (s.story?.tier === "CK" && !(s.clubTimeline?.splits ?? []).length) return "2부 스플릿에는 플레이오프가 없습니다";
    if (regularDone && s.phase !== "regular") return "플레이오프 진출 기록 없음";
    return NONE;
  }
  const parts = po.map((x) => {
    const opp = x.a === s.team ? x.b : x.a;
    const us = x.a === s.team ? x.sa : x.sb;
    const them = x.a === s.team ? x.sb : x.sa;
    return `${STAGE_KO[x.stage]} vs ${teamKo(s, opp)} ${us}:${them}${x.winner === s.team ? " 승" : " 패"}`;
  });
  return parts.join(" · ");
}

function mergeChamps(list: ChampCount[][]): ChampCount[] {
  const map = new Map<string, { n: number; wins: number }>();
  for (const arr of list) for (const c of arr) {
    const cur = map.get(c.id) ?? { n: 0, wins: 0 };
    cur.n += c.n; cur.wins += c.wins;
    map.set(c.id, cur);
  }
  return [...map.entries()].map(([id, v]) => ({
    id, name: CH[id]?.ko ?? id, n: v.n, wins: v.wins, wr: v.n ? v.wins / v.n : null,
  })).sort((a, b) => b.n - a.n || b.wins - a.wins || a.id.localeCompare(b.id));
}

function aggregateLive(s: Save): {
  rec: { w: number; l: number; gw: number; gl: number };
  rank?: number;
  games: ReturnType<typeof ourGames>;
  series: SeriesRec[];
  picks: ChampCount[];
  bans: ChampCount[];
  gold: ReturnType<typeof goldStats>;
  press: PressCount[];
  obj: ObjFirst[] | null;
} {
  const series = liveSeries(s);
  const games = ourGames(s, series);
  const rec = seriesRecord(s, series);
  const picks = tallyChamps(games.map(({ g, usBlue }) => ({ ids: sideChamps(g, usBlue, "picks"), won: g.winner === s.team })));
  const bans = tallyChamps(games.map(({ g, usBlue }) => ({ ids: sideChamps(g, usBlue, "bans"), won: g.winner === s.team })));
  return { rec, rank: rankOf(s), games, series: ourSeries(s, series), picks, bans, gold: goldStats(s, games), press: pressOf(ourSeries(s, series)), obj: objectivesOf(games) };
}

function emptySnapFromClub(s: Save, id: string): { rec: { w: number; l: number; gw: number; gl: number }; rank?: number; champion?: string; year?: number; split?: string } | undefined {
  const sp = s.clubTimeline?.splits.find((x) => x.id === id);
  if (!sp) return;
  return { rec: { w: sp.w, l: sp.l, gw: sp.gw, gl: sp.gl }, rank: sp.rank, champion: sp.championName ?? sp.champion, year: sp.year, split: sp.split };
}

export function captureClassReportSplit(s: Save, rows?: { t: string; w: number; l: number }[]): ClassReportSnap | undefined {
  const id = currentSnapId(s);
  const live = aggregateLive(s);
  if (!live.series.length && !live.games.length) return;
  const rank = rows ? rows.findIndex((r) => r.t === s.team) + 1 || undefined : live.rank;
  const snap: ClassReportSnap = {
    id,
    year: s.story?.year,
    split: s.story?.split,
    tier: s.story?.tier,
    games: live.games.length,
    seriesW: live.rec.w,
    seriesL: live.rec.l,
    setW: live.rec.gw,
    setL: live.rec.gl,
    rank: rank && rank > 0 ? rank : undefined,
    champion: s.champion,
    goldSample: live.gold.sample,
    goldLeadWins: live.gold.leadWins,
    goldLeadN: live.gold.leadN,
    comebackW: live.gold.comebackW,
    comebackL: live.gold.comebackL,
    picks: live.picks.slice(0, 8),
    bans: live.bans.slice(0, 8),
    press: live.press,
    obj: live.obj ?? undefined,
    cash: Number.isFinite(s.eco?.cash) ? s.eco.cash : undefined,
    payroll: payrollOf(s),
  };
  const st = (s.classReport ??= {});
  st.splits = [...(st.splits ?? []).filter((x) => x.id !== id), snap].slice(-CLASS_REPORT_LIMITS.snaps);
  return snap;
}

export function reportPromptId(s: Save): string | undefined {
  if (s.story?.ended || s.phase === "done") return "career-end";
  if (s.story && ["awards", "tryout", "expiry", "stove"].includes(s.story.phase)) return currentSnapId(s);
  return;
}

export function shouldOfferReport(s: Save): boolean {
  const id = reportPromptId(s);
  if (!id) return false;
  return !(s.classReport?.seenPrompts ?? []).includes(id);
}

export function markReportSeen(s: Save, id?: string): void {
  const key = id ?? reportPromptId(s);
  if (!key) return;
  const st = (s.classReport ??= {});
  const cur = st.seenPrompts ?? [];
  if (!cur.includes(key)) st.seenPrompts = [...cur, key].slice(-CLASS_REPORT_LIMITS.prompts);
}

export function setReportStudent(s: Save, name: string, studentId: string): void {
  const st = (s.classReport ??= {});
  const n = clip(name, CLASS_REPORT_LIMITS.name);
  const i = clip(studentId, CLASS_REPORT_LIMITS.studentId);
  if (n) st.studentName = n; else delete st.studentName;
  if (i) st.studentId = i; else delete st.studentId;
}

export function setReportReflection(s: Save, id: string, text: string): void {
  if (!REFLECTION_QUESTIONS.some((q) => q.id === id)) return;
  const st = (s.classReport ??= {});
  const v = clip(text, CLASS_REPORT_LIMITS.reflection);
  const rec = { ...(st.reflections ?? {}) };
  if (v) rec[id] = v; else delete rec[id];
  st.reflections = rec;
}

function fmtWr(wins: number, n: number): string {
  if (!n) return NONE;
  return `${((wins / n) * 100).toFixed(0)}% (${wins}/${n})`;
}

function fmtRecord(w: number, l: number, gw: number, gl: number): string {
  if (w + l === 0 && gw + gl === 0) return NONE;
  return `시리즈 ${w}승 ${l}패 · 세트 ${gw}승 ${gl}패`;
}

function growthOf(s: Save): GrowthRow[] | null {
  const keys = [...new Set([...(s.starters[s.team] ?? []), ...(s.story?.contracts.filter((c) => c.years > 0).map((c) => c.key) ?? []), ...s.cards])];
  const rows: GrowthRow[] = [];
  for (const key of keys) {
    const r = trainedRatingOf(s, key);
    if (!r) continue;
    const p = PL[key];
    const card = CARDS[key];
    const name = p?.name ?? card?.name;
    if (!name) continue;
    const pos = p ? POS_KO[p.pos] : card ? POS_KO[card.posIdx] : "";
    const delta = Math.round((r.overall - r.base) * 10) / 10;
    rows.push({ key, name, pos, base: r.base, overall: r.overall, delta });
  }
  if (!rows.length) return null;
  return rows.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || a.name.localeCompare(b.name, "ko"));
}

function movesOf(s: Save): RosterMove[] {
  const ev = s.clubTimeline?.events ?? [];
  const roster = ev.filter((e) => e.kind === "roster" || e.kind === "finance").map((e) => ({
    date: e.date, title: e.title, body: e.body, cash: e.cash,
  }));
  if (roster.length) return roster;
  const news = (s.news ?? []).filter((n) => n.kind === "welcome" || /영입|방출|이적|계약|트라이아웃|스토브/.test(n.title));
  return news.map((n) => ({ date: n.date, title: n.title, body: n.body }));
}

export function buildClassReport(s: Save, scope: ReportScope = "until-now"): ClassReportView {
  const scopes = splitOptions(s);
  const live = aggregateLive(s);
  const snaps = s.classReport?.splits ?? [];
  let scopeId = scope;
  if (scope !== "until-now" && scope !== "live" && !snaps.some((x) => x.id === scope)) {
    scopeId = scopes.some((x) => x.id === scope) ? scope : "until-now";
  }

  let rec = { w: 0, l: 0, gw: 0, gl: 0 };
  let rank: number | undefined;
  let picks: ChampCount[] | null = null;
  let bans: ChampCount[] | null = null;
  let gold = { sample: 0, leadN: 0, leadWins: 0, comebackW: 0, comebackL: 0 };
  let press: PressCount[] = [];
  let obj: ObjFirst[] | null = null;
  let seriesForPo: SeriesRec[] = live.series;
  let snapMeta: ClassReportSnap | undefined;
  let cashAt: number | undefined;
  let payrollAt: number | undefined;
  let champ: string | undefined;

  if (scopeId === "live") {
    rec = live.rec; rank = live.rank; picks = live.picks.length ? live.picks : null; bans = live.bans.length ? live.bans : null;
    gold = live.gold; press = live.press; obj = live.obj; seriesForPo = live.series;
    cashAt = s.eco?.cash; payrollAt = payrollOf(s);
  } else if (scopeId === "until-now") {
    rec = { ...live.rec };
    rank = live.rank;
    const pickLists = [live.picks], banLists = [live.bans];
    gold = { ...live.gold };
    press = [...live.press];
    const objParts: ObjFirst[][] = live.obj ? [live.obj] : [];
    for (const sp of snaps) {
      if (sp.id === currentSnapId(s) && live.series.length) continue; // live already covers current series
      rec.w += sp.seriesW; rec.l += sp.seriesL; rec.gw += sp.setW; rec.gl += sp.setL;
      if (sp.rank && sp.rank > 0) rank = sp.rank;
      pickLists.push(sp.picks); banLists.push(sp.bans);
      gold.sample += sp.goldSample; gold.leadN += sp.goldLeadN; gold.leadWins += sp.goldLeadWins;
      gold.comebackW += sp.comebackW; gold.comebackL += sp.comebackL;
      for (const p of sp.press) {
        const cur = press.find((x) => x.tone === p.tone);
        if (cur) cur.n += p.n; else press.push({ ...p });
      }
      if (sp.obj) objParts.push(sp.obj);
      cashAt = sp.cash ?? cashAt;
      payrollAt = sp.payroll ?? payrollAt;
      champ = sp.champion ?? champ;
    }
    const mergedP = mergeChamps(pickLists);
    const mergedB = mergeChamps(banLists);
    picks = mergedP.length ? mergedP : null;
    bans = mergedB.length ? mergedB : null;
    if (objParts.length) {
      const labels = objParts[0].map((r) => r.label);
      obj = labels.map((label) => {
        const rows = objParts.map((o) => o.find((r) => r.label === label)).filter((x): x is ObjFirst => !!x);
        return {
          label,
          ours: rows.reduce((n, r) => n + r.ours, 0),
          opp: rows.reduce((n, r) => n + r.opp, 0),
          sample: rows.reduce((n, r) => n + r.sample, 0),
          missing: rows.reduce((n, r) => n + r.missing, 0),
        };
      });
      if (obj.every((r) => r.sample === 0)) obj = null;
    } else obj = live.obj;
    // 과거 스플릿은 클럽 연표 전적만 있고 상세 스냅이 없을 수 있음
    for (const sp of s.clubTimeline?.splits ?? []) {
      if (snaps.some((x) => x.id === sp.id)) continue;
      if (sp.id === currentSnapId(s) && live.series.length) continue;
      rec.w += sp.w; rec.l += sp.l; rec.gw += sp.gw; rec.gl += sp.gl;
      if (rank == null) rank = sp.rank;
    }
    cashAt = Number.isFinite(s.eco?.cash) ? s.eco.cash : cashAt;
    payrollAt = payrollOf(s) ?? payrollAt;
    seriesForPo = live.series;
  } else {
    snapMeta = snaps.find((x) => x.id === scopeId);
    const club = emptySnapFromClub(s, scopeId);
    if (snapMeta) {
      rec = { w: snapMeta.seriesW, l: snapMeta.seriesL, gw: snapMeta.setW, gl: snapMeta.setL };
      rank = snapMeta.rank;
      picks = snapMeta.picks.length ? snapMeta.picks : null;
      bans = snapMeta.bans.length ? snapMeta.bans : null;
      gold = { sample: snapMeta.goldSample, leadN: snapMeta.goldLeadN, leadWins: snapMeta.goldLeadWins, comebackW: snapMeta.comebackW, comebackL: snapMeta.comebackL };
      press = snapMeta.press;
      obj = snapMeta.obj && snapMeta.obj.some((r) => r.sample > 0) ? snapMeta.obj : null;
      cashAt = snapMeta.cash;
      payrollAt = snapMeta.payroll;
      champ = snapMeta.champion;
      if (snapMeta.id === currentSnapId(s)) seriesForPo = live.series;
      else seriesForPo = [];
    } else if (club) {
      rec = club.rec; rank = club.rank; champ = club.champion;
      picks = null; bans = null; obj = null; seriesForPo = [];
    }
  }

  const honors = careerHonors(s);
  const trophies = honors.trophies.filter((t) => t.done).map((t) => ({ label: t.label, detail: t.detail }));
  const feats = honors.feats.filter((f) => f.done).map((f) => ({ label: f.label, detail: f.detail }));

  const op = fanOpinion(s);
  const form = op.form.length ? `최근 ${op.form.length}경기 ${op.form.filter(Boolean).length}승 ${op.form.length - op.form.filter(Boolean).length}패` : NONE;
  const pressLine = press.length ? press.map((p) => `「${p.tone}」 ${p.n}회`).join(" · ") : NONE;
  const opinionRaw = (scopeId === "until-now" || scopeId === "live")
    ? (live.series.length || op.form.length ? `${op.label} · 표시 온도 ${op.score} · ${op.summary}` : NONE)
    : NONE;
  const opinion = annotateOpinionRank(s, opinionRaw, op.rank);

  const growth = (scopeId === "until-now" || scopeId === "live") ? growthOf(s) : null;
  const moves = movesOf(s);
  const scopeLabel = scopes.find((x) => x.id === scopeId)?.label ?? "지금까지";

  const playoff = scopeId !== "until-now" && scopeId !== "live" && seriesForPo.length === 0
    ? (champ ? `스플릿 우승 ${teamKo(s, champ) === champ && TM[champ] ? TM[champ].ko : teamKo(s, champ)}` : (clubChampion(s, scopeId) ?? NONE))
    : playoffLine(s, seriesForPo);

  const cashNow = Number.isFinite(s.eco?.cash) ? fmtMoney(s.eco.cash) : NONE;
  const cashNote = cashAt != null && scopeId !== "until-now" && scopeId !== "live"
    ? `당시 잔고 ${fmtMoney(cashAt)} (기록된 값만)`
    : "현재 잔고는 저장에 있는 값입니다. 과거 잔고가 없으면 기록 없음입니다.";
  const payroll = payrollAt != null ? fmtMoney(payrollAt) : (payrollOf(s) != null ? fmtMoney(payrollOf(s)!) : NONE);

  return {
    scopeId,
    scopeLabel,
    scopes,
    studentName: s.classReport?.studentName ?? "",
    studentId: s.classReport?.studentId ?? "",
    manager: s.manager,
    modeLabel: modeLabel(s),
    yearLabel: yearLabel(s, snapMeta),
    team: s.team,
    teamName: teamKo(s, s.team),
    record: fmtRecord(rec.w, rec.l, rec.gw, rec.gl),
    rank: rank != null && rank > 0 ? `${rank}위` : NONE,
    playoff,
    trophies,
    feats,
    picks,
    bans,
    gold15: gold.sample ? `15분 골드 우세 시 승률 ${fmtWr(gold.leadWins, gold.leadN)} · 표본 ${gold.sample}세트` : NONE,
    comeback: gold.sample ? `15분 열세 역전승 ${gold.comebackW}세트 · 15분 우세 역전패 ${gold.comebackL}세트` : NONE,
    objectives: obj,
    moves,
    cashNow,
    cashNote,
    payroll,
    growth,
    press: pressLine,
    opinion,
    form,
    reflections: REFLECTION_QUESTIONS.map((q) => ({ id: q.id, prompt: q.prompt, answer: s.classReport?.reflections?.[q.id] ?? "" })),
    note: "이 보고서는 이 커리어에서 실제로 남은 기록만 모았습니다. 없는 값은 「기록 없음」이며 0으로 채우거나 다른 연도 기록으로 대체하지 않습니다. 성찰 칸의 답은 학생이 직접 씁니다. 금액은 게임용 가상 금액입니다. 팀 로고·선수 사진은 쓰지 않습니다.",
  };
}


/** 여론의 「현재 N위」는 지금 저장의 정규 시즌 순위표입니다. 숫자는 그대로 두고 기준만 밝힙니다. */
function opinionRankBasis(s: Save): string {
  const me = standings(s).find((r) => r.t === s.team);
  const played = me ? me.w + me.l : 0;
  const day = s.days[Math.min(Math.max(s.day, 0), Math.max(0, s.days.length - 1))];
  const label = day?.label ?? "";
  const phase = s.story?.phase ?? s.phase ?? "";
  const intl = phase === "worlds" || phase === "msi" || /월즈|MSI/.test(label);
  const off = ["awards", "tryout", "expiry", "stove", "done"].includes(String(phase));
  if (played > 0) {
    return intl || off
      ? "지금 정규 시즌 순위표 기준 · 지난 스플릿·국제전 성적과 별개"
      : "지금 진행 중인 정규 시즌 순위표 기준";
  }
  if (intl) return "지금 정규 시즌 순위표 기준 · 이 표에는 정규 경기가 없어 위의 정규 순위·진행 중인 국제전과 다를 수 있음";
  if (off) return "지금 정규 시즌 순위표 기준 · 이 표에는 정규 경기가 없어 위의 정규 순위와 다를 수 있음";
  return "지금 정규 시즌 순위표 기준";
}

function annotateOpinionRank(s: Save, opinion: string, rank: number): string {
  if (!opinion || opinion === NONE || !(rank > 0)) return opinion;
  const basis = opinionRankBasis(s);
  const token = `현재 ${rank}위`;
  if (opinion.includes(token)) return opinion.replace(token, `${token}(${basis})`);
  return `${opinion} · ${token}(${basis})`;
}

function clubChampion(s: Save, id: string): string | undefined {
  const sp = s.clubTimeline?.splits.find((x) => x.id === id);
  if (!sp?.champion && !sp?.championName) return;
  return sp.championName ?? (sp.champion ? teamKo(s, sp.champion) : undefined);
}

export function reportToJson(view: ClassReportView): string {
  return JSON.stringify({
    title: "LOL Manager 수업 보고서",
    scope: view.scopeLabel,
    studentName: view.studentName || null,
    studentId: view.studentId || null,
    manager: view.manager,
    mode: view.modeLabel,
    year: view.yearLabel === NONE ? null : view.yearLabel,
    team: { short: view.team, name: view.teamName },
    record: view.record === NONE ? null : view.record,
    rank: view.rank === NONE ? null : view.rank,
    playoff: view.playoff === NONE ? null : view.playoff,
    trophies: view.trophies,
    feats: view.feats,
    picks: view.picks,
    bans: view.bans,
    gold15: view.gold15 === NONE ? null : view.gold15,
    comeback: view.comeback === NONE ? null : view.comeback,
    objectives: view.objectives,
    moves: view.moves,
    cashNow: view.cashNow === NONE ? null : view.cashNow,
    payroll: view.payroll === NONE ? null : view.payroll,
    growth: view.growth,
    press: view.press === NONE ? null : view.press,
    opinion: view.opinion === NONE ? null : view.opinion,
    form: view.form === NONE ? null : view.form,
    reflections: view.reflections,
    note: view.note,
  }, null, 2);
}

export function reportToCsv(view: ClassReportView): string {
  const rows: [string, string][] = [
    ["제목", "LOL Manager 수업 보고서"],
    ["범위", view.scopeLabel],
    ["이름", view.studentName || NONE],
    ["학번", view.studentId || NONE],
    ["감독", view.manager],
    ["모드", view.modeLabel],
    ["연도", view.yearLabel],
    ["팀", `${view.teamName} (${view.team})`],
    ["성적", view.record],
    ["순위", view.rank],
    ["플레이오프·우승", view.playoff],
    ["트로피", view.trophies.length ? view.trophies.map((t) => `${t.label}: ${t.detail}`).join(" / ") : NONE],
    ["업적", view.feats.length ? view.feats.map((t) => `${t.label}: ${t.detail}`).join(" / ") : NONE],
    ["많이 뽑은 챔피언", view.picks?.length ? view.picks.slice(0, 8).map((c) => `${c.name} ${c.n}회`).join(" / ") : NONE],
    ["많이 밴한 챔피언", view.bans?.length ? view.bans.slice(0, 8).map((c) => `${c.name} ${c.n}회`).join(" / ") : NONE],
    ["15분 골드", view.gold15],
    ["역전", view.comeback],
    ["오브젝트 선취", view.objectives?.length ? view.objectives.map((o) => o.sample ? `${o.label} 우리 ${o.ours}/${o.sample}` : `${o.label} ${NONE}`).join(" / ") : NONE],
    ["현재 자금", view.cashNow],
    ["연봉 합", view.payroll],
    ["기자회견 어조", view.press],
    ["여론", view.opinion],
    ["최근 전적", view.form],
    ...view.reflections.map((r): [string, string] => [r.prompt, r.answer || ""]),
  ];
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  return rows.map(([k, v]) => `${esc(k)},${esc(v)}`).join("\n");
}

/** 조회만. 승부·자금·저장을 바꾸지 않습니다. */
export function reportDoesNotMutate(s: Save, fn: (s: Save) => unknown): unknown {
  return fn(s);
}
