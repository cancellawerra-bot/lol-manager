import { CORE, PL, POS_KO, TM, fmt } from "../data";
import { useSave } from "../store";
import { standings, nextMySeries, dateKo, formVal, STAGE_KO, opp } from "../game/season";
import { Card, Pct, TeamChip, form5, PName } from "../ui";

export default function Home() {
  const s = useSave()!;
  const rows = standings(s);
  const nx = nextMySeries(s);
  const op = nx ? opp(s, nx) : null;
  const rowOf = (t: string) => rows.find((r) => r.t === t)!;
  const started = rows.some((r) => r.w + r.l > 0);
  const rankOf = (t: string): string => (started ? `${rows.findIndex((r) => r.t === t) + 1}` : "–");
  const h2h = op ? s.series.filter((x) => x.winner && ((x.a === s.team && x.b === op) || (x.a === op && x.b === s.team))) : [];
  const upcoming = s.series.filter((x) => (x.a === s.team || x.b === s.team) && !x.winner).sort((a, b) => a.day - b.day).slice(0, 5);
  const recent = s.series.filter((x) => (x.a === s.team || x.b === s.team) && x.winner).sort((a, b) => b.day - a.day).slice(0, 5);
  const myRow = rowOf(s.team);
  return (
    <div className="grid home">
      {s.phase === "done" && (
        <Card title="시즌 종료" className="span2 hero-done">
          <p className="big">{s.champion === s.team ? `🏆 ${TM[s.team].ko} 우승! ${s.manager} 감독, 축하드립니다.` : `우승: ${TM[s.champion!].ko}. ${TM[s.team].ko}는 정규 시즌 ${rankOf(s.team)}위로 마쳤습니다.`}</p>
          <p className="muted">정규 시즌 {myRow.w}승 {myRow.l}패 (세트 {myRow.gw}:{myRow.gl}). 새 시즌은 다음 버전에서 이어집니다. 지금은 새 커리어로 다른 팀을 맡아 보실 수 있습니다.</p>
          <a className="btn" href="#/">타이틀로</a>
        </Card>
      )}
      {nx && op && (
        <Card title={<>다음 경기 <span className="muted">· {STAGE_KO[nx.stage]} · Bo{nx.bo}</span></>} className="span2 next-match">
          <div className="vs">
            <div className="vs-team"><TeamChip t={s.team} size="lg" /><b>{TM[s.team].ko}</b><span className="muted">{started ? `${rankOf(s.team)}위 · ${myRow.w}승 ${myRow.l}패` : "개막전"}</span>{form5(myRow.last)}</div>
            <div className="vs-mid"><span className="vs-x">VS</span><b>{dateKo(s.days[nx.day].date)}</b><span className="muted">{s.days[nx.day].label}</span>{h2h.length > 0 && <span className="muted sm">이번 시즌 상대 전적 {h2h.filter((x) => x.winner === s.team).length}승 {h2h.filter((x) => x.winner !== s.team).length}패</span>}</div>
            <div className="vs-team"><TeamChip t={op} size="lg" /><b>{TM[op].ko}</b><span className="muted">{started ? `${rankOf(op)}위 · ${rowOf(op).w}승 ${rowOf(op).l}패` : "개막전"}</span>{form5(rowOf(op).last)}</div>
          </div>
          <table className="tbl lineup-cmp">
            <thead><tr><th>{s.team}</th><th className="c">포지션</th><th className="r">{op}</th></tr></thead>
            <tbody>{[0, 1, 2, 3, 4].map((i) => {
              const a = PL[s.starters[s.team][i]], b = PL[s.starters[op][i]];
              return <tr key={i}><td><PName k={a.key} /> <Pct v={a.pct.ovr} />{a.small && <span className="tag warn">표본 부족</span>}</td><td className="c muted">{POS_KO[i]}</td><td className="r">{b.small && <span className="tag warn">표본 부족</span>}<Pct v={b.pct.ovr} /> <PName k={b.key} /></td></tr>;
            })}</tbody>
          </table>
          <div className="row gap wrap"><a className="btn" href={`#/scout/${op}`}>{op} 밴픽 성향 보기</a><span className="muted sm">숫자는 포지션 내 종합 지표 백분위(2026 LCK). 상단 "{nx.day === s.day ? "경기 시작" : "진행하기"}"로 진행합니다.</span></div>
        </Card>
      )}
      <Card title="순위" right={<a href="#/standings" className="sm">전체 ›</a>}>
        <table className="tbl compact">
          <thead><tr><th>#</th><th>팀</th><th className="r">승-패</th><th className="r">득실</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.t} className={r.t === s.team ? "me" : ""}><td>{i + 1}</td><td><TeamChip t={r.t} size="sm" full /></td><td className="r">{r.w}-{r.l}</td><td className="r">{r.gw - r.gl >= 0 ? "+" : ""}{r.gw - r.gl}</td></tr>
          ))}</tbody>
        </table>
      </Card>
      <Card title="소식" right={<a href="#/news" className="sm">전체 ›</a>}>
        <ul className="news-mini">{s.news.slice(0, 6).map((n) => (
          <li key={n.id} className={n.read ? "" : "unread"}><small>{dateKo(n.date)}</small><b>{n.title}</b><span className="muted">{n.body}</span></li>
        ))}</ul>
      </Card>
      <Card title="선수단 컨디션" right={<a href="#/squad" className="sm">선수단 ›</a>}>
        <table className="tbl compact">
          <thead><tr><th>포지션</th><th>선수</th><th className="r">종합</th><th className="r">폼</th></tr></thead>
          <tbody>{s.starters[s.team].map((k, i) => {
            const f = formVal(s, k);
            return <tr key={k}><td className="muted">{POS_KO[i]}</td><td><PName k={k} /></td><td className="r"><Pct v={PL[k].pct.ovr} /></td><td className="r">{s.form[k]?.length ? <span className={f > 0.15 ? "up" : f < -0.15 ? "down" : ""}>{f > 0.15 ? "▲" : f < -0.15 ? "▼" : "–"} {(s.form[k].reduce((a, b) => a + b, 0) / s.form[k].length).toFixed(1)}</span> : <span className="muted">–</span>}</td></tr>;
          })}</tbody>
        </table>
        <p className="muted sm">폼은 이번 커리어 최근 3경기 평점 평균입니다(게임 안 기록).</p>
      </Card>
      <Card title="일정">
        <ul className="sched-mini">
          {recent.slice(0, 3).reverse().map((x) => <li key={x.id}><small>{dateKo(s.days[x.day].date)}</small><span>vs {opp(s, x)}</span><b className={x.winner === s.team ? "up" : "down"}>{x.winner === s.team ? "승" : "패"} {x.a === s.team ? `${x.sa}:${x.sb}` : `${x.sb}:${x.sa}`}</b></li>)}
          {upcoming.map((x) => <li key={x.id} className={x.day === s.day ? "today" : ""}><small>{dateKo(s.days[x.day].date)}</small><span>vs {opp(s, x)}</span><span className="muted">{STAGE_KO[x.stage]}</span></li>)}
        </ul>
        <a className="sm" href="#/schedule">전체 일정 ›</a>
      </Card>
      <Card title="데이터 한눈에">
        <ul className="facts">
          <li><b>{CORE.meta.games}</b><span>2026 LCK 경기 ({CORE.meta.period[0]} ~ {CORE.meta.period[1]})</span></li>
          <li><b>{CORE.meta.players}</b><span>기록이 있는 선수</span></li>
          <li><b>{fmt(CORE.meta.rankedGames)}</b><span>랭크 경기 (상성·시너지는 30판 이상만)</span></li>
        </ul>
        <a className="sm" href="#/method">계산 방법 보기 ›</a>
      </Card>
    </div>
  );
}
