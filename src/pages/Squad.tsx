import { useState } from "react";
import { CORE, PL, POS_KO, TM, pctTxt } from "../data";
import { useSave, setStarter } from "../store";
import { formVal } from "../game/season";
import { Card, Pct, TeamChip } from "../ui";

export default function Squad() {
  const s = useSave()!;
  const [team, setTeam] = useState(s.team);
  const mine = team === s.team;
  const ps = TM[team].players.map((k) => PL[k]).sort((a, b) => a.pos - b.pos || b.games - a.games);
  return (
    <Card title={<>선수단 <span className="muted">· {TM[team].name}</span></>} right={
      <select value={team} onChange={(e) => setTeam(e.target.value)} aria-label="팀 선택">{CORE.teams.map((t) => <option key={t.short} value={t.short}>{t.short} {t.ko}{t.short === s.team ? " (우리 팀)" : ""}</option>)}</select>
    }>
      <div className="tbl-wrap"><table className="tbl squad">
        <thead><tr><th>포지션</th><th>선수</th><th className="r">종합</th><th className="r hide-s">라인전</th><th className="r hide-s">교전</th><th className="r hide-s">성장</th><th className="r hide-s">시야</th><th className="r hide-s">챔피언 폭</th><th className="r">2026 LCK</th><th className="r hide-s">폼</th><th>주전</th></tr></thead>
        <tbody>{ps.map((p) => {
          const st = s.starters[team][p.pos] === p.key;
          const alt = ps.filter((x) => x.pos === p.pos).length > 1;
          return (
            <tr key={p.key} className={st ? "starter" : ""}>
              <td className="muted">{POS_KO[p.pos]}</td>
              <td><a href={`#/player/${p.key}`} className="pname">{p.name}</a>{p.small && <span className="tag warn xs">표본 부족</span>}</td>
              <td className="r"><Pct v={p.pct.ovr} /></td>
              <td className="r hide-s">{p.pct.lane}</td><td className="r hide-s">{p.pct.fight}</td><td className="r hide-s">{p.pct.farm}</td><td className="r hide-s">{p.pct.vision}</td><td className="r hide-s">{p.pct.pool}</td>
              <td className="r">{p.games}경기 <span className="muted">{pctTxt(p.wins, p.games, 0)}</span></td>
              <td className="r hide-s">{s.form[p.key]?.length ? (formVal(s, p.key) >= 0 ? "+" : "") + formVal(s, p.key).toFixed(2) : "–"}</td>
              <td>{st ? <span className="tag good">주전</span> : mine && alt ? <button className="btn sm" onClick={() => setStarter(team, p.pos, p.key)}>주전으로</button> : <span className="muted sm">교체</span>}</td>
            </tr>
          );
        })}</tbody>
      </table></div>
      <p className="muted sm">{mine ? "포지션마다 주전 1명이 경기에 나갑니다. 표본이 적은 선수는 능력치가 포지션 평균 쪽으로 보정되어 있습니다." : <>다른 팀 선수단은 보기만 할 수 있습니다. <TeamChip t={team} size="sm" /> AI는 2026 LCK 출전 수가 가장 많은 선수를 주전으로 씁니다.</>}</p>
    </Card>
  );
}
