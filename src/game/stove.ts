// 스토브리그 본편: 시상 → 트라이아웃 → 계약 만료 → 주간 밀봉 입찰·이적·루머
import { CARDS, PL, TM, cardLabel } from "../data";
import type { SeasonCard } from "../types";
import { Rng } from "./rng";
import type { Save } from "./season";
import { addNews, standings } from "./season";
import {
  cardForYear, debutYear, ensurePlayer, marketCards, storySalary, cmpStr, cmpCard,
  teamPower, finishStove as rollYear, registerOffseason, currentLeague,
  resolveFranchise, pumpStory, CK_OPS, LCK_OPS, LCK_SHARE, LCK_SHARE_PRE, LCK_SPONSOR,
  payrollSoftCap, upcomingSalaryDue, RELEASE_OVR, REPLACE_OVR,
  fmtMoney, lckPrizeOf, scaleLckIncome, ensureStartingFive,
  type Contract, type Tier,
} from "./story";
import { moneyRound } from "./money";

export type Bonus = { lck?: number; intl?: number; mvp?: number; callup?: boolean; cut?: number };
export interface Bid {
  team: string; person: string; cardId: string; salary: number; years: number;
  starter: boolean; bonuses: Bonus; kind: "tryout" | "fa" | "transfer";
}
export interface BidResult {
  person: string; name: string; winner?: string; salary?: number; years?: number;
  reason: string; rejected: { team: string; why: string }[];
}
export interface IncomingBid {
  id: string; from: string; person: string; key: string; fee: number; salary: number;
  years: number; stance: string; expireWeek: number; status: "open" | "accepted" | "rejected" | "expired";
}
export interface TransferOffer {
  person: string; from: string; cardId: string; fee: number; step: 1 | 2; salary?: number; years?: number; starter?: boolean;
}
export interface Rumor { id: number; text: string; true: boolean; person: string; team: string }
export interface AwardRow { pos: number; first?: { key: string; name: string; team: string; note: string }; second?: { key: string; name: string; team: string; note: string } }
export interface StoveState {
  week: number; // stove week, 1 = 협상만
  maxWeek: number;
  awards: AwardRow[];
  tryoutPool: string[]; // card ids
  tryoutOffers: Bid[];
  tryoutResults?: BidResult[];
  expiryKeys: string[];
  expiryDecided: Record<string, "resign" | "release">;
  faPool: string[]; // card ids available
  pendingBids: Bid[];
  weekResults?: BidResult[];
  incoming: IncomingBid[];
  rumors: Rumor[];
  ourTransfer?: TransferOffer;
  transfersOn: boolean;
  aiContracts: Record<string, Contract[]>;
  closed?: boolean;
}

export const TRYOUT_MAX = 3;
export const STOVE_WEEKS = 5;

export function stoveOf(s: Save): StoveState | undefined { return s.story?.stove; }

export function prestige(s: Save, team: string): number {
  const st = s.story!;
  const lck = st.lck.includes(team);
  let p = lck ? 56 : 32;
  if (team === s.team) {
    p += st.trophies.lck * 8 + st.trophies.worlds * 14 + st.trophies.msi * 6;
    p += Math.max(0, (s.eco.trust - 50) / 5);
  } else {
    p += teamPower(team) / 8;
  }
  const rows = standings(s);
  const rk = rows.findIndex((r) => r.t === team);
  if (rk >= 0) p += Math.max(0, 12 - rk * 1.2);
  return Math.max(15, Math.min(100, p));
}

function topPowerTeams(s: Save, n = 5): string[] {
  const st = s.story!;
  return [...st.lck, ...st.ck].sort((a, b) => teamPower(b) - teamPower(a) || cmpStr(a, b)).slice(0, n);
}

function contractAsk(card: SeasonCard, tier: Tier): number {
  return storySalary(card, tier);
}

function bonusVal(b: Bonus): number {
  return (b.lck ?? 0) + (b.intl ?? 0) + (b.mvp ?? 0) + (b.callup ? 0.3 : 0) - (b.cut ?? 0);
}

/** 구단 명성·주전·돈으로 한 팀을 고릅니다. */
export function chooseTeam(s: Save, person: string, offers: Bid[], rng: Rng): BidResult {
  const name = CARDS[offers[0]?.cardId]?.name ?? PL[offers.find((o) => o.person === person)?.cardId ?? ""]?.name ?? person;
  if (!offers.length) return { person, name, reason: "제안이 없었습니다.", rejected: [] };
  const strong = new Set(topPowerTeams(s, 5));
  const scored = offers.map((o) => {
    const card = CARDS[o.cardId];
    const ask = card ? contractAsk(card, s.story!.lck.includes(o.team) ? "LCK" : "CK") : o.salary;
    const pr = prestige(s, o.team);
    const money = o.salary + bonusVal(o.bonuses);
    let score = pr * 0.5 + (o.starter ? 22 : 6) + Math.min(40, money * 2);
    let why = "";
    if (strong.has(o.team) && o.salary + 1e-6 >= ask * 0.85) {
      score += 14;
      why = "육성보다 안정 — 강팀의 제안이라 최저연봉이어도 좋다고 봤습니다";
    }
    if (o.starter) { score += 8; if (!why) why = "주전 자리가 비어 있던 팀으로 갔습니다"; }
    if (pr >= 62 && !why) why = "구단 명성을 우선시한 선택입니다";
    if (money >= ask * 1.15 && !why) why = "연봉 조건을 우선시한 선택입니다";
    if (!strong.has(o.team) && money < ask) score -= 18;
    if (!why) why = "조건이 가장 균형 있다고 판단했습니다";
    return { o, score: score + rng.next() * 4, why };
  });
  scored.sort((a, b) => b.score - a.score || cmpStr(a.o.team, b.o.team));
  const win = scored[0];
  const rejected = scored.slice(1).map((x) => {
    let why = "다른 팀의 조건이 더 맞았습니다";
    if (prestige(s, win.o.team) - prestige(s, x.o.team) >= 8) why = "구단 명성을 우선시한 선택입니다";
    else if (win.o.starter && !x.o.starter) why = "주전 자리를 우선했습니다";
    else if (win.o.salary > x.o.salary + 0.5) why = "연봉 조건을 우선했습니다";
    if (!topPowerTeams(s, 5).includes(x.o.team) && x.o.salary < (CARDS[x.o.cardId] ? contractAsk(CARDS[x.o.cardId], "CK") : x.o.salary)) {
      why = "약팀 제안은 더 높은 연봉과 보너스가 필요했습니다";
    }
    return { team: x.o.team, why };
  });
  return { person, name, winner: win.o.team, salary: win.o.salary, years: win.o.years, reason: win.why, rejected };
}

