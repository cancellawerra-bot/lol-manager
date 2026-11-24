import { PL } from "../data";
import type { Player, SeasonCard } from "../types";
import { RATING_MAX, RATING_MIN, cardRating, ratingOf } from "../rating";
import type { Save } from "./season";
import { cardForYear } from "./story";
import { careerYear } from "./yearRecords";
import { isOurPlayer, personId, scoutReports } from "./scouting";

/** 별점 반 칸: 2 = ★, 10 = ★★★★★. */
export const STAR_MIN = 2, STAR_MAX = 10, STAR_WIDTH_MAX = 4;

export type StarKind = "exact" | "range" | "none";
export interface StarEstimate {
  kind: StarKind;
  lo: number;
  hi: number;
  value: number | null;
  width: number;
  reports: number;
  text: string;
  reason: string;
}

const fnv = (s: string): number => {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
};

/** 60–63 → ★, 64–67 → ★½, …, 88–91 → ★★★★½, 92–99 → ★★★★★. */
export function ratingToHalf(r: number): number {
  const t = Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(r)));
  if (t >= 92) return STAR_MAX;
  return STAR_MIN + Math.floor((t - 60) / 4);
}

export function formatStars(lo: number, hi: number): string {
  const one = (h: number): string => {
    const n = Math.max(STAR_MIN, Math.min(STAR_MAX, Math.round(h)));
    const whole = Math.floor(n / 2), half = n % 2 === 1;
    return "★".repeat(whole) + (half ? "½" : "");
  };
  return lo === hi ? one(lo) : `${one(lo)}~${one(hi)}`;
}

export function knownRating(s: Save | null | undefined, personOrKey: string, card?: SeasonCard | null, player?: Player | null): number | null {
  const id = personId(s, personOrKey);
  if (player) { const r = ratingOf(player); if (r != null) return r; }
  if (s?.story) {
    const ct = s.story.contracts.find(c => c.person === id || c.key === personOrKey);
    if (ct) { const r = ratingOf(PL[ct.key]); if (r != null) return r; }
  }
  const c = card ?? cardForYear(id, careerYear(s))?.card;
  if (c) return cardRating(c, c.year < Math.min(careerYear(s), 2026));
  const p = PL[personOrKey] ?? Object.values(PL).find(x => x.personKey === id || x.key === id);
  return p ? ratingOf(p) : null;
}

function evidenceWidth(s: Save | null | undefined, id: string, card?: SeasonCard | null, player?: Player | null): number | null {
  const year = careerYear(s);
  const found = cardForYear(id, year);
  const c = card ?? found?.card;
  const p = player ?? (Object.values(PL).find(x => x.personKey === id || x.key === id) ?? undefined);
  if (!c && !p && knownRating(s, id, card, player) == null) return null;
  const small = !!(c?.small || p?.small);
  const current = c ? c.year >= Math.min(year, 2026) : year >= 2026;
  const games = c?.games ?? p?.games ?? 0;
  return !small && current && games >= 10 ? 2 : 4;
}

/** 가장 넓은 창을 사람마다 결정적으로 잡은 뒤, 너비만 줄여 항상 실제 별점을 포함하고 이전 구간의 부분집합이 되게 합니다. */
export function starWindow(trueHalf: number, width: number, salt: string, maxWidth = STAR_WIDTH_MAX): [number, number] {
  const t = Math.max(STAR_MIN, Math.min(STAR_MAX, Math.round(trueHalf)));
  const cap = Math.max(0, maxWidth);
  const w = Math.max(0, Math.min(cap, Math.round(width)));
  if (w <= 0) return [t, t];
  const off = fnv(salt) % (cap + 1);
  let lo = t - off, hi = lo + cap;
  if (lo < STAR_MIN) { hi += STAR_MIN - lo; lo = STAR_MIN; }
  if (hi > STAR_MAX) { lo -= hi - STAR_MAX; hi = STAR_MAX; }
  lo = Math.max(STAR_MIN, lo);
  hi = Math.min(STAR_MAX, hi);
  if (t < lo) lo = t;
  if (t > hi) hi = t;
  let cut = Math.max(0, hi - lo - w);
  const side = fnv(salt + ":side") % 2;
  while (cut > 0) {
    const left = t - lo, right = hi - t;
    if (left > right) lo += 1;
    else if (right > left) hi -= 1;
    else if (side === 0) lo += 1;
    else hi -= 1;
    cut -= 1;
  }
  if (t < lo) lo = t;
  if (t > hi) hi = t;
  return [lo, hi];
}

export function estimateOvr(s: Save | null | undefined, personOrKey: string, value?: number | null, card?: SeasonCard | null, player?: Player | null): StarEstimate {
  const id = personId(s, personOrKey);
  const reports = scoutReports(s, id);
  const v = value ?? knownRating(s, id, card, player);
  const none = (reason: string): StarEstimate => ({ kind: "none", lo: 0, hi: 0, value: v ?? null, width: 0, reports, text: "기록 없음", reason });
  if (v == null || !Number.isFinite(v)) return none("현재 연도에 확인된 능력치 기록이 없어 추정하지 않습니다.");
  if (isOurPlayer(s, id) || isOurPlayer(s, personOrKey)) {
    return { kind: "exact", lo: ratingToHalf(v), hi: ratingToHalf(v), value: v, width: 0, reports, text: String(v), reason: "우리 구단 선수라 정확한 능력치를 표시합니다." };
  }
  const base = evidenceWidth(s, id, card, player);
  if (base == null) return none("현재 연도에 확인된 능력치 기록이 없어 추정하지 않습니다.");
  const width = Math.max(0, base - reports * 2);
  const half = ratingToHalf(v);
  if (width <= 0) {
    return { kind: "exact", lo: half, hi: half, value: v, width: 0, reports, text: String(v), reason: "관찰 리포트를 충분히 작성해 능력치를 확인했습니다." };
  }
  const [lo, hi] = starWindow(half, width, `ovr:${id}`);
  const reason = reports > 0
    ? `확인된 시즌 기록과 관찰 리포트 ${reports}건으로 별점 구간을 좁혔습니다. 실제 능력치는 이 구간에 있습니다.`
    : base <= 2
      ? "해당 연도 시즌 기록을 바탕으로 별점 구간을 표시합니다. 실제 능력치는 이 구간에 있습니다."
      : "과거 기록이거나 표본이 적어 별점 구간이 넓습니다. 실제 능력치는 이 구간에 있습니다.";
  return { kind: "range", lo, hi, value: v, width: hi - lo, reports, text: formatStars(lo, hi), reason };
}

export function ratingLabel(s: Save | null | undefined, personOrKey: string, value?: number | null, card?: SeasonCard | null): string {
  const est = estimateOvr(s, personOrKey, value, card);
  if (est.kind === "none") return "기록 없음";
  if (est.kind === "exact") return String(est.value);
  return `${est.text} 추정`;
}

export const potentialNote = (est: StarEstimate): string => (
  est.kind === "exact" ? "성장 상한 100(기존 규칙). 숨은 잠재력 점수는 만들지 않습니다."
    : "성장 상한은 우리 구단 선수이거나 관찰이 끝난 뒤에만 확인합니다. 숨은 잠재력 점수는 만들지 않습니다."
);
