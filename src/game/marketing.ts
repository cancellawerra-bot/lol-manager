// 마케팅(스토리·역사 모드): 굿즈(시즌 유니폼·시즌 자켓)와 팬미팅. 제작·행사 비용은 바로 나가고, 굿즈 판매 정산은 시즌 말 수입 때 합니다.
// 금액은 게임용 가상 금액이며, LCK는 규모가 크므로 단위(u)를 10배로 씁니다(2부는 1배).
import { PL } from "../data";
import { ratingOf } from "../rating";
import { addNews, standings, type Save } from "./season";
import { fmtMoney, moneyRound } from "./money";
import { Rng } from "./rng";
import { trainingPerson } from "./trainingRuntime";

export type GoodsKind = "uniform" | "jacket";
export type Qty = "none" | "s" | "m" | "l" | "xl";
export type Venue = "small" | "mid" | "gym";
export const GOODS_LABEL: Record<GoodsKind, string> = { uniform: "시즌 유니폼", jacket: "시즌 자켓" };
export const GOODS_DEMAND: Record<GoodsKind, number> = { uniform: 1, jacket: 0.6 };
export const QTY_LABEL: Record<Qty, string> = { none: "제작 X", s: "소량", m: "보통", l: "많이", xl: "대량" };
export const QTY_COST: Record<Qty, number> = { none: 0, s: 0.3, m: 0.6, l: 1.2, xl: 2.4 };
export const VENUE: Record<Venue, { label: string; seats: number; cost: number }> = {
  small: { label: "소극장", seats: 1000, cost: 0.25 }, mid: { label: "공연장", seats: 2500, cost: 0.6 }, gym: { label: "체육관", seats: 5000, cost: 1.2 },
};
export const SOLD_RETURN = 1.2, LEFTOVER_RETURN = 0.2, MAX_MODELS = 3, MEET_REVENUE = 2;

export interface GoodsOrder { qty: Qty; cost: number; models: string[]; settled?: boolean; sold?: number; net?: number }
export interface FanMeet { venue: Venue; attendance: number; fill: number; net: number; fansGain: number }
export interface MarketingState { version: 1; year: number; goods: Partial<Record<GoodsKind, GoodsOrder>>; meet?: FanMeet; history: string[] }

const active = (s: Save): boolean => !!s.story && !s.story.ended;
/** 금액 단위: LCK 10, 2부 1 */
export const unitOf = (s: Save): number => (s.story?.tier === "LCK" ? 10 : 1);
const clamp = (n: number, lo: number, hi: number): number => Math.max(lo, Math.min(hi, n));