function allTeams(s: Save): string[] { const st = s.story!; return [...st.lck, ...st.ck]; }

function usedPeople(s: Save, stove: StoveState): Set<string> {
  const u = new Set<string>();
  for (const c of s.story!.contracts) u.add(c.person);
  for (const list of Object.values(stove.aiContracts)) for (const c of list) u.add(c.person);
  return u;
}

function initAiContracts(s: Save): Record<string, Contract[]> {
  const out: Record<string, Contract[]> = {};
  const year = s.story!.year;
  for (const t of allTeams(s)) {
    if (t === s.team) continue;
    const keys = s.starters[t] ?? [];
    out[t] = keys.filter(Boolean).map((k) => {
      const p = PL[k]; const pkey = p?.personKey ?? k;
      const r = cardForYear(pkey, year, p?.pos);
      return { key: k, cardId: r?.card.id ?? k, years: 1 + (hash(k + t) % 3), salary: r ? storySalary(r.card, s.story!.lck.includes(t) ? "LCK" : "CK") : 0.35, person: pkey };
    });
  }
  return out;
}
function hash(s: string): number { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); }

function recNote(key: string): string {
  const p = PL[key];
  if (!p) return "기록 없음";
  const bits: string[] = [];
  if (p.games) bits.push(`${p.games}경기`);
  if (p.pct?.ovr) bits.push(`퍼센타일 ${p.pct.ovr}`);
  if (p.small) bits.push("표본 부족");
  return bits.join(" · ") || "기록 없음";
}

function buildAwards(s: Save): AwardRow[] {
  const rows: AwardRow[] = [];
  const league = currentLeague(s);
  for (let pos = 0; pos < 5; pos++) {
    const cands: { key: string; name: string; team: string; score: number; note: string }[] = [];
    for (const t of league) {
      const k = s.starters[t]?.[pos]; if (!k) continue;
      const p = PL[k]; if (!p) continue;
      const st = s.pstats[k];
      const score = st && st.g > 0 ? st.rsum / st.g + st.mvp * 0.3 + (st.w / st.g) : (p.pct.ovr ?? 50) / 20;
      cands.push({ key: k, name: p.label ?? p.name, team: t, score, note: recNote(k) });
    }
    cands.sort((a, b) => b.score - a.score || cmpStr(a.key, b.key));
    rows.push({ pos, first: cands[0], second: cands[1] });
  }
  return rows;
}

function tryoutPool(s: Save, stove: StoveState): string[] {
  const year = Math.min(s.story!.year + 1, 2026);
  const used = usedPeople(s, stove);
  const ids: string[] = [];
  for (const c of marketCards(year)) {
    if (used.has(c.pkey)) continue;
    const debut = debutYear(c.pkey) ?? c.year;
    // 데뷔가 가깝거나 상대적으로 낮은 연봉의 신인·비주전
    if (debut > year) continue;
    if (c.year < year - 3 && c.percentile > 70) continue;
    if (debut >= year - 2 || c.salary <= 8) ids.push(c.id);
  }
  return ids.sort((a, b) => (debutYear(CARDS[a].pkey) ?? 99) - (debutYear(CARDS[b].pkey) ?? 99) || CARDS[a].salary - CARDS[b].salary || cmpStr(a, b)).slice(0, 24);
}

function faPool(s: Save, stove: StoveState): string[] {
  const year = Math.min(s.story!.year + 1, 2026);
  const used = usedPeople(s, stove);
  const best = new Map<string, SeasonCard>();
  for (const c of marketCards(year)) {
    if (used.has(c.pkey)) continue;
    const k = c.pkey;
    const prev = best.get(k);
    if (!prev || c.year > prev.year || (c.year === prev.year && c.games > prev.games)) best.set(k, c);
  }
  return [...best.values()].sort((a, b) => b.percentile - a.percentile || cmpCard(a, b)).map((c) => c.id);
}

