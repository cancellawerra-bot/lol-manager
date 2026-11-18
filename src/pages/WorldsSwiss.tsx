import { useState } from "react";
import type { Save, SeriesRec } from "../game/season";
import { swissRows } from "../game/swiss";
import { Card, Modal, TeamChip } from "../ui";
import { SeriesDetail } from "./SeriesDetail";

export default function WorldsSwiss({ s }: { s: Save }) {
  const st = s.story!.swiss!;
  const rows = swissRows(st, s.series);
  const [open, setOpen] = useState<SeriesRec | null>(null);
  const ko = s.series.filter((sr) => /^W-(QF|SF|F)/.test(sr.id));
  return <div className="grid" data-testid="worlds-swiss">
    <Card title={`${s.story!.year} 월즈 · 스위스`} className="span2">
      <p>3승이면 8강 진출, 3패면 탈락합니다. 같은 승패끼리 대결하며 진출·탈락 결정전은 Bo3, 나머지는 Bo1입니다.</p>
      <p className="muted sm">1라운드는 1풀–4풀·2풀–3풀, 같은 지역 대결 금지. {st.avoidRematches ? "2라운드부터 같은 지역 대결은 가능하고, 스위스 재대결은 금지됩니다." : "2023년 방식으로 2라운드부터 같은 지역 대결과 재대결이 가능합니다."} LCK 3장·해외 13팀과 추첨 풀은 게임의 축약 구성입니다. 해외 팀은 개별 선수 기록이 없는 시드 추정 전력입니다.</p>
      <div className="tbl-wrap"><table className="tbl" data-testid="swiss-table">
        <thead><tr><th>팀</th><th>전적</th><th>상태</th><th className="hide-s">추첨 풀</th><th className="hide-s">상대</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.t} className={r.t === s.team ? "me" : ""} data-team={r.t}>
          <td><TeamChip t={r.t} /></td><td><b>{r.w}</b>승 {r.l}패</td>
          <td><span className={r.w === 3 ? "tag good" : r.l === 3 ? "tag warn" : "tag"}>{r.w === 3 ? "8강 진출" : r.l === 3 ? "탈락" : "진행 중"}</span></td>
          <td className="hide-s">{r.pool}풀</td><td className="hide-s sm">{r.opponents.join(", ") || "경기 전"}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="muted sm">전적은 게임 안 시리즈 승패입니다. 같은 전적 안의 표시 순서는 순위나 진출 우선권을 뜻하지 않습니다.</p>
    </Card>
    <Card title="라운드별 대진 · 결과" className="span2">
      {Array.from({ length: st.round }, (_, i) => i + 1).map((round) => <div key={round} data-testid={`swiss-round-${round}`}>
        <h3>{round}라운드</h3>
        <div className="tbl-wrap"><table className="tbl compact"><thead><tr><th>대결 전 전적</th><th>대진</th><th>형식</th><th>결과</th></tr></thead><tbody>
          {s.series.filter((sr) => sr.swiss?.round === round).map((sr) => <tr key={sr.id}>
            <td>{sr.swiss!.w}승 {sr.swiss!.l}패</td><td>{sr.a} vs {sr.b}</td><td>Bo{sr.bo}</td>
            <td>{sr.winner ? <button className="btn ghost sm" onClick={() => setOpen(sr)}>{sr.sa}:{sr.sb} · {sr.winner} 승</button> : "경기 전"}</td>
          </tr>)}
        </tbody></table></div>
      </div>)}
    </Card>
    <Card title="월즈 8강 · 4강 · 결승" className="span2">
      <p className="muted sm">3승 무패 두 팀은 서로 반대편에서 3승 2패 팀과 8강전을 치릅니다. 나머지 네 팀은 추첨하며, 8강부터 모두 Bo5입니다.</p>
      {!ko.length ? <p>스위스가 끝나면 8강을 추첨합니다.</p> : <div className="bracket">{(["PO1", "SF", "F"] as const).map((stage) => <div className="br-col" key={stage}>
        <h4>{{ PO1: "8강", SF: "4강", F: "결승" }[stage]}</h4>
        {ko.filter((sr) => sr.stage === stage).map((sr) => <button className="br-m" key={sr.id} onClick={() => sr.games.length && setOpen(sr)}>
          <span className={sr.winner === sr.a ? "w" : ""}><TeamChip t={sr.a} size="sm" /><b>{sr.games.length ? sr.sa : ""}</b></span>
          <span className={sr.winner === sr.b ? "w" : ""}><TeamChip t={sr.b} size="sm" /><b>{sr.games.length ? sr.sb : ""}</b></span>
        </button>)}
      </div>)}</div>}
    </Card>
    <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.a} ${open.sa}:${open.sb} ${open.b} · Bo${open.bo}` : ""} wide>{open && <SeriesDetail sr={open} />}</Modal>
  </div>;
}
