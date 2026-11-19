import { useEffect, useRef, useState } from "react";
import { CARDS, PL, POS_KO, TM } from "../data";
import type { Save } from "../game/season";
import { mutate } from "../store";
import { Card } from "../ui";
import { CardTile } from "./Market";
import { fmtMoney } from "../game/money";
import { seasonCandidates, seasonMarketClosed, seasonMarketWeek, prepareInSeason, seasonSalaryDue, seasonReserve, startSeasonNegotiation, seasonClubReply, seasonPlayerReply, answerSeasonIncoming, setSeasonAutomatic } from "../game/inSeason";
import { ScoutingPanel } from "./Scouting";
import { scoutPreferences, scoutWatch, toggleScoutWatch } from "../game/scouting";

export default function InSeasonMarket({ s }: { s: Save }) {
  const [query, setQuery] = useState(""), [pos, setPos] = useState("all"), [source, setSource] = useState("all");
  const [message, setMessage] = useState(""), [fee, setFee] = useState("0"), [salary, setSalary] = useState("0.3"), [years, setYears] = useState(1), [starter, setStarter] = useState(true);
  const closed = seasonMarketClosed(s), week = seasonMarketWeek(s), m = s.inSeason;
  useEffect(() => { if (!closed && (m?.year !== s.story?.year || m?.week !== week)) mutate((x) => prepareInSeason(x)); }, [closed, m?.year, m?.week, s.story?.year, week]);
  const list = seasonCandidates(s).filter((c) => (pos === "all" || c.card.posIdx === Number(pos)) && (source === "all" || (source === "FA" ? c.owner === "FA" : c.owner !== "FA")) && (!query.trim() || `${c.card.name} ${c.owner} ${TM[c.owner]?.ko ?? ""}`.toLowerCase().includes(query.trim().toLowerCase()))).sort((a, b) => a.salary - b.salary || b.ovr - a.ovr);
  const tr = m?.negotiation, target = tr && seasonCandidates(s).find((c) => c.person === tr.person);
  const negotiationRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (tr) negotiationRef.current?.scrollIntoView({ block: "start" }); }, [tr?.person, tr?.step]);
  const teamName = (t: string) => t === "FA" ? "자유계약" : TM[t]?.ko ?? t;
  const action = (fn: (x: Save) => string | undefined, success: string) => mutate((x) => setMessage(fn(x) ?? success));
  return <>
    <ScoutingPanel context="season" onSelect={c => {
      if (!c.offerCardId || c.salary == null) return;
      setSalary(String(c.salary)); setFee(String(c.fee ?? 0)); setYears(1); setStarter(scoutPreferences(s).goal !== "development");
      action(x => startSeasonNegotiation(x, c.offerCardId!, c.fee ?? 0), "추천 선수의 기존 협상 조건을 확인해 주세요.");
    }} />
    <Card title="시즌 중 이적" right={<span className="muted sm">정규 시즌 · 주간 영입 1명 / 매각 1명</span>}>
      <p className="muted sm">선수당 한 명을 표시하고 현재 연도에 맞는 실제 기록을 적용합니다. 계약 선수는 구단 합의 후 선수의 동의를 받습니다. 연봉·이적료는 모두 게임용 가상 금액입니다. 이적 기간은 게임 설정입니다.</p>
      <p data-testid="season-market-status">{closed ?? `${s.days[s.day]?.date} · ${week.split("-").slice(-1)[0]}주차 시장 열림`} · 잔고 <b>{fmtMoney(s.eco.cash)}</b> · 다음 해 계약·가입 유보금 {fmtMoney(seasonReserve(s))}</p>
      <label className="row gap"><input type="checkbox" data-testid="season-automatic" checked={m?.automatic ?? false} disabled={!!closed} onChange={(e) => mutate((x) => setSeasonAutomatic(x, e.target.checked))} />자동 감독에게 주간 보강 맡기기</label>
      <p className="muted sm">보유 벤치를 먼저 기용하고 예산 안에서 보강합니다. 필요한 자금은 실제로 도착한 벤치 이적 제안으로 마련합니다. 선수는 거절할 수 있습니다.</p>
      {message && <p role="status" data-testid="season-market-message" className="notice">{message}</p>}
      {tr && target && <div ref={negotiationRef} style={{ scrollMarginTop: 110 }} className="notice" data-testid="season-negotiation">
        <h3>{target.card.name} · {tr.step === "club" ? "1. 구단 협상" : "2. 선수 계약"}</h3>
        <p>{teamName(tr.from)} · {POS_KO[target.card.posIdx]} · 연봉 희망 {fmtMoney(target.salary)} · 합의 이적료 {fmtMoney(tr.fee)}</p>
        {tr.step === "club" ? <button className="btn" disabled={!!closed} data-testid="season-club-reply" onClick={() => action(seasonClubReply, "구단 합의 완료. 선수 계약 조건을 제시해 주세요.")}>구단 답변 받기</button> : <>
          <div className="row wrap gap">
            <label>연봉(억 원) <input style={{ width: 100 }} data-testid="season-salary" type="number" min="0.01" step="0.01" value={salary} onChange={(e) => setSalary(e.target.value)} /></label>
            <label>계약 <select data-testid="season-years" value={years} onChange={(e) => setYears(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>{n}시즌</option>)}</select></label>
            <label><input type="checkbox" data-testid="season-starter" checked={starter} onChange={(e) => setStarter(e.target.checked)} />선발 약속</label>
          </div>
          <p>이번 지급: 이적료 {fmtMoney(tr.fee)} + 남은 연봉 {fmtMoney(seasonSalaryDue(s, Number(salary) || 0))} = <b>{fmtMoney(tr.fee + seasonSalaryDue(s, Number(salary) || 0))}</b></p>
          <p className="muted sm">1시즌 계약은 올해 말 만료입니다. 2시즌 이상은 다음 해 연봉도 남겨 둡니다. 기존 선수의 이미 지급한 연봉은 환급되지 않습니다. 선발로 영입하면 기존 주전은 벤치로 남습니다.</p>
          <button className="btn" disabled={!!closed} data-testid="season-player-reply" onClick={() => mutate((x) => setMessage(seasonPlayerReply(x, Number(salary), years, starter).message))}>선수 답변 받기</button>
        </>}
        <button className="btn ghost" data-testid="season-cancel" onClick={() => mutate((x) => { if (x.inSeason) x.inSeason.negotiation = undefined; })}>협상 닫기</button>
      </div>}
      <h3>도착한 이적 제안</h3>
      {!m?.incoming.length && <p className="muted sm">이번 주 도착한 제안이 없습니다.</p>}
      {m?.incoming.map((offer) => <div className="notice" key={offer.id} data-testid="season-incoming">
        <p><b>{PL[s.story!.contracts.find((c) => c.person === offer.person)?.key ?? ""]?.name ?? offer.person}</b> → {teamName(offer.from)} · 이적료 {fmtMoney(offer.fee)} · 제시 연봉 {fmtMoney(offer.salary)}</p>
        {offer.status === "open" ? <><button className="btn" disabled={!!closed} data-testid="season-accept-sale" onClick={() => action((x) => answerSeasonIncoming(x, offer.id, true), "선수 동의와 정산을 마쳤습니다.")}>매각 동의 요청</button> <button className="btn ghost" disabled={!!closed} onClick={() => action((x) => answerSeasonIncoming(x, offer.id, false), "제안을 거절했습니다.")}>거절</button></> : <span>{offer.status === "accepted" ? "이적 완료" : offer.status === "rejected" ? "거절" : "기한 만료"}</span>}
      </div>)}
      <p className="muted sm">주전을 팔려면 같은 포지션의 보유 벤치가 필요합니다. 수락해도 선수·구매 구단의 조건이 맞아야 정산되며, 제안은 다음 주에 만료됩니다.</p>
      <div className="row wrap gap market-bar">
        <input aria-label="시즌 중 선수 검색" data-testid="season-search" placeholder="선수·소속 검색" value={query} onChange={(e) => setQuery(e.target.value)} />
        <select aria-label="시즌 중 포지션" value={pos} onChange={(e) => setPos(e.target.value)}><option value="all">전 포지션</option>{POS_KO.map((p, i) => <option key={p} value={i}>{p}</option>)}</select>
        <select aria-label="계약 상태" value={source} onChange={(e) => setSource(e.target.value)}><option value="all">모든 선수</option><option value="FA">자유계약</option><option value="contracted">계약 선수</option></select>
        <label>제안 이적료(억 원) <input style={{ width: 90 }} aria-label="제안 이적료" type="number" min="0" step="0.01" value={fee} onChange={(e) => setFee(e.target.value)} /></label>
      </div>
      <p className="muted sm">낮은 연봉 순 · {list.length}명. 카드의 금액은 연봉 희망이며, 계약 선수의 이적료는 별도입니다.</p>
      <div className="card-grid">{list.slice(0, 60).map((c) => <div key={c.person} data-testid={`season-candidate-${c.person}`}>
        <CardTile c={c.card} price={c.salary} personView disabled={!!closed} onClick={() => { setSalary(String(c.salary)); setYears(1); setStarter(true); action((x) => startSeasonNegotiation(x, c.card.id, Number(fee) || 0), c.owner === "FA" ? "선수에게 계약을 제시해 주세요." : "구단에 이적료를 제안했습니다."); }} />
        <p className="sm">현재 게임 종합 <b>{c.ovr}</b>{c.card.year < Math.min(s.story!.year, 2026) && " · 과거 기록 기반 추정"}</p>
        <p className="sm">현재 소속: {teamName(c.owner)} · {c.stance}{c.owner !== "FA" && ` · 희망 이적료 ${fmtMoney(c.fee)}`}</p>
        <button className="btn sm" data-testid={`market-watch-${c.person}`} onClick={() => mutate(x => setMessage(toggleScoutWatch(x, c.person) ?? "관심 목록을 갱신했습니다."))}>{scoutWatch(s).includes(c.person) ? "관심 해제" : "관심 저장"}</button>
      </div>)}</div>
      {list.length > 60 && <p className="muted sm">60명까지 표시합니다. 검색·포지션으로 범위를 좁혀 주세요.</p>}
      <h3>완료된 이적</h3>
      <div data-testid="season-transfer-history">{m?.history.filter((d) => d.from === s.team || d.to === s.team).slice(-12).reverse().map((d) => <p key={d.id} className="sm">{d.date} · {d.name} · {teamName(d.from)} → {teamName(d.to)} · 이적료 {fmtMoney(d.fee)} · 연봉 {fmtMoney(d.salary)} / 이번 지급 연봉 {fmtMoney(d.paidSalary)}</p>)}</div>
    </Card>
    <Card title="보유 선수" right={<span className="muted sm">선발 5 + 벤치 최대 3</span>}><div className="card-grid">{s.story!.contracts.map((ct) => CARDS[ct.cardId] ? <div key={ct.person}><CardTile c={CARDS[ct.cardId]} price={ct.salary} personView on /><p className="sm">현재 게임 종합 <b>{PL[ct.key]?.pct.ovr ?? "기록 없음"}</b>{PL[ct.key]?.label?.includes("추정") && " · 과거 기록 기반 추정"}</p></div> : <div key={ct.person}>{ct.person} · 기록 없음</div>)}</div></Card>
  </>;
}
