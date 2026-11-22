import { CH, PL, POS_KO, TM } from "../data";
import type { Save } from "../game/season";
import { dateKo, nextMySeries, opp, standings } from "../game/season";
import { PHASE_STORY_KO, SPLIT_KO, TIER_KO } from "../game/story";
import { seasonMarketWeek } from "../game/inSeason";
import { trainingPerson } from "../game/trainingRuntime";
import { fmtMoney } from "../game/money";
import { PlayerAvatar } from "../ui";
import { ratingOf } from "../rating";
import SeasonJourney from "./SeasonJourney";

const ROLES = ["TOP", "JGL", "MID", "ADC", "SUP"];
const goalLabel = { win: "우승", final: "결승 진출", sf: "4강 진출", po: "플레이오프 진출", top8: "8위 이내" };
interface Attention { label: string; detail: string; href: string; tone: "warn" | "good" | "neutral" }
/** 현재 저장의 상태만 읽습니다. 시장·훈련·약속을 초기화하거나 진행하지 않습니다. */
export function homeAttention(s: Save): Attention[] {
  if (s.story?.ended || s.phase === "done") return [{ label: "이번 여정을 돌아볼 시간", detail: "구단의 기록과 다음 도전을 살펴보세요.", href: "#/club", tone: "neutral" }];
  if (s.session) return [{ label: "진행 중인 경기가 있습니다", detail: "현재 경기의 준비와 결과 확인을 이어가세요.", href: "#/match", tone: "warn" }];
  const items: Attention[] = [];
  if (!s.schedOk) items.push({ label: "선수단 일정이 비어 있습니다", detail: "훈련·스크림·휴식 계획을 먼저 정해 주세요.", href: "#/squad", tone: "warn" });
  const expiry = s.story?.phase === "expiry" ? s.story.stove?.expiryKeys.filter(k => !s.story!.stove!.expiryDecided[k]).length ?? 0 : 0;
  if (expiry) items.push({ label: `만료 계약 ${expiry}명 결정 대기`, detail: "재계약과 방출을 정해야 다음 단계로 갑니다.", href: "#/stove", tone: "warn" });
  if (s.story?.phase === "franchise") items.push({ label: "2021 프랜차이즈 전환", detail: "슬롯·예산 조건과 진입 여부를 확인해 주세요.", href: "#/home", tone: "warn" });
  const offers = s.story?.phase === "regular" && s.inSeason?.year === s.story.year ? s.inSeason.incoming.filter(o => o.status === "open" && o.week === seasonMarketWeek(s)).length : 0;
  if (offers) items.push({ label: `도착한 이적 제안 ${offers}건`, detail: "선수와 예산을 확인하고 답변을 정하세요.", href: "#/market", tone: "neutral" });
  const tired = (s.starters[s.team] ?? []).filter(k => { const person = trainingPerson(s, k); return person && (s.training?.players[person]?.fatigue ?? 0) >= 45; }).length;
  if (tired) items.push({ label: `선발 ${tired}명 피로 확인`, detail: "현재 피로 45 이상 · 휴식과 교체를 검토하세요.", href: "#/squad", tone: "warn" });
  const due = Object.values(s.rotation?.promises ?? {}).filter(p => s.story?.contracts.some(c => c.person === p.person) && p.target - p.starts > 0 && 4 - p.opportunities <= p.target - p.starts).length;
  if (due) items.push({ label: `선발 약속 ${due}명 기한 확인`, detail: "남은 정규 시리즈와 첫 선발 의무를 비교하세요.", href: "#/squad", tone: "warn" });
  if (s.eco.cash < 0 || s.story?.financeWarn) items.push({ label: "구단 자금 확인", detail: `현재 잔고 ${fmtMoney(s.eco.cash)} · 계약 전 지급 조건을 살펴보세요.`, href: "#/club", tone: "warn" });
  return items;
}
/** 실제 출전 기록을 우선하고, 없는 챔피언 기록을 대표 챔피언으로 만들지 않습니다. */
export function homeChampion(s: Save, key: string): { id: string; source: string } | undefined {
  for (const series of [...s.series].sort((a, b) => b.day - a.day)) for (let i = series.games.length - 1; i >= 0; i--) {
    const game = series.games[i];
    for (const side of ["B", "R"] as const) { const pos = game.lineup[side].indexOf(key), id = pos >= 0 ? game.picks[side].find(p => p.pos === pos)?.c : undefined; if (id && CH[id]) return { id, source: "최근 출전 챔피언" }; }
  }
  const known = PL[key]?.pool.find(([id]) => !!CH[id]);
  return known ? { id: known[0], source: "선수 기록의 챔피언" } : undefined;
}
export default function ManagerDashboard({ s, onAdvance }: { s: Save; onAdvance?: () => void }) {
  const next = s.session ? s.series.find(r => r.id === s.session!.seriesId) ?? nextMySeries(s) : nextMySeries(s), opponent = next ? opp(s, next) : undefined;
  const finished = !!s.story?.ended || s.phase === "done", stove = !!s.story && ["awards", "tryout", "expiry", "stove"].includes(s.story.phase), franchise = s.story?.phase === "franchise";
  const rows = standings(s), row = rows.find(r => r.t === s.team), played = !!row && row.w + row.l > 0, leagueActive = !s.story || ["regular", "playoffs"].includes(s.story.phase);
  const phase = s.story ? `${s.story.year} ${SPLIT_KO[s.story.split]} · ${TIER_KO[s.story.tier]} · ${PHASE_STORY_KO[s.story.phase]}` : "2026 LCK · 감독 커리어";
  const attention = homeAttention(s), selected = attention.slice(0, 3), recent = s.series.filter(r => r.winner && (r.a === s.team || r.b === s.team)).sort((a, b) => b.day - a.day)[0];
  const title = finished ? s.story?.ended === "clear" || s.champion === s.team ? "기억에 남을 여정" : "한 시즌이 남긴 이야기" : franchise ? "구단의 다음 장을 결정하세요" : stove ? "다음 시즌을 만드는 시간" : s.session ? "경기는 아직 끝나지 않았습니다" : opponent ? "다음 승부를 준비할 시간" : "다음 무대를 기다리며";
  return <div className="manager-dashboard" data-testid="manager-dashboard">
    <div className="mh-heading"><div><p className="mh-eyebrow">LOL MANAGER <span>/</span> 감독실</p><h1>{s.manager} 감독님, 준비되셨나요?</h1><p>{phase}</p></div><a className="mh-club-link" href="#/club">구단 연표 <span>↗</span></a></div>
    <div className="mh-main-grid">
      <section className={"mh-match " + (finished ? "is-finished" : "")} data-testid="home-match-hero" aria-label="다음 경기와 진행">
        <div className="mh-arena" aria-hidden="true"><i /><i /><i /><i /><i /></div>
        <div className="mh-match-top"><span className="mh-live-label"><i />{finished ? "시즌 기록" : stove || franchise ? "CLUB MANAGEMENT" : s.session ? "MATCH IN PROGRESS" : "NEXT MATCH"}</span><span>{!finished && !stove && !franchise && next ? `Bo${next.bo}` : s.story ? `${s.story.year} SEASON` : "LCK"}</span></div>
        <h2>{title}</h2>
        {!finished && !stove && !franchise && opponent && next ? <>
          <div className="mh-versus"><div><span className="mh-team-code">{s.team}</span><b>{TM[s.team]?.ko ?? s.team}</b></div><span className="mh-vs">VS</span><div><span className="mh-team-code away">{opponent}</span><b>{TM[opponent]?.ko ?? opponent}</b></div></div>
          <p className="mh-match-date">{s.days[next.day]?.date ? dateKo(s.days[next.day].date) : "일정 기록 없음"}<span>·</span>{s.days[next.day]?.label ?? "대회 기록 없음"}</p>
        </> : <div className="mh-intermission"><span>{finished ? s.story?.ended === "clear" || s.champion === s.team ? "CHAMPION" : "SEASON REVIEW" : franchise ? "A NEW CHAPTER" : stove ? "BUILD YOUR NEXT FIVE" : "STAY READY"}</span><p>{finished ? "함께한 선수와 구단의 발자취를 돌아보세요." : franchise ? "2021 LCK 진입 조건과 구단의 미래를 확인하세요." : stove ? "선수단의 빈자리, 계약, 그리고 예산. 다음 선택이 기다립니다." : "현재 일정과 선수단을 확인하며 다음 경기를 준비하세요."}</p></div>}
        <div className="mh-match-bottom">{finished ? <a className="mh-primary" href="#/club" data-testid="home-primary">구단 기록 돌아보기 <span>↗</span></a> : stove ? <a className="mh-primary" href="#/stove" data-testid="home-primary">스토브리그로 <span>→</span></a> : franchise ? <button className="mh-primary" data-testid="home-primary" onClick={() => document.querySelector('[data-testid="franchise-screen"]')?.scrollIntoView({ behavior: "smooth", block: "center" })}>프랜차이즈 선택 확인 <span>↓</span></button> : <button className="mh-primary" data-testid="home-primary" onClick={onAdvance} disabled={!onAdvance}>{s.session ? "경기 계속하기" : !s.schedOk ? "진행 준비 확인" : next?.day === s.day ? "경기 준비하기" : "다음 일정으로"}<span>→</span></button>}
          {!finished && <a href="#/schedule" className="mh-soft-link">전체 일정 보기</a>}
        </div>
        <p className="mh-caption">{s.session ? "기존 경기 진행을 이어갑니다." : !finished && !stove && !franchise && !s.schedOk ? "진행하기 전에 선수단 일정을 정해 주세요." : s.mode === "story" ? "2018년의 창단부터 2027년 월즈까지, 당신의 구단 이야기." : "준비부터 밴픽까지, 감독의 선택을 이어가세요."}</p>
      </section>
      <aside className="mh-attention" aria-label="지금 확인할 일" data-testid="home-attention">
        <div className="mh-panel-title"><div><small>YOUR NEXT MOVE</small><h2>지금 확인할 일</h2></div><span className="mh-count">{attention.length}</span></div>
        {selected.length ? <div className="mh-task-list">{selected.map((item, i) => <a key={item.label} href={item.href} className={`mh-task ${item.tone}`} onClick={item.href === "#/home" ? e => { e.preventDefault(); document.querySelector('[data-testid="franchise-screen"]')?.scrollIntoView({ behavior: "smooth", block: "center" }); } : undefined}><span className="mh-task-number">0{i + 1}</span><div><b>{item.label}</b><p>{item.detail}</p></div><span aria-hidden="true">↗</span></a>)}</div> : <div className="mh-ready" data-testid="home-ready"><span aria-hidden="true">✓</span><b>차분히, 다음 경기를 향해</b><p>현재 확인할 급한 항목이 없습니다.<br />전술과 선발을 마지막으로 살펴보세요.</p><a href="#/squad">선수단 점검 ↗</a></div>}
        {attention.length > 3 && <p className="mh-overflow-note">외 {attention.length - 3}개 항목 · 선수단과 구단에서 확인</p>}
        <div className="mh-goal"><span>이번 시즌 목표</span><b>{goalLabel[s.eco.goal]}</b><a href="#/club">구단 현황 →</a></div>
      </aside>
    </div>
    <SeasonJourney s={s} />
    <div className="mh-pulse" data-testid="home-season-pulse"><div><span>정규 시즌</span><b>{leagueActive ? played ? `${row!.w}승 ${row!.l}패` : "개막 전" : "대회 진행 중"}</b><small>{leagueActive && played ? `${rows.findIndex(r => r.t === s.team) + 1}위 · 세트 ${row!.gw}–${row!.gl}` : phase}</small></div><div><span>구단 자금</span><b className={s.eco.cash < 0 ? "neg" : ""}>{fmtMoney(s.eco.cash)}</b><small>게임용 가상 금액</small></div><div><span>구단주 신뢰</span><b>{s.eco.trust}<em>/ 100</em></b><small>현재 커리어의 운영 지표</small></div><div><span>최근 경기</span><b>{recent ? `${recent.winner === s.team ? "승" : "패"} ${recent.a === s.team ? recent.sa : recent.sb}–${recent.a === s.team ? recent.sb : recent.sa}` : "기록 없음"}</b><small>{recent ? `vs ${TM[opp(s, recent)]?.ko ?? opp(s, recent)}` : "첫 경기를 기다리고 있습니다"}</small></div></div>
    {!finished && <section className="mh-squad" aria-label="현재 선발 구성"><div className="mh-section-heading"><div><small>THE STARTING FIVE</small><h2>우리의 다음 승부를 맡길 5명</h2></div><a href="#/squad">선발·로테이션 관리 ↗</a></div>
      <div className="mh-five">{[0, 1, 2, 3, 4].map(pos => {
        const key = s.starters[s.team]?.[pos], p = key ? PL[key] : undefined, person = key ? trainingPerson(s, key) : undefined, training = person ? s.training?.players[person] : undefined, promise = person ? s.rotation?.promises[person] : undefined, champion = key ? homeChampion(s, key) : undefined;
        return <article className="mh-player" key={pos} data-testid={`home-player-${pos}`}><div className="mh-player-top"><span>{ROLES[pos]}</span><span>{p ? ratingOf(p) : "–"}<small>OVR</small></span></div>
          <div className="mh-player-identity">{key ? <PlayerAvatar seed={key} size={48} /> : <span className="mh-role-icon" aria-hidden="true">{ROLES[pos]}</span>}<div>{p ? <a href={`#/player/${key}`}>{p.name}</a> : <b>선발 공백</b>}<span>{POS_KO[pos]} · {p?.cardYear ? `${p.cardYear} 기록` : p ? "시즌 기록 없음" : "선수단에서 구성"}</span></div></div>
          <div className="mh-fatigue"><span>피로</span><b className={training && training.fatigue >= 45 ? "mh-warning" : ""}>{training ? `${training.fatigue.toFixed(1)} / 100` : "기록 없음"}</b></div><div className="mh-fatigue-track" aria-hidden="true"><i style={{ width: `${Math.max(0, Math.min(100, training?.fatigue ?? 0))}%`, background: training && training.fatigue >= 45 ? "var(--gold)" : undefined }} /></div>
          <p className="mh-player-note">{promise ? `첫 선발 약속 ${promise.starts}/${promise.target} · 기회 ${promise.opportunities}/4` : "개별 출전 약속 없음"}</p><p className="mh-player-evidence">{p?.small ? "표본 부족 · " : ""}{champion ? champion.source : "챔피언 기록 없음"}</p>
        </article>;
      })}</div><p className="mh-footnote">현재 선발 구성입니다. 실제 첫 선발은 자동 로테이션·출전 약속과 경기 전 선택에 따라 달라질 수 있습니다.</p>
    </section>}
  </div>;
}
