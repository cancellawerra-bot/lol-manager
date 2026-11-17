import { POS_KO, PL } from "../data";
import { useSave, mutate, fillSchedule, setStarter } from "../store";
import { Card, PName, Pct } from "../ui";
import type { DayAct } from "../game/season";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const ACT: { id: DayAct; t: string }[] = [{ id: "train", t: "훈련" }, { id: "scrim", t: "스크림" }, { id: "rest", t: "휴식" }, { id: "", t: "미정" }];

export default function Squad() {
  const s = useSave()!;
  const keys = s.starters[s.team] ?? [];
  const all = [...keys, ...((s.mode === "roster" ? [] : s.cards.filter((k) => !keys.includes(k))))];
  const setAct = (k: string, d: number, a: DayAct): void => {
    mutate((x) => {
      const row = [...(x.sched[k] ?? ["", "", "", "", "", "", ""])];
      row[d] = a; x.sched[k] = row;
      const people = x.starters[x.team] ?? [];
      x.schedOk = people.every((p) => (x.sched[p] ?? []).every(Boolean) && (x.sched[p] ?? []).includes("rest"));
    });
  };
  return (
    <div className="col gap">
      <Card title="선수단 일정" right={<button className="btn sm" data-testid="delegate-sched" onClick={() => fillSchedule()}>수석코치에게 맡기기</button>}>
        <p className="muted sm">한 주에 하루는 휴식으로 두세요. 빈 칸이 있거나 휴식이 없으면 경기를 진행할 수 없습니다. 한 번 정하면 매주 같은 패턴이 이어집니다.</p>
        <div className="tbl-wrap">
          <table className="tbl sched-grid">
            <thead><tr><th>선수</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
            <tbody>
              {keys.map((k, i) => (
                <tr key={k}>
                  <td><small className="muted">{POS_KO[i]}</small> <PName k={k} /></td>
                  {(s.sched[k] ?? ["","","","","","",""]).map((a, d) => (
                    <td key={d}>
                      <select value={a} onChange={(e) => setAct(k, d, e.target.value as DayAct)}>
                        {ACT.map((x) => <option key={x.id || "e"} value={x.id}>{x.t}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={s.schedOk ? "ok sm" : "err sm"}>{s.schedOk ? "일정이 준비되었습니다." : "빈 칸을 채우고, 선수마다 휴식일을 하나 이상 넣어 주세요."}</p>
      </Card>
      <Card title="선발 라인업">
        <table className="tbl">
          <thead><tr><th>포지션</th><th>선수</th><th>종합</th><th>교체</th></tr></thead>
          <tbody>
            {keys.map((k, i) => {
              const p = PL[k];
              const opts = all.filter((x) => PL[x]?.pos === i || x === k);
              return (
                <tr key={k}>
                  <td>{POS_KO[i]}</td>
                  <td><PName k={k} /> {p?.small && <span className="tag warn">표본 부족</span>}</td>
                  <td><Pct v={p?.pct.ovr ?? 0} /></td>
                  <td>{opts.length > 1 && <select value={k} onChange={(e) => setStarter(s.team, i, e.target.value)}>{opts.map((x) => <option key={x} value={x}>{PL[x]?.label ?? PL[x]?.name ?? x}</option>)}</select>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