export function payIncome(s: Save): void {
  const st = s.story!;
  if (st.tier === "LCK") scaleLckIncome(s);
  const rows = standings(s);
  const fromTable = rows.findIndex((r) => r.t === s.team) + 1;
  const rank = st.lastRank || fromTable;
  const prize = st.tier === "LCK"
    ? lckPrizeOf(rank)
    : ([0.7, 0.45, 0.3, 0.15][Math.min(Math.max((rank || 4) - 1, 0), 3)]);
  const share = st.tier === "LCK" ? (st.franchised ? LCK_SHARE : LCK_SHARE_PRE) : 0;
  const sp = s.eco.sponsor?.amount ?? (st.tier === "LCK" ? LCK_SPONSOR : 0.5);
  const ops = st.tier === "CK" ? CK_OPS : LCK_OPS;
  s.eco.cash = moneyRound(s.eco.cash + prize + share + sp - ops);
  const opsTxt = `, 운영비 −${fmtMoney(ops)}`;
  addNews(s, "season", `${st.year} 시즌 수입`,
    `성적 ${fmtMoney(prize)}(${rank || "?"}위), 스폰서 ${fmtMoney(sp)}${share ? `, ${st.franchised ? "프랜차이즈" : "LCK 중계"} 배분 ${fmtMoney(share)}` : ""}${opsTxt}. 잔고 ${fmtMoney(s.eco.cash)}(게임용 가상 금액).`, s.team);
}

export function beginOffseason(s: Save): void {
  const st = s.story!;
  payIncome(s);
  for (const c of s.story!.contracts) c.years -= 1;
  const stove: StoveState = {
    week: 0, maxWeek: STOVE_WEEKS, awards: [], tryoutPool: [], tryoutOffers: [],
    expiryKeys: [], expiryDecided: {}, faPool: [], pendingBids: [], incoming: [], rumors: [],
    transfersOn: true, aiContracts: {},
  };
  stove.aiContracts = initAiContracts(s);
  stove.awards = buildAwards(s);
  stove.tryoutPool = tryoutPool(s, stove);
  stove.expiryKeys = st.contracts.filter((c) => c.years <= 0).map((c) => c.key);
  st.stove = stove;
  st.phase = "awards";
  addNews(s, "season", `LCK AWARDS ${st.year} · 시즌 결산 시상식`, "포지션별 1팀·2팀을 발표합니다. 표본이 적은 선수는 ‘표본 부족’으로 표시합니다.", s.team);
}

export function awardsDone(s: Save): void {
  const st = s.story!; const stove = st.stove!;
  st.phase = "tryout";
  addNews(s, "season", "트라이아웃 개막", `신인·비주전 후보 ${stove.tryoutPool.length}명. 팀마다 제안은 최대 ${TRYOUT_MAX}명, 계약 2년. 트라이아웃 기간의 FA 제안은 주가 끝날 때 한꺼번에 결과가 납니다. 보너스 조항을 걸 수 있습니다.`, s.team);
}

export function placeTryoutOffer(s: Save, bid: Bid): string | null {
  const stove = s.story!.stove!;
  if (stove.tryoutOffers.filter((o) => o.team === s.team).length >= TRYOUT_MAX && !stove.tryoutOffers.some((o) => o.team === s.team && o.person === bid.person)) {
    return `트라이아웃 제안은 최대 ${TRYOUT_MAX}명입니다.`;
  }
  if (s.eco.cash < bid.salary) return "자금이 부족합니다.";
  stove.tryoutOffers = stove.tryoutOffers.filter((o) => !(o.team === s.team && o.person === bid.person));
  stove.tryoutOffers.push({ ...bid, team: s.team, kind: "tryout", years: 2 });
  return null;
}

function aiTryoutOffers(s: Save, rng: Rng): void {
  const stove = s.story!.stove!;
  const pool = stove.tryoutPool.map((id) => CARDS[id]).filter(Boolean);
  for (const t of allTeams(s)) {
    if (t === s.team) continue;
    const n = 1 + (hash(t + String(s.story!.year)) % 3);
    const picks = rng.shuffle(pool).slice(0, n);
    for (const c of picks) {
      const tier: Tier = s.story!.lck.includes(t) ? "LCK" : "CK";
      const ask = moneyRound(Math.max(0.2, contractAsk(c, tier) * 0.9));
      stove.tryoutOffers.push({
        team: t, person: c.pkey, cardId: c.id, salary: Math.round(ask * 10) / 10, years: 2,
        starter: false, bonuses: rng.chance(0.35) ? { callup: true } : {}, kind: "tryout",
      });
    }
  }
}

export function resolveTryout(s: Save, rng: Rng): void {
  const stove = s.story!.stove!;
  aiTryoutOffers(s, rng);
  const byP = new Map<string, Bid[]>();
  for (const o of stove.tryoutOffers) {
    const arr = byP.get(o.person) ?? []; arr.push(o); byP.set(o.person, arr);
  }
  const results: BidResult[] = [];
  for (const person of [...byP.keys()].sort(cmpStr)) {
    const offers = byP.get(person)!;
    const r = chooseTeam(s, person, offers, rng);
    results.push(r);
    if (r.winner) signToTeam(s, r.winner, offers.find((o) => o.team === r.winner)!, rng);
  }
  stove.tryoutResults = results;
  const ours = results.filter((r) => r.winner === s.team);
  addNews(s, "season", "트라이아웃 주간 결과", ours.length ? `우리 구단이 ${ours.map((r) => r.name).join(", ")} 선수와 계약했습니다.` : "우리 구단의 제안은 받아들여지지 않았습니다. 강팀·명성을 우선하는 경우가 많습니다.", s.team);
}

