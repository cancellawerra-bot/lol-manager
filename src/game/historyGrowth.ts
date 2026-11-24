/** 역사 모드 약팀 성장 가속: 낮은 능력치에서만 온전히 적용되고, 90 이상에서는 붙지 않습니다. */
export const HISTORY_GROWTH_FULL = 80;
export const HISTORY_GROWTH_CUTOFF = 90;
export function historyGrowthSpeed(boost: number, rating: number): number {
  if (!(boost > 1)) return 1;
  if (rating >= HISTORY_GROWTH_CUTOFF) return 1;
  if (rating <= HISTORY_GROWTH_FULL) return boost;
  return 1 + (boost - 1) * ((HISTORY_GROWTH_CUTOFF - rating) / (HISTORY_GROWTH_CUTOFF - HISTORY_GROWTH_FULL));
}
