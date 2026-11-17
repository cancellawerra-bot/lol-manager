import { useState } from "react";
import { useSave } from "../store";
import { dateKo, STAGE_KO, SeriesRec } from "../game/season";
import { Card, TeamChip } from "../ui";
import { Modal } from "../ui";
import { SeriesDetail } from "./SeriesDetail";

export default function Schedule() {
  const s = useSave()!;
  const [mine, setMine] = useState(true);
  const [open, setOpen] = useState<SeriesRec | null>(null);
  const weeks = Array.from(new Set(s.days.map((d) => d.week)));
  return (
    <Card title="일정 · 결과" right={<div className="seg"><button className={mine ? "on" : ""} onClick={() => setMine(true)}>우리 팀</button><button className={!mine ? "on" : ""} onClick={() => setMine(false)}>전체</button></div>}>
      <div className="cal">
        {weeks.map((w) => {
          const days = s.days.map((d, i) => ({ d, i })).filter((x) => x.d.week === w);
          return (
            <div key={w} className={"cal-week" + (days.some((x) => x.i === s.day) ? " now" : "")}>
              <div className="cal-wh">{w <= 9 ? `${w}주차` : days[0].d.label}</div>
              {days.map(({ d, i }) => {
                const list = s.series.filter((x) => x.day === i && (!mine || x.a === s.team || x.b === s.team));
                return (
                  <div key={i} className={"cal-day" + (i === s.day ? " today" : i < s.day ? " past" : "")}>
                    <div className="cal-dh"><b>{dateKo(d.date)}</b><small className="muted">{STAGE_KO[d.stage]}{i === s.day ? " · 오늘" : ""}</small></div>
                    {list.length ? list.map((x) => (
                      <button key={x.id} className={"cal-m" + (x.a === s.team || x.b === s.team ? " mine" : "")} onClick={() => x.games.length && setOpen(x)} disabled={!x.games.length}>
                        <TeamChip t={x.a} size="sm" /><span className={x.winner === x.a ? "w" : ""}>{x.games.length ? x.sa : ""}</span><span className="muted">:</span><span className={x.winner === x.b ? "w" : ""}>{x.games.length ? x.sb : ""}</span><TeamChip t={x.b} size="sm" />
                      </button>
                    )) : <span className="muted sm">{d.stage === "R" ? "" : "대진 미정"}</span>}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title={open ? `${open.a} ${open.sa}:${open.sb} ${open.b} · ${STAGE_KO[open.stage]}` : ""} wide>
        {open && <SeriesDetail sr={open} />}
      </Modal>
    </Card>
  );
}