function signToTeam(s: Save, team: string, bid: Bid, _rng: Rng): void {
  const st = s.story!; const stove = st.stove!;
  const year = Math.min(st.year + 1, 2026);
  const r = cardForYear(bid.person, year);
  const card = r?.card ?? CARDS[bid.cardId];
  if (!card) return;
  const key = ensurePlayer(card, year, r?.estimated ?? false);
  const ct: Contract = { key, cardId: card.id, years: bid.years, salary: bid.salary, person: bid.person, prepaid: team === s.team };
  if (team === s.team) {
    if (s.eco.cash + 1e-9 < bid.salary) return;
    s.eco.cash = moneyRound(s.eco.cash - bid.salary);
    const pos = card.posIdx;
    const cur = [...(s.starters[team] ?? ["", "", "", "", ""])];
    while (cur.length < 5) cur.push("");
    if (bid.starter && cur[pos] && PL[cur[pos]]?.personKey !== bid.person) {
      const oldK = cur[pos];
      st.contracts = st.contracts.filter((c) => c.key !== oldK);
      s.cards = s.cards.filter((id) => id !== oldK);
    }
    st.contracts.push(ct);
    s.cards = [...new Set([...s.cards, key, card.id])];
    if (bid.starter || !cur[pos]) cur[pos] = key;
    s.starters[team] = cur;
  } else {
    (stove.aiContracts[team] ??= []).push(ct);
    const cur = [...(s.starters[team] ?? ["", "", "", "", ""])];
    while (cur.length < 5) cur.push("");
    if (bid.starter || !cur[card.posIdx]) cur[card.posIdx] = key;
    s.starters[team] = cur;
  }
  stove.faPool = stove.faPool.filter((id) => CARDS[id]?.pkey !== bid.person);
  stove.tryoutPool = stove.tryoutPool.filter((id) => CARDS[id]?.pkey !== bid.person);
}

export function tryoutDone(s: Save): void {
  const st = s.story!;
  st.phase = "expiry";
  const stove = st.stove!;
  if (!stove.expiryKeys.length) {
    // nothing to decide
  }
  addNews(s, "season", "계약 만료", stove.expiryKeys.length ? "만료 선수마다 재계약 또는 방출을 정해 주세요. 전원 결정해야 스토브리그로 넘어갑니다." : "올해 만료되는 우리 선수는 없습니다.", s.team);
}

export function decideExpiry(s: Save, key: string, how: "resign" | "release", salary?: number, years?: number): string | null {
  const st = s.story!; const stove = st.stove!;
  const ct = st.contracts.find((c) => c.key === key);
  if (!ct) return "계약을 찾을 수 없습니다.";
  if (how === "resign") {
    const pay = salary ?? ct.salary;
    ct.years = years ?? 2;
    ct.salary = pay;
    // 연봉은 다음 시즌 개막에 정산합니다.
  }
  stove.expiryDecided[key] = how;
  return null;
}

export function expiryDone(s: Save, rng: Rng): void {
  const st = s.story!; const stove = st.stove!;
  for (const key of stove.expiryKeys) {
    if (stove.expiryDecided[key] === "release") {
      const ct = st.contracts.find((c) => c.key === key);
      st.contracts = st.contracts.filter((c) => c.key !== key);
      s.starters[s.team] = (s.starters[s.team] ?? []).map((k) => k === key ? "" : k);
      s.cards = s.cards.filter((id) => id !== key && id !== ct?.cardId);
      if (ct) {
        const r = cardForYear(ct.person, Math.min(st.year + 1, 2026));
        if (r) stove.faPool.push(r.card.id);
      }
    } else if (!stove.expiryDecided[key]) {
      // 미결정이면 아직 못 넘어감
      return;
    }
  }
  // AI expiry: some released to FA
  for (const t of Object.keys(stove.aiContracts).sort(cmpStr)) {
    const list = stove.aiContracts[t];
    const keep: Contract[] = [];
    for (const c of list) {
      if (c.years <= 1 && hash(c.key + t) % 3 === 0) {
        const r = cardForYear(c.person, Math.min(st.year + 1, 2026));
        if (r) stove.faPool.push(r.card.id);
        s.starters[t] = (s.starters[t] ?? []).map((k) => k === c.key ? "" : k);
      } else keep.push(c);
    }
    stove.aiContracts[t] = keep;
  }
  stove.faPool = [...new Set([...stove.faPool, ...faPool(s, stove)])];
  if (st.year === 2020 && !st.franchised && !st.buyInOffered) {
    st.phase = "franchise";
    addNews(s, "season", "2021 프랜차이즈 전환", "스토브 입찰에 앞서 프랜차이즈 전환을 결정해 주세요.", s.team);
    return;
  }
  enterStoveWeeks(s, rng);
}

export function enterStoveWeeks(s: Save, rng: Rng): void {
  const st = s.story!; const stove = st.stove!;
  st.phase = "stove";
  stove.week = stove.week >= 2 ? stove.week : 1;
  genRumors(s, rng);
  genIncoming(s, rng);
  addNews(s, "season", "스토브리그 1주차", "1주차는 협상 기간입니다 — 계약은 2주차부터 가능합니다. 제안은 주가 끝날 때 다른 구단 제안과 함께 선수가 보고 한 팀을 고릅니다. 먼저 누른다고 먼저 데려오는 게 아닙니다.", s.team);
}

export function canBidNow(s: Save): boolean {
  const stove = s.story?.stove; if (!stove) return false;
  return s.story!.phase === "stove" && stove.week >= 2;
}

