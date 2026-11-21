// 화면에 보이는 "능력치" (2026-11-21, v2.15.0)
// 같은 포지션 순위(백분위)를 그대로 0~100으로 보여 주면 꼴찌는 0점, 정상급끼리도 수십 점씩 벌어집니다.
// 그래서 화면에는 국제대회 보정까지 들어간 실제 종합 점수(z)를 LCK 기준 능력치로 바꿔 보여 줍니다.
// 평균 선수 ≈ 85, 1표준편차 = 4점, 60~99 (2026-11-21 오너: 팀 간 차이를 줄이고 정상급은 90대). 교수님 평가 선수는 tools/owner_ratings.json. 경기 계산·연봉·교체 기준은 기존 퍼센타일(pct)을 그대로 씁니다.
import type { Player, SeasonCard } from "./types";

export const RATING_BASE = 85, RATING_PER_Z = 4, RATING_MIN = 60, RATING_MAX = 99;
/** 과거 카드로 추정한 선수(그해 카드 없음)는 화면 능력치도 조금 낮춥니다(퍼센타일 감쇠와 같은 방향). */
export const ESTIMATE_DROP = 3;

export const ratingFromZ = (z: number): number => Math.max(RATING_MIN, Math.min(RATING_MAX, Math.round(RATING_BASE + RATING_PER_Z * z)));
export const ratingOf = (p?: Player | null): number | null => (p ? p.rating ?? ratingFromZ(p.z?.ovr ?? 0) : null);
export const cardRating = (c: SeasonCard, estimated = false): number => Math.max(RATING_MIN, ratingFromZ(c.composite) - (estimated ? ESTIMATE_DROP : 0));
export const ratingColor = (r: number): string => (r >= 92 ? "var(--gold)" : r >= 88 ? "var(--good)" : r >= 84 ? "var(--teal)" : r >= 80 ? "var(--warn)" : "var(--bad)");
