import { CH, CORE, PL, POS_KO, TM, fmt } from "../data";
import { useSave } from "../store";
import { standings } from "../game/season";
import { Card, ChampIcon, Ovr, TeamChip, Bar } from "../ui";

function ChampRow({ list, games, max = 10 }: { list: [string, number][]; games: number; max?: number }) {
  return (
    <ul className="crow">{list.slice(0, max).map(([c, n]) => (
      <li key={c}><ChampIcon id={c} size={34} /><div><b>{CH[c]?.ko ?? c}</b><small>{n}회 · {((n / games) * 100).toFixed(0)}%</small></div></li>
    ))}</ul>
  );
}
export default function Scout({ team }: { team?: string }) {
  const s = useSave()!;
  const t = team && TM[team] ? team : CORE.teams.find((x) => x.short !== s.team)!.short;
  const st = CORE.styles[t]; const ln = CORE.laning[t];
  const rows = standings(s); const r = rows.find((x) => x.t === t)!;
  const fpTot = st.firstPos.reduce((a, b) => a + b, 0);
  return (
    <div className="grid">
      <Card className="span2" title={<>상대 분석 <span className="muted">· 실제 2026 LCK 밴픽 성향</span></>} right={
        <div className="team-tabs">{CORE.teams.map((x) => <a key={x.short} href={`#/scout/${x.short}`} className={x.short === t ? "on" : ""}><TeamChip t={x.short} size="sm" /></a>)}</div>
      }>
        <div className="row gap wrap scout-head">
          <TeamChip t={t} size="lg" full /><span className="muted">{TM[t].name}</span>
          <span className="tag">근거: 2026 LCK {st.games}경기 밴픽</span>
          <span className="tag">이번 커리어 {rows.indexOf(r) + 1}위 · {r.w}승 {r.l}패</span>
        </div>
        <p className="muted sm">AI {t}는 아래 실제 기록을 근거로 밴픽합니다. 자주 쓴 챔피언일수록 점수가 높아지지만, 비슷한 후보 중에서 무작위로 골라 매번 같지는 않습니다.</p>
      </Card>
      <Card title="자주 밴한 챔피언"><ChampRow list={st.bans} games={st.games} /></Card>
      <Card title="1차 밴(밴 1~3번째) 단골"><ChampRow list={st.p1bans} games={st.games} /></Card>
      <Card title="자주 픽한 챔피언"><ChampRow list={st.picks} games={st.games} /></Card>
      <Card title="첫 픽 포지션">
        <ul className="bars">{st.firstPos.map((n, i) => <li key={i}><span>{POS_KO[i]}</span><Bar v={n} max={Math.max(...st.firstPos)} /><b>{n}회</b><small className="muted">{fpTot ? ((n / fpTot) * 100).toFixed(0) : 0}%</small></li>)}</ul>
        <p className="muted sm">팀의 첫 번째 픽이 어느 포지션이었는지(경기 데이터 슬롯 기준, {fpTot}경기).</p>
        <h4>라인전 (15분, 확정 지표)</h4>
        <ul className="facts sm">
          <li><b>{ln.gd >= 0 ? "+" : ""}{fmt(ln.gd)}</b><span>팀 골드 차</span></li>
          <li><b>{ln.csd >= 0 ? "+" : ""}{ln.csd.toFixed(1)}</b><span>CS 차</span></li>
          <li><b>{ln.xpd >= 0 ? "+" : ""}{fmt(ln.xpd)}</b><span>경험치 차</span></li>
        </ul>
        <p className="muted sm">{ln.games}경기 평균 · 출처 LeagueLab 팀 라인전 확정본</p>
      </Card>
      <Card title="주전 라인업" className="span2">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>포지션</th><th>선수</th><th className="r">종합</th><th>주력 챔피언 (2026 LCK)</th></tr></thead>
          <tbody>{s.starters[t].map((k, i) => { const p = PL[k]; return (
            <tr key={k}><td className="muted">{POS_KO[i]}</td><td><a className="pname" href={`#/player/${k}`}>{p.name}</a>{p.small && <span className="tag warn xs">표본 부족</span>}</td><td className="r"><Ovr p={p} /></td>
              <td><span className="mini-pool">{p.pool.slice(0, 6).map(([c, n]) => <span key={c} title={`${CH[c]?.ko} ${n}경기`}><ChampIcon id={c} size={26} /><small>{n}</small></span>)}</span></td></tr>
          ); })}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
