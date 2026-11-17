// 매치 시뮬: 경기 전 확률은 실제 데이터 요인(선수 지표, 팀 세트 승률, 랭크 상성, LCK 챔피언 지표, 진영)을 합해 만들고,
// 경기 진행(라인전·오브젝트·한타)은 그 확률을 바탕으로 한 난수 규칙입니다. 계수는 '게임 규칙'으로 데이터 출처·방법 페이지에 공개합니다.
import { CH, CORE, PL, TM, POS_KO, fmt } from "../data";
import type { PosIdx } from "../types";
import { DraftState, Side, comfort, rankedMu, rankedSyn, shrink, other } from "./draft";
import { Rng, sigmoid, logit } from "./rng";

export interface Factor { key: string; label: string; v: number; lines: string[] }
export interface GEvent { t: number; side?: Side; kind: "kill" | "drake" | "grub" | "herald" | "tower" | "baron" | "fight" | "lane" | "end" | "info"; text: string; lead?: number }
export interface Perf { key: string; side: Side; pos: PosIdx; c: string; k: number; d: number; a: number; lane: number; rating: number }
export interface GameResult {
  winner: Side; dur: number; kills: Record<Side, number>; gold15: number; lanes15: number[]; leadEnd: number;
  obj: Record<Side, { drake: number; baron: number; tower: number; grub: number; herald: number }>;
  events: GEvent[]; factors: Factor[]; pPre: number; pMid: number; perf: Perf[]; mvp: string;
}
export const COEF = { skill: 0.6, org: 0.5, comfortHi: 0.06, comfortStep: 0.006, comfortNone: -0.1, mu: 4, syn: 2, meta: 1, noFront: -0.15, oneDmg: -0.1, form: 0.3, laneZ: 1.0, laneMu: 10, laneBase: 300, laneNoise: 600, midGold: 3500, endGold: 2600, endL0: 0.5 };
export const BLUE_EDGE = (): number => Math.log(CORE.meta.blueWins / CORE.meta.redWins);
export const orgOf = (short: string): number => { const t = TM[short]; return logit((t.gw + 10) / (t.gw + t.gl + 20)); };
const pctS = (x: number): string => `${(x * 100).toFixed(1)}%`;

