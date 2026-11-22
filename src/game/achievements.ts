// 도전 성과(스토리 모드): 월즈 우승만이 목표가 아니도록, 구단 연표에 이미 보관된 실제 기록에서 단계별 성과를 읽어 보여 줍니다.
// LCK 안의 성과(정규 순위·플레이오프·결승·우승)는 실제 시즌 기록이고, MSI·월즈는 우승 횟수만 기록합니다(해외 팀은 가상 시드 팀).
import type { Save } from "./season";
import { standings } from "./season";

export interface Achievement { id: string; label: string; done: boolean; detail: string }
const PO_STAGES = ["PO1", "SF", "F"];
const SPLIT_KO = { spring: "스프링", summer: "서머" } as const;

export function challengeLog(s: Save): Achievement[] | undefined {
  const st = s.story; if (!st) return;
  const splits = (s.clubTimeline?.splits ?? []).filter((x) => x.tier === "LCK" && x.complete);
  const when = (x: { year: number; split: "spring" | "summer" }): string => `${x.year} ${SPLIT_KO[x.split]}`;
  const first = <T,>(f: (x: (typeof splits)[number]) => T | false): { r: T; at: string } | undefined => { for (const x of splits) { const r = f(x); if (r) return { r: r as T, at: when(x) }; } return undefined; };
  const top = first((x) => x.rank === 1 && x.rank);
  const po = first((x) => x.matches.some((m) => PO_STAGES.includes(m.stage)));
  const fin = first((x) => x.matches.some((m) => m.stage === "F"));
  const best = splits.length ? Math.min(...splits.map((x) => x.rank)) : undefined;
  // 지금 진행 중인 스플릿 기록(아직 보관 전)도 반영
  const rows = standings(s), me = rows.findIndex((r) => r.t === s.team) + 1;
  const livePo = s.series.some((x) => PO_STAGES.includes(x.stage) && (x.a === s.team || x.b === s.team));
  const liveFin = s.series.some((x) => x.stage === "F" && (x.a === s.team || x.b === s.team));
  const out: Achievement[] = [
    { id: "top6", label: "플레이오프 진출", done: !!po || livePo, detail: po ? `${po.at}` : livePo ? "이번 스플릿" : "정규 시즌 상위권(6위 이내)을 노려 보세요" },
    { id: "rank1", label: "정규 시즌 1위", done: !!top || (me === 1 && st.tier === "LCK" && rows[0]?.w + rows[0]?.l > 0 && s.phase !== "regular"), detail: top ? top.at : best != null ? `최고 ${best}위` : "아직 완료한 스플릿이 없습니다" },
    { id: "final", label: "LCK 결승 진출", done: !!fin || liveFin, detail: fin ? fin.at : liveFin ? "이번 스플릿" : "플레이오프에서 결승까지" },
    { id: "lck", label: "LCK 우승", done: st.trophies.lck > 0, detail: st.trophies.lck > 0 ? `${st.trophies.lck}회` : "결승 승리" },
    { id: "msi", label: "MSI 우승", done: st.trophies.msi > 0, detail: st.trophies.msi > 0 ? `${st.trophies.msi}회` : "LCK 1시드로 출전" },
    { id: "worlds", label: "월즈 우승 (최종 목표)", done: st.trophies.worlds > 0, detail: st.trophies.worlds > 0 ? `${st.trophies.worlds}회` : "2027까지 도전" },
  ];
  return out;
}
