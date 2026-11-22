// 밴픽 엔진: lol-banpick-lab 시뮬레이터의 2026 규칙(첫 번째 선택권, 20단계 순서, 피어리스)을 모듈로 옮기고
// 팀 성향(2026 LCK 실제 밴픽)·선수 숙련도(2026 LCK 실제 기록)·랭크 상성(30판 이상)을 근거로 붙였습니다.
import { CH, CHAMPS, CORE, PL, RANKED, POS_KO, fmt } from "../data";
import type { Champ, Player, PosIdx } from "../types";
import { Rng } from "./rng";

export type Side = "B" | "R";
export type Ord = "F" | "L";
export type Kind = "ban" | "pick";
export const SEQ: { ord: Ord; kind: Kind }[] = "Fb Lb Fb Lb Fb Lb Fp Lp Lp Fp Fp Lp Lb Fb Lb Fb Lp Fp Fp Lp"
  .split(" ").map((s) => ({ ord: s[0] as Ord, kind: s[1] === "b" ? "ban" : "pick" }));
export const PHASE_OF = (step: number): string => (step < 6 ? "1차 밴" : step < 12 ? "1차 픽" : step < 16 ? "2차 밴" : step < 20 ? "2차 픽" : "완료");

export interface DPick { c: string; pos: PosIdx }
export interface DLog { side: Side; kind: Kind; c: string; pos?: PosIdx; by: "user" | "ai"; why: string[] }
export interface DraftState {
  teams: Record<Side, string>;      // 팀 약칭
  lineup: Record<Side, string[]>;   // 포지션 순 선수 key 5명
  firstSide: Side;                  // 선픽(F) 진영
  step: number;
  bans: Record<Side, string[]>;
  picks: Record<Side, DPick[]>;
  locked: string[];                 // 피어리스: 같은 시리즈 앞 세트에서 쓴 챔피언
  /** v2.34.0 챔피언 훈련으로 쌓은 연습 일수(선수 key → 챔피언 → 일수). 챔피언 숙련도에 연습 2일 = 1경기로 더합니다. */
  practice?: Record<string, Record<string, number>>;
  log: DLog[];
}
export interface Reason { t: string; v: number }
export interface Rec { c: string; pos: PosIdx | null; score: number; reasons: Reason[] }

export const other = (s: Side): Side => (s === "B" ? "R" : "B");
export function turn(d: DraftState): { side: Side; kind: Kind } | null {
  if (d.step >= SEQ.length) return null;
  const s = SEQ[d.step];
  return { side: s.ord === "F" ? d.firstSide : other(d.firstSide), kind: s.kind };
}
export function newDraft(blue: string, red: string, lineB: string[], lineR: string[], firstSide: Side, locked: string[]): DraftState {
  return { teams: { B: blue, R: red }, lineup: { B: lineB, R: lineR }, firstSide, step: 0, bans: { B: [], R: [] }, picks: { B: [], R: [] }, locked, log: [] };
}
export function used(d: DraftState): Set<string> {
  if (!d?.bans) return new Set(d?.locked ?? []);
  return new Set([...d.bans.B, ...d.bans.R, ...(d.picks?.B ?? []).map((p) => p.c), ...(d.picks?.R ?? []).map((p) => p.c), ...(d.locked ?? [])]);
}
export function available(d: DraftState): Champ[] { const u = used(d); return CHAMPS.filter((c) => !u.has(c.id)); }
export function openPos(d: DraftState, s: Side): PosIdx[] {
  const f = new Set(d.picks[s].map((p) => p.pos));
  return ([0, 1, 2, 3, 4] as PosIdx[]).filter((p) => !f.has(p));
}

