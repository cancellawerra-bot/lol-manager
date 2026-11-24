// 화면용 연도 기록. 그해 데이터가 있으면 보여주고, 없으면 다른 연도로 대체하지 않고 "기록 없음".
// 경기 판정·난이도·경제 계산에는 쓰지 않습니다.
import type { Save } from "./season";

export const NO_RECORD = "기록 없음";

export interface YearChampPro {
  p: number; b: number; w: number; eb?: number | null; pr?: number | null; tier?: number | null; ok?: boolean;
}
export interface YearSeason {
  year: number;
  games: number;
  blueWins?: number | null;
  redWins?: number | null;
  period?: string[];
  source?: string;
  champs: Record<string, YearChampPro>;
}
export interface YearMetaFile {
  meta: { builtAt: string; note: string; years: number[]; missing: string };
  seasons: Record<string, YearSeason>;
}

export let YEAR_META: YearMetaFile | undefined;

export function setYearMeta(data: YearMetaFile): void {
  YEAR_META = data;
}

/** 스토리·역사·창작(story.year)은 그 해, 그 외(로스터·판타지 등)는 2026 LCK. */
export function careerYear(s?: Save | { story?: { year?: number } } | null): number {
  const y = s?.story?.year;
  return typeof y === "number" && y > 0 ? y : 2026;
}

export function yearSeason(year: number): YearSeason | undefined {
  return YEAR_META?.seasons[String(year)];
}

export function hasYearMeta(year: number): boolean {
  return !!yearSeason(year);
}

/** 그해 팀 밴픽 성향·주력 챔피언 경기 수가 저장소(CORE 2026)에 있는 연도인지. 계산은 그대로 두고 표시만 가립니다. */
export function hasYearTeamStyles(year: number): boolean {
  return year === 2026;
}

export function hasYearPlayerPools(year: number): boolean {
  return year === 2026;
}

export function champProForYear(year: number, id: string): YearChampPro | undefined {
  return yearSeason(year)?.champs[id];
}

export function lckYearName(year: number): string {
  return `${year} LCK`;
}

export function blueSideHint(year: number): string {
  const rec = yearSeason(year);
  if (!rec || rec.blueWins == null || rec.redWins == null || !rec.games) {
    return `${lckYearName(year)} 진영 승률 ${NO_RECORD}. 상대가 순서를 고릅니다.`;
  }
  const mid = rec.blueWins > rec.redWins
    ? "블루 승률이 더 높았습니다"
    : rec.blueWins < rec.redWins
      ? "레드 승률이 더 높았습니다"
      : "블루·레드 승수가 같았습니다";
  return `${lckYearName(year)} ${mid} (블루 ${rec.blueWins}승 · 레드 ${rec.redWins}승, ${rec.games}경기). 상대가 순서를 고릅니다.`;
}

export function recOrNone(v: string | number | null | undefined, fmt?: (n: number) => string): string {
  if (v == null || v === "") return NO_RECORD;
  if (typeof v === "number") return fmt ? fmt(v) : String(v);
  return v;
}

/** 밴픽 추천 문구용. 점수(v)는 호출 쪽에서 기존 계산을 그대로 둡니다. */
export function metaReasonText(year: number, champId: string, fallbackEb?: number | null, fallbackP?: number, fallbackB?: number): string | undefined {
  const pro = champProForYear(year, champId);
  if (pro && pro.eb != null) return `${lckYearName(year)} 보정 승률 ${(pro.eb * 100).toFixed(1)}% · 픽 ${pro.p} 밴 ${pro.b}`;
  if (!hasYearMeta(year)) return undefined; // 호출 쪽에서 "기록 없음"
  if (year === 2026 && fallbackEb != null) return `${lckYearName(year)} 보정 승률 ${(fallbackEb * 100).toFixed(1)}% · 픽 ${fallbackP ?? 0} 밴 ${fallbackB ?? 0}`;
  return undefined;
}

export function playerChampReason(year: number, name: string, base: number, wins: number, bonus: number): string {
  const parts: string[] = [];
  if (hasYearPlayerPools(year) && base > 0) {
    parts.push(bonus > 0 ? `${name} ${lckYearName(year)} ${base}경기 + 연습 ${bonus}경기 상당` : `${name} ${lckYearName(year)} ${base}경기 ${wins}승`);
  } else if (bonus > 0) {
    parts.push(`${name} 연습 ${bonus}경기 상당`);
  }
  return parts.length ? parts.join(" · ") : `${name} ${NO_RECORD}`;
}

export function knownYears(): number[] {
  return YEAR_META?.meta.years ?? (YEAR_META?.seasons ? Object.keys(YEAR_META.seasons).map(Number).sort() : []);
}
