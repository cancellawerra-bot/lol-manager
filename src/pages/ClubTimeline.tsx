import { useState } from "react";
import { POS_KO } from "../data";
import { useSave } from "../store";
import { Card } from "../ui";
import { standings } from "../game/season";
import { fmtMoney } from "../game/money";
import { readClubTimeline, clubSplitSnapshot, CLUB_EVENT_LABELS, type ClubSplitRecord } from "../game/clubTimeline";

function SplitRecord({ record, current = false }: { record: ClubSplitRecord; current?: boolean }) {
  const r = record;
  return <article className="notice" data-testid={`club-split-${r.id}`}>
    <b>{r.year} {r.split === "spring" ? "스프링" : "서머"} · {r.tier === "CK" ? "2부" : "LCK"}{current ? " · 진행 중" : " · 종료 보관"}</b>
    <p className="sm">{r.w + r.l ? `정규 ${r.rank}위 · ${r.w}승 ${r.l}패 · 세트 ${r.gw}승 ${r.gl}패` : "아직 정규 경기 없음"}{!r.complete && " · 최종 성적 아님"}<br />{r.championName ? `플레이오프 우승 ${r.championName}` : r.tier === "CK" ? "2부는 플레이오프 없음" : current ? "플레이오프 결과 아직 없음" : "플레이오프 우승 기록 없음"}</p>
    <details data-testid={`club-split-detail-${r.id}`}><summary>당시 선수단·우리 경기 {r.matches.length}개 보기</summary>
      <p className="muted xs">{current ? "현재 보유 명단" : "스플릿 종료 시점의 보유 명단"}입니다. 각 경기의 출전 명단과 다를 수 있습니다. 시즌 카드 기록과 게임 속 경기 성적을 구분합니다.</p>
      <div className="tbl-wrap"><table className="tbl"><thead><tr><th>당시 선수</th><th>포지션</th><th>근거 카드</th><th>구성</th><th>연봉</th></tr></thead><tbody>{r.roster.map((p, i) => <tr key={`${p.person}-${i}`}><td>{p.name}</td><td>{p.pos == null ? "기록 없음" : POS_KO[p.pos]}</td><td>{p.cardYear ?? "기록 없음"}</td><td>{p.starter ? "선발 구성" : "벤치"}</td><td>{fmtMoney(p.salary)}</td></tr>)}</tbody></table></div>
      {r.matches.length ? <div className="tbl-wrap"><table className="tbl"><thead><tr><th>날짜</th><th>상대</th><th>구분</th><th>실제 결과</th></tr></thead><tbody>{r.matches.map(m => <tr key={m.id}><td>{m.date || "기록 없음"}</td><td>{m.opponentName}</td><td>{m.stage === "R" ? "정규" : "플레이오프"}</td><td>{m.won ? "승" : "패"} {m.scored}–{m.conceded}</td></tr>)}</tbody></table></div> : <p>경기 기록 없음</p>}
    </details>
  </article>;
}
export default function ClubTimeline() {
  const s = useSave()!, t = readClubTimeline(s);
  const [year, setYear] = useState("all"), [kind, setKind] = useState("all"), [query, setQuery] = useState(""), [oldFirst, setOldFirst] = useState(false), [page, setPage] = useState(0);
  if (!t || !s.story) return null;
  const current = ["regular", "playoffs"].includes(s.story.phase) && !s.story.ended ? clubSplitSnapshot(s, standings(s)) : undefined;
  const years = [...new Set([s.story.year, ...t.events.map(e => e.year), ...t.splits.map(r => r.year)])].sort((a, b) => b - a);
  const events = t.events.filter(e => (year === "all" || e.year === Number(year)) && (kind === "all" || e.kind === kind) && (!query.trim() || `${e.title} ${e.body}`.toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : Number(a.id.slice(5)) - Number(b.id.slice(5))) * (oldFirst ? 1 : -1));
  const last = Math.max(0, Math.ceil(events.length / 20) - 1), selectedPage = Math.min(page, last), visible = events.slice(selectedPage * 20, selectedPage * 20 + 20);
  const splits = [...t.splits].filter(r => year === "all" || r.year === Number(year)).sort((a, b) => b.year - a.year || (a.split === "summer" ? -1 : 1));
  const reset = (): void => setPage(0);
  return <Card title="구단 연표" right={<span className="muted sm">프랜차이즈 게임 속 기록</span>}>
    <p className="sm">창단부터 시즌 성적·승강전·프랜차이즈 전환·우승·선수단·재정 사건을 이어서 봅니다. 실제 진행 중 생성된 기록이며 현실 구단의 역사와 구분합니다.</p>
    <p className="muted sm" data-testid="club-history-coverage">{t.since.legacy ? `이전 저장: ${t.since.year}년 ${t.since.split === "spring" ? "스프링" : "서머"}부터 연표 보관. 남아 있는 소식만 복구하며 사라진 과거 성적·선수단은 기록 없음입니다.` : `${t.since.year}년부터 연표 보관. 시즌이 바뀌고 최근 소식이 줄어도 보관한 기록은 유지합니다.`}</p>
    <p className="sm">기존 커리어 누적 집계: LCK {s.story.trophies.lck}회 · MSI {s.story.trophies.msi}회 · 월즈 {s.story.trophies.worlds}회. 누적 횟수만으로 우승 연도나 결승 결과를 만들지 않습니다.</p>
    <div className="row wrap gap">
      <select aria-label="연표 연도" data-testid="club-history-year" value={year} onChange={e => { setYear(e.target.value); reset(); }}><option value="all">전체 연도</option>{years.map(y => <option key={y} value={y}>{y}년</option>)}</select>
      <select aria-label="연표 사건" data-testid="club-history-kind" value={kind} onChange={e => { setKind(e.target.value); reset(); }}><option value="all">모든 사건</option>{Object.entries(CLUB_EVENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
      <input aria-label="연표 검색" data-testid="club-history-query" value={query} placeholder="사건·선수 이름 검색" onChange={e => { setQuery(e.target.value); reset(); }} />
      <button className="btn sm" data-testid="club-history-order" onClick={() => { setOldFirst(!oldFirst); reset(); }}>{oldFirst ? "오래된 순" : "최신 순"}</button>
    </div>
    <h3>시즌 성적</h3><p className="muted xs">연도 조건만 적용합니다. 사건 종류·검색은 아래 사건 목록을 거릅니다. 과거 세부 경기/선수단은 종료 시점의 보관본이며 이후 이적·이름 변경으로 다시 계산하지 않습니다.</p>
    {current && !t.splits.some(r => r.id === current.id) && (year === "all" || current.year === Number(year)) && <SplitRecord record={current} current />}
    {splits.map(r => <SplitRecord key={r.id} record={r} />)}
    {!splits.length && <p data-testid="club-history-no-splits">종료한 스플릿 보관 기록 없음{current ? " · 현재 시즌은 진행 중입니다." : ""}</p>}
    <h3>주요 사건 <span className="muted sm">{events.length}개</span></h3>
    <div className="col gap" data-testid="club-history-events">{visible.map(e => <article className="notice" key={e.id} data-testid={`club-event-${e.id.replace(":", "-")}`}><span className="muted xs">{e.date} · {CLUB_EVENT_LABELS[e.kind]}{e.source === "retained-news" && " · 이전 저장의 남은 소식"}</span><h3>{e.title}</h3><p className="sm">{e.body}</p>{e.cash != null && <p className="muted xs">사건 기록 시 잔고 {fmtMoney(e.cash)} · 게임용 가상 금액</p>}</article>)}</div>
    {!visible.length && <p data-testid="club-history-empty">이 조건의 사건 기록 없음</p>}
    {events.length > 20 && <div className="row wrap gap"><button className="btn sm" data-testid="club-history-prev" disabled={selectedPage === 0} onClick={() => setPage(selectedPage - 1)}>이전</button><span data-testid="club-history-page">{selectedPage + 1}/{last + 1}</span><button className="btn sm" data-testid="club-history-next" disabled={selectedPage === last} onClick={() => setPage(selectedPage + 1)}>다음</button></div>}
  </Card>;
}
