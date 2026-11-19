import { CARDS, PL, TM } from "../data";
import type { SeasonCard } from "../types";
import type { Save } from "./season";
import { addNews } from "./season";
import { cardForYear, franchisePlayers, marketCards, ensurePlayer, storySalary, payrollSoftCap, aiWeeklyFaBudget, storyDiff, FRANCHISE_BUYIN, type Contract, type Tier, cmpStr } from "./story";
import { chooseTeam, type Bid } from "./negotiation";
import { moneyRound, fmtMoney } from "./money";
import { advanceTeamTraining, trainingDate, initializeTraining } from "./trainingRuntime";
import { Rng } from "./rng";
import { syncPromises } from "./rotation";

export interface SeasonDeal {
  id: number; date: string; person: string; name: string; from: string; to: string;
  fee: number; salary: number; paidSalary: number; years: number; reason: string;
}
export interface SeasonIncoming {
  id: string; week: string; from: string; person: string; fee: number; salary: number;
  status: "open" | "accepted" | "rejected" | "expired";
}
export interface SeasonNegotiation { person: string; cardId: string; from: string; fee: number; week: string; step: "club" | "player" }
export interface InSeasonState {
  version: 1; year: number; rng: number; week: string; automatic: boolean;
  rosters: Record<string, Contract[]>; cash: Record<string, number>;
  bought: Record<string, string>; sold: string; attempted: string[];
  incoming: SeasonIncoming[]; negotiation?: SeasonNegotiation; history: SeasonDeal[]; seq: number;
}
export interface SeasonCandidate { person: string; card: SeasonCard; owner: string; salary: number; fee: number; ovr: number; stance: string }
const dateMs = (d: string): number => Date.parse(d + "T00:00:00Z");
const hash = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return Math.abs(h); };
const teams = (s: Save): string[] => [...new Set([...(s.story?.lck ?? []), ...(s.story?.ck ?? [])])];
const tier = (s: Save, t: string): Tier => s.story!.lck.includes(t) ? "LCK" : "CK";
const personOf = (k: string): string => PL[k]?.personKey ?? CARDS[k]?.pkey ?? k.toLowerCase();
const contractList = (s: Save, team: string): Contract[] => team === s.team ? s.story!.contracts : s.inSeason?.rosters[team] ?? [];
const validMoney = (n: number): boolean => Number.isFinite(n) && n >= 0 && n <= 10000;
export function seasonMarketClosed(s: Save): string | undefined {
  if (s.mode !== "story" || !s.story) return "프랜차이즈에서 이용할 수 있습니다.";
  if (s.story.ended || s.story.phase !== "regular" || s.days[s.day]?.stage !== "R") return "정규 시즌에만 이적할 수 있습니다. 플레이오프·승강전·국제대회와 시즌 종료 후에는 닫힙니다.";
  if (s.session) return "경기가 진행 중입니다. 시리즈를 마친 뒤 명단을 변경해 주세요.";
  return;
}
export function seasonMarketWeek(s: Save): string {
  const first = s.days.find((d) => d.stage === "R")?.date ?? trainingDate(s);
  return `${s.story?.year}-${s.story?.split}-${Math.floor((dateMs(trainingDate(s)) - dateMs(first)) / (7 * 86400000)) + 1}`;
}
/** 남은 달력 연도의 급여. 연봉은 기존 가상 가격이며 0.01억 단위로 정산합니다. */
export function seasonSalaryDue(s: Save, annual: number): number {
  const year = s.story!.year, date = trainingDate(s);
  const full = (dateMs(`${year + 1}-01-01`) - dateMs(`${year}-01-01`)) / 86400000;
  const left = Math.max(0, (dateMs(`${year + 1}-01-01`) - dateMs(date)) / 86400000);
  return moneyRound(annual * Math.min(1, left / full));
}
export function seasonReserve(s: Save): number {
  const future = s.story!.contracts.filter((c) => c.years > 1).reduce((n, c) => n + c.salary, 0);
  const franchise = !s.story!.franchised && s.story!.year <= 2020 ? FRANCHISE_BUYIN[storyDiff(s)] : 0;
  return moneyRound(future + franchise);
}
export function initializeInSeason(s: Save): InSeasonState | undefined {
  if (s.mode !== "story" || !s.story) return;
  if (s.inSeason?.year === s.story.year) return s.inSeason;
  const old = s.inSeason;
  const m: InSeasonState = { version: 1, year: s.story.year, rng: (s.seed ^ s.story.year * 127 ^ 0x193a7) >>> 0, week: "", automatic: old?.automatic ?? false,
    rosters: {}, cash: {}, bought: {}, sold: "", attempted: [], incoming: [], history: old?.history ?? [], seq: old?.seq ?? 0 };
  for (const t of teams(s).filter((t) => t !== s.team)) {
    m.rosters[t] = (s.starters[t] ?? []).filter(Boolean).map((key) => {
      const person = personOf(key), r = cardForYear(person, m.year, PL[key]?.pos);
      return { key, person, cardId: r?.card.id ?? key, salary: r ? storySalary(r.card, tier(s, t)) : 0, years: 1 + hash(key + t) % 3 };
    });
    m.cash[t] = moneyRound(aiWeeklyFaBudget(t, payrollSoftCap(s, tier(s, t)), storyDiff(s)));
  }
  s.inSeason = m; return m;
}
function owners(s: Save): Map<string, string> {
  const out = new Map<string, string>();
  for (const t of teams(s)) for (const c of contractList(s, t)) out.set(c.person, t);
  return out;
}
function actualCard(s: Save, c: SeasonCard, owner: string): SeasonCard | undefined {
  const owned = contractList(s, owner).find((x) => x.person === c.pkey);
  return cardForYear(c.pkey, s.story!.year, owned ? PL[owned.key]?.pos : c.posIdx)?.card;
}
const ovr = (s: Save, c: SeasonCard): number => PL[ensurePlayer(c, s.story!.year, c.year < Math.min(s.story!.year, 2026))]?.pct.ovr ?? 0;
export function seasonCandidates(s: Save): SeasonCandidate[] {
  if (!s.story || !s.inSeason || s.inSeason.year !== s.story.year) return [];
  const owned = owners(s), list: SeasonCandidate[] = [];
  for (const raw of franchisePlayers(s.story.year)) {
    const owner = owned.get(raw.pkey) ?? "FA"; if (owner === s.team) continue;
    const card = actualCard(s, raw, owner); if (!card) continue;
    const power = ovr(s, card), salary = storySalary(card, s.story.tier);
    const ownerPay = owner === "FA" ? 0 : contractList(s, owner).find((c) => c.person === card.pkey)?.salary ?? storySalary(card, tier(s, owner));
    list.push({ person: card.pkey, card, owner, salary, fee: owner === "FA" ? 0 : moneyRound(Math.max(0.1, ownerPay * 0.5)), ovr: power,
      stance: owner === "FA" ? "자유계약" : power >= 80 ? "간판 선수 · 매각 거절" : "대체 선수·금액 조건 협상" });
  }
  return list;
}
function canBuy(s: Save, team: string, card: SeasonCard, salary: number, fee: number, years: number): string | undefined {
  if (!validMoney(salary) || salary <= 0 || !validMoney(fee) || !Number.isInteger(years) || years < 1 || years > 3) return "금액과 계약 기간을 확인해 주세요.";
  const own = contractList(s, team);
  if (own.some((c) => c.person === card.pkey)) return "이미 보유한 선수입니다.";
  if (own.length >= 8) return "선발과 벤치를 합쳐 8명까지 보유할 수 있습니다. 먼저 유효한 이적 제안으로 자리를 마련해 주세요.";
  if (moneyRound(own.reduce((n, c) => n + c.salary, 0) + salary) > moneyRound(payrollSoftCap(s, tier(s, team)))) return "연간 선수단 연봉 한도를 넘습니다.";
  const cost = moneyRound(fee + seasonSalaryDue(s, salary));
  const reserve = team === s.team ? moneyRound(seasonReserve(s) + (years > 1 ? salary : 0)) : 0;
  const cash = team === s.team ? s.eco.cash : s.inSeason!.cash[team] ?? 0;
  if (moneyRound(cash) < moneyRound(cost + reserve)) return "이적료·남은 시즌 연봉·다음 해 계약 연봉과 프랜차이즈 유보금을 감당할 자금이 부족합니다.";
  if (s.inSeason!.bought[team] === s.inSeason!.week) return "한 주에 한 명까지 영입할 수 있습니다.";
  return;
}
function freeCards(s: Save, pos?: number): SeasonCard[] {
  const owned = owners(s);
  return marketCards(s.story!.year).filter((c) => !owned.has(c.pkey) && (pos == null || c.posIdx === pos));
}
function benchReplacement(s: Save, team: string, person: string): Contract | undefined {
  const own = contractList(s, team), key = own.find((c) => c.person === person)?.key;
  const pos = key ? PL[key]?.pos : undefined;
  return own.filter((c) => c.person !== person && PL[c.key]?.pos === pos && !(s.starters[team] ?? []).includes(c.key)).sort((a, b) => (PL[b.key]?.pct.ovr ?? 0) - (PL[a.key]?.pct.ovr ?? 0))[0];
}
function sellerReplacement(s: Save, team: string, person: string, fee: number): Contract | SeasonCard | undefined {
  const own = contractList(s, team), ct = own.find((c) => c.person === person); if (!ct) return;
  if (!(s.starters[team] ?? []).includes(ct.key)) return ct;
  const bench = benchReplacement(s, team, person); if (bench) return bench;
  if (team === s.team) return;
  const pos = PL[ct.key]?.pos, power = PL[ct.key]?.pct.ovr ?? 0;
  return freeCards(s, pos).filter((c) => {
    const ask = storySalary(c, tier(s, team));
    return ovr(s, c) >= power - 15 && moneyRound(own.reduce((n, c) => n + c.salary, 0) - ct.salary + ask) <= moneyRound(payrollSoftCap(s, tier(s, team))) &&
      moneyRound(seasonSalaryDue(s, ask)) <= moneyRound((s.inSeason!.cash[team] ?? 0) + fee);
  }).sort((a, b) => storySalary(a, tier(s, team)) - storySalary(b, tier(s, team)) || b.percentile - a.percentile || cmpStr(a.id, b.id))[0];
}
function refreshTeam(s: Save, team: string): void {
  if (!TM[team]) return;
  TM[team].starters = [...(s.starters[team] ?? [])];
  TM[team].players = contractList(s, team).map((c) => c.key);
  if (team === s.team) s.cards = s.story!.contracts.map((c) => c.key);
}
function sign(s: Save, team: string, card: SeasonCard, salary: number, years: number, starter: boolean): string {
  const key = ensurePlayer(card, s.story!.year, !!cardForYear(card.pkey, s.story!.year, card.posIdx)?.estimated);
  const training = initializeTraining(s);
  if (training) {
    const old = training.players[card.pkey], date = trainingDate(s);
    training.players[card.pkey] = { ...(old ?? { person: card.pkey, mechanicsXp: 0, strategyXp: 0, fatigue: 0 }), lastDate: old?.lastDate && old.lastDate > date ? old.lastDate : date };
  }
  contractList(s, team).push({ key, person: card.pkey, cardId: card.id, salary, years, prepaid: false });
  const cost = seasonSalaryDue(s, salary);
  if (team === s.team) s.eco.cash = moneyRound(s.eco.cash - cost); else s.inSeason!.cash[team] = moneyRound(s.inSeason!.cash[team] - cost);
  if (starter || !s.starters[team]?.[card.posIdx]) { s.starters[team][card.posIdx] = key; if (team === s.team) s.schedOk = false; }
  refreshTeam(s, team); return key;
}
function complete(s: Save, from: string, to: string, card: SeasonCard, fee: number, salary: number, years: number, starter: boolean, reason: string): string | undefined {
  const m = s.inSeason!, error = canBuy(s, to, card, salary, fee, years); if (error) return error;
  let replacement: Contract | SeasonCard | undefined;
  if (from !== "FA") {
    if (!contractList(s, from).some((c) => c.person === card.pkey)) return "원 소속이 바뀌어 협상을 다시 확인해야 합니다.";
    replacement = sellerReplacement(s, from, card.pkey, fee);
    if (!replacement) return "구단에 같은 포지션 대체 선수가 없어 이적할 수 없습니다.";
  } else if (owners(s).has(card.pkey)) return "이미 다른 구단과 계약한 선수입니다.";
  // 거래 전 날짜까지 원 소속 훈련을 마치고 사람별 성장·피로를 그대로 넘깁니다.
  if (from !== "FA") advanceTeamTraining(s, from, trainingDate(s));
  advanceTeamTraining(s, to, trainingDate(s));
  if (from !== "FA") {
    const wasStarter = (s.starters[from] ?? []).some((k) => personOf(k) === card.pkey);
    const left = contractList(s, from).filter((c) => c.person !== card.pkey);
    if (from === s.team) s.story!.contracts = left; else m.rosters[from] = left;
    if (to === s.team) s.eco.cash = moneyRound(s.eco.cash - fee); else m.cash[to] = moneyRound(m.cash[to] - fee);
    if (from === s.team) s.eco.cash = moneyRound(s.eco.cash + fee); else m.cash[from] = moneyRound(m.cash[from] + fee);
    if (wasStarter && replacement) {
      if (from === s.team) s.schedOk = false;
      if ("cardId" in replacement) s.starters[from][card.posIdx] = replacement.key;
      else sign(s, from, replacement, storySalary(replacement, tier(s, from)), 1, true);
    }
    refreshTeam(s, from);
  }
  syncPromises(s);
  sign(s, to, card, salary, years, starter); m.bought[to] = m.week;
  m.history.push({ id: ++m.seq, date: trainingDate(s), person: card.pkey, name: card.name, from, to, fee, salary, paidSalary: seasonSalaryDue(s, salary), years, reason });
  if (m.history.length > 180) m.history = m.history.filter((d, i) => d.from === s.team || d.to === s.team || i >= m.history.length - 80);
  if (from === s.team || to === s.team) addNews(s, "season", `${card.name} 시즌 중 ${to === s.team ? "영입" : "이적"}`,
    `${from === "FA" ? "FA" : TM[from]?.ko ?? from} → ${TM[to]?.ko ?? to}. 이적료 ${fmtMoney(fee)}, 연봉 ${fmtMoney(salary)}, 이번 시즌 지급 ${fmtMoney(seasonSalaryDue(s, salary))}. ${reason} 모두 게임용 가상 금액입니다.`, s.team);
  return;
}
function bid(team: string, c: SeasonCard, salary: number, years = 1, starter = true): Bid { return { team, person: c.pkey, cardId: c.id, salary, years, starter, bonuses: {}, kind: "fa" }; }
function aiOffers(s: Save, card: SeasonCard, rng: Rng): Bid[] {
  const out: Bid[] = [], power = ovr(s, card);
  for (const t of rng.shuffle(teams(s).filter((t) => t !== s.team))) {
    if (s.inSeason!.bought[t] === s.inSeason!.week || contractList(s, t).length >= 8) continue;
    const old = PL[s.starters[t]?.[card.posIdx]], ask = storySalary(card, tier(s, t));
    if (old && power < old.pct.ovr + 8) continue;
    const salary = moneyRound(ask * (1 + rng.next() * 0.12));
    if (!canBuy(s, t, card, salary, 0, 1)) out.push(bid(t, card, salary));
    if (out.length === 3) break;
  }
  return out;
}
function aiMarket(s: Save, rng: Rng): void {
  // 포지션별 상위 6명과 저연봉 6명만 검토합니다. 일주일 한 번의 실제 예산 안 보강입니다.
  const available = freeCards(s), selected = new Map<string, SeasonCard>();
  for (let pos = 0; pos < 5; pos++) {
    const pool = available.filter((c) => c.posIdx === pos);
    for (const c of [...pool.sort((a, b) => b.percentile - a.percentile || cmpStr(a.id, b.id)).slice(0, 6),
      ...pool.sort((a, b) => a.salary - b.salary || b.percentile - a.percentile).slice(0, 6)]) selected.set(c.pkey, c);
  }
  const pool = [...selected.values()].sort((a, b) => b.percentile - a.percentile || cmpStr(a.id, b.id));
  for (const c of pool) {
    const offers = aiOffers(s, c, rng); if (!offers.length) continue;
    const result = chooseTeam(s, c.pkey, offers, rng), win = offers.find((o) => o.team === result.winner);
    if (win) complete(s, "FA", win.team, c, 0, win.salary, 1, true, result.reason);
  }
}
function generateIncoming(s: Save, rng: Rng): void {
  const m = s.inSeason!, own = s.story!.contracts;
  if (!own.length || !rng.chance(0.65)) return;
  const ct = rng.pick(own), r = cardForYear(ct.person, s.story!.year, PL[ct.key]?.pos); if (!r) return;
  const fee = moneyRound(Math.max(0.1, ct.salary * 0.5));
  for (const t of rng.shuffle(teams(s).filter((t) => t !== s.team))) {
    const salary = moneyRound(storySalary(r.card, tier(s, t)) * 1.1);
    if (canBuy(s, t, r.card, salary, fee, 1)) continue;
    m.incoming.push({ id: `${m.week}-${ct.person}-${t}`, week: m.week, from: t, person: ct.person, fee, salary, status: "open" }); return;
  }
}
export function startSeasonNegotiation(s: Save, cardId: string, fee: number): string | undefined {
  const closed = seasonMarketClosed(s); if (closed) return closed;
  prepareInSeason(s); const m = s.inSeason!, target = seasonCandidates(s).find((c) => c.card.id === cardId);
  if (!target || !validMoney(fee)) return "현재 선수와 금액을 확인해 주세요.";
  if (m.attempted.includes(`${s.team}:${target.person}`)) return "이번 주에 답변을 마친 선수입니다. 다음 주에 다시 협상할 수 있습니다.";
  if (m.bought[s.team] === m.week) return "이번 주 영입을 이미 마쳤습니다.";
  m.negotiation = { person: target.person, cardId, from: target.owner, fee: target.owner === "FA" ? 0 : moneyRound(fee), week: m.week, step: target.owner === "FA" ? "player" : "club" };
  return;
}
export function seasonClubReply(s: Save): string | undefined {
  const closed = seasonMarketClosed(s); if (closed) return closed;
  const m = s.inSeason, tr = m?.negotiation;
  if (!m || !tr || tr.week !== seasonMarketWeek(s) || tr.step !== "club") return "진행 중인 구단 협상이 없습니다.";
  const target = seasonCandidates(s).find((c) => c.person === tr.person && c.owner === tr.from && c.card.id === tr.cardId);
  if (!target) return "소속이 바뀌어 협상이 만료되었습니다.";
  if (target.ovr >= 80) return "구단이 간판 선수의 매각을 거절했습니다.";
  if (tr.fee < target.fee) return `구단 희망 이적료는 ${fmtMoney(target.fee)}입니다.`;
  if (!sellerReplacement(s, tr.from, tr.person, tr.fee)) return "원 소속 구단에 대체 선수가 없어 매각을 거절했습니다.";
  tr.step = "player"; return;
}
export function seasonPlayerReply(s: Save, salary: number, years: number, starter: boolean): { ok: boolean; message: string } {
  salary = moneyRound(salary);
  const closed = seasonMarketClosed(s); if (closed) return { ok: false, message: closed };
  const m = s.inSeason, tr = m?.negotiation;
  if (!m || !tr || tr.week !== seasonMarketWeek(s) || tr.step !== "player") return { ok: false, message: "현재 주간의 선수 협상이 없습니다." };
  const target = seasonCandidates(s).find((c) => c.person === tr.person && c.owner === tr.from && c.card.id === tr.cardId);
  if (!target) return { ok: false, message: "다른 구단과 계약했거나 소속이 바뀌었습니다." };
  const error = canBuy(s, s.team, target.card, salary, tr.fee, years); if (error) return { ok: false, message: error };
  if (salary + 1e-6 < target.salary * 0.85) return { ok: false, message: "선수가 제시한 연봉 조건이 너무 낮습니다." };
  const attempt = `${s.team}:${tr.person}`;
  if (m.attempted.includes(attempt)) return { ok: false, message: "이번 주에 이미 답변한 선수입니다." };
  const rng = new Rng(m.rng), offers = [bid(s.team, target.card, salary, years, starter)];
  if (tr.from !== "FA") {
    const ct = contractList(s, tr.from).find((c) => c.person === tr.person)!;
    offers.push(bid(tr.from, target.card, ct.salary, ct.years, (s.starters[tr.from] ?? []).includes(ct.key)));
  } else offers.push(...aiOffers(s, target.card, rng));
  const result = chooseTeam(s, tr.person, offers, rng); m.rng = rng.s; m.attempted.push(attempt); m.negotiation = undefined;
  const win = offers.find((o) => o.team === result.winner)!;
  if (win.team === s.team) {
    const fail = complete(s, tr.from, s.team, target.card, tr.fee, salary, years, starter, result.reason);
    return { ok: !fail, message: fail ?? `${target.card.name} 선수를 영입했습니다. ${result.reason}` };
  }
  if (tr.from === "FA") complete(s, "FA", win.team, target.card, 0, win.salary, win.years, true, result.reason);
  return { ok: false, message: `선수가 ${TM[win.team]?.ko ?? win.team} 구단을 선택했습니다. ${result.reason}` };
}
export function answerSeasonIncoming(s: Save, id: string, accept: boolean): string | undefined {
  const closed = seasonMarketClosed(s); if (closed) return closed;
  const m = s.inSeason, proposal = m?.incoming.find((b) => b.id === id && b.status === "open");
  if (!m || !proposal || proposal.week !== seasonMarketWeek(s)) return "기한이 지났거나 이미 처리한 제안입니다.";
  if (!accept) { proposal.status = "rejected"; return; }
  if (m.sold === m.week) return "한 주에 한 명까지 매각할 수 있습니다.";
  if (!sellerReplacement(s, s.team, proposal.person, proposal.fee)) return "같은 포지션의 보유 벤치가 있어야 주전을 팔 수 있습니다.";
  const ct = s.story!.contracts.find((c) => c.person === proposal.person), r = ct && cardForYear(ct.person, s.story!.year, PL[ct.key]?.pos);
  if (!ct || !r) return "계약 선수를 찾을 수 없습니다.";
  const can = canBuy(s, proposal.from, r.card, proposal.salary, proposal.fee, 1); if (can) return can;
  const rng = new Rng(m.rng), result = chooseTeam(s, ct.person, [bid(s.team, r.card, ct.salary, ct.years, (s.starters[s.team] ?? []).includes(ct.key)), bid(proposal.from, r.card, proposal.salary)], rng);
  m.rng = rng.s;
  if (result.winner !== proposal.from) { proposal.status = "rejected"; return "선수가 현 구단에 남기로 했습니다."; }
  const fail = complete(s, s.team, proposal.from, r.card, proposal.fee, proposal.salary, 1, true, result.reason);
  if (fail) return fail;
  proposal.status = "accepted"; m.sold = m.week; return;
}
function autoManage(s: Save): void {
  const m = s.inSeason!, keys = s.starters[s.team] ?? [];
  for (let pos = 0; pos < 5; pos++) {
    const candidates = s.story!.contracts.filter((c) => PL[c.key]?.pos === pos).sort((a, b) => (PL[b.key]?.pct.ovr ?? 0) - (PL[a.key]?.pct.ovr ?? 0));
    if (candidates[0] && (PL[candidates[0].key]?.pct.ovr ?? 0) > (PL[keys[pos]]?.pct.ovr ?? 0)) { keys[pos] = candidates[0].key; s.schedOk = false; }
  }
  refreshTeam(s, s.team);
  const upgrades = () => seasonCandidates(s).filter((c) => c.owner === "FA" && c.ovr >= (PL[keys[c.card.posIdx]]?.pct.ovr ?? 0) + 8).sort((a, b) => b.ovr - a.ovr || a.salary - b.salary);
  let options = upgrades().filter((c) => !canBuy(s, s.team, c.card, moneyRound(c.salary * 1.12), 0, 1));
  if (!options.length && m.bought[s.team] !== m.week) {
    for (const offer of m.incoming.filter((b) => b.status === "open")) {
      const ct = s.story!.contracts.find((c) => c.person === offer.person);
      if (!ct || keys.includes(ct.key)) continue;
      // 실제 제안으로 벤치를 팔아야 필요한 보강이 가능한 경우만 매각을 시도합니다.
      const afterSale: Save = { ...s, eco: { ...s.eco, cash: moneyRound(s.eco.cash + offer.fee) }, story: { ...s.story!, contracts: s.story!.contracts.filter((c) => c.person !== ct.person) } };
      const canUpgrade = upgrades().some((c) => !canBuy(afterSale, s.team, c.card, moneyRound(c.salary * 1.12), 0, 1));
      if (canUpgrade && !answerSeasonIncoming(s, offer.id, true)) break;
    }
    options = upgrades().filter((c) => !canBuy(s, s.team, c.card, moneyRound(c.salary * 1.12), 0, 1));
  }
  if (options.length) {
    const t = options[0]; startSeasonNegotiation(s, t.card.id, 0); seasonPlayerReply(s, moneyRound(t.salary * 1.12), 1, true);
  }
}
/** 주간 갱신은 한 번만. 시장 전용 난수를 저장해 열람/불러오기로 경기 난수가 바뀌지 않습니다. */
export function prepareInSeason(s: Save): void {
  if (seasonMarketClosed(s)) return;
  const m = initializeInSeason(s)!; const week = seasonMarketWeek(s);
  if (m.week === week) return;
  m.week = week; m.attempted = []; m.negotiation = undefined;
  for (const incoming of m.incoming) if (incoming.status === "open") incoming.status = "expired";
  m.incoming = m.incoming.filter((b) => b.status === "open");
  const rng = new Rng(m.rng); aiMarket(s, rng); generateIncoming(s, rng); m.rng = rng.s;
  if (m.automatic) autoManage(s);
}
export function setSeasonAutomatic(s: Save, enabled: boolean): void {
  if (seasonMarketClosed(s)) return;
  prepareInSeason(s); s.inSeason!.automatic = enabled;
  if (enabled) autoManage(s);
}
