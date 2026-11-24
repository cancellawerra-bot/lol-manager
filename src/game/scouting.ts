import { CARDS, PL, POS_KO } from "../data";
import type { SeasonCard } from "../types";
import type { Save } from "./season";
import { cardForYear, franchisePlayers, storySalary, DECAY_PCT, payrollSoftCap, upcomingSalaryDue, cmpStr } from "./story";
import { seasonCandidates, seasonMarketClosed, seasonScoutError, seasonSalaryDue, seasonReserve } from "./inSeason";
import { TRYOUT_MAX, canBidNow } from "./stove";
import { moneyRound } from "./money";
import { trainingDate, playerTraining } from "./trainingRuntime";
import { trainingProfile } from "./training";
import { PLAYER_BIRTHDATES } from "./playerBirthdates";

export type ScoutGoal = "upgrade" | "value" | "development" | "watch";
export type ScoutContext = "season" | "fa" | "tryout";
export interface ScoutPreferences { goal: ScoutGoal; pos: number | "all"; affordableOnly: boolean }
export interface ScoutingState extends ScoutPreferences { version: 1; watch: string[]; reports?: Record<string, number> }
export const MAX_SCOUT_REPORTS = 3;
export function personId(s: Save | null | undefined, personOrKey: string): string {
  if (s?.story) {
    const ct = s.story.contracts.find(c => c.key === personOrKey || c.person === personOrKey);
    if (ct) return ct.person;
  }
  if (CARDS[personOrKey]?.pkey) return CARDS[personOrKey].pkey;
  const p = PL[personOrKey];
  if (p?.personKey) return p.personKey;
  for (const c of s?.story?.contracts ?? []) { if (c.key === personOrKey) return c.person; }
  if (s) {
    for (const k of [...(s.starters[s.team] ?? []), ...(s.cards ?? [])]) {
      if (k === personOrKey) return CARDS[k]?.pkey ?? PL[k]?.personKey ?? k;
    }
  }
  return personOrKey;
}
export function isOurPlayer(s: Save | null | undefined, personOrKey: string): boolean {
  if (!s) return false;
  if (s.story) return s.story.contracts.some(c => c.person === personOrKey || c.key === personOrKey || c.person === personId(s, personOrKey));
  const mine = [...(s.starters[s.team] ?? []), ...(s.cards ?? [])];
  if (mine.includes(personOrKey)) return true;
  const id = personId(s, personOrKey);
  return mine.some(k => k === id || CARDS[k]?.pkey === id || PL[k]?.personKey === id);
}
export function scoutReportsMap(s: Save | null | undefined): Record<string, number> {
  const raw = s?.scouting?.reports ?? {}, out: Record<string, number> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (typeof k === "string" && k && Number.isInteger(v) && v > 0) out[k] = Math.min(MAX_SCOUT_REPORTS, v);
  }
  return out;
}
export const scoutReports = (s: Save | null | undefined, person: string): number => scoutReportsMap(s)[personId(s, person)] ?? 0;
export function writeScoutingState(s: Save, patch?: Partial<Pick<ScoutingState, "watch" | "reports">> & Partial<ScoutPreferences>): void {
  const watch = patch?.watch ?? scoutWatch(s);
  const reports = scoutReportsMap({ scouting: { version: 1, goal: "upgrade", pos: "all", affordableOnly: true, watch, reports: patch?.reports ?? s.scouting?.reports } } as Save);
  const prefs = scoutPreferences({ ...s, scouting: { version: 1, ...scoutPreferences(s), ...patch, watch } as ScoutingState });
  const next: ScoutingState = { version: 1, ...prefs, watch };
  if (Object.keys(reports).length) next.reports = reports;
  s.scouting = next;
}
export function addScoutReport(s: Save, person: string): string | undefined {
  const id = personId(s, person);
  if (isOurPlayer(s, id)) return "우리 구단 선수는 이미 정확한 능력치를 볼 수 있습니다.";
  if (!cardForYear(id, s.story?.year ?? 2026) && !PL[person] && !Object.values(PL).some(p => p.personKey === id)) return "현재 연도에 확인된 선수 기록이 없습니다.";
  const n = scoutReports(s, id);
  if (n >= MAX_SCOUT_REPORTS) return "더 이상 좁힐 관찰이 없습니다.";
  writeScoutingState(s, { reports: { ...scoutReportsMap(s), [id]: n + 1 } });
}