export function placeFaBid(s: Save, bid: Bid): string | null {
  const stove = s.story!.stove!;
  if (!canBidNow(s)) return "1주차는 협상만 가능합니다. 계약 제안은 2주차부터입니다.";
  const reserved = stove.pendingBids.filter((o) => o.team === s.team && o.person !== bid.person).reduce((n, o) => n + o.salary, 0);
  if (s.eco.cash < reserved + bid.salary) return "자금이 부족합니다. 이번 주 다른 입찰과 합치면 잔고를 넘습니다.";
  if (!stove.faPool.includes(bid.cardId) && !stove.faPool.some((id) => CARDS[id]?.pkey === bid.person)) return "이 선수는 이번 FA 풀에 없습니다.";
  stove.pendingBids = stove.pendingBids.filter((o) => !(o.team === s.team && o.person === bid.person));
  stove.pendingBids.push({ ...bid, team: s.team, kind: "fa" });
  return null;
}

function aiFaBids(s: Save, rng: Rng): Bid[] {
  const stove = s.story!.stove!;
  const out: Bid[] = [];
  const pool = stove.faPool.map((id) => CARDS[id]).filter(Boolean);
  for (const t of allTeams(s)) {
    if (t === s.team) continue;
    const holes = [0, 1, 2, 3, 4].filter((i) => !s.starters[t]?.[i]);
    const need = holes.length ? holes : [];
    const tier0: Tier = s.story!.lck.includes(t) ? "LCK" : "CK";
    const existingPay = (stove.aiContracts[t] ?? []).reduce((n, c) => n + c.salary, 0);
    const cap = payrollSoftCap(s, tier0);
    const roomPay = Math.max(0, cap - existingPay);
    const budget = Math.min(8 + teamPower(t) / 10, roomPay || 8 + teamPower(t) / 10);
    let spent = 0;
    const want = rng.shuffle(pool).sort((a, b) => {
      const ha = need.includes(a.posIdx) ? -50 : 0;
      const hb = need.includes(b.posIdx) ? -50 : 0;
      return (b.percentile + ha) - (a.percentile + hb) || cmpCard(a, b);
    }).slice(0, 2 + (holes.length ? 1 : 0));
    for (const c of want) {
      const tier: Tier = s.story!.lck.includes(t) ? "LCK" : "CK";
      const ask = contractAsk(c, tier);
      if (spent + ask > budget) continue;
      if (existingPay + spent + ask > cap && !need.includes(c.posIdx)) continue;
      const starter = need.includes(c.posIdx) || !s.starters[t]?.[c.posIdx];
      out.push({ team: t, person: c.pkey, cardId: c.id, salary: ask, years: 2, starter, bonuses: {}, kind: "fa" });
      spent += ask;
    }
  }
  return out;
}

function genRumors(s: Save, rng: Rng): void {
  const stove = s.story!.stove!;
  stove.rumors = [];
  const pool = stove.faPool.slice(0, 20).map((id) => CARDS[id]).filter(Boolean);
  const n = rng.int(0, 3);
  for (let i = 0; i < n && pool.length; i++) {
    const c = rng.pick(pool);
    const team = rng.pick(allTeams(s).filter((t) => t !== s.team));
    const truth = rng.chance(0.55);
    stove.rumors.push({
      id: i + 1, person: c.pkey, team, true: truth,
      text: `${TM[team]?.ko ?? team}이(가) ${cardLabel(c)} 선수를 원한다는 이야기가 있습니다. 루머는 맞을 수도, 빗나갈 수도 있습니다.`,
    });
  }
}

function stanceFor(s: Save, team: string, key: string): string {
  const p = PL[key];
  const star = (p?.pct.ovr ?? 0) >= 80 || teamPower(team) < 40 && (p?.pct.ovr ?? 0) >= 60;
  if (star) return "간판스타는 안 팖";
  if (s.eco.cash < 5 && team === s.team) return "돈이 맞으면 판다";
  return "조건이 되면 협상한다";
}

function genIncoming(s: Save, rng: Rng): void {
  const stove = s.story!.stove!;
  stove.incoming = stove.incoming.filter((x) => x.status === "open");
  const ours = s.starters[s.team] ?? [];
  if (!stove.transfersOn || !ours.filter(Boolean).length) return;
  if (!rng.chance(0.7)) return;
  const key = rng.pick(ours.filter(Boolean));
  const p = PL[key]; if (!p?.personKey) return;
  const from = rng.pick(allTeams(s).filter((t) => t !== s.team && (s.story!.lck.includes(t) || teamPower(t) > 45)));
  const fee = Math.round((p.pct.ovr / 8 + (s.story!.lck.includes(s.team) ? 3 : 1)) * 10) / 10;
  const cr = cardForYear(p.personKey, Math.min(s.story!.year + 1, 2026), p.pos);
  const ask = cr ? contractAsk(cr.card, s.story!.tier) : 3;
  stove.incoming.push({
    id: `in-${s.story!.year}-w${stove.week}-${key}`,
    from, person: p.personKey, key, fee, salary: Math.round(ask * 1.1 * 10) / 10,
    years: 2, stance: stanceFor(s, s.team, key), expireWeek: stove.week, status: "open",
  });
}

