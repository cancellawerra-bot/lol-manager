import { CORE, PL, POS_KO, TM, fmt } from "../data";
import { useSave, fillSchedule, mutate, autoSimSplit, autoToOffseason, acceptFranchise } from "../store";
import { standings, nextMySeries, dateKo, formVal, STAGE_KO, opp } from "../game/season";
import { FRANCHISE_BUYIN, SPLIT_KO, TIER_KO, PHASE_STORY_KO, fmtMoney } from "../game/story";
import { Card, Pct, TeamChip, form5, PName } from "../ui";

export default function Home() {
  const s = useSave()!;
  const rows = standings(s);
  const nx = nextMySeries(s);
  const op = nx ? opp(s, nx) : null;
  const emptyRow = (t: string) => ({ t, w: 0, l: 0, gw: 0, gl: 0, streak: "–", last: [] as string[] });
  const rowOf = (t: string) => rows.find((r) => r.t === t) ?? emptyRow(t);
  const started = rows.some((r) => r.w + r.l > 0);
  const rankOf = (t: string): string => (started ? `${rows.findIndex((r) => r.t === t) + 1}` : "–");
  const h2h = op ? s.series.filter((x) => x.winner && ((x.a === s.team && x.b === op) || (x.a === op && x.b === s.team))) : [];
  const upcoming = s.series.filter((x) => (x.a === s.team || x.b === s.team) && !x.winner).sort((a, b) => a.day - b.day).slice(0, 5);
  const recent = s.series.filter((x) => (x.a === s.team || x.b === s.team) && x.winner).sort((a, b) => b.day - a.day).slice(0, 5);
  const myRow = rowOf(s.team);
  const goalKo = { win: "우승", final: "결승 진출", sf: "4강", po: "플레이오프 진출", top8: "8위 이내" }[s.eco?.goal ?? "top8"];
  return (
    <div className="grid home">
      {s.seen === "tut1" && (
        <Card title="수석코치 안내 1/2" className="span2">
          <p>상단의 <b>진행하기</b>로 일주일을 넘깁니다. 우리 경기가 있는 날에는 기자회견부터 밴픽, 경기, 결과 설명까지 이어집니다.</p>
          <p className="muted sm">그 전에 선수단 주간 일정을 정해야 합니다. 수석코치에게 맡겨도 됩니다.</p>
          <button className="btn primary" onClick={() => mutate((x) => { x.seen = "tut2"; })}>다음</button>
        </Card>
      )}
      {s.seen === "tut2" && (
        <Card title="수석코치 안내 2/2" className="span2">
          <p><b>선수단 일정</b>에서 훈련·스크림·휴식을 정하고, <b>영입</b>에서 시즌 카드를 다시 살펴볼 수 있습니다. 예산·신뢰도는 위쪽 칩에 있습니다.</p>
          <button className="btn primary" onClick={() => mutate((x) => { x.seen = "done"; })}>알겠습니다</button>
        </Card>
      )}
      {!s.schedOk && (
        <Card title="주전 일정을 정해 주세요" className="span2">
          <p>한 주 일정의 빈 칸을 채워야 경기를 진행할 수 있습니다. 수석코치에게 맡기면 훈련·스크림과 휴식일이 채워집니다.</p>
          <div className="row gap wrap"><a className="btn" href="#/squad">선수단 일정</a><button className="btn primary" data-testid="delegate-sched" onClick={() => fillSchedule()}>수석코치에게 맡기기</button></div>
        </Card>
      )}
      {s.mode === "story" && s.story && (
        <Card title={`${s.story.year} ${SPLIT_KO[s.story.split]} · ${TIER_KO[s.story.tier]} · ${PHASE_STORY_KO[s.story.phase]}`} className="span2">
          <p>2018 2부에서 시작해 2027 월즈 우승이 목표입니다. LCK {s.story.trophies.lck}회 · 월즈 {s.story.trophies.worlds}회. 정규 시리즈는 축약(싱글 라운드 로빈)이며, 우리 경기가 없는 날은 자동으로 넘어갑니다.</p>
          {["regular", "playoffs", "promo", "rtm", "msi", "worlds"].includes(s.story.phase) && <div className="row gap wrap">
            <button className="btn" data-testid="auto-split" onClick={() => autoSimSplit(false)}>이 국면 나머지 자동 진행</button>
            <button className="btn" data-testid="auto-year" onClick={() => autoToOffseason()}>오프시즌까지 자동 진행</button>
            <span className="muted sm">우리 경기도 즉시 시뮬합니다. 승패를 조작하지 않으며, 한 해를 빠르게 넘기기 위한 축약입니다.</span>
          </div>}
          {s.story.phase === "msi" && <p data-testid="msi-banner">MSI가 진행 중입니다. 그룹은 단판 라운드 로빈, 상위 4팀이 준결승(Bo5)에 갑니다. 해외 팀은 리그 시드 이름이며 개별 선수 기록은 없습니다.</p>}
          {s.story.phase === "rtm" && <p data-testid="rtm-banner">Road to MSI: 스프링 상위 팀이 LCK 시드를 가립니다. 2018–2020은 1시드만, 2021년부터는 최종전으로 2시드까지 정합니다.</p>}
          {["awards", "tryout", "expiry", "stove"].includes(s.story.phase) && <p><a className="btn primary" href="#/stove" data-testid="goto-stove">스토브리그 본편으로</a></p>}
        </Card>
      )}
      {s.story && !s.story.ended && (s.story.financeWarn || s.eco.cash < 0) && (
        <Card title="구단주 경고" className="span2">
          <div data-testid="finance-warning">
            <p className="big">{s.eco.cash < 0 ? "적자 운영" : "잔고 부족"} — 잔고 {fmtMoney(s.eco.cash)}</p>
            <p>{s.eco.cash < 0
              ? "적자가 한도를 넘거나 이어지면 강제 매각 또는 구단주 해임·파산으로 스토리가 끝납니다."
              : "자금이 빠듯합니다. 적자가 누적되면 강제 매각이나 해임 위험이 있습니다."}</p>
          </div>
        </Card>
      )}
      {s.story?.phase === "franchise" && (
        <Card title="2021 프랜차이즈 전환" className="span2">
          <div data-testid="franchise-screen">
          {s.story.tier === "LCK"
            ? <><p>2020 시즌을 LCK에서 마쳤습니다. 프랜차이즈 슬롯을 받을 수 있습니다. 이후 승강전은 없습니다.</p>
                <button className="btn primary" data-testid="franchise-yes" onClick={() => acceptFranchise(true)}>슬롯 확정</button></>
            : <><p>2부에서 2020을 마쳤습니다. 한 번의 매수 제안이 있습니다. 비용 {fmtMoney(FRANCHISE_BUYIN[s.eco.difficulty])}(현재 {fmtMoney(s.eco.cash)}). 수락하면 이 게임에서는 2021 LCK 전력 최하위 구단 자리를 대신합니다. 거절하거나 자금이 부족하면 2부에 남고, LCK·월즈에는 나가지 못합니다.</p>
                <div className="row gap wrap">
                  <button className="btn primary" data-testid="franchise-yes" onClick={() => { const e = acceptFranchise(true); if (e) alert(e); }}>매수 수락</button>
                  <button className="btn" data-testid="franchise-no" onClick={() => acceptFranchise(false)}>2부에 남는다</button>
                </div></>}
          </div>
        </Card>
      )}
      {s.story?.ended === "clear" && (
        <Card title="클리어" className="span2 hero-done" >
          <div data-testid="clear-screen">
            <p className="big">클리어 — 2027 월즈 우승</p>
            <p>2018년 2부에서 출발한 {s.club?.name ?? s.team}이 2027 월즈를 우승했습니다. LCK {s.story.trophies.lck}회, 월즈 {s.story.trophies.worlds}회, MSI {s.story.trophies.msi}회.</p>
          </div>
        </Card>
      )}
      {s.story?.ended === "fail" && (
        <Card title="여정의 끝" className="span2">
          <div data-testid="fail-screen">
            <p className="big">2027 시즌을 마쳤지만 월즈 우승에는 이르지 못했습니다.</p>
            <p>LCK {s.story.trophies.lck}회, 월즈 {s.story.trophies.worlds}회, MSI {s.story.trophies.msi}회. {s.story.tier === "CK" && !s.story.franchised ? "2부에서 프랜차이즈 슬롯을 받지 못해 월즈에 나가지 못했습니다." : ""}</p>
          </div>
        </Card>
      )}
      {s.story?.ended === "bankrupt" && (
        <Card title="구단주 해임" className="span2">
          <div data-testid="bankrupt-screen">
            <p className="big">파산 — 누적 적자로 구단 운영이 중단되었습니다.</p>
            <p>잔고 {fmtMoney(s.eco.cash)}. LCK {s.story.trophies.lck}회, 월즈 {s.story.trophies.worlds}회, MSI {s.story.trophies.msi}회.</p>
          </div>
        </Card>
      )}
      {s.phase === "done" && !s.story?.ended && (
        <Card title="시즌 종료" className="span2 hero-done">
          <p className="big">{s.champion === s.team ? `🏆 ${TM[s.team].ko} 우승! ${s.manager} 감독, 축하드립니다.` : `우승: ${TM[s.champion!].ko}. ${TM[s.team].ko}는 정규 시즌 ${rankOf(s.team)}위로 마쳤습니다.`}</p>
          <p>{s.ownerNote ?? "구단주가 이번 시즌을 평가했습니다."}</p>
          <p className="muted">목표였던 {goalKo} · 정규 시즌 {myRow.w}승 {myRow.l}패 (세트 {myRow.gw}:{myRow.gl}). 스토브리그와 다음 시즌은 다음 버전에서 이어집니다.</p>
          <a className="btn" href="#/">타이틀로</a>
        </Card>
      )}
      {nx && op && (
        <Card title={<>다음 경기 <span className="muted">· {STAGE_KO[nx.stage]} · Bo{nx.bo}</span></>} className="span2 next-match">
          <div className="vs">
            <div className="vs-team"><TeamChip t={s.team} size="lg" /><b>{TM[s.team]?.ko ?? s.team}</b><span className="muted">{started ? `${rankOf(s.team)}위 · ${myRow.w}승 ${myRow.l}패` : "개막전"}</span>{form5(myRow.last)}</div>
            <div className="vs-mid"><span className="vs-x">VS</span><b>{dateKo(s.days[nx.day].date)}</b><span className="muted">{s.days[nx.day].label}</span>{h2h.length > 0 && <span className="muted sm">이번 시즌 상대 전적 {h2h.filter((x) => x.winner === s.team).length}승 {h2h.filter((x) => x.winner !== s.team).length}패</span>}</div>
            <div className="vs-team"><TeamChip t={op} size="lg" /><b>{TM[op]?.ko ?? op}</b><span className="muted">{started ? `${rankOf(op)}위 · ${rowOf(op).w}승 ${rowOf(op).l}패` : "개막전"}</span>{form5(rowOf(op).last)}</div>
          </div>
          <table className="tbl lineup-cmp">
            <thead><tr><th>{s.team}</th><th className="c">포지션</th><th className="r">{op}</th></tr></thead>
            <tbody>{[0, 1, 2, 3, 4].map((i) => {
              const a = PL[s.starters[s.team]?.[i]], b = PL[s.starters[op]?.[i]];
              return <tr key={i}><td>{a ? <><PName k={a.key} /> <Pct v={a.pct.ovr} />{a.small && <span className="tag warn">표본 부족</span>}</> : "–"}</td><td className="c muted">{POS_KO[i]}</td><td className="r">{b ? <>{b.small && <span className="tag warn">표본 부족</span>}<Pct v={b.pct.ovr} /> <PName k={b.key} /></> : "–"}</td></tr>;
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
            return <tr key={k}><td className="muted">{POS_KO[i]}</td><td><PName k={k} /></td><td className="r">{PL[k] ? <Pct v={PL[k].pct.ovr} /> : "–"}</td><td className="r">{s.form[k]?.length ? <span className={f > 0.15 ? "up" : f < -0.15 ? "down" : ""}>{f > 0.15 ? "▲" : f < -0.15 ? "▼" : "–"} {(s.form[k].reduce((a, b) => a + b, 0) / s.form[k].length).toFixed(1)}</span> : <span className="muted">–</span>}</td></tr>;
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
