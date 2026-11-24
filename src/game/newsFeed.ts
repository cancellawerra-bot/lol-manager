// 경기일 소식·여론(표시 전용). 승부·경제·팬심 수치를 바꾸지 않습니다.
// 글은 이 커리어에서 실제로 일어난 결과·결정만 쓰고, 선수·구단 관계자 발언이나 성격을 지어내지 않습니다.
import { PL, TM } from "../data";
import { addNews, dateKo, standings, STAGE_KO, type News, type Row, type Save, type SeriesRec } from "./season";

export const NEWS_CAP = 100;
export const NEWS_KIND: Record<string, string> = {
  result: "경기 결과", upset: "이변", streak: "흐름", leader: "선두", rank: "순위",
  season: "시즌", welcome: "구단", mvp: "POG", playoff: "플레이오프",
};

export interface NewsStanding { t: string; w: number; l: number; gw: number; gl: number; rank: number }
export interface NewsFixture { date: string; a: string; b: string; stage: string }
export interface NewsDetail { standings: NewsStanding[]; upcoming: NewsFixture[] }

export function teamKo(s: Save, t: string): string {
  if (s.club && (s.club.short === t || s.team === t && s.club.name)) {
    if (s.club.short === t) return s.club.name;
  }
  return TM[t]?.ko ?? t;
}

export function trimNews(s: Save): void {
  if (s.news.length <= NEWS_CAP) return;
  const unread = s.news.filter((n) => !n.read);
  const read = s.news.filter((n) => n.read);
  const room = Math.max(0, NEWS_CAP - Math.min(unread.length, NEWS_CAP));
  const keepUnread = unread.slice(0, NEWS_CAP);
  const keepRead = read.slice(0, room);
  s.news = [...keepUnread, ...keepRead].sort((a, b) => b.id - a.id);
}

export function newsSnapshot(s: Save): NewsDetail {
  const rows = standings(s);
  const upcoming = s.series.filter((x) => !x.winner && x.day > s.day).sort((a, b) => a.day - b.day).slice(0, 6);
  return {
    standings: rows.map((r, i) => ({ t: r.t, w: r.w, l: r.l, gw: r.gw, gl: r.gl, rank: i + 1 })),
    upcoming: upcoming.map((x) => ({ date: s.days[x.day]?.date ?? "", a: x.a, b: x.b, stage: STAGE_KO[x.stage] ?? x.stage })),
  };
}

/** 스토리 LCK는 상위 4팀, 로스터·창작은 상위 6팀. 2부(CK)는 플레이오프 없음. */
export function poCutoff(s: Save): number | null {
  if (s.story) return s.story.tier === "LCK" ? 4 : null;
  return 6;
}

function remainingRegular(s: Save, t: string): number {
  return s.series.filter((x) => x.stage === "R" && !x.winner && (x.a === t || x.b === t) && !x.id.startsWith("MSI-") && !x.id.startsWith("W-G") && !x.id.startsWith("PR-") && !x.id.startsWith("RTM-")).length;
}

export function clinchState(s: Save, rows: Row[]): "clinch" | "out" | null {
  const cut = poCutoff(s);
  if (!cut || rows.length < cut + 1) return null;
  const me = rows.find((r) => r.t === s.team);
  if (!me) return null;
  const myLeft = remainingRegular(s, s.team);
  const outside = rows.slice(cut);
  const inside = rows.slice(0, cut);
  const myMax = me.w + myLeft;
  const myMin = me.w;
  const outsidersMax = Math.max(...outside.map((r) => r.w + remainingRegular(s, r.t)));
  const lastSpotMin = Math.min(...inside.map((r) => r.w));
  if (myMin > outsidersMax) return "clinch";
  if (myMax < lastSpotMin) return "out";
  return null;
}