export function answerIncoming(s: Save, id: string, accept: boolean, rng: Rng): string | null {
  const stove = s.story!.stove!;
  const bid = stove.incoming.find((x) => x.id === id && x.status === "open");
  if (!bid) return "이미 처리됐거나 기한이 지난 제안입니다.";
  if (!accept) { bid.status = "rejected"; return null; }
  // 구단이 받아도 선수가 거절할 수 있음
  const stay = prestige(s, s.team) + 20;
  const go = prestige(s, bid.from) + bid.salary;
  if (go + rng.next() * 10 < stay) {
    bid.status = "rejected";
    addNews(s, "season", `${PL[bid.key]?.name} 마음`, "이적 제안을 받아들였지만 선수가 지금 팀에 남기를 원했습니다.", s.team);
    return "선수가 거절했습니다. 지금 팀 만족·상대 명성을 보고 남기로 했습니다.";
  }
  bid.status = "accepted";
  s.eco.cash = moneyRound(s.eco.cash + bid.fee);
  s.story!.contracts = s.story!.contracts.filter((c) => c.key !== bid.key);
  s.starters[s.team] = (s.starters[s.team] ?? []).map((k) => k === bid.key ? "" : k);
  const card = CARDS[Object.keys(CARDS).find((id) => CARDS[id].pkey === bid.person) ?? ""];
  const fake: Bid = { team: bid.from, person: bid.person, cardId: card?.id ?? bid.key, salary: bid.salary, years: bid.years, starter: true, bonuses: {}, kind: "transfer" };
  signToTeam(s, bid.from, fake, rng);
  addNews(s, "season", `${PL[bid.key]?.name} 이적`, `${TM[bid.from]?.ko ?? bid.from}로 이적했습니다. 이적료 ${fmtMoney(bid.fee)}(게임용 가상 금액).`, s.team);
  return null;
}

export function startTransfer(s: Save, cardId: string, fee: number): string | null {
  const stove = s.story!.stove!;
  const c = CARDS[cardId]; if (!c) return "선수를 찾을 수 없습니다.";
  // find owning team
  let from = "";
  for (const [t, list] of Object.entries(stove.aiContracts)) {
    if (list.some((x) => x.person === c.pkey)) from = t;
  }
  if (!from) return "계약 중인 선수가 아니거나 이미 FA입니다.";
  if (s.eco.cash < fee) return "이적료를 감당할 자금이 부족합니다.";
  stove.ourTransfer = { person: c.pkey, from, cardId, fee, step: 1 };
  return null;
}

export function resolveTransferStep1(s: Save, rng: Rng): { ok: boolean; msg: string } {
  const stove = s.story!.stove!; const tr = stove.ourTransfer;
  if (!tr || tr.step !== 1) return { ok: false, msg: "진행 중인 1단계 협상이 없습니다." };
  const ownerKeys = (s.starters[tr.from] ?? []);
  const key = ownerKeys.find((k) => PL[k]?.personKey === tr.person) ?? tr.cardId;
  const stance = stanceFor(s, tr.from, key);
  const p = PL[key];
  const star = stance.includes("간판");
  const want = Math.round(((p?.pct.ovr ?? 50) / 7 + 2) * 10) / 10;
  if (star || tr.fee + 1e-6 < want * 0.85 && rng.chance(0.7)) {
    stove.ourTransfer = undefined;
    return { ok: false, msg: `${cName(tr)} 선수는 팀의 간판이라 팔 생각이 없습니다. (${stance})` };
  }
  if (tr.fee < want) {
    stove.ourTransfer = undefined;
    return { ok: false, msg: `${TM[tr.from]?.ko ?? tr.from} 구단이 이적료를 거절했습니다. 희망은 약 ${want}억입니다. (${stance})` };
  }
  tr.step = 2;
  return { ok: true, msg: `구단이 이적료 ${tr.fee}억에 합의했습니다. 2단계에서 선수 연봉을 제안하세요. 구단 사정: ${stance}` };
}
function cName(tr: TransferOffer): string { return CARDS[tr.cardId]?.name ?? tr.person; }

export function resolveTransferStep2(s: Save, salary: number, years: number, starter: boolean, rng: Rng): { ok: boolean; msg: string } {
  const stove = s.story!.stove!; const tr = stove.ourTransfer;
  if (!tr || tr.step !== 2) return { ok: false, msg: "2단계 협상이 없습니다." };
  if (s.eco.cash < tr.fee + salary) return { ok: false, msg: "이적료와 연봉을 합친 자금이 부족합니다." };
  const bid: Bid = { team: s.team, person: tr.person, cardId: tr.cardId, salary, years, starter, bonuses: {}, kind: "transfer" };
  const r = chooseTeam(s, tr.person, [
    bid,
    { team: tr.from, person: tr.person, cardId: tr.cardId, salary: salary * 0.8, years: 1, starter: true, bonuses: {}, kind: "fa" },
  ], rng);
  if (r.winner !== s.team) {
    stove.ourTransfer = undefined;
    return { ok: false, msg: `선수가 거절했습니다. ${r.reason}` };
  }
  s.eco.cash = moneyRound(s.eco.cash - tr.fee);
  stove.aiContracts[tr.from] = (stove.aiContracts[tr.from] ?? []).filter((c) => c.person !== tr.person);
  s.starters[tr.from] = (s.starters[tr.from] ?? []).map((k) => PL[k]?.personKey === tr.person ? "" : k);
  signToTeam(s, s.team, bid, rng);
  stove.ourTransfer = undefined;
  addNews(s, "season", `${r.name} 영입`, `${TM[tr.from]?.ko ?? tr.from}에서 이적료 ${fmtMoney(tr.fee)}, 연봉 ${fmtMoney(salary)}으로 영입했습니다.`, s.team);
  return { ok: true, msg: `${r.name} 선수와 계약했습니다. ${r.reason}` };
}