export function factorsFor(d: DraftState, form: Record<string, number>): Factor[] {
  const F: Factor[] = [];
  const pB = d.lineup.B.map((k) => PL[k]); const pR = d.lineup.R.map((k) => PL[k]);
  const mean = (a: number[]): number => a.reduce((x, y) => x + y, 0) / a.length;
  // 1 선수 기량
  {
    const who = (p: typeof pB[0]): string => `${p.label ?? p.name} ${p.pct.ovr} (${p.cardYear ? p.cardYear+" 카드 · " : ""}${p.games}경기${p.small ? "·표본 부족" : ""})`;
    const lines = [0, 1, 2, 3, 4].map((i) => `${POS_KO[i]} ${who(pB[i])} vs ${who(pR[i])}`);
    const anyCard = [...pB, ...pR].some((p) => p.cardYear);
    F.push({ key: "skill", label: anyCard ? "선수 지표 (시즌 카드·2026 LCK)" : "선수 지표 (2026 LCK)", v: COEF.skill * (mean(pB.map((p) => p.z.ovr)) - mean(pR.map((p) => p.z.ovr))), lines });
  }
  // 2 팀 경기력
  {
    const b = TM[d.teams.B], r = TM[d.teams.R];
    const rec = (x: typeof b): string => (x.gw + x.gl === 0 || x.founded) ? `${x.short} 신생·2026 세트 승률 기록 없음 (평균으로 반영)` : `${x.short} ${x.gw}승 ${x.gl}패`;
    F.push({ key: "org", label: "팀 세트 승률 (2026 LCK)", v: COEF.org * (orgOf(b.short) - orgOf(r.short)), lines: [`${rec(b)} · ${rec(r)} (보정: (승+10)/(경기+20))`] });
  }
  // 3 숙련도
  {
    let v = 0; const lines: string[] = [];
    for (const s of ["B", "R"] as Side[]) for (const pk of d.picks[s]) {
      const pl = PL[d.lineup[s][pk.pos]]; const cf = comfort(pl, pk.c);
      let x = 0;
      if (cf.n >= 5) x = COEF.comfortHi + Math.min(cf.n, 15) * COEF.comfortStep; else if (cf.n === 0) x = COEF.comfortNone;
      if (x !== 0) { v += s === "B" ? x : -x; lines.push(`${pl.name} ${CH[pk.c].ko}: 2026 LCK ${cf.n}경기${cf.n ? ` ${cf.w}승` : " (기록 없음)"}`); }
    }
    F.push({ key: "comfort", label: "챔피언 숙련도", v, lines });
  }
  // 4 랭크 상성·시너지
  {
    let v = 0; const lines: string[] = [];
    for (let pos = 0 as PosIdx; pos < 5; pos = (pos + 1) as PosIdx) {
      const b = d.picks.B.find((p) => p.pos === pos), r = d.picks.R.find((p) => p.pos === pos);
      if (!b || !r) continue;
      const mu = rankedMu(pos, b.c, r.c);
      if (mu) { v += (shrink(mu.wr * mu.n, mu.n) - 0.5) * COEF.mu; lines.push(`${POS_KO[pos]} ${CH[b.c].ko} vs ${CH[r.c].ko}: 랭크 ${fmt(mu.n)}판, ${CH[b.c].ko} 승률 ${pctS(mu.wr)}`); }
      else lines.push(`${POS_KO[pos]} ${CH[b.c].ko} vs ${CH[r.c].ko}: 랭크 30판 미만 (반영 안 함)`);
    }
    for (const s of ["B", "R"] as Side[]) {
      const ps = d.picks[s];
      for (let i = 0; i < ps.length; i++) for (let j = i + 1; j < ps.length; j++) {
        const sy = rankedSyn(ps[i].pos, ps[i].c, ps[j].pos, ps[j].c);
        if (sy) { const x = (shrink(sy.wr * sy.n, sy.n) - 0.5) * COEF.syn; v += s === "B" ? x : -x; if (Math.abs(sy.wr - 0.5) >= 0.03) lines.push(`${TM[d.teams[s]].short} 시너지 ${CH[ps[i].c].ko}+${CH[ps[j].c].ko}: 랭크 ${fmt(sy.n)}판 승률 ${pctS(sy.wr)}`); }
      }
    }
    F.push({ key: "mu", label: "밴픽 상성·시너지 (랭크 30판+)", v, lines });
  }
  // 5 챔피언 메타
  {
    let v = 0; const lines: string[] = [];
    for (const s of ["B", "R"] as Side[]) for (const pk of d.picks[s]) {
      const c = CH[pk.c];
      if (c.pro && c.pro.eb != null) { const x = (c.pro.eb - 0.5) * COEF.meta; v += s === "B" ? x : -x; if (Math.abs(c.pro.eb - 0.5) >= 0.015) lines.push(`${c.ko}: LCK 2026 보정 승률 ${pctS(c.pro.eb)} (픽 ${c.pro.p})`); }
    }
    F.push({ key: "meta", label: "LCK 2026 챔피언 지표", v, lines });
  }
  // 6 조합
  {
    let v = 0; const lines: string[] = [];
    for (const s of ["B", "R"] as Side[]) {
      const cs = d.picks[s].map((p) => CH[p.c]);
      const sign = s === "B" ? 1 : -1;
      if (!cs.some((c) => c.u >= 3 || c.tags.includes("T"))) { v += sign * COEF.noFront; lines.push(`${TM[d.teams[s]].short}: 앞라인 챔피언 없음`); }
      const ap = cs.filter((c) => c.dmg === "M").length, ad = cs.filter((c) => c.dmg === "P").length;
      if (ap >= 4 || ad >= 4) { v += sign * COEF.oneDmg; lines.push(`${TM[d.teams[s]].short}: ${ap >= 4 ? "마법" : "물리"} 피해에 치우침`); }
    }
    F.push({ key: "comp", label: "조합 균형 (게임 규칙)", v, lines });
  }
  // 7 진영
  F.push({ key: "side", label: "진영", v: BLUE_EDGE(), lines: [`2026 LCK 블루 ${CORE.meta.blueWins}승 · 레드 ${CORE.meta.redWins}승 (${CORE.meta.games}경기)`] });
  // 8 폼
  {
    const fb = mean(d.lineup.B.map((k) => form[k] ?? 0)), fr = mean(d.lineup.R.map((k) => form[k] ?? 0));
    F.push({ key: "form", label: "최근 폼 (이번 커리어 경기)", v: COEF.form * (fb - fr), lines: [`${d.teams.B} ${fb >= 0 ? "+" : ""}${fb.toFixed(2)} · ${d.teams.R} ${fr >= 0 ? "+" : ""}${fr.toFixed(2)} (최근 3경기 평점 기준)`] });
  }
  return F;
}

