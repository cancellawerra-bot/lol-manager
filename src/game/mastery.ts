// 챔피언 숙련 4단계: 2026 LCK에서 그 챔피언을 몇 경기 해 봤는지로 나눕니다(전체 선수 기록 분포 기준:
// 중앙값 3경기, 상위 25%가 7경기 이상, 상위 10%가 11경기 이상). 과거 시즌 카드에는 챔피언별 기록이 없어 쓰지 않습니다.
export type TierId = "intro" | "skilled" | "expert" | "master";
export interface Tier { id: TierId; ko: string; min: number; desc: string }
export const TIERS: Tier[] = [
  { id: "intro", ko: "입문", min: 1, desc: "1~2경기" },
  { id: "skilled", ko: "숙련", min: 3, desc: "3~6경기" },
  { id: "expert", ko: "전문", min: 7, desc: "7~11경기" },
  { id: "master", ko: "장인", min: 12, desc: "12경기 이상" },
];
export const masteryOf = (games: number): Tier => [...TIERS].reverse().find((t) => games >= t.min) ?? TIERS[0];

/** 선수의 챔피언 풀을 단계별로 센 요약. */
export function masterySummary(pool: [string, number, number][]): Record<TierId, number> {
  const out: Record<TierId, number> = { intro: 0, skilled: 0, expert: 0, master: 0 };
  for (const [, n] of pool) if (n > 0) out[masteryOf(n).id]++;
  return out;
}