export function closeStoveWeek(s: Save, rng: Rng): void {
  const st = s.story!; const stove = st.stove!;
  // expire unanswered incoming
  for (const b of stove.incoming) if (b.status === "open" && b.expireWeek < stove.week) b.status = "expired";
  if (stove.week === 1) {
    stove.week = 2;
    stove.weekResults = [];
    genRumors(s, rng); genIncoming(s, rng);
    addNews(s, "season", "스토브 2주차", "이번 주부터 밀봉 입찰을 넣을 수 있습니다. 주가 끝나면 다른 구단 제안과 함께 결과가 납니다.", s.team);
    return;
  }
  const ai = aiFaBids(s, rng);
  const all = [...stove.pendingBids, ...ai];
  const byP = new Map<string, Bid[]>();
  for (const o of all) { const arr = byP.get(o.person) ?? []; arr.push(o); byP.set(o.person, arr); }
  const results: BidResult[] = [];
  for (const [person, offers] of byP) {
    const r = chooseTeam(s, person, offers, rng);
    results.push(r);
    if (r.winner) {
      const bid = offers.find((o) => o.team === r.winner)!;
      signToTeam(s, r.winner, bid, rng);
    }
  }
  stove.weekResults = results;
  stove.pendingBids = [];
  aiFillHoles(s, rng);
  const ours = results.filter((r) => r.winner === s.team);
  addNews(s, "season", `${st.year} 스토브 ${stove.week}주차 결과`,
    `${results.filter((r) => r.winner).length}명이 팀을 정했습니다.${ours.length ? ` 우리 영입: ${ours.map((r) => r.name).join(", ")}.` : " 우리 구단의 신규 계약은 없었습니다."}`, s.team);
  if (stove.week >= stove.maxWeek) {
    stove.closed = true;
  } else {
    stove.week += 1;
    genRumors(s, rng); genIncoming(s, rng);
  }
}

function aiFillHoles(s: Save, rng: Rng): void {
  const stove = s.story!.stove!;
  const year = Math.min(s.story!.year + 1, 2026);
  for (const t of allTeams(s)) {
    const cur = [...(s.starters[t] ?? ["", "", "", "", ""])];
    while (cur.length < 5) cur.push("");
    for (let pos = 0; pos < 5; pos++) {
      if (cur[pos]) continue;
      const cands = stove.faPool.map((x) => CARDS[x]).filter((c) => c && c.posIdx === pos).sort((a, b) => storySalary(a, s.story!.lck.includes(t) ? "LCK" : "CK") - storySalary(b, s.story!.lck.includes(t) ? "LCK" : "CK") || cmpCard(a, b));
      const id = t === s.team ? cands[0] : cands[Math.floor(rng.next() * Math.min(3, cands.length)) ] ?? cands[0];
      if (!id) continue;
      const tier: Tier = s.story!.lck.includes(t) ? "LCK" : "CK";
      const ask = contractAsk(id, tier);
      if (t === s.team && s.eco.cash < ask + upcomingSalaryDue(s.story!.contracts)) continue;
      if (t !== s.team) {
        const cap = payrollSoftCap(s, s.story!.lck.includes(t) ? "LCK" : "CK");
        const existingPay = (stove.aiContracts[t] ?? []).reduce((n, c) => n + c.salary, 0);
        if (existingPay + ask > cap) continue;
      }
      const bid: Bid = { team: t, person: id.pkey, cardId: id.id, salary: ask, years: 2, starter: true, bonuses: {}, kind: "fa" };
      signToTeam(s, t, bid, rng);
    }
  }
  void year; void rng;
}

export function finishOffseason(s: Save, rng: Rng): void {
  const st = s.story!;
  const stove = st.stove;
  if (stove && !stove.closed && stove.week < stove.maxWeek) return;
  aiFillHoles(s, rng);
  ensureStartingFive(s);
  rollYear(s, rng);
  st.stove = undefined;
}

/** 오프시즌 화면을 규칙대로 빠르게 넘깁니다. 경기 결과는 조작하지 않습니다. 프랜차이즈 선택은 호출 측에서 합니다. */
export function autoAdvanceOffseason(s: Save, rng: Rng, opts: { signStars?: boolean; reserveCash?: number } = {}): void {
  const st = s.story;
  if (!st?.stove) return;
  if (st.phase === "awards") awardsDone(s);
  if (st.phase === "tryout") {
    if (!st.stove.tryoutResults) resolveTryout(s, rng);
    tryoutDone(s);
  }
  if (st.phase === "expiry") {
    for (const k of st.stove.expiryKeys) {
      if (!st.stove.expiryDecided[k]) {
        const weak = (PL[k]?.pct.ovr ?? 50) < RELEASE_OVR;
        const err = decideExpiry(s, k, weak ? "release" : "resign");
        if (err) decideExpiry(s, k, "release");
      }
    }
    expiryDone(s, rng);
  }
  if (st.phase !== "stove" || !st.stove) return;
  let g = 0;
  while (g++ < 12 && st.phase === "stove" && !st.stove.closed) {
    if (opts.signStars && canBidNow(s)) legalStarBids(s, opts.reserveCash ?? 0);
    closeStoveWeek(s, rng);
  }
  if (st.stove?.closed) finishOffseason(s, rng);
}

function minFaCost(s: Save, pos: number): number {
  const st = s.story!; const stove = st.stove!;
  const cheap = stove.faPool.map((id) => CARDS[id]).filter((c) => c && c.posIdx === pos).sort((a, b) => storySalary(a, st.tier) - storySalary(b, st.tier) || cmpCard(a, b))[0];
  if (cheap) return storySalary(cheap, st.tier);
  return st.tier === "LCK" ? 3 : 0.2;
}

function holeReserve(s: Save, exceptPos?: number): number {
  const holes = [0, 1, 2, 3, 4].filter((i) => !s.starters[s.team]?.[i] && i !== exceptPos);
  return holes.reduce((n, pos) => n + minFaCost(s, pos), 0);
}