// 챔피언 포지션 가중치: 2026 LCK 실제 기용(슬롯 순서) 비율, 기용이 없으면 일반 게임 기준 포지션(밴픽 사이트 데이터)
const POSW: Record<string, number[]> = {};
const META_POS: Record<string, number> = { T: 0, J: 1, M: 2, A: 3, S: 4 };
export function posWeight(c: Champ): number[] {
  if (POSW[c.id]) return POSW[c.id];
  const tot = c.proPos.reduce((a, b) => a + b, 0);
  let w = [0, 0, 0, 0, 0];
  if (tot >= 3) w = c.proPos.map((n) => n / tot);
  c.pos.forEach((p, i) => { const k = META_POS[p]; if (k !== undefined) w[k] = Math.max(w[k], i === 0 ? 0.6 : 0.3); });
  if (RANKED) for (let p = 0; p < 5; p++) { const l = RANKED.lane[`${p}|${c.id}`]; if (l && l[1] >= 300) w[p] = Math.max(w[p], 0.35); }
  if (RANKED) POSW[c.id] = w;
  return w;
}
export const playable = (c: Champ, p: number): boolean => posWeight(c)[p] >= 0.15;

// ---- 랭크 상성/시너지 (30판 이상만 저장됨). 보정 승률 = (승 + 0.5×200) / (판 + 200) ----
export const shrink = (w: number, n: number): number => (w + 100) / (n + 200);
export function rankedMu(pos: number, a: string, b: string): { wr: number; n: number } | null {
  if (!RANKED) return null;
  const k = a < b ? `${pos}|${a}|${b}` : `${pos}|${b}|${a}`;
  const x = RANKED.mu[k];
  if (!x) return null;
  return a < b ? { wr: x[0] / x[1], n: x[1] } : { wr: (x[1] - x[0]) / x[1], n: x[1] };
}
export function rankedSyn(pa: number, a: string, pb: number, b: string): { wr: number; n: number } | null {
  if (!RANKED) return null;
  const first = pa < pb || (pa === pb && a < b);
  const k = first ? `${pa}|${a}|${pb}|${b}` : `${pb}|${b}|${pa}|${a}`;
  const x = RANKED.syn[k];
  return x ? { wr: x[0] / x[1], n: x[1] } : null;
}
const pctS = (x: number): string => `${(x * 100).toFixed(1)}%`;
const POOLM = new Map<string, Map<string, [number, number]>>();
/** 챔피언 숙련: n = 2026 LCK 경기 수(base) + 연습 보정(bonus). 연습은 2일 = 1경기로 셉니다(경기 기록과 달리 승수는 없음). */
export const PRACTICE_PER_GAME = 2;
export function comfort(p: Player | undefined, c: string, practiceDays = 0): { n: number; w: number; base: number; bonus: number } {
  const bonus = Math.floor(Math.max(0, practiceDays) / PRACTICE_PER_GAME);
  if (!p) return { n: bonus, w: 0, base: 0, bonus };
  let m = POOLM.get(p.key);
  if (!m) { m = new Map(p.pool.map((x) => [x[0], [x[1], x[2]]])); POOLM.set(p.key, m); }
  const r = m.get(c);
  return r ? { n: r[0] + bonus, w: r[1], base: r[0], bonus } : { n: bonus, w: 0, base: 0, bonus };
}
export const practiceOf = (d: DraftState, key: string | undefined, c: string): number => (key ? d.practice?.[key]?.[c] ?? 0 : 0);
const STYM = new Map<string, Map<string, number>>();
function styleCount(team: string, kind: "picks" | "bans", c: string): number {
  const st = CORE.styles?.[team];
  if (!st) return 0;
  const k = team + kind; let m = STYM.get(k);
  if (!m) { m = new Map(st[kind] ?? []); STYM.set(k, m); }
  return m.get(c) ?? 0;
}
function styleGames(team: string): number { return CORE.styles?.[team]?.games ?? 0; }
const isFront = (c: Champ): boolean => c.u >= 3 || c.tags.includes("T");

function metaScore(c: Champ): Reason | null {
  if (!c.pro || c.pro.eb == null) return null;
  const v = (c.pro.eb - 0.5) * 10 + (c.pro.pr ?? 0) * 2.5;
  return { t: `LCK 2026 보정 승률 ${pctS(c.pro.eb)} · 픽 ${c.pro.p} 밴 ${c.pro.b}`, v };
}