function pogName(sr: SeriesRec): string | undefined {
  const w = sr.winner;
  if (!w) return;
  const mvpCount: Record<string, number> = {};
  sr.games.filter((g) => g.winner === w).forEach((g) => { mvpCount[g.mvp] = (mvpCount[g.mvp] ?? 0) + 1; });
  const pom = Object.entries(mvpCount).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0]?.[0];
  return pom && PL[pom] ? PL[pom].name : undefined;
}

function setLine(sr: SeriesRec): string {
  return sr.games.map((g, i) => `${i + 1}세트 ${g.winner}(${g.dur}분)`).join(", ");
}

function standingsBeforeDay(s: Save, day: number): Row[] {
  const hide = new Set(s.series.filter((x) => x.day === day && x.winner).map((x) => x.id));
  const ghost: Save = { ...s, series: s.series.map((x) => hide.has(x.id) ? { ...x, winner: undefined, sa: 0, sb: 0, games: [] } : x) };
  return standings(ghost);
}

function alreadyPosted(s: Save, seriesId: string): boolean {
  return s.news.some((n) => n.seriesId === seriesId);
}

function emit(s: Save, kind: News["kind"], title: string, body: string, team?: string, seriesId?: string, detail?: NewsDetail): void {
  addNews(s, kind, title, body, team, { seriesId, detail });
}

export function publishMatchdayNews(s: Save, day = s.day): void {
  const todays = s.series.filter((x) => x.day === day && x.winner);
  if (!todays.length) return;
  const before = standingsBeforeDay(s, day);
  const detail = newsSnapshot(s);
  const after = standings(s);
  const rankOf = (rows: Row[], t: string): number => rows.findIndex((r) => r.t === t) + 1;
  const playedR = s.series.filter((x) => x.stage === "R" && x.winner).length;

  for (const sr of todays) {
    if (alreadyPosted(s, sr.id)) continue;
    const w = sr.winner!, l = w === sr.a ? sr.b : sr.a;
    const ws = w === sr.a ? sr.sa : sr.sb, ls = w === sr.a ? sr.sb : sr.sa;
    const mine = w === s.team || l === s.team;
    const stageTxt = STAGE_KO[sr.stage];
    const pom = pogName(sr);
    const press = mine ? sr.pressTone : undefined;
    const facts = [
      setLine(sr) || `${ws}:${ls}`,
      pom ? `POG(승리 팀 최고 평점): ${pom}.` : "",
      press ? `우리 기자회견 어조: ${press}.` : "",
    ].filter(Boolean).join(" ");

    if (sr.stage !== "R") {
      const verb = w === s.team ? "승리" : (l === s.team ? "패" : "승리");
      const title = mine && l === s.team
        ? `[${stageTxt}] ${teamKo(s, s.team)}, ${teamKo(s, w)}에 ${ls}:${ws} 패`
        : `[${stageTxt}] ${teamKo(s, w)}, ${teamKo(s, l)}에 ${ws}:${ls} ${verb === "패" ? "승리" : "승리"}`;
      emit(s, "playoff", title, facts, mine ? s.team : w, sr.id, detail);
      continue;
    }

    const rw = rankOf(before, w), rl = rankOf(before, l);
    const upset = playedR > 10 && rw > 0 && rl > 0 && rw - rl >= 4;
    if (upset) {
      emit(s, "upset", `이변: ${rw}위 ${teamKo(s, w)}, ${rl}위 ${teamKo(s, l)} 격파 (${ws}:${ls})`, facts, mine ? s.team : w, sr.id, detail);
      continue;
    }
    const title = mine && l === s.team
      ? `${teamKo(s, s.team)}, ${teamKo(s, w)}에 ${ls}:${ws} 패`
      : `${teamKo(s, w)}, ${teamKo(s, l)}에 ${ws}:${ls} 승리`;
    emit(s, "result", title, facts, mine ? s.team : w, sr.id, detail);
  }

  const st = s.days[day]?.stage ?? "R";
  if (st === "R") {
    const leaderBefore = before.some((r) => r.w + r.l > 0) ? before[0]?.t : null;
    if (leaderBefore && after[0] && after[0].t !== leaderBefore) {
      const a = after[0];
      const gd = a.gw - a.gl;
      emit(s, "leader", `${teamKo(s, a.t)}, 단독 선두로`, `${dateKo(s.days[day].date)} 경기 후 ${teamKo(s, a.t)}가 ${a.w}승 ${a.l}패(세트 ${gd >= 0 ? "+" : ""}${gd})로 1위에 올랐습니다.`, a.t, undefined, detail);
    }
    for (const r of after) {
      const prev = before.find((b) => b.t === r.t)?.streak;
      if (!r.streak || r.streak === "–" || r.streak === prev) continue;
      const n = parseInt(r.streak, 10);
      const ours = r.t === s.team;
      if (ours && n >= 3 || !ours && n >= 4) {
        emit(s, "streak", `${teamKo(s, r.t)} ${r.streak}`, `${teamKo(s, r.t)}가 정규 시즌 ${r.streak}을 달리고 있습니다. 현재 ${after.findIndex((x) => x.t === r.t) + 1}위 (${r.w}승 ${r.l}패).`, r.t, undefined, detail);
      }
    }
    const br = rankOf(before, s.team), ar = rankOf(after, s.team);
    if (br > 0 && ar > 0 && br !== ar) {
      const dir = ar < br ? "상승" : "하락";
      emit(s, "rank", `${teamKo(s, s.team)} ${br}위 → ${ar}위 ${dir}`, `${dateKo(s.days[day].date)} 경기 후 정규 시즌 순위가 ${br}위에서 ${ar}위가 되었습니다.`, s.team, undefined, detail);
    }
    const clinch = clinchState(s, after);
    const prevClinch = clinchState({ ...s, series: s.series.map((x) => x.day === day ? { ...x, winner: undefined, sa: 0, sb: 0, games: [] } : x) } as Save, before);
    if (clinch && clinch !== prevClinch) {
      const cut = poCutoff(s)!;
      if (clinch === "clinch") {
        emit(s, "playoff", `${teamKo(s, s.team)}, 플레이오프 진출 확정`, `남은 정규 시즌 결과와 관계없이 상위 ${cut}팀(플레이오프)이 확정되었습니다. 현재 ${ar}위.`, s.team, undefined, detail);
      } else {
        emit(s, "playoff", `${teamKo(s, s.team)}, 플레이오프 탈락`, `남은 경기로도 상위 ${cut}팀에 들 수 없습니다. 현재 ${ar}위.`, s.team, undefined, detail);
      }
    }
  }
}

