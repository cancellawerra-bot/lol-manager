import { Rng } from "./rng";
import type { SeriesRec } from "./season";

export interface SwissTeam { t: string; region: string; pool: number }
export interface SwissState { teams: SwissTeam[]; round: number; avoidRematches: boolean; drawRng: number }
export interface SwissRow extends SwissTeam { w: number; l: number; gw: number; gl: number; opponents: string[] }
export interface SwissPair { a: string; b: string; bo: 1 | 3; holder1: string; w: number; l: number }
const cmp = (a: string, b: string): number => a < b ? -1 : a > b ? 1 : 0;

/** 승수는 세트 수가 아니라 시리즈 수입니다. 기록은 완료된 경기에서만 읽습니다. */
export function swissRows(st: SwissState, series: SeriesRec[]): SwissRow[] {
  const rows = st.teams.map((t) => ({ ...t, w: 0, l: 0, gw: 0, gl: 0, opponents: [] as string[] }));
  const byTeam = new Map(rows.map((r) => [r.t, r]));
  for (const sr of series.filter((x) => x.id.startsWith("W-SW"))) {
    if (!sr.winner) continue;
    const a = byTeam.get(sr.a), b = byTeam.get(sr.b);
    if (!a || !b) continue;
    a.opponents.push(b.t); b.opponents.push(a.t);
    a.gw += sr.sa; a.gl += sr.sb; b.gw += sr.sb; b.gl += sr.sa;
    if (sr.winner === a.t) { a.w++; b.l++; } else { b.w++; a.l++; }
  }
  return rows.sort((a, b) => b.w - a.w || a.l - b.l || a.pool - b.pool || cmp(a.t, b.t));
}

/** 추첨 순서대로 시도하되 뒷 대진이 막히면 앞 추첨을 되돌립니다. 금지 대진을 허용하지 않습니다. */
export function matchSwiss(teams: SwissRow[], legal: (a: SwissRow, b: SwissRow) => boolean): [SwissRow, SwissRow][] | undefined {
  if (!teams.length) return [];
  const [a, ...rest] = teams;
  for (let i = 0; i < rest.length; i++) {
    const b = rest[i];
    if (!legal(a, b)) continue;
    const tail = matchSwiss(rest.filter((_, j) => j !== i), legal);
    if (tail) return [[a, b], ...tail];
  }
}

export function drawSwissRound(st: SwissState, series: SeriesRec[], rng: Rng): SwissPair[] {
  const rows = swissRows(st, series).filter((r) => r.w < 3 && r.l < 3);
  const groups = new Map<string, SwissRow[]>();
  for (const r of rows) {
    const key = `${r.w}-${r.l}`;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }
  const pairs: SwissPair[] = [];
  for (const group of groups.values()) {
    const matches = matchSwiss(rng.shuffle(group), (a, b) => st.round === 1
      ? a.pool + b.pool === 5 && a.region !== b.region
      : !st.avoidRematches || !a.opponents.includes(b.t));
    if (!matches) throw new Error("월즈 스위스 추첨: 규칙을 만족하는 대진이 없습니다.");
    for (const [a, b] of matches) pairs.push({ a: a.t, b: b.t, w: a.w, l: a.l,
      bo: a.w === 2 || a.l === 2 ? 3 : 1,
      holder1: a.pool < b.pool ? a.t : a.pool > b.pool ? b.t : rng.chance(0.5) ? a.t : b.t });
  }
  return pairs;
}

/** 3-0 두 팀은 반대편에 두고 3-2와 대결, 남은 네 팀은 추첨합니다. */
export function drawSwissKnockout(st: SwissState, series: SeriesRec[], rng: Rng): [string, string][] {
  const adv = swissRows(st, series).filter((r) => r.w === 3);
  const unbeaten = rng.shuffle(adv.filter((r) => r.l === 0));
  const last = rng.shuffle(adv.filter((r) => r.l === 2));
  if (adv.length !== 8 || unbeaten.length !== 2 || last.length !== 3) throw new Error("월즈 스위스 진출 팀 수가 맞지 않습니다.");
  const used = new Set([...unbeaten.map((r) => r.t), last[0].t, last[1].t]);
  const rest = rng.shuffle(adv.filter((r) => !used.has(r.t)));
  const betterFirst = (a: SwissRow, b: SwissRow): [string, string] => a.l <= b.l ? [a.t, b.t] : [b.t, a.t];
  return [[unbeaten[0].t, last[0].t], betterFirst(rest[0], rest[1]), [unbeaten[1].t, last[1].t], betterFirst(rest[2], rest[3])];
}
