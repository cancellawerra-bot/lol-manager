// 경기 전 라인 맞대결·조언. 이미 있는 능력치·시즌 카드·커리어 기록만 정리하며, 새 수치나 선수 발언·성격을 만들지 않습니다.
import { CARDS, CH, PL } from "../data";
import { careerYear, hasYearPlayerPools, lckYearName, NO_RECORD } from "./yearRecords";
import { standings, type Save, type SeriesRec } from "./season";
import { ratingOf } from "../rating";
import { playerTraining } from "./trainingRuntime";
import { estimateOvr, visibleSortValue, visibleRatingSpan } from "./scoutEstimate";
import type { PosIdx } from "../types";
import type { SeasonCard } from "../types";
import type { DraftState } from "./draft";

export const POS_KO = ["탑", "정글", "미드", "원딜", "서포터"] as const;

export interface ChampFact { id: string; n: number; wins?: number }
export interface SideFact {
  key: string;
  name: string;
  ovr: number | null; // 공개된 정확값만. 미관찰 구간이면 null
  ovrText: string;
  estKind: "exact" | "range" | "none";
  visible: number | null;
  ovrLo: number | null;
  ovrHi: number | null;
  cardYear: number | null;
  cardGames: number | null;
  cardKda: number | null;
  cardWr: number | null;
  cardGd15: number | null;
  careerG: number;
  careerW: number;
  careerKda: string | null;
  careerAvg: number | null;
  careerForm: number[];
  pool: ChampFact[] | null; // null = 그해 기록 없음
  practice: ChampFact[];
  fatigue: number | null;
}
export interface LaneFact {
  pos: PosIdx;
  posKo: string;
  my: SideFact;
  op: SideFact;
  ovrDiff: number | null;
}
export interface PreMatchBrief {
  year: number;
  myTeam: string;
  opTeam: string;
  myAvg: number | null;
  opAvg: number | null;
  opAvgText: string;
  lanes: LaneFact[];
  keyPos: PosIdx | null;
  teamForm: { my: string[]; op: string[] };
  h2h: { w: number; l: number; n: number } | null;
  series: { sa: number; sb: number; set: number } | null;
  picks: { pos: PosIdx; my?: string; op?: string }[] | null;
  advice: string[];
}

function visibleSide(s: Save, key: string): Pick<SideFact, "ovr" | "ovrText" | "estKind" | "visible" | "ovrLo" | "ovrHi"> {
  const p = PL[key];
  const est = estimateOvr(s, p?.personKey ?? key, p ? ratingOf(p) : null, undefined, p ?? null);
  if (est.kind === "exact" && est.value != null) {
    return { ovr: est.value, ovrText: String(est.value), estKind: "exact", visible: est.value, ovrLo: est.value, ovrHi: est.value };
  }
  if (est.kind === "range") {
    const span = visibleRatingSpan(est)!;
    return { ovr: null, ovrText: est.text, estKind: "range", visible: visibleSortValue(est), ovrLo: span.lo, ovrHi: span.hi };
  }
  return { ovr: null, ovrText: "기록 없음", estKind: "none", visible: null, ovrLo: null, ovrHi: null };
}

function vsVisible(our: number | null, op: SideFact): string {
  if (our == null) return "";
  if (op.estKind === "exact" && op.visible != null) {
    const d = Math.round(our - op.visible);
    if (d === 0) return " 종합은 같습니다.";
    return ` 우리가 ${Math.abs(d)} ${d > 0 ? "높습니다" : "낮습니다"}.`;
  }
  if (op.estKind === "range" && op.ovrLo != null && op.ovrHi != null) {
    if (our > op.ovrHi) return " 우리 값이 상대 추정 구간보다 높습니다.";
    if (our < op.ovrLo) return " 우리 값이 상대 추정 구간보다 낮습니다.";
    return " 우리 값이 상대 추정 구간과 겹칩니다.";
  }
  return "";
}

function seasonCardOf(s: Save, key: string): SeasonCard | undefined {
  if (CARDS[key]) return CARDS[key];
  const ct = s.story?.contracts.find((c) => c.key === key);
  return ct ? CARDS[ct.cardId] : undefined;
}

function fmt1(n: number): string { return n.toFixed(1); }

function sideFact(s: Save, key: string, year: number): SideFact {
  const p = PL[key];
  const card = seasonCardOf(s, key);
  const st = s.pstats[key];
  const form = s.form[key] ?? [];
  const tr = playerTraining(s, key);
  const practice = Object.entries(tr?.champs ?? {}).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([id, n]) => ({ id, n }));
  const pool: ChampFact[] | null = (!card && hasYearPlayerPools(year) && p?.pool?.length)
    ? p.pool.slice(0, 4).map(([id, n, w]) => ({ id, n, wins: w }))
    : null;
  return {
    key,
    name: p?.name ?? key,
    ...visibleSide(s, key),
    cardYear: card?.year ?? null,
    cardGames: card ? card.games : (hasYearPlayerPools(year) && p && !card ? p.games : null),
    cardKda: card ? (card.kda ?? null) : (hasYearPlayerPools(year) && p && !card ? p.m.kda : null),
    cardWr: card ? (card.wr ?? null) : (hasYearPlayerPools(year) && p && !card && p.games ? p.wins / p.games : null),
    cardGd15: card ? (card.gd15 ?? null) : (hasYearPlayerPools(year) && p && !card ? p.m.gd : null),
    careerG: st?.g ?? 0,
    careerW: st?.w ?? 0,
    careerKda: st && st.g ? `${st.k}/${st.d}/${st.a}` : null,
    careerAvg: st && st.g ? st.rsum / st.g : null,
    careerForm: form.slice(),
    pool,
    practice,
    fatigue: tr ? tr.fatigue : null,
  };
}

