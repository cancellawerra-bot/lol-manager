// 선수 카드 공통 부품 (v2.24.0, 2026-11-22): 등급색 능력치·국제대회 뱃지·4대 능력치 미니 막대.
// 시즌 카드에는 챔피언 정보가 없으므로 아이콘을 지어내지 않고 능력치 숫자를 크게 보여 줍니다. 팀 로고·선수 사진은 쓰지 않습니다.
import type { SeasonCard } from "./types";
import { ratingColor } from "./rating";

export type HonorChip = { t: string; k: "w1" | "w2" | "w3"; e: "ev-w" | "ev-m" };

/** 그해 국제대회 성적만 뱃지로 (다음 시즌 이월 표시는 뺍니다). 예: "2023 월즈 우승" → "월즈 우승" */
export function honorChips(c: SeasonCard): HonorChip[] {
  return (c.honors ?? []).filter((h) => !h.includes("이월")).map((h) => {
    const t = h.replace(/^\d{4}\s*/, "");
    return { t, k: /준우승/.test(t) ? "w2" : /우승/.test(t) ? "w1" : "w3", e: /^MSI/.test(t) ? "ev-m" : "ev-w" } as HonorChip;
  });
}

export function HonorChips({ c }: { c: SeasonCard }) {
  const hs = honorChips(c);
  if (!hs.length) return null;
  return <span className="pc-chips">{hs.map((h) => <em key={h.t} className={"pc-chip " + h.k + " " + h.e}>{h.t}</em>)}</span>;
}

const FOUR: ["fight" | "press" | "judge" | "ops", string][] = [["fight", "교전"], ["press", "압박"], ["judge", "판단"], ["ops", "운영"]];

/** 카드 안 4대 능력치 (60–99, 기록 없으면 –) */
export function MiniFour({ c }: { c: SeasonCard }) {
  if (!c.four) return null;
  return (
    <div className="pc-four" aria-label="4대 능력치">
      {FOUR.map(([k, n]) => {
        const v = c.four![k];
        return (
          <span key={k} className="pc-f">
            <small>{n}</small>
            <span className="pc-fbar">{v != null && <i style={{ width: `${Math.max(4, ((v - 60) / 39) * 100)}%`, background: ratingColor(v) }} />}</span>
            <b style={v != null ? { color: ratingColor(v) } : undefined}>{v ?? "–"}</b>
          </span>
        );
      })}
    </div>
  );
}
