import { useState } from "react";
import { useSave } from "../store";
import { standings, STAGE_KO, SeriesRec } from "../game/season";
import { Card, TeamChip, form5, Modal } from "../ui";
import { SeriesDetail } from "./SeriesDetail";
import { TM } from "../data";
import WorldsSwiss from "./WorldsSwiss";

export default function Standings() {
  const s = useSave()!;
  const rows = standings(s);
  const [open, setOpen] = useState<SeriesRec | null>(null);
  const po = s.series.filter((x) => x.stage !== "R");
  const box = (st: "PO1" | "SF" | "F") => po.filter((x) => x.stage === st);
  if (s.story?.swiss && s.series.some((sr) => sr.swiss)) return <WorldsSwiss s={s} />;
  return (
    <div className="grid">
      <Card title="정규 시즌 순위" className="span2">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>#</th><th>팀</th><th className="r">시리즈</th><th className="r">세트</th><th className="r">득실</th><th className="r hide-s">연속</th><th className="hide-s">최근 5</th><th className="r hide-s">실제 2026 R1-2</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.t} className={(r.t === s.team ? "me " : "") + (i === 1 ? "cut2 " : i === 5 ? "cut6" : "")}>
              <td>{i + 1}</td><td><a href={`#/scout/${r.t}`}><TeamChip t={r.t} full /></a></td><td className="r"><b>{r.w}</b>-{r.l}</td><td className="r">{r.gw}-{r.gl}</td>
              <td className="r">{r.gw - r.gl >= 0 ? "+" : ""}{r.gw - r.gl}</td><td className="r hide-s">{r.streak}</td><td className="hide-s">{form5(r.last)}</td><td className="r hide-s muted">{TM[r.t].real[0]}-{TM[r.t].real[1]}</td>
            </tr>
          ))}</tbody>
        </table></div>
        <p className="muted sm">1·2위는 플레이오프 준결승 직행, 3~6위는 1라운드(Bo5). 순위 기준: 시리즈 승수 → 세트 득실 → 상대 전적. 오른쪽 열은 실제 2026 LCK 정규 1·2라운드 성적(참고)입니다.</p>
      </Card>
      <Card title="플레이오프" className="span2">
        {!po.length ? <p className="muted">정규 시즌이 끝나면 대진이 정해집니다.</p> : (
          <div className="bracket">
            {(["PO1", "SF", "F"] as const).map((st) => (
              <div key={st} className="br-col"><h4>{STAGE_KO[st]}</h4>
                {box(st).map((x) => (
                  <button key={x.id} className="br-m" onClick={() => x.games.length && setOpen(x)}>
                    <span className={x.winner === x.a ? "w" : ""}><TeamChip t={x.a} size="sm" full /> <b>{x.games.length ? x.sa : ""}</b></span>
                    <span className={x.winner === x.b ? "w" : ""}><TeamChip t={x.b} size="sm" full /> <b>{x.games.length ? x.sb : ""}</b></span>
                  </button>
                ))}
                {!box(st).length && <div className="muted sm">대진 미정</div>}
              </div>
            ))}
          </div>
        )}
      </Card>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.a} ${open.sa}:${open.sb} ${open.b}` : ""} wide>{open && <SeriesDetail sr={open} />}</Modal>
    </div>
  );
}