function avgExact(s: Save, keys: string[]): number | null {
  const sides = keys.map((k) => visibleSide(s, k));
  if (!sides.length || sides.some((x) => x.estKind !== "exact" || x.ovr == null)) return null;
  return sides.reduce((n, x) => n + x.ovr!, 0) / sides.length;
}

function keyLane(lanes: LaneFact[]): PosIdx | null {
  let best: PosIdx | null = null, abs = -1;
  for (const ln of lanes) {
    if (ln.ovrDiff == null) continue;
    const a = Math.abs(ln.ovrDiff);
    if (a > abs) { abs = a; best = ln.pos; }
  }
  return best;
}

function h2hOf(s: Save, my: string, op: string): { w: number; l: number; n: number } | null {
  const played = s.series.filter((sr) => sr.winner && ((sr.a === my && sr.b === op) || (sr.a === op && sr.b === my)));
  if (!played.length) return null;
  let w = 0, l = 0;
  for (const sr of played) { if (sr.winner === my) w++; else l++; }
  return { w, l, n: played.length };
}

function seriesSoFar(sr: SeriesRec | undefined, my: string): PreMatchBrief["series"] {
  if (!sr || !sr.games.length) return sr ? { sa: 0, sb: 0, set: 1 } : null;
  const mine = sr.a === my ? sr.sa : sr.sb, theirs = sr.a === my ? sr.sb : sr.sa;
  return { sa: mine, sb: theirs, set: sr.games.length + 1 };
}