export function recommend(d: DraftState, side: Side, kind: Kind, forcePos?: PosIdx | null): Rec[] {
  const avail = available(d);
  const team = d.teams[side]; const enemy = other(side); const eteam = d.teams[enemy];
  const out: Rec[] = [];
  if (kind === "pick") {
    const open = openPos(d, side);
    const own = d.picks[side];
    const ownC = own.map((p) => CH[p.c]);
    const front = ownC.some(isFront);
    const ap = ownC.filter((c) => c.dmg === "M").length; const ad = ownC.filter((c) => c.dmg === "P").length;
    for (const c of avail) {
      let best: Rec | null = null;
      for (const pos of open) {
        if (forcePos != null && pos !== forcePos) continue;
        const pw = posWeight(c)[pos];
        if (pw < 0.15) continue;
        const rs: Reason[] = [];
        const m = metaScore(c); if (m) rs.push(m); else rs.push({ t: "LCK 2026 표본 부족(픽 3회 미만)", v: -0.4 });
        const pl = PL[d.lineup[side]?.[pos]];
        if (!pl) continue;
        const cf = comfort(pl, c.id, practiceOf(d, pl.key, c.id));
        if (cf.n > 0) rs.push({ t: cf.bonus > 0 ? `${pl.name} 2026 LCK ${cf.base}경기 + 연습 ${cf.bonus}경기 상당` : `${pl.name} 2026 LCK ${cf.n}경기 ${cf.w}승`, v: Math.min(cf.n, 12) / 12 * 1.8 });
        else rs.push({ t: `${pl?.name ?? "선수"} 2026 LCK 기록 없음`, v: -0.5 });
        const sc = styleCount(team, "picks", c.id);
        if (sc > 0) rs.push({ t: `${team} 성향 픽 ${sc}회`, v: (sc / Math.max(1, styleGames(team))) * 5 });
        const opp = d.picks[enemy].find((p) => p.pos === pos);
        if (opp) {
          const mu = rankedMu(pos, c.id, opp.c);
          if (mu) rs.push({ t: `랭크 맞상대 vs ${CH[opp.c].ko} ${fmt(mu.n)}판 승률 ${pctS(mu.wr)}`, v: (shrink(mu.wr * mu.n, mu.n) - 0.5) * 14 });
        }
        for (const o of own) {
          const sy = rankedSyn(pos, c.id, o.pos, o.c);
          if (sy) rs.push({ t: `랭크 시너지 + ${CH[o.c].ko} ${fmt(sy.n)}판 승률 ${pctS(sy.wr)}`, v: (shrink(sy.wr * sy.n, sy.n) - 0.5) * 8 });
        }
        rs.push({ t: `${POS_KO[pos]} 기용 비율`, v: pw * 0.6 });
        if (!front && own.length >= 2 && isFront(c)) rs.push({ t: "앞라인 보강", v: 0.45 });
        if (ad >= 3 && c.dmg === "M") rs.push({ t: "마법 피해 보강", v: 0.35 });
        if (ap >= 3 && c.dmg === "P") rs.push({ t: "물리 피해 보강", v: 0.35 });
        const score = rs.reduce((a, r) => a + r.v, 0);
        if (!best || score > best.score) best = { c: c.id, pos, score, reasons: rs };
      }
      if (best) out.push(best);
    }
  } else {
    const eopen = openPos(d, enemy);
    for (const c of avail) {
      const rs: Reason[] = [];
      const m = metaScore(c); if (m) rs.push({ ...m, v: m.v * 0.9 });
      let bestCf: Reason | null = null;
      for (const pos of eopen) {
        if (!playable(c, pos)) continue;
        const pl = PL[d.lineup[enemy]?.[pos]]; if (!pl) continue; const cf = comfort(pl, c.id);
        if (cf.n >= 2) { const v = Math.min(cf.n, 12) / 12 * 1.6 + (cf.w / cf.n - 0.5) * 1.2; if (!bestCf || v > bestCf.v) bestCf = { t: `상대 ${pl.name} 2026 LCK ${cf.n}경기 ${cf.w}승`, v }; }
      }
      if (bestCf) rs.push(bestCf);
      if (!eopen.some((p) => playable(c, p))) rs.push({ t: "상대에게 남은 포지션과 맞지 않음", v: -2 });
      const ep = styleCount(eteam, "picks", c.id);
      if (ep > 0) rs.push({ t: `${eteam} 성향 픽 ${ep}회`, v: (ep / Math.max(1, styleGames(eteam))) * 4 });
      const ob = styleCount(team, "bans", c.id);
      if (ob > 0) rs.push({ t: `${team} 성향 밴 ${ob}회`, v: (ob / Math.max(1, styleGames(team))) * 3 });
      // 우리 픽의 랭크 천적 견제
      for (const o of d.picks[side]) {
        const mu = rankedMu(o.pos, c.id, o.c);
        if (mu && mu.wr > 0.52 && eopen.includes(o.pos)) rs.push({ t: `우리 ${CH[o.c].ko} 상대로 랭크 ${fmt(mu.n)}판 승률 ${pctS(mu.wr)}`, v: (shrink(mu.wr * mu.n, mu.n) - 0.5) * 12 });
      }
      out.push({ c: c.id, pos: null, score: rs.reduce((a, r) => a + r.v, 0), reasons: rs });
    }
  }
  return out.sort((a, b) => b.score - a.score);
}

