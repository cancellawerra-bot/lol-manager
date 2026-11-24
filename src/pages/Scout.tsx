import { CH, CORE, PL, POS_KO, TM, fmt } from "../data";
import { useSave } from "../store";
import { standings } from "../game/season";
import { Card, ChampIcon, Ovr, TeamChip, Bar } from "../ui";
import { careerYear, hasYearPlayerPools, hasYearTeamStyles, lckYearName, NO_RECORD } from "../game/yearRecords";

function ChampRow({ list, games, max = 10 }: { list: [string, number][]; games: number; max?: number }) {
  return (
    <ul className="crow">{list.slice(0, max).map(([c, n]) => (
      <li key={c}><ChampIcon id={c} size={34} /><div><b>{CH[c]?.ko ?? c}</b><small>{n}회 · {((n / games) * 100).toFixed(0)}%</small></div></li>
    ))}</ul>
  );
}
export default function Scout({ team }: { team?: string }) {
  const s = useSave()!;
  const year = careerYear(s);
  const yearStyles = hasYearTeamStyles(year);
  const yearPools = hasYearPlayerPools(year);
  const rows = standings(s);
  const careerTeams = [...new Set([s.team, ...rows.map((x) => x.t), ...Object.keys(s.starters)])].filter((t) => TM[t] || s.starters[t]);
  const tabs = yearStyles ? CORE.teams.map((x) => x.short) : (careerTeams.length ? careerTeams : CORE.teams.map((x) => x.short));
  const t = team && tabs.includes(team) ? team : (tabs.find((x) => x !== s.team) ?? tabs[0]);
  const st = yearStyles ? CORE.styles[t] : undefined;
  const ln = yearStyles ? CORE.laning[t] : undefined;
  const r = rows.find((x) => x.t === t);
  const fpTot = st ? st.firstPos.reduce((a, b) => a + b, 0) : 0;
  const keys = s.starters[t] ?? [];
  return (
    <div className="grid">
      <Card className="span2" title={<>상대 분석 <span className="muted">· {yearStyles ? `${lckYearName(year)} 밴픽 성향` : `${lckYearName(year)} 밴픽 성향 ${NO_RECORD}`}</span></>} right={
        <div className="team-tabs">{tabs.map((short) => <a key={short} href={`#/scout/${short}`} className={short === t ? "on" : ""}><TeamChip t={short} size="sm" /></a>)}</div>
      }>
        <div className="row gap wrap scout-head">
          <TeamChip t={t} size="lg" full /><span className="muted">{TM[t]?.name ?? t}</span>
          <span className="tag">근거: {st ? `${lckYearName(year)} ${st.games}경기 밴픽` : `${lckYearName(year)} ${NO_RECORD}`}</span>
          {r && <span className="tag">이번 커리어 {rows.indexOf(r) + 1}위 · {r.w}승 {r.l}패</span>}
        </div>
        <p className="muted sm">{yearStyles && st ? <>AI {t}는 아래 실제 기록을 근거로 밴픽합니다. 자주 쓴 챔피언일수록 점수가 높아지지만, 비슷한 후보 중에서 무작위로 골라 매번 같지는 않습니다.</> : <>{lckYearName(year)} 팀 밴픽 성향 기록이 없어 다른 연도 값으로 대체하지 않습니다. ({NO_RECORD})</>}</p>
      </Card>
      {st ? <>
        <Card title="자주 밴한 챔피언"><ChampRow list={st.bans} games={st.games} /></Card>
        <Card title="1차 밴(밴 1~3번째) 단골"><ChampRow list={st.p1bans} games={st.games} /></Card>
        <Card title="자주 픽한 챔피언"><ChampRow list={st.picks} games={st.games} /></Card>
        <Card title="첫 픽 포지션">
          <ul className="bars">{st.firstPos.map((n, i) => <li key={i}><span>{POS_KO[i]}</span><Bar v={n} max={Math.max(...st.firstPos)} /><b>{n}회</b><small className="muted">{fpTot ? ((n / fpTot) * 100).toFixed(0) : 0}%</small></li>)}</ul>
          <p className="muted sm">팀의 첫 번째 픽이 어느 포지션이었는지(경기 데이터 슬롯 기준, {fpTot}경기).</p>
          {ln && <><h4>라인전 (15분, 확정 지표)</h4>
          <ul className="facts sm">
            <li><b>{ln.gd >= 0 ? "+" : ""}{fmt(ln.gd)}</b><span>팀 골드 차</span></li>
            <li><b>{ln.csd >= 0 ? "+" : ""}{ln.csd.toFixed(1)}</b><span>CS 차</span></li>
            <li><b>{ln.xpd >= 0 ? "+" : ""}{fmt(ln.xpd)}</b><span>경험치 차</span></li>
          </ul>
          <p className="muted sm">{ln.games}경기 평균 · 출처 LeagueLab 팀 라인전 확정본 ({lckYearName(year)})</p></>}
        </Card>
      </> : <Card className="span2" title="밴픽 성향"><p>{lckYearName(year)} 팀 밴픽·라인전 기록 {NO_RECORD}.</p></Card>}
      <Card title="주전 라인업" className="span2">
        <div className="tbl-wrap"><table className="tbl">
          <thead><tr><th>포지션</th><th>선수</th><th className="r">종합</th><th>주력 챔피언 ({yearPools ? lckYearName(year) : `${lckYearName(year)} ${NO_RECORD}`})</th></tr></thead>
          <tbody>{keys.length ? keys.map((k, i) => { const p = PL[k]; return (
            <tr key={k}><td className="muted">{POS_KO[i]}</td><td>{p ? <a className="pname" href={`#/player/${k}`}>{p.name}</a> : k}{p?.small && <span className="tag warn xs">표본 부족</span>}</td><td className="r">{p ? <Ovr p={p} /> : "–"}</td>
              <td>{yearPools && p?.pool?.length ? <span className="mini-pool">{p.pool.slice(0, 6).map(([c, n]) => <span key={c} title={`${CH[c]?.ko} ${n}경기`}><ChampIcon id={c} size={26} /><small>{n}</small></span>)}</span> : <span className="muted sm">{NO_RECORD}</span>}</td></tr>
          ); }) : <tr><td colSpan={4} className="muted">{NO_RECORD}</td></tr>}</tbody>
        </table></div>
      </Card>
    </div>
  );
}