export type FanMood = "hot" | "up" | "calm" | "down" | "cold";
export interface FanPost { board: string; text: string; likes: number; replies: number }
export interface FanOpinion {
  mood: FanMood; score: number; label: string; tone: string;
  summary: string; form: boolean[]; rank: number; posts: FanPost[];
}

const MOOD_META: Record<FanMood, { label: string; tone: string }> = {
  hot: { label: "들끓는 중", tone: "good" }, up: { label: "기대감 상승", tone: "good" },
  calm: { label: "차분함", tone: "neutral" }, down: { label: "걱정스러움", tone: "warn" },
  cold: { label: "싸늘함", tone: "warn" },
};
const BOARDS = ["응원 게시판", "경기 후기방", "가상 라운지", "감독 결정 이야기", "일정 게시판"];

const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

/** 표시용 여론. eco.fans·승부·난이도는 읽기만 하고 바꾸지 않습니다. */
export function fanOpinion(s: Save): FanOpinion {
  const rows = standings(s);
  const rank = rows.findIndex((r) => r.t === s.team) + 1, n = rows.length || 10;
  const mine = s.series.filter((r) => r.winner && (r.a === s.team || r.b === s.team)).sort((a, b) => b.day - a.day);
  const form = mine.slice(0, 5).map((r) => r.winner === s.team);
  const wins = form.filter(Boolean).length, losses = form.length - wins;
  const last = mine[0];
  const lastWon = last ? last.winner === s.team : undefined;
  const lastScore = last ? `${last.a === s.team ? last.sa : last.sb}:${last.a === s.team ? last.sb : last.sa}` : "";
  const lastOpp = last ? teamKo(s, last.a === s.team ? last.b : last.a) : "";
  const streak = rows.find((r) => r.t === s.team)?.streak ?? "–";
  const press = last?.pressTone;
  let score = 50 + (wins - losses) * 9 + (rank > 0 ? Math.round(((n + 1) / 2 - rank) * 2.2) : 0);
  // 기자회견 어조는 표시 보정만(수치 저장·승부에 쓰지 않음)
  if (press === "적극적" && lastWon === true) score += 4;
  else if (press === "적극적" && lastWon === false) score -= 2;
    score = Math.max(5, Math.min(95, score));
  let mood: FanMood = "calm";
  if (form.length === 0) { mood = "calm"; score = 50; }
  else if (score >= 78) mood = "hot"; else if (score >= 60) mood = "up"; else if (score >= 42) mood = "calm"; else if (score >= 26) mood = "down"; else mood = "cold";

  const name = teamKo(s, s.team);
  const templates: string[] = [];
  if (!form.length) {
    templates.push("아직 치른 경기가 없습니다. 개막을 기다려 봅니다.", `${name} 첫 경기 일정 정리해 봤습니다`, "라인업만 차분히 보겠습니다");
  } else {
    if (lastWon === true) templates.push(`${name}, ${lastOpp}전 ${lastScore} 승리. 경기 내용이 남습니다`, `방금 ${lastScore}로 이겼습니다. 다음 일정도 기대됩니다`);
    else templates.push(`${name}, ${lastOpp}전 ${lastScore} 패. 다음 경기를 준비합시다`, `${lastOpp}에게 ${lastScore}로 졌습니다. 일정은 계속됩니다`);
    if (/연승$/.test(streak) && parseInt(streak, 10) >= 2) templates.push(`${name} ${streak} 중입니다. 이 흐름을 이어 가면 좋겠습니다`);
    if (/연패$/.test(streak) && parseInt(streak, 10) >= 2) templates.push(`${name} ${streak}입니다. 다음 경기에서 끊어 보길 바랍니다`);
    if (press) templates.push(`감독 기자회견 어조는 「${press}」이었습니다. 결정은 기록으로만 남깁니다`);
    if (rank > 0) templates.push(`현재 정규 시즌 ${rank}위입니다. 순위표만 보고 이야기합니다`);
    templates.push(`${name} 이번 주 남은 일정을 정리해 봤습니다`, "밴픽과 경기 결과만 놓고 이야기해 봐요");
  }
  const seed = hash(`${s.team}|${mine.length}|${form.map(Number).join("")}|${press ?? ""}|${lastScore}`);
  const uniq = [...new Set(templates)];
  const posts: FanPost[] = [];
  for (let k = 0; k < uniq.length && posts.length < 3; k++) {
    const text = uniq[(seed + k) % uniq.length];
    if (posts.some((p) => p.text === text)) continue;
    const i = posts.length;
    const base = (hash(`${seed}|${i}`) % 180) + 12;
    posts.push({ board: BOARDS[(seed + i * 3) % BOARDS.length], text, likes: mood === "hot" || mood === "up" ? base + 60 : base, replies: hash(`r${seed}${i}`) % 60 + 2 });
  }
  const summary = form.length
    ? `최근 ${form.length}경기 ${wins}승 ${losses}패${rank > 0 ? ` · 현재 ${rank}위` : ""}${press ? ` · 최근 기자회견 「${press}」` : ""}`
    : "아직 치른 경기가 없어 팬들이 개막을 기다리고 있습니다.";
  return { mood, score, label: MOOD_META[mood].label, tone: MOOD_META[mood].tone, summary, form, rank, posts };
}