function legalStarBids(s: Save, reserve = 0): void {
  const st = s.story!; const stove = st.stove!;
  const cards = stove.faPool.map((id) => CARDS[id]).filter(Boolean);
  const bidFor = (c: typeof cards[0], asHole: boolean): boolean => {
    const cur = s.starters[s.team]?.[c.posIdx];
    const ask = contractAsk(c, st.tier);
    // 교체 입찰이면 나가는 주전의 연봉은 이번 정산에서 빼도 됩니다(계약이 교체로 해제됩니다).
    const due = upcomingSalaryDue(st.contracts, cur || undefined);
    const keep = reserve + holeReserve(s, asHole ? c.posIdx : undefined) + due;
    const room = s.eco.cash - keep;
    if (room < ask * 0.85) return false;
    const offer = moneyRound(Math.min(room, ask * (prestige(s, s.team) < 60 ? 1.45 : 1.12)));
    const pendingOurs = stove.pendingBids.filter((b) => b.team === s.team).reduce((n, b) => n + b.salary, 0);
    const payroll = st.contracts.reduce((n, x) => n + x.salary, 0) + pendingOurs;
    const oldPay = (cur && st.contracts.find((x) => x.key === cur)?.salary) || 0;
    const cap = payrollSoftCap(s, st.tier);
    if (payroll - oldPay + offer > cap) {
      if (!asHole) return false;
      // 구멍이라도 스타 연봉으로 총액을 넘기면 다음 해 강제 매각으로 로스터가 무너집니다.
      if (offer > (st.tier === "LCK" ? (payrollYearCapStar(s)) : 0.6)) return false;
    }
    return !placeFaBid(s, { team: s.team, person: c.pkey, cardId: c.id, salary: offer, years: 2, starter: true, bonuses: {}, kind: "fa" });
  };
  // 1) 주전 구멍부터, 가능한 한 종합 55 이상
  const holes = [0, 1, 2, 3, 4].filter((i) => !s.starters[s.team]?.[i]);
  for (const pos of holes) {
    const opts = cards.filter((c) => c.posIdx === pos).sort((a, b) => storySalary(a, st.tier) - storySalary(b, st.tier) || b.percentile - a.percentile || cmpCard(a, b));
    const mid = opts.filter((c) => c.percentile >= REPLACE_OVR);
    const pool = (mid.length ? mid : opts).sort((a, b) => storySalary(a, st.tier) - storySalary(b, st.tier) || b.percentile - a.percentile || cmpCard(a, b));
    for (const c of pool) { if (bidFor(c, true)) break; }
  }
  const taken = new Set<number>(holes);
  // 2) 가장 약한 주전(종합 55 미만)부터 교체
  const weakPos = [0, 1, 2, 3, 4]
    .filter((i) => !taken.has(i))
    .map((i) => ({ i, ovr: PL[s.starters[s.team]?.[i]]?.pct.ovr ?? 0 }))
    .filter((x) => x.ovr < REPLACE_OVR)
    .sort((a, b) => a.ovr - b.ovr || a.i - b.i);
  for (const { i, ovr } of weakPos) {
    const opts = cards.filter((c) => c.posIdx === i && c.percentile >= ovr + 5).sort((a, b) => b.percentile - a.percentile || storySalary(a, st.tier) - storySalary(b, st.tier) || cmpCard(a, b));
    for (const c of opts) { if (bidFor(c, false)) { taken.add(i); break; } }
  }
  // 3) 여유 자금으로 업그레이드 (포지션당 최대 1)
  const upgrades = cards.slice().sort((a, b) => b.percentile - a.percentile || cmpCard(a, b));
  for (const c of upgrades) {
    if (taken.has(c.posIdx)) continue;
    const cur = s.starters[s.team]?.[c.posIdx];
    const curOvr = cur && PL[cur]?.pct?.ovr != null ? PL[cur].pct.ovr : 0;
    if (!(c.percentile >= curOvr + 8 || curOvr < REPLACE_OVR)) continue;
    if (!bidFor(c, false)) continue;
    taken.add(c.posIdx);
    if (taken.size >= 5) break;
  }
}
function payrollYearCapStar(s: Save): number {
  return payrollSoftCap(s, "LCK") <= 70 ? 12 : 18;
}

export function allExpiryDecided(s: Save): boolean {
  const stove = s.story?.stove; if (!stove) return true;
  return stove.expiryKeys.every((k) => stove.expiryDecided[k]);
}


/** 한 해를 오프시즌 끝까지 진행합니다. 프랜차이즈 선택과 합법 영입만 하며 경기 결과는 조작하지 않습니다. */
export function stepYear(s: Save, rng: Rng, opts: { acceptBuyIn?: boolean; signStars?: boolean; reserveCash?: number } = {}): void {
  const st = s.story;
  if (!st || st.ended) return;
  if (!["awards", "tryout", "expiry", "stove", "franchise", "clear", "fail", "bankrupt"].includes(st.phase)) {
    pumpStory(s, rng);
  }
  if (st.ended) return;
  autoAdvanceOffseason(s, rng, { signStars: opts.signStars, reserveCash: opts.reserveCash });
  if (st.phase === "franchise") {
    const err = resolveFranchise(s, !!opts.acceptBuyIn);
    if (err) resolveFranchise(s, false);
  }
  autoAdvanceOffseason(s, rng, { signStars: opts.signStars, reserveCash: opts.reserveCash });
}

registerOffseason(beginOffseason, enterStoveWeeks);
