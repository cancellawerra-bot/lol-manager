// 판타지 드래프트 규칙 (2026-11-22, Grok, v2.16.0)
// - 한 카드는 한 팀만 지명합니다(모든 팀 공통). 같은 실존 인물은 한 팀에 한 장.
// - 5라운드 스네이크, 포지션마다 한 명. 이미 채운 포지션은 잠급니다.
// - "이번 픽 최대 X억" = 남은 예산 − (남은 다른 포지션을 가장 싸게 채우는 비용). 이 금액을 넘는 카드는 잠가서
//   어떤 순서로 골라도 드래프트가 막히지 않습니다.
// - AI는 화면 능력치(cardRating) 위주로 고르되, 남은 예산과 포지션을 보고 약간의 무작위성을 둡니다.
// 판타지 전용이며 스토리 모드 경제·밸런스와 무관합니다.
import { CARDS, CARDS_FILE } from "../data";
import type { SeasonCard } from "../types";
import { cardRating } from "../rating";
import { fmtMoney, moneyRound } from "./money";
import type { Rng } from "./rng";

export const FANTASY_ROUNDS = 5;
export const FANTASY_TEAMS = 10;
export type Rosters = Record<string, string[]>;

export const snakeOrder = (order: string[], round: number): string[] => (round % 2 === 0 ? order : [...order].reverse());
export const whoPicks = (order: string[], round: number, pick: number): string | undefined => (round < FANTASY_ROUNDS ? snakeOrder(order, round)[pick] : undefined);

/** 카드 id → 지명한 팀 약칭 */
export function takenMap(rosters: Rosters): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [t, ids] of Object.entries(rosters)) for (const id of ids) out[id] = t;
  return out;
}

export const openPositions = (mine: string[]): number[] => [0, 1, 2, 3, 4].filter((p) => !mine.some((id) => CARDS[id]?.posIdx === p));
export const spentOf = (mine: string[]): number => moneyRound(mine.reduce((n, id) => n + (CARDS[id]?.salary ?? 0), 0));

let poolSrc: unknown = null;
let pool: SeasonCard[][] = [];
/** 포지션별로 연봉 낮은 순 정렬한 카드 목록 (카드 파일이 바뀌면 다시 만듭니다) */
function byPos(): SeasonCard[][] {
  if (poolSrc !== CARDS_FILE || !pool.length) {
    poolSrc = CARDS_FILE;
    const all = Object.values(CARDS);
    pool = [0, 1, 2, 3, 4].map((p) => all.filter((c) => c.posIdx === p).sort((a, b) => a.salary - b.salary));
  }
  return pool;
}

/** 아직 아무도 지명하지 않았고 우리 팀에 같은 인물이 없는 카드 중, 그 포지션 최저 연봉 카드 */
function cheapest(pos: number, taken: Record<string, string>, people: Set<string>): SeasonCard | undefined {
  return byPos()[pos].find((x) => !taken[x.id] && !people.has(x.pkey));
}

export type DraftCtx = { me: string; cap: number; taken: Record<string, string>; mine: string[]; open: number[]; people: Set<string>; spent: number; cheap: Record<number, SeasonCard | undefined> };

/** 한 팀의 지금 지명 상황 (카드마다 다시 계산하지 않도록 한 번만 만듭니다) */
export function draftCtx(me: string, rosters: Rosters, cap: number): DraftCtx {
  const taken = takenMap(rosters), mine = rosters[me] ?? [], open = openPositions(mine);
  const people = new Set(mine.map((id) => CARDS[id]?.pkey));
  const cheap: Record<number, SeasonCard | undefined> = {};
  for (const p of open) cheap[p] = cheapest(p, taken, people);
  return { me, cap, taken, mine, open, people, spent: spentOf(mine), cheap };
}

/** 이 포지션 카드를 지금 뽑을 때 쓸 수 있는 최대 금액 (extraPerson: 이번에 뽑을 카드의 인물) */
export function ctxPickMax(ctx: DraftCtx, pos: number, extraPerson?: string): number {
  let reserve = 0;
  for (const p of ctx.open) {
    if (p === pos) continue;
    let c = ctx.cheap[p];
    if (c && extraPerson && c.pkey === extraPerson) c = cheapest(p, ctx.taken, new Set([...ctx.people, extraPerson]));
    reserve += c ? c.salary : Infinity;
  }
  return moneyRound(ctx.cap - ctx.spent - reserve);
}

export const pickMaxFor = (pos: number, mine: string[], rosters: Rosters, cap: number, me: string): number => ctxPickMax(draftCtx(me, { ...rosters, [me]: mine }, cap), pos);

/** 남은 포지션 중 가장 큰 "이번 픽 최대" 금액 */
export function pickMax(me: string, rosters: Rosters, cap: number): number {
  const ctx = draftCtx(me, rosters, cap);
  if (!ctx.open.length) return 0;
  return Math.max(...ctx.open.map((p) => ctxPickMax(ctx, p)));
}

/** 이 카드를 지금 이 팀이 지명할 수 없는 이유 (없으면 undefined) */
export function ctxLockReason(c: SeasonCard, ctx: DraftCtx, teamName: (t: string) => string = (t) => t): string | undefined {
  const owner = ctx.taken[c.id];
  if (owner) return owner === ctx.me ? "우리 팀 지명" : `${teamName(owner)} 지명`;
  if (ctx.people.has(c.pkey)) return "같은 선수의 다른 시즌 카드가 이미 있습니다";
  if (!ctx.open.includes(c.posIdx)) return "이미 채운 포지션입니다";
  const max = ctxPickMax(ctx, c.posIdx, c.pkey);
  if (moneyRound(c.salary) > max) return `이번 픽 최대 ${fmtMoney(Math.max(0, max))}을 넘습니다`;
  return undefined;
}

export const lockReason = (c: SeasonCard, me: string, rosters: Rosters, cap: number, teamName?: (t: string) => string): string | undefined => ctxLockReason(c, draftCtx(me, rosters, cap), teamName);

/** AI 지명: 화면 능력치 위주 + 예산 배분 + 약간의 무작위 */
export function aiPick(team: string, rosters: Rosters, cap: number, rng: Rng): string | undefined {
  const ctx = draftCtx(team, rosters, cap), open = ctx.open;
  if (!open.length) return undefined;
  const all = byPos().filter((_, p) => open.includes(p)).flat().filter((c) => !ctxLockReason(c, ctx));
  const cands = all.some((c) => !c.small) ? all.filter((c) => !c.small) : all;
  if (!cands.length) return undefined;
  const share = (cap - ctx.spent) / open.length;
  const score = (c: SeasonCard): number => cardRating(c) - 0.3 * Math.max(0, c.salary - share * 1.5);
  const top = cands.map((c) => ({ c, s: score(c) })).sort((a, b) => b.s - a.s).slice(0, 6);
  const w = top.map((_, i) => Math.pow(0.55, i));
  let r = rng.next() * w.reduce((a, b) => a + b, 0);
  for (let i = 0; i < top.length; i++) { r -= w[i]; if (r <= 0) return top[i].c.id; }
  return top[0].c.id;
}

/** 한 픽 적용 후 다음 순번 */
export function applyPick(id: string | undefined, order: string[], rosters: Rosters, round: number, pick: number): { rosters: Rosters; round: number; pick: number } {
  const who = whoPicks(order, round, pick);
  const next = id && who ? { ...rosters, [who]: [...(rosters[who] ?? []), id] } : rosters;
  let r = round, p = pick + 1;
  if (p >= order.length) { r += 1; p = 0; }
  return { rosters: next, round: r, pick: p };
}
