import { CORE, PL, POS_KO, TM, fmt } from "../data";
import { useSave, fillSchedule, autoSimSplit, autoToOffseason, acceptFranchise } from "../store";
import { standings, nextMySeries, dateKo, STAGE_KO, opp } from "../game/season";
import { FRANCHISE_BUYIN, SPLIT_KO, TIER_KO, PHASE_STORY_KO, fmtMoney } from "../game/story";
import { Card, Ovr, TeamChip, form5, PName } from "../ui";
import { TacticsControls } from "./Tactics";
import ManagerDashboard from "./ManagerDashboard";
import "./home.css";

export default function Home({ onAdvance }: { onAdvance?: () => void }) {
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
    <div className="manager-home">
      <ManagerDashboard s={s} onAdvance={onAdvance} />
      {!s.schedOk && !s.story?.ended && s.phase !== "done" && (
        <Card title="주전 일정을 정해 주세요" className="span2">
          <p>한 주 일정의 빈 칸을 채워야 경기를 진행할 수 있습니다. 수석코치에게 맡기면 훈련과 휴식일이 채워집니다.</p>
          <div className="row gap wrap"><a className="btn" href="#/squad">선수단 일정</a><button className="btn primary" data-testid="delegate-sched" onClick={() => fillSchedule()}>수석코치에게 맡기기</button><button className="btn" data-testid="delegate-sched-go" onClick={() => { fillSchedule(); onAdvance?.(); }}>맡기고 바로 진행 ▶</button></div>
        </Card>
      )}
      {s.mode === "story" && s.story && (
        <Card title={`${s.story.year} ${SPLIT_KO[s.story.split]} · ${TIER_KO[s.story.tier]} · ${PHASE_STORY_KO[s.story.phase]}`} className="span2">
          <p>2018 2부에서 시작해 2027 월즈 우승이 목표입니다. LCK {s.story.trophies.lck}회 · 월즈 {s.story.trophies.worlds}회. 정규 시리즈는 축약(싱글 라운드 로빈)이며, 우리 경기가 없는 날은 자동으로 넘어갑니다.</p>
          {["regular", "playoffs", "promo", "rtm", "msi", "worlds"].includes(s.story.phase) && <div className="row gap wrap">
            <button className="btn" data-testid="auto-split" disabled={!!s.session} onClick={() => autoSimSplit(false)}>이 국면 나머지 자동 진행</button>
            <button className="btn" data-testid="auto-year" disabled={!!s.session} onClick={() => autoToOffseason()}>오프시즌까지 자동 진행</button>
            <span className="muted sm">우리 경기도 즉시 시뮬합니다. 승패를 조작하지 않으며, 한 해를 빠르게 넘기기 위한 축약입니다.</span>
          </div>}
          {s.story.phase === "msi" && <p data-testid="msi-banner">MSI가 진행 중입니다. 그룹은 단판 라운드 로빈, 상위 4팀이 준결승(Bo5)에 갑니다. 해외 팀은 리그 시드 이름이며 개별 선수 기록은 없습니다.</p>}
          {s.story.phase === "rtm" && <p data-testid="rtm-banner">Road to MSI: 스프링 상위 팀이 LCK 시드를 가립니다. 2018–2020은 1시드만, 2021년부터는 최종전으로 2시드까지 정합니다.</p>}
          {s.story.phase === "worlds" && s.story.swiss && <p data-testid="swiss-banner">월즈 스위스: 3승이면 8강 진출, 3패면 탈락합니다. 진출·탈락 결정전은 Bo3, 나머지는 Bo1입니다. <a href="#/standings">스위스 전적·대진 보기 →</a></p>}
          {["awards", "tryout", "expiry", "stove"].includes(s.story.phase) && <p><a className="btn primary" href="#/stove" data-testid="goto-stove">스토브리그 본편으로</a></p>}
        </Card>
      )}
      {!s.story?.ended && <Card title="감독 작전" className="span2"><TacticsControls /></Card>}
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
      {s.story?.ended && (
        <Card title={s.story.ended === "clear" ? "클리어" : s.story.ended === "bankrupt" ? "구단주 해임" : "여정의 끝"} className="span2 hero-done">
          <div data-testid={s.story.ended === "clear" ? "clear-screen" : s.story.ended === "bankrupt" ? "bankrupt-screen" : "fail-screen"}>
            {s.story.ended === "clear" && <p className="big">클리어 — 2027 월즈 우승</p>}
            {s.story.ended === "fail" && <p className="big">2027 시즌을 마쳤지만 월즈 우승에는 이르지 못했습니다.</p>}
            {s.story.ended === "bankrupt" && <p className="big">파산 — 누적 적자로 구단 운영이 중단되었습니다.</p>}
            <p>2018년 2부에서 출발한 {s.club?.name ?? s.team}의 기록입니다. 2018–{s.story.year}. LCK {s.story.trophies.lck}회, 월즈 {s.story.trophies.worlds}회, MSI {s.story.trophies.msi}회. 잔고 {fmtMoney(s.eco.cash)}.{s.story.lastRank ? ` 마지막 정규 순위 ${s.story.lastRank}위.` : ""}{s.story.ended === "fail" && s.story.tier === "CK" && !s.story.franchised ? " 2부에서 프랜차이즈 슬롯을 받지 못해 월즈에 나가지 못했습니다." : ""}</p>
            <p><a href="#/club" className="btn" data-testid="ending-club-history">구단 연표 보기</a></p>
            <div className="tbl-wrap"><table className="tbl compact" data-testid="ending-roster">
              <thead><tr><th>포지션</th><th>선수</th><th className="r">종합</th></tr></thead>
              <tbody>{(s.starters[s.team] ?? []).map((k, i) => (
                <tr key={k || i}><td className="muted">{POS_KO[i]}</td><td><PName k={k} /></td><td className="r">{PL[k] ? <Ovr p={PL[k]} /> : "–"}</td></tr>
              ))}</tbody>
            </table></div>
            <div className="row gap wrap end-actions">
              <a className="btn primary" href="#/" data-testid="ending-new-game">새 게임</a>
              <a className="btn" href="#/news" data-testid="ending-keep-viewing">계속 살펴보기</a>
            </div>
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
      {nx && op && !s.story?.ended && (
        <details className="home-match-details"><summary>다음 상대의 선발·전적 살펴보기</summary><Card title={<>다음 경기 <span className="muted">· {STAGE_KO[nx.stage]} · Bo{nx.bo}</span></>} className="span2 next-match">
          <div className="vs">
            <div className="vs-team"><TeamChip t={s.team} size="lg" /><b>{TM[s.team]?.ko ?? s.team}</b><span className="muted">{started ? `${rankOf(s.team)}위 · ${myRow.w}승 ${myRow.l}패` : "개막전"}</span>{form5(myRow.last)}</div>
            <div className="vs-mid"><span className="vs-x">VS</span><b>{dateKo(s.days[nx.day].date)}</b><span className="muted">{s.days[nx.day].label}</span>{h2h.length > 0 && <span className="muted sm">이번 시즌 상대 전적 {h2h.filter((x) => x.winner === s.team).length}승 {h2h.filter((x) => x.winner !== s.team).length}패</span>}</div>
            <div className="vs-team"><TeamChip t={op} size="lg" /><b>{TM[op]?.ko ?? op}</b><span className="muted">{started ? `${rankOf(op)}위 · ${rowOf(op).w}승 ${rowOf(op).l}패` : "개막전"}</span>{form5(rowOf(op).last)}</div>
          </div>
          <div className="tbl-wrap"><table className="tbl lineup-cmp">
            <thead><tr><th>{s.team}</th><th className="c">포지션</th><th className="r">{op}</th></tr></thead>
            <tbody>{[0, 1, 2, 3, 4].map((i) => {
              const a = PL[s.starters[s.team]?.[i]], b = PL[s.starters[op]?.[i]];
              return <tr key={i}><td>{a ? <><PName k={a.key} /> <Ovr p={a} />{a.small && <span className="tag warn">표본 부족</span>}</> : "–"}</td><td className="c muted">{POS_KO[i]}</td><td className="r">{b ? <>{b.small && <span className="tag warn">표본 부족</span>}<Ovr p={b} /> <PName k={b.key} /></> : "–"}</td></tr>;
            })}</tbody>
          </table></div>
          <div className="row gap wrap"><a className="btn" href={`#/scout/${op}`}>{op} 밴픽 성향 보기</a><span className="muted sm">숫자는 적용된 시즌 기록 기반 게임 종합 지표입니다. 상단 "{nx.day === s.day ? "경기 시작" : "진행하기"}"로 진행합니다.</span></div>
        </Card></details>
      )}
      <div className="home-secondary">
      {!s.story?.ended && (!s.story || ["regular", "playoffs"].includes(s.story.phase)) && (
      <Card title="순위" right={<a href="#/standings" className="sm">전체 ›</a>}>
        <div className="tbl-wrap"><table className="tbl compact">
          <thead><tr><th>#</th><th>팀</th><th className="r">승-패</th><th className="r">득실</th></tr></thead>
          <tbody>{rows.map((r, i) => (
            <tr key={r.t} className={r.t === s.team ? "me" : ""}><td>{i + 1}</td><td><TeamChip t={r.t} size="sm" full /></td><td className="r">{r.w}-{r.l}</td><td className="r">{r.gw - r.gl >= 0 ? "+" : ""}{r.gw - r.gl}</td></tr>
          ))}</tbody>
        </table></div>
      </Card>
      )}
      <Card title="소식" right={<a href="#/news" className="sm">전체 ›</a>}>
        <ul className="news-mini">{s.news.slice(0, 6).map((n) => (
          <li key={n.id} className={n.read ? "" : "unread"}><small>{dateKo(n.date)}</small><b>{n.title}</b><span className="muted">{n.body}</span></li>
        ))}</ul>
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
    </div>
  );
}