export interface ScoutCandidate {
  person: string; card?: SeasonCard; offerCardId?: string; owner: string; ovr?: number; bestOwned?: number; delta?: number;
  age?: number; estimated: boolean; salary?: number; fee?: number; cost?: number; reserve?: number; years: number;
  blocked?: string; reasons: string[]; warnings: string[]; score: number;
}
export interface BenchSuggestion { key: string; name: string; pos: number; ovr: number; starterOvr: number; fatigue: number; promise?: string }
export const SCOUT_GOALS: Record<ScoutGoal, string> = { upgrade: "전력 보강", value: "연봉 대비 전력", development: "육성 검토 · 만 21세 이하", watch: "관심 선수" };
export function scoutPreferences(s: Save): ScoutPreferences {
  const p = s.scouting;
  return { goal: p && Object.prototype.hasOwnProperty.call(SCOUT_GOALS, p.goal) ? p.goal : "upgrade", pos: p && Number.isInteger(p.pos) && Number(p.pos) >= 0 && Number(p.pos) < 5 ? Number(p.pos) : "all", affordableOnly: p?.affordableOnly !== false };
}
export const scoutWatch = (s: Save): string[] => [...new Set((s.scouting?.watch ?? []).filter(p => typeof p === "string"))].slice(0, 20);
export function setScoutPreferences(s: Save, p: ScoutPreferences): void {
  if (s.mode !== "story" || !s.story) return;
  writeScoutingState(s, { ...p, watch: scoutWatch(s) });
}
export function toggleScoutWatch(s: Save, person: string): string | undefined {
  if (s.mode !== "story" || !s.story) return "프랜차이즈에서 이용할 수 있습니다.";
  const watch = scoutWatch(s), index = watch.indexOf(person);
  if (index >= 0) watch.splice(index, 1);
  else {
    if (!cardForYear(person, s.story.year)) return "현재 연도에 확인된 선수 기록이 없습니다.";
    if (watch.length >= 20) return "관심 선수는 20명까지 저장할 수 있습니다.";
    watch.push(person);
  }
  writeScoutingState(s, { watch });
}
const effective = (c: SeasonCard, year: number): number => c.year < Math.min(year, 2026) ? Math.max(5, Math.round(c.percentile) - DECAY_PCT) : c.percentile;
function ownedOvr(s: Save, person: string, key: string, pos?: number): number | undefined {
  const p = PL[key];
  if (p?.cardYear != null && p.cardYear <= s.story!.year) return p.pct.ovr;
  const r = cardForYear(person, s.story!.year, pos);
  return r ? effective(r.card, s.story!.year) : undefined;
}
function bestOwned(s: Save, pos: number): number | undefined {
  const values = s.story!.contracts.filter(c => (PL[c.key]?.pos ?? CARDS[c.cardId]?.posIdx) === pos).map(c => ownedOvr(s, c.person, c.key, pos)).filter((x): x is number => x != null);
  return values.length ? Math.max(...values) : undefined;
}
export function scoutBench(s: Save): BenchSuggestion[] {
  if (!s.story || s.story.phase !== "regular") return [];
  return s.story.contracts.flatMap(c => {
    const p = PL[c.key], keys = s.starters[s.team] ?? [];
    if (!p || c.years <= 0 || keys.includes(c.key)) return [];
    const current = keys[p.pos], old = s.story!.contracts.find(x => x.key === current), base = old && ownedOvr(s, old.person, current, p.pos), power = ownedOvr(s, c.person, c.key, p.pos);
    if (base == null || power == null || power <= base) return [];
    const promise = old && s.rotation?.promises[old.person];
    return [{ key: c.key, name: p.name, pos: p.pos, ovr: power, starterOvr: base, fatigue: playerTraining(s, c.key)?.fatigue ?? 0, promise: promise ? `${promise.name} 첫 선발 약속 ${promise.starts}/${promise.target} · 기회 ${promise.opportunities}/4` : undefined }];
  }).sort((a, b) => (b.ovr - b.starterOvr) - (a.ovr - a.starterOvr) || cmpStr(a.key, b.key));
}
function offlineBudget(s: Save, c: SeasonCard, context: "fa" | "tryout"): { reserve: number; blocked?: string; years: number } {
  const st = s.story!, stove = st.stove, salary = storySalary(c, st.tier), years = context === "tryout" ? 2 : 1;
  const pending = (context === "tryout" ? stove?.tryoutOffers : stove?.pendingBids)?.filter(b => b.team === s.team) ?? [];
  // 모두 체결돼도 기존 계약을 지킬 수 있도록 기존 선수·다른 입찰을 전액 남깁니다.
  const reserve = moneyRound(upcomingSalaryDue(st.contracts) + seasonReserve(s) + pending.reduce((n, b) => n + b.salary * (b.years > 1 ? 2 : 1), 0) + (years > 1 ? salary : 0));
  let blocked: string | undefined;
  if (s.session || st.ended) blocked = "진행 중 경기 또는 종료된 커리어에서는 제안할 수 없습니다.";
  else if (!stove || st.phase !== (context === "tryout" ? "tryout" : "stove") || stove.closed || context === "tryout" && stove.tryoutResults) blocked = "현재 모집 기간이 아닙니다.";
  else if (context === "fa" && !canBidNow(s)) blocked = "1주차는 검토 기간입니다. 입찰은 2주차부터입니다.";
  else if (pending.some(b => b.person === c.pkey)) blocked = "이미 이번 모집에 제안한 선수입니다.";
  else if (context === "tryout" && pending.length >= TRYOUT_MAX) blocked = "트라이아웃 제안 3명을 모두 사용했습니다.";
  else if (st.contracts.length + new Set(pending.map(b => b.person)).size >= 8) blocked = "기존 선수와 다른 제안을 포함하면 8명을 넘습니다.";
  else if (moneyRound(st.contracts.reduce((n, x) => n + x.salary, 0) + pending.reduce((n, b) => n + b.salary, 0) + salary) > moneyRound(payrollSoftCap(s, st.tier))) blocked = "기존 선수·다른 제안과 합쳐 연봉 한도를 넘습니다.";
  else if (moneyRound(s.eco.cash) < moneyRound(salary + reserve)) blocked = "기존 연봉·다른 제안·다년 계약·가입금 유보 후 자금이 부족합니다.";
  return { reserve, blocked, years };
}
function annotate(s: Save, c: ScoutCandidate, goal: ScoutGoal): ScoutCandidate {
  if (!c.card || c.ovr == null) return c;
  const profile = trainingProfile(PLAYER_BIRTHDATES[c.person], trainingDate(s)), base = bestOwned(s, c.card.posIdx);
  c.bestOwned = base; c.delta = base == null ? undefined : c.ovr - base; c.age = profile.age;
  const hole = !(s.starters[s.team] ?? [])[c.card.posIdx];
  c.reasons = [hole ? `${POS_KO[c.card.posIdx]} 선발 공백` : base == null ? "보유 선수 비교 기록 없음" : `같은 포지션 보유 최고 ${base} 대비 ${c.delta! >= 0 ? "+" : ""}${c.delta}`];
  if (c.estimated) c.warnings.push(`${c.card.year} 과거 기록 기반 추정 · 현재 연도 기록 없음`);
  if (c.card.small || c.card.games < 20) c.warnings.push("표본 부족 · 순위를 보수적으로 계산합니다.");
  if (c.card.limited) c.warnings.push("일부 지표 기록 없음 · 초기 시대 지표 제한");
  if (c.age == null) c.warnings.push("생년 정보 없음 · 육성 나이 기준 판단 보류");
  if (c.offerCardId && c.owner !== "FA" && c.owner !== "트라이아웃") c.warnings.push("원 소속 대체 선수와 구단 합의가 필요합니다.");
  c.warnings.push("선수 동의·경쟁 구단의 제안에 따라 영입이 거절될 수 있습니다.");
  const penalty = c.card.small || c.card.games < 20 ? 3 : 0;
  c.score = goal === "value" ? Math.max(0, c.delta ?? c.ovr) / Math.max(.01, c.salary! + c.fee!) - penalty : goal === "development" ? c.ovr + (21 - (c.age ?? 21)) * 2 - penalty : (hole ? 1000 : (c.delta ?? 0) * 10) + c.ovr * .1 - penalty;
  return c;
}
export function scoutingReport(s: Save, context: ScoutContext, pref = scoutPreferences(s), query = ""): { candidates: ScoutCandidate[]; total: number; blocked: number; missingEvidence: number; notice?: string } {
  if (s.mode !== "story" || !s.story) return { candidates: [], total: 0, blocked: 0, missingEvidence: 0, notice: "프랜차이즈에서 이용할 수 있습니다." };
  const st = s.story, own = new Set(st.contracts.map(c => c.person)); let missingEvidence = 0;
  let candidates: ScoutCandidate[] = [];
  if (context === "season") {
    candidates = seasonCandidates(s).map(c => annotate(s, { person: c.person, card: c.card, offerCardId: c.card.id, owner: c.owner, ovr: c.ovr, estimated: c.card.year < Math.min(st.year, 2026), salary: c.salary, fee: c.fee, cost: moneyRound(c.fee + seasonSalaryDue(s, c.salary)), reserve: seasonReserve(s), years: 1, blocked: seasonScoutError(s, c), reasons: [], warnings: [], score: 0 }, pref.goal));
  } else {
    const pool = context === "tryout" ? st.stove?.tryoutPool : st.stove?.faPool;
    const people = new Set<string>();
    for (const id of pool ?? []) {
      const offer = CARDS[id]; if (!offer || own.has(offer.pkey) || people.has(offer.pkey)) continue; people.add(offer.pkey);
      const r = cardForYear(offer.pkey, st.year, offer.posIdx);
      if (!r) { missingEvidence++; continue; }
      const budget = offlineBudget(s, offer, context);
      candidates.push(annotate(s, { person: offer.pkey, card: r.card, offerCardId: offer.id, owner: context === "tryout" ? "트라이아웃" : "FA", ovr: effective(r.card, st.year), estimated: r.estimated, salary: storySalary(offer, st.tier), fee: 0, cost: storySalary(offer, st.tier), reserve: budget.reserve, years: budget.years, blocked: budget.blocked, reasons: [], warnings: offer.year > st.year ? ["계약 대상은 다음 시즌 카드 · 추천 능력 비교는 현재 확인된 기록만 사용합니다."] : [], score: 0 }, pref.goal));
    }
  }
  const total = candidates.length, blocked = candidates.filter(c => !!c.blocked).length;
  if (pref.goal === "watch") {
    const map = new Map(candidates.map(c => [c.person, c]));
    candidates = scoutWatch(s).map(person => {
      const found = map.get(person); if (found) return found;
      const r = cardForYear(person, st.year);
      const rosters = context === "season" ? s.inSeason?.year === st.year ? s.inSeason.rosters : {} : st.stove?.aiContracts ?? {};
      const owner = own.has(person) ? s.team : Object.entries(rosters).find(([, cs]) => cs.some(c => c.person === person))?.[0] ?? "기록 없음";
      return annotate(s, { person, card: r?.card, owner, ovr: r ? effective(r.card, st.year) : undefined, estimated: r?.estimated ?? false, years: 1, blocked: own.has(person) ? "이미 보유한 선수입니다." : "현재 시장에 제안할 수 있는 대상이 아닙니다.", reasons: ["현재 연도 기록 없음"], warnings: [], score: 0 }, pref.goal);
    });
  } else {
    if (pref.goal === "upgrade" || pref.goal === "value") candidates = candidates.filter(c => c.card && (!(s.starters[s.team] ?? [])[c.card.posIdx] || c.delta != null && c.delta > 0));
    if (pref.goal === "development") candidates = candidates.filter(c => c.age != null && c.age <= 21);
    if (pref.affordableOnly) candidates = candidates.filter(c => !c.blocked || c.blocked.startsWith("1주차"));
    candidates.sort((a, b) => b.score - a.score || cmpStr(a.person, b.person));
  }
  candidates = candidates.filter(c => pref.pos === "all" || c.card?.posIdx === pref.pos);
  if (query.trim()) candidates = candidates.filter(c => `${c.card?.name ?? ""} ${c.person}`.toLowerCase().includes(query.trim().toLowerCase()));
  const notice = context === "season" ? seasonMarketClosed(s) ?? (!s.inSeason || s.inSeason.year !== st.year ? "주간 시장 갱신 후 추천을 확인할 수 있습니다." : undefined) : !st.stove || st.phase !== (context === "tryout" ? "tryout" : "stove") || st.stove.closed ? "현재 모집 기간이 아닙니다. 관심 선수 기록은 확인할 수 있습니다." : context === "fa" && !canBidNow(s) ? "1주차는 검토 기간입니다. 조건 선택은 2주차부터 가능합니다." : undefined;
  return { candidates: pref.goal === "watch" ? candidates : candidates.slice(0, 6), total, blocked, missingEvidence, notice };
}
export function openingScout(year: number, cap: number, selected: string[], priceOf: (c: SeasonCard) => number = c => storySalary(c, "CK")): { card: SeasonCard; ovr: number; salary: number; reserve: number }[] {
  if (selected.length >= 8) return [];
  const people = new Set(selected.map(id => CARDS[id]?.pkey)), filled = new Set<number>(selected.flatMap(id => CARDS[id] ? [CARDS[id].posIdx] : []));
  const list = franchisePlayers(year).filter(c => !people.has(c.pkey));
  const holes = [0, 1, 2, 3, 4].filter(pos => !filled.has(pos));
  if (selected.length + holes.length > 8) return [];
  const used = moneyRound(selected.reduce((n, id) => n + (CARDS[id] ? priceOf(CARDS[id]) : 0), 0));
  return list.filter(c => !holes.length || holes.includes(c.posIdx)).flatMap(card => {
    const salary = moneyRound(priceOf(card)); if (!Number.isFinite(salary) || salary <= 0) return [];
    let reserve = 0;
    for (const pos of holes.filter(p => p !== card.posIdx)) {
      const costs = list.filter(c => c.posIdx === pos && c.pkey !== card.pkey).map(priceOf).filter(n => Number.isFinite(n) && n > 0);
      if (!costs.length) return [];
      reserve += Math.min(...costs);
    }
    reserve = moneyRound(reserve);
    return moneyRound(used + salary + reserve) <= moneyRound(cap) ? [{ card, ovr: effective(card, year), salary, reserve }] : [];
  }).sort((a, b) => b.ovr - a.ovr || a.salary - b.salary || cmpStr(a.card.id, b.card.id)).slice(0, 3);
}