// AI 선택: 점수 상위 후보 중 소프트맥스로 골라 매번 같은 수를 두지 않게 합니다(게임 규칙).
export function aiChoose(recs: Rec[], rng: Rng, temp = 0.45, k = 4): Rec | null {
  const top = recs.slice(0, k);
  if (!top.length) return null;
  const mx = top[0].score;
  const ws = top.map((r) => Math.exp((r.score - mx) / temp));
  let x = rng.next() * ws.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) { x -= ws[i]; if (x <= 0) return top[i]; }
  return top[0];
}

export function apply(d: DraftState, c: string, pos: PosIdx | null, by: "user" | "ai", why: string[]): DraftState {
  const t = turn(d); if (!t) return d;
  const n: DraftState = { ...d, bans: { B: [...d.bans.B], R: [...d.bans.R] }, picks: { B: [...d.picks.B], R: [...d.picks.R] }, log: [...d.log] };
  if (t.kind === "ban") n.bans[t.side].push(c);
  else {
    let p = pos;
    if (p == null || !openPos(d, t.side).includes(p)) {
      const ch = CH[c]; const w = posWeight(ch);
      p = openPos(d, t.side).sort((a, b) => w[b] - w[a])[0];
    }
    n.picks[t.side].push({ c, pos: p });
    pos = p;
  }
  n.log.push({ side: t.side, kind: t.kind, c, pos: pos ?? undefined, by, why });
  n.step = d.step + 1;
  return n;
}

export function aiStep(d: DraftState, rng: Rng): DraftState {
  const t = turn(d); if (!t) return d;
  let recs = recommend(d, t.side, t.kind);
  if (!recs.length && t.kind === "pick") { // 남은 포지션에 맞는 챔피언이 없을 때(극단적 피어리스): 아무 챔피언이나
    const pos = openPos(d, t.side)[0];
    const c = available(d)[0];
    return apply(d, c.id, pos, "ai", ["남은 포지션에 맞는 챔피언이 없어 임의 선택"]);
  }
  const r = aiChoose(recs, rng)!;
  recs = [];
  return apply(d, r.c, r.pos, "ai", r.reasons.filter((x) => x.v > 0.05).sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.t));
}
export function autoDraft(d: DraftState, rng: Rng): DraftState { let x = d; while (turn(x)) x = aiStep(x, rng); return x; }
