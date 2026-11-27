import { CARDS, PL, TM } from "../data";
import type { Save, News, Row } from "./season";
import { captureClassReportSplit } from "./classReport";

export type ClubEventKind = "milestone" | "roster" | "finance" | "season";
export interface ClubEvent {
  id: string; date: string; year: number; kind: ClubEventKind; title: string; body: string;
  source: "live" | "retained-news"; cash?: number;
}
export interface ClubRosterRecord { person: string; name: string; pos?: number; cardYear?: number; salary: number; starter: boolean }
export interface ClubSplitRecord {
  id: string; year: number; split: "spring" | "summer"; tier: "CK" | "LCK"; date: string;
  rank: number; w: number; l: number; gw: number; gl: number; complete: boolean;
  champion?: string; championName?: string;
  roster: ClubRosterRecord[];
  matches: { id: string; date: string; opponent: string; opponentName: string; stage: string; scored: number; conceded: number; won: boolean }[];
}
export interface ClubTimelineState {
  version: 1; since: { year: number; split: string; legacy: boolean }; events: ClubEvent[]; splits: ClubSplitRecord[];
}
export const CLUB_EVENT_LABELS: Record<ClubEventKind, string> = { milestone: "구단 이정표", roster: "선수단", finance: "재정", season: "시즌·대회" };
const kindOf = (title: string): ClubEventKind => /창단|승강전 종료|프랜차이즈 슬롯|프랜차이즈 매수|2부 잔류|클리어|여정의 끝|해임/.test(title) ? "milestone" : /영입|이적|계약|트라이아웃.*결과|스토브.*결과|주전 공백|주전 교체/.test(title) ? "roster" : /수입|적자|잔고|매각|연봉/.test(title) ? "finance" : "season";
const relevant = (s: Save, n: News): boolean => (n.team === s.team || /, \d{4} (MSI|월즈) 우승$/.test(n.title)) && (n.kind === "season" || n.kind === "welcome");
function fromNews(n: News, live: boolean, cash?: number): ClubEvent {
  return { id: `news:${n.id}`, date: n.date, year: Number(n.date.slice(0, 4)), kind: kindOf(n.title), title: n.title, body: n.body, source: live ? "live" : "retained-news", ...(live ? { cash } : {}) };
}
/** 새 커리어에서 명시적으로 시작. 이전 저장은 다음 실제 사건부터 보관합니다. */
export function initializeClubTimeline(s: Save, legacy = true, excludeNewsId?: number): ClubTimelineState | undefined {
  if (s.mode !== "story" || !s.story) return;
  return s.clubTimeline ??= { version: 1, since: { year: s.story.year, split: s.story.split, legacy }, events: legacy ? s.news.filter(n => n.id !== excludeNewsId && relevant(s, n)).map(n => fromNews(n, false)) : [], splits: [] };
}
export function captureClubNews(s: Save, n: News): void {
  if (s.mode !== "story" || !s.story || !relevant(s, n)) return;
  const t = initializeClubTimeline(s, true, n.id)!;
  if (!t.events.some(e => e.id === `news:${n.id}`)) t.events.push(fromNews(n, true, s.eco.cash));
}
/** 조회는 읽기 전용. 확인되지 않는 과거를 현재 값으로 채우지 않습니다. */
export function readClubTimeline(s: Save): ClubTimelineState | undefined {
  if (s.mode !== "story" || !s.story) return;
  return s.clubTimeline ?? { version: 1, since: { year: s.story.year, split: s.story.split, legacy: true }, events: s.news.filter(n => relevant(s, n)).map(n => fromNews(n, false)), splits: [] };
}
export function clubSplitSnapshot(s: Save, rows: Row[], champion?: string): ClubSplitRecord | undefined {
  const st = s.story; if (!st) return;
  const own = rows.find(r => r.t === s.team); if (!own) return;
  const local = s.series.filter(x => !/^(PR-|W-|MSI-|RTM-)/.test(x.id));
  const regular = local.filter(x => x.stage === "R"); if (!regular.length) return;
  const matches = local.filter(x => x.winner && (x.a === s.team || x.b === s.team)).map(x => {
    const opponent = x.a === s.team ? x.b : x.a;
    return { id: x.id, date: s.days[x.day]?.date ?? "", opponent, opponentName: TM[opponent]?.ko ?? opponent, stage: x.stage, scored: x.a === s.team ? x.sa : x.sb, conceded: x.a === s.team ? x.sb : x.sa, won: x.winner === s.team };
  });
  const roster = st.contracts.map(c => { const p = PL[c.key], card = CARDS[c.cardId]; return { person: c.person, name: p?.name ?? card?.name ?? c.person, pos: p?.pos ?? card?.posIdx, cardYear: p?.cardYear ?? card?.year, salary: c.salary, starter: (s.starters[s.team] ?? []).includes(c.key) }; });
  const dates = local.filter(x => x.winner).map(x => s.days[x.day]?.date).filter((d): d is string => !!d).sort();
  return { id: `${st.year}-${st.split}`, year: st.year, split: st.split, tier: st.tier, date: dates[dates.length - 1] ?? s.days[0]?.date ?? "", rank: rows.findIndex(r => r.t === s.team) + 1, w: own.w, l: own.l, gw: own.gw, gl: own.gl, complete: regular.every(x => !!x.winner), champion, championName: champion ? TM[champion]?.ko ?? champion : undefined, roster, matches };
}
/** 끝난 실제 순위·경기·당시 선수를 한 번만 보관합니다. */
export function archiveClubSplit(s: Save, rows: Row[], champion?: string): void {
  if (s.mode !== "story" || !s.story) return;
  const id = `${s.story.year}-${s.story.split}`;
  if (s.clubTimeline?.splits.some(r => r.id === id)) return;
  const snapshot = clubSplitSnapshot(s, rows, champion); if (!snapshot?.complete) return;
  initializeClubTimeline(s)!.splits.push(snapshot);
  captureClassReportSplit(s, rows);
}