function adviceOf(b: Omit<PreMatchBrief, "advice">): string[] {
  const lines: string[] = [];
  if (b.myAvg != null && b.opAvg != null) {
    const d = b.myAvg - b.opAvg;
    if (Math.abs(d) < 0.5) lines.push(`선발 5명 평균 종합은 우리 ${fmt1(b.myAvg)}, 상대 ${fmt1(b.opAvg)}로 비슷합니다.`);
    else if (d > 0) lines.push(`선발 5명 평균 종합은 우리 ${fmt1(b.myAvg)}, 상대 ${fmt1(b.opAvg)}로 우리가 ${fmt1(d)} 높습니다.`);
    else lines.push(`선발 5명 평균 종합은 우리 ${fmt1(b.myAvg)}, 상대 ${fmt1(b.opAvg)}로 우리가 ${fmt1(-d)} 낮습니다.`);
  } else if (b.myAvg != null) {
    lines.push(`선발 5명 평균 종합은 우리 ${fmt1(b.myAvg)}입니다. 상대는 미관찰 선수가 있어 ${b.opAvgText}으로만 비교합니다.`);
  }
  if (b.keyPos != null) {
    const ln = b.lanes[b.keyPos];
    lines.push(`종합 능력치 차이가 가장 큰 라인은 ${ln.posKo}입니다. 우리 ${ln.my.name} ${ln.my.ovrText}, 상대 ${ln.op.name} ${ln.op.ovrText}.${vsVisible(ln.my.ovr, ln.op)}`);
    const facts: string[] = [];
    if (ln.my.cardKda != null) facts.push(`우리 ${ln.posKo}의 ${ln.my.cardYear ?? b.year} 시즌 카드 KDA ${ln.my.cardKda.toFixed(2)}`);
    else facts.push(`우리 ${ln.posKo}의 ${lckYearName(b.year)} 시즌 KDA는 ${NO_RECORD}`);
    if (ln.op.cardKda != null) facts.push(`상대는 ${ln.op.cardKda.toFixed(2)}`);
    else facts.push(`상대 ${lckYearName(b.year)} 시즌 KDA는 ${NO_RECORD}`);
    if (ln.my.cardGd15 != null || ln.op.cardGd15 != null) {
      const a = ln.my.cardGd15 == null ? NO_RECORD : `${ln.my.cardGd15 >= 0 ? "+" : ""}${Math.round(ln.my.cardGd15)}`;
      const c = ln.op.cardGd15 == null ? NO_RECORD : `${ln.op.cardGd15 >= 0 ? "+" : ""}${Math.round(ln.op.cardGd15)}`;
      facts.push(`15분 골드 차(시즌 카드) 우리 ${a} · 상대 ${c}`);
    }
    lines.push(facts.join(". ") + ".");
  }
  const anyCareer = b.lanes.some((ln) => ln.my.careerG || ln.op.careerG);
  if (!anyCareer) lines.push("이번 커리어 출전 기록이 아직 없어, 시즌 카드와 현재 종합 능력치만 정리했습니다.");
  else {
    const bits = b.lanes.filter((ln) => ln.my.careerG || ln.op.careerG).slice(0, 2).map((ln) => {
      const mine = ln.my.careerG ? `우리 ${ln.my.name} ${ln.my.careerG}경기 ${ln.my.careerW}승` : `우리 ${ln.posKo} 커리어 기록 없음`;
      const theirs = ln.op.careerG ? `상대 ${ln.op.name} ${ln.op.careerG}경기 ${ln.op.careerW}승` : `상대 ${ln.posKo} 커리어 기록 없음`;
      return `${ln.posKo}은 ${mine}, ${theirs}`;
    });
    if (bits.length) lines.push(bits.join(". ") + ".");
  }
  if (b.h2h) lines.push(`이 커리어에서 상대와의 시리즈는 ${b.h2h.n}번이며 우리가 ${b.h2h.w}승 ${b.h2h.l}패입니다.`);
  if (b.teamForm.my.length || b.teamForm.op.length) {
    const fmtF = (xs: string[]): string => xs.length ? xs.map((x) => (x === "W" ? "승" : "패")).join("") : "기록 없음";
    lines.push(`최근 팀 성적은 우리 ${fmtF(b.teamForm.my)}, 상대 ${fmtF(b.teamForm.op)}입니다.`);
  }
  if (b.series && b.series.set > 1) lines.push(`이번 시리즈는 현재 ${b.series.sa}:${b.series.sb}이며, ${b.series.set}세트를 앞두고 있습니다.`);
  if (!hasYearPlayerPools(b.year) || b.lanes.every((ln) => !ln.my.pool && !ln.op.pool)) {
    lines.push(`${lckYearName(b.year)} 챔피언별 출전 기록은 ${NO_RECORD}입니다. 다른 연도 값으로 채우지 않습니다.`);
  }
  if (b.picks && b.picks.some((p) => p.my || p.op)) {
    const key = b.keyPos != null ? b.picks.find((p) => p.pos === b.keyPos) : undefined;
    if (key && (key.my || key.op)) {
      const myC = key.my ? (CH[key.my]?.ko ?? key.my) : "없음";
      const opC = key.op ? (CH[key.op]?.ko ?? key.op) : "없음";
      lines.push(`이번 세트 ${POS_KO[b.keyPos!]} 픽은 우리 ${myC} · 상대 ${opC}입니다.`);
    }
  }
  lines.push("이 조언은 화면에 있는 기록만 정리한 것이며, 선수 발언이나 성격을 지어내지 않았습니다. 승부 계산에는 쓰이지 않습니다.");
  return lines;
}

export function preMatchBrief(s: Save, myTeam: string, opTeam: string, sr?: SeriesRec, draft?: DraftState): PreMatchBrief {
  const year = careerYear(s);
  const mine = s.starters[myTeam] ?? [];
  const theirs = s.starters[opTeam] ?? [];
  const lanes: LaneFact[] = [0, 1, 2, 3, 4].map((i) => {
    const pos = i as PosIdx;
    const my = sideFact(s, mine[i] ?? "", year);
    const op = sideFact(s, theirs[i] ?? "", year);
    const ovrDiff = my.visible != null && op.visible != null ? Math.round(my.visible - op.visible) : null;
    return { pos, posKo: POS_KO[pos], my, op, ovrDiff };
  });
  const rows = standings(s);
  const myRow = rows.find((r) => r.t === myTeam), opRow = rows.find((r) => r.t === opTeam);
  const picks = draft ? [0, 1, 2, 3, 4].map((i) => {
    const pos = i as PosIdx;
    const mySide = draft.teams.B === myTeam ? "B" as const : "R" as const;
    const opSide = mySide === "B" ? "R" as const : "B" as const;
    return { pos, my: draft.picks[mySide].find((p) => p.pos === pos)?.c, op: draft.picks[opSide].find((p) => p.pos === pos)?.c };
  }) : null;
  const myAvg = avgExact(s, mine);
  const opAvg = avgExact(s, theirs);
  const opSides = theirs.map((k) => visibleSide(s, k));
  const opAvgText = opAvg != null ? fmt1(opAvg)
    : opSides.some((x) => x.estKind === "range") ? "추정 구간"
    : "기록 없음";
  const base: Omit<PreMatchBrief, "advice"> = {
    year,
    myTeam,
    opTeam,
    myAvg,
    opAvg,
    opAvgText,
    lanes,
    keyPos: keyLane(lanes),
    teamForm: { my: myRow?.last?.slice(-5) ?? [], op: opRow?.last?.slice(-5) ?? [] },
    h2h: h2hOf(s, myTeam, opTeam),
    series: seriesSoFar(sr, myTeam),
    picks,
  };
  return { ...base, advice: adviceOf(base) };
}