export function initializeMarketing(s: Save): MarketingState | undefined {
  if (!active(s)) return;
  const year = s.story!.year;
  if (!s.marketing || s.marketing.year !== year) s.marketing = { version: 1, year, goods: {}, history: s.marketing?.history ?? [] };
  return s.marketing;
}
/** 선수 인기도(광고 모델 효과): 종합 능력치 60이 기준, 1점당 0.25%, 최대 3명 */
export function modelPower(_s: Save, keys: string[]): number {
  return keys.slice(0, MAX_MODELS).reduce((n, k) => n + (clamp(ratingOf(PL[k]) ?? 70, 40, 100) - 60) / 400, 0);
}
/** 광고 모델은 계약 중인 선발 선수만 인정(시즌 말에 벤치로 밀리면 효과 없음) */
function liveModels(s: Save, models: string[]): string[] {
  const starters = new Set(s.starters[s.team] ?? []);
  return models.filter((k) => starters.has(k) && !!PL[k]);
}
const rankFactor = (rank: number): number => rank <= 0 ? 1 : rank === 1 ? 1.4 : rank <= 3 ? 1.2 : rank <= 6 ? 1.0 : 0.8;
/** 승률 보정: 승률 50% = 1.0, 75% = 1.2, 25% = 0.8. 아직 경기가 없으면 1.0 */
const winFactor = (wr: number | undefined): number => wr === undefined ? 1 : 0.6 + clamp(wr, 0, 1) * 0.8;
export interface Form { rank: number; wr?: number; champ: boolean }
/** 이번 시즌 성적: 현재(시즌 말이면 최종) 순위·승률·우승 여부. 판매와 팬미팅 관객이 이 성적을 따라 움직입니다. */
export function seasonForm(s: Save, rankHint = 0): Form {
  const rows = standings(s), i = rows.findIndex((r) => r.t === s.team), me = i >= 0 ? rows[i] : undefined;
  const games = me ? me.w + me.l : 0;
  return { rank: rankHint || (games > 0 ? i + 1 : 0), wr: games >= 2 && me ? me.w / games : undefined, champ: s.champion === s.team };
}
/** 성적 종합 계수 = 순위 × 승률 × 우승(×1.15). 하위권·부진 0.64 ~ 우승권 1.9 */
export const formFactor = (f: Form): number => rankFactor(f.rank) * winFactor(f.wr) * (f.champ ? 1.15 : 1);
export const FORM_LOW: Form = { rank: 8, wr: 0.25, champ: false }, FORM_HIGH: Form = { rank: 1, wr: 0.85, champ: true };
/** 제작량이 아니라 "팔릴 수 있는 금액": 단위 × (0.5+팬심/100) × 모델 보정 × 상품 계수 × 성적 계수(순위·승률·우승) */
export function goodsDemand(s: Save, kind: GoodsKind, models: string[], form: Form | number): number {
  const f = typeof form === "number" ? formFactor({ rank: form, champ: false }) : formFactor(form);
  return moneyRound(unitOf(s) * (0.5 + s.eco.fans / 100) * (1 + modelPower(s, models)) * GOODS_DEMAND[kind] * f);
}
export interface GoodsPreview { qty: Qty; cost: number; soldLow: number; soldHigh: number; netLow: number; netHigh: number }
/** 제작량별 예상: 낮은 쪽은 하위권·부진, 높은 쪽은 우승권·호조 기준 */
export function goodsPreview(s: Save, kind: GoodsKind, models: string[]): GoodsPreview[] {
  return (Object.keys(QTY_COST) as Qty[]).map((qty) => {
    const cost = moneyRound(unitOf(s) * QTY_COST[qty]);
    const calc = (f: Form): { sold: number; net: number } => settleOne(cost, goodsDemand(s, kind, models, f));
    const lo = calc(FORM_LOW), hi = calc(FORM_HIGH);
    return { qty, cost, soldLow: lo.sold, soldHigh: hi.sold, netLow: lo.net, netHigh: hi.net };
  });
}
function settleOne(cost: number, demand: number): { sold: number; net: number } {
  if (cost <= 0) return { sold: 0, net: 0 };
  const sold = clamp(demand / cost, 0, 1);
  const revenue = cost * (sold * SOLD_RETURN + (1 - sold) * LEFTOVER_RETURN);
  return { sold, net: moneyRound(revenue - cost) };
}
export function goodsError(s: Save, kind: GoodsKind, qty: Qty, models: string[]): string | undefined {
  if (!active(s)) return "마케팅은 스토리·역사 모드에서만 할 수 있습니다.";
  if (s.session) return "경기 진행 중에는 정할 수 없습니다.";
  if (!(kind in GOODS_LABEL) || !(qty in QTY_COST)) return "알 수 없는 상품입니다.";
  const m = initializeMarketing(s)!;
  if (m.goods[kind]) return `${GOODS_LABEL[kind]}은(는) 올해 이미 만들었습니다.`;
  const cost = moneyRound(unitOf(s) * QTY_COST[qty]);
  if (cost > s.eco.cash) return `제작비 ${fmtMoney(cost)}이 부족합니다. 현재 ${fmtMoney(s.eco.cash)}.`;
  const ok = new Set(s.starters[s.team] ?? []);
  if (models.length > MAX_MODELS || models.some((k) => !ok.has(k))) return `광고 모델은 선발 선수 ${MAX_MODELS}명까지 고를 수 있습니다.`;
}
export function orderGoods(s: Save, kind: GoodsKind, qty: Qty, models: string[]): string {
  const err = goodsError(s, kind, qty, models); if (err) return err;
  const m = initializeMarketing(s)!, cost = moneyRound(unitOf(s) * QTY_COST[qty]);
  m.goods[kind] = { qty, cost, models: [...models] };
  s.eco.cash = moneyRound(s.eco.cash - cost);
  const text = qty === "none" ? `${GOODS_LABEL[kind]}은(는) 올해 만들지 않기로 했습니다.` : `${GOODS_LABEL[kind]} ${QTY_LABEL[qty]} 제작(제작비 ${fmtMoney(cost)}). 판매 정산은 시즌 말에 합니다.`;
  m.history.unshift(`${m.year} ${text}`); m.history.length = Math.min(30, m.history.length);
  if (qty !== "none") addNews(s, "season", `${GOODS_LABEL[kind]} 제작`, text + ` 광고 모델 ${models.length}명.`, s.team);
  return text;
}
export function meetError(s: Save, venue: Venue): string | undefined {
  if (!active(s)) return "마케팅은 스토리·역사 모드에서만 할 수 있습니다.";
  if (s.session) return "경기 진행 중에는 정할 수 없습니다.";
  if (!(venue in VENUE)) return "알 수 없는 장소입니다.";
  const m = initializeMarketing(s)!;
  if (m.meet) return "올해 팬미팅은 이미 열었습니다.";
  const cost = moneyRound(unitOf(s) * VENUE[venue].cost);
  if (cost > s.eco.cash) return `대관·제작비 ${fmtMoney(cost)}이 부족합니다. 현재 ${fmtMoney(s.eco.cash)}.`;
}
/** 찾아올 팬 수(추정 범위): 팬심과 지금 성적 기반, 실제는 이 범위 안에서 정해집니다 */
export function meetRange(s: Save): [number, number] {
  const base = (600 + s.eco.fans * 18) * clamp(Math.sqrt(formFactor(seasonForm(s))), 0.8, 1.25);   // 성적이 좋을 때 열면 관객이 늘고, 부진하면 줄어듭니다
  return [Math.round(base * 0.85), Math.round(base * 1.15)];
}
export function meetPreview(s: Save): { venue: Venue; label: string; seats: number; cost: number; fillLow: number; fillHigh: number; netLow: number; netHigh: number }[] {
  const [lo, hi] = meetRange(s);
  return (Object.keys(VENUE) as Venue[]).map((v) => {
    const cost = moneyRound(unitOf(s) * VENUE[v].cost), f = (n: number): number => Math.min(1, n / VENUE[v].seats);
    return { venue: v, label: VENUE[v].label, seats: VENUE[v].seats, cost, fillLow: f(lo), fillHigh: f(hi), netLow: moneyRound(f(lo) * cost * MEET_REVENUE - cost), netHigh: moneyRound(f(hi) * cost * MEET_REVENUE - cost) };
  });
}
export function holdMeet(s: Save, venue: Venue): string {
  const err = meetError(s, venue); if (err) return err;
  const m = initializeMarketing(s)!, v = VENUE[venue], cost = moneyRound(unitOf(s) * v.cost), [lo, hi] = meetRange(s);
  const rng = new Rng((s.seed ^ (m.year * 7919) ^ (venue.charCodeAt(0) * 104729)) >>> 0);
  const attendance = Math.round(lo + (hi - lo) * rng.next()), fill = Math.min(1, attendance / v.seats);
  const net = moneyRound(fill * cost * MEET_REVENUE - cost), fansGain = fill >= 0.8 ? 3 : fill >= 0.5 ? 2 : 1;
  s.eco.cash = moneyRound(s.eco.cash + net); s.eco.fans = clamp(s.eco.fans + fansGain, 0, 100);
  m.meet = { venue, attendance, fill, net, fansGain };
  const text = `${m.year} 팬미팅(${v.label}) — 관객 ${attendance.toLocaleString("ko-KR")}명(좌석의 ${Math.round(fill * 100)}%), 손익 ${net >= 0 ? "+" : ""}${fmtMoney(net)}, 팬심 +${fansGain}.`;
  m.history.unshift(text); m.history.length = Math.min(30, m.history.length);
  addNews(s, "season", "팬미팅 개최", text, s.team);
  return text;
}
/** 시즌 말 굿즈 정산(payIncome에서 호출): 광고 모델이 아직 선발일 때만 인기 보정이 붙습니다. 반환은 이번에 들어온 판매 순이익(제작비는 이미 지출). */
export function settleGoods(s: Save, rank: number): number {
  const m = initializeMarketing(s); if (!m) return 0;
  const form = seasonForm(s, rank);
  let net = 0; const parts: string[] = [];
  for (const kind of Object.keys(GOODS_LABEL) as GoodsKind[]) {
    const o = m.goods[kind]; if (!o || o.settled || o.cost <= 0) continue;
    const { sold } = settleOne(o.cost, goodsDemand(s, kind, liveModels(s, o.models), form));
    const revenue = moneyRound(o.cost * (sold * SOLD_RETURN + (1 - sold) * LEFTOVER_RETURN));
    o.settled = true; o.sold = sold; o.net = moneyRound(revenue - o.cost); net += revenue;
    parts.push(`${GOODS_LABEL[kind]} ${Math.round(sold * 100)}% 판매(수입 ${fmtMoney(revenue)}, 제작비 ${fmtMoney(o.cost)} → ${o.net >= 0 ? "+" : ""}${fmtMoney(o.net)})`);
  }
  if (parts.length) { m.history.unshift(`${m.year} 굿즈 정산 — ${parts.join(" · ")}`); m.history.length = Math.min(30, m.history.length); }
  return moneyRound(net);
}
/** 예상 장부용: 이번 시즌에 제작한 굿즈의 예상 판매 수입(제작비는 이미 지출) */
export function goodsIncomeEstimate(s: Save, rank: number): number {
  const m = s.marketing; if (!m || m.year !== s.story?.year) return 0;
  const form = seasonForm(s, rank);
  let sum = 0;
  for (const kind of Object.keys(GOODS_LABEL) as GoodsKind[]) {
    const o = m.goods[kind]; if (!o || o.settled || o.cost <= 0) continue;
    const sold = settleOne(o.cost, goodsDemand(s, kind, liveModels(s, o.models), form)).sold;
    sum += o.cost * (sold * SOLD_RETURN + (1 - sold) * LEFTOVER_RETURN);
  }
  return moneyRound(sum);
}
export const personOf = (s: Save, key: string): string => trainingPerson(s, key) ?? key;
