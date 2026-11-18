import { CH, PL, POS_KO } from "../data";
import type { SeriesRec } from "../game/season";
import { ChampIcon, TeamChip } from "../ui";
import { useSave } from "../store";
import { TacticsReview } from "./Tactics";

export function SeriesDetail({ sr }: { sr: SeriesRec }) {
  const s = useSave();
  return (
    <div className="sd">
      {sr.games.map((g, i) => (
        <div key={i} className="sd-g">
          <div className="row between wrap"><b>{i + 1}세트 · {g.winner} 승 · {g.dur}분 · 킬 {g.kills[0]}:{g.kills[1]}</b><span className="muted sm">선택권 {g.holder} · 선픽 {g.firstSide === "B" ? g.blue : g.red} · 경기 전 블루 승리 확률 {(g.pPre * 100).toFixed(0)}%</span></div>
          {(["B", "R"] as const).map((sd) => (
            <div key={sd} className="sd-side">
              <span className={"side-dot " + sd}>{sd === "B" ? "블루" : "레드"}</span><TeamChip t={sd === "B" ? g.blue : g.red} size="sm" />
              <span className="sd-picks">{[...g.picks[sd]].sort((a, b) => a.pos - b.pos).map((p) => <span key={p.c} title={`${POS_KO[p.pos]} ${PL[g.lineup[sd][p.pos]]?.name} · ${CH[p.c].ko}`}><ChampIcon id={p.c} size={30} /></span>)}</span>
              <span className="sd-bans">{g.bans[sd].map((c) => <ChampIcon key={c} id={c} size={20} dim />)}</span>
            </div>
          ))}
          <div className="muted sm">MVP(평점 1위): {PL[g.mvp]?.name}</div>
          <TacticsReview record={g.tactics} side={g.red === s?.team ? "R" : "B"} />
          {g.training && <div className="muted sm">훈련 성장·피로 (경기 당시 게임 효과): {(["B", "R"] as const).map((side) => {
            const t = g.training![side];return `${side === "B" ? g.blue : g.red} 피지컬 +${(t.mechanics * 100).toFixed(2)}% / 전략 +${(t.strategy * 100).toFixed(2)}% / 피로 −${(t.fatigue * 100).toFixed(2)}%`;
          }).join(" · ")}</div>}
        </div>
      ))}
    </div>
  );
}