const ROLE_K = [0.18, 0.2, 0.26, 0.3, 0.06];
export function simulateGame(d: DraftState, form: Record<string, number>, rng: Rng): GameResult {
  const factors = factorsFor(d, form);
  const L0 = factors.reduce((a, f) => a + f.v, 0);
  const pPre = sigmoid(L0);
  const ev: GEvent[] = [];
  const obj = { B: { drake: 0, baron: 0, tower: 0, grub: 0, herald: 0 }, R: { drake: 0, baron: 0, tower: 0, grub: 0, herald: 0 } };
  const kills = { B: 0, R: 0 };
  const T = (s: Side): string => d.teams[s];
  const pick = (p: number): Side => (rng.chance(p) ? "B" : "R");
  // 라인전
  const lanes15: number[] = [];
  for (let pos = 0; pos < 5; pos++) {
    const b = d.picks.B.find((p) => p.pos === pos)!, r = d.picks.R.find((p) => p.pos === pos)!;
    const zb = PL[d.lineup.B[pos]].z.lane, zr = PL[d.lineup.R[pos]].z.lane;
    const mu = rankedMu(pos, b.c, r.c);
    const edge = COEF.laneZ * (zb - zr) + (mu ? (shrink(mu.wr * mu.n, mu.n) - 0.5) * COEF.laneMu : 0) + L0 * 0.3;
    lanes15.push(Math.round(COEF.laneBase * edge + rng.normal() * COEF.laneNoise));
  }
  let lead = lanes15.reduce((a, b) => a + b, 0);
  const fb = pick(sigmoid(L0 * 0.6 + rng.normal() * 0.3));
  kills[fb] += 1;
  const fbPos = rng.pick([0, 1, 2, 3]);
  ev.push({ t: rng.int(3, 6), side: fb, kind: "kill", text: `${T(fb)} ${PL[d.lineup[fb][fbPos]].name}(${CH[d.picks[fb].find((p) => p.pos === fbPos)!.c].ko}) 퍼스트 블러드` });
  const g1 = pick(sigmoid(L0 * 0.5 + lanes15[1] / 900)); const gn = rng.chance(0.5) ? 3 : 2;
  obj[g1].grub += gn; obj[other(g1)].grub += 3 - gn;
  ev.push({ t: 7, side: g1, kind: "grub", text: `공허 유충: ${T(g1)} ${gn}마리${gn < 3 ? `, ${T(other(g1))} ${3 - gn}마리` : ""}` });
  const dr1 = pick(sigmoid(L0 * 0.5 + (lanes15[3] + lanes15[4] + lanes15[1]) / 1800));
  obj[dr1].drake++;
  ev.push({ t: rng.int(6, 8), side: dr1, kind: "drake", text: `첫 드래곤 ${T(dr1)}` });
  const extra = Math.round(rng.normal() * 2);
  kills.B += Math.max(0, 2 + extra + (lanes15.reduce((a, b) => a + b, 0) > 0 ? 1 : 0)); kills.R += Math.max(0, 2 - extra + (lanes15.reduce((a, b) => a + b, 0) < 0 ? 1 : 0));
  const big = lanes15.map((g, i) => [g, i] as [number, number]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]))[0];
  const ls: Side = big[0] >= 0 ? "B" : "R";
  ev.push({ t: 14, kind: "lane", side: lead >= 0 ? "B" : "R", lead, text: `라인전 종료(14분): 골드 ${lead >= 0 ? T("B") : T("R")} +${fmt(Math.abs(lead))}. 가장 큰 차이는 ${POS_KO[big[1]]} (${T(ls)} +${fmt(Math.abs(big[0]))})` });
  const gold15 = lead;
  // 중반
  const pMid = sigmoid(L0 * 0.75 + lead / COEF.midGold);
  const tw = pick(pMid); obj[tw].tower++;
  ev.push({ t: rng.int(13, 16), side: tw, kind: "tower", text: `${T(tw)} 첫 포탑 파괴` });
  lead += tw === "B" ? 500 : -500;
  const hr = pick(pMid); obj[hr].herald++;
  ev.push({ t: 16, side: hr, kind: "herald", text: `협곡의 전령 ${T(hr)}` });
  const dr2 = pick(pMid); obj[dr2].drake++;
  ev.push({ t: rng.int(12, 14), side: dr2, kind: "drake", text: `두 번째 드래곤 ${T(dr2)}` });
  const f1 = pick(sigmoid(L0 * 0.7 + lead / COEF.midGold + rng.normal() * 0.35));
  const f1k = rng.int(2, 4), f1d = rng.int(0, 2);
  kills[f1] += f1k; kills[other(f1)] += f1d; lead += (f1 === "B" ? 1 : -1) * (f1k - f1d) * 350 + (f1 === "B" ? 600 : -600);
  ev.push({ t: rng.int(19, 22), side: f1, kind: "fight", lead, text: `드래곤 앞 한타 ${T(f1)} 승리 (${f1k}:${f1d})` });
  const dr3 = pick(sigmoid(L0 * 0.6 + lead / COEF.midGold)); obj[dr3].drake++;
  ev.push({ t: rng.int(19, 21) + 2, side: dr3, kind: "drake", text: `세 번째 드래곤 ${T(dr3)}` });
  // 승자 결정
  const pEnd = sigmoid(COEF.endL0 * L0 + lead / COEF.endGold);
  const W: Side = rng.chance(pEnd) ? "B" : "R"; const Lz = other(W);
  const behind = (W === "B" && lead < 0) || (W === "R" && lead > 0);
  if (behind) {
    const k2 = rng.int(3, 5); kills[W] += k2; kills[Lz] += rng.int(0, 2);
    lead = (W === "B" ? 1 : -1) * rng.int(500, 2500);
    ev.push({ t: rng.int(24, 28), side: W, kind: "fight", lead, text: `${T(W)} 역전 한타 (${k2}킬) — 바론 둥지 앞에서 흐름을 뒤집었습니다` });
  }
  const bt = rng.int(25, 31);
  const bW = rng.chance(0.82) ? W : Lz; obj[bW].baron++;
  ev.push({ t: bt, side: bW, kind: "baron", text: `내셔 남작 ${T(bW)}` });
  if (bW === W) lead += W === "B" ? 1500 : -1500;
  const dr4 = rng.chance(0.7) ? W : Lz; obj[dr4].drake++;
  ev.push({ t: bt - rng.int(1, 4), side: dr4, kind: "drake", text: `네 번째 드래곤 ${T(dr4)}${obj[dr4].drake >= 4 ? " — 드래곤의 영혼" : ""}` });
  const towers = rng.int(6, 10); obj[W].tower = Math.max(obj[W].tower, towers); obj[Lz].tower = Math.max(obj[Lz].tower, rng.int(1, 5));
  const fk = rng.int(3, 5); kills[W] += fk; kills[Lz] += rng.int(0, 2);
  const dur = Math.max(bt + 2, Math.round(37 - Math.abs(lead) / 1200 + rng.normal() * 2.5));
  ev.push({ t: dur - 1, side: W, kind: "fight", text: `${T(W)} 마지막 한타 승리 (${fk}킬)` });
  ev.push({ t: dur, side: W, kind: "end", text: `${T(W)} 넥서스 파괴 — ${dur}분 승리` });
  ev.sort((a, b) => a.t - b.t);
  // 선수 기록 (경기 결과에 맞춰 나눈 규칙 값)
  const perf: Perf[] = [];
  for (const s of ["B", "R"] as Side[]) {
    const tk = kills[s], ok = kills[other(s)];
    const ws = s === W;
    const ks = ROLE_K.map((w) => w * (0.7 + rng.next() * 0.6)); const tot = ks.reduce((a, b) => a + b, 0);
    let rem = tk; const kk = ks.map((x, i) => (i === 4 ? 0 : Math.floor((x / tot) * tk)));
    rem -= kk.reduce((a, b) => a + b, 0); kk[rng.int(0, 3)] += rem;
    const dd = [0, 0, 0, 0, 0]; for (let i = 0; i < ok; i++) dd[rng.int(0, 4)]++;
    for (let i = 0; i < 5; i++) {
      const pk = d.picks[s].find((p) => p.pos === i)!;
      const a = Math.round(tk * (i === 4 || i === 1 ? 0.65 : 0.45) * (0.8 + rng.next() * 0.4));
      const laneG = (s === "B" ? 1 : -1) * lanes15[i];
      const rating = Math.max(3, Math.min(10, 6.2 + (ws ? 0.6 : -0.5) + laneG / 1300 + kk[i] * 0.12 + a * 0.04 - dd[i] * 0.18 + rng.normal() * 0.25));
      perf.push({ key: d.lineup[s][i], side: s, pos: i as PosIdx, c: pk.c, k: kk[i], d: dd[i], a, lane: laneG, rating: Math.round(rating * 10) / 10 });
    }
  }
  const mvp = perf.filter((p) => p.side === W).sort((a, b) => b.rating - a.rating)[0].key;
  return { winner: W, dur, kills, gold15, lanes15, leadEnd: lead, obj, events: ev, factors, pPre, pMid, perf, mvp };
}
