import { useState } from "react";
import { PL, POS_KO, TM, recTxt } from "../data";
import type { SeasonCard } from "../types";
import { useSave, mutate, setStarter } from "../store";
import { Card } from "../ui";
import { cardRating, ratingOf } from "../rating";
import { fmtMoney } from "../game/money";
import { SCOUT_GOALS, scoutingReport, scoutPreferences, scoutWatch, scoutBench, setScoutPreferences, toggleScoutWatch, openingScout, type ScoutContext, type ScoutCandidate, type ScoutGoal } from "../game/scouting";

export function ScoutingPanel({ context, onSelect }: { context: ScoutContext; onSelect: (c: ScoutCandidate) => void }) {
  const s = useSave()!, [message, setMessage] = useState(""), [query, setQuery] = useState("");
  const pref = scoutPreferences(s), watch = scoutWatch(s), report = scoutingReport(s, context, pref, query), bench = context === "season" ? scoutBench(s) : [];
  const change = (next: Partial<typeof pref>) => mutate(x => setScoutPreferences(x, { ...scoutPreferences(x), ...next }));
  return <Card title="스카우팅 추천" right={<span className="muted sm">{s.story?.year}년 확인 기록 기준</span>}>
    <p className="sm">보유 벤치를 먼저 비교하고, 현재 확인된 시즌 기록과 예산으로 후보를 추립니다. 전력 보강·가성비는 같은 포지션 보유 최고 선수보다 나은 후보, 육성 검토는 생년이 확인된 만 21세 이하 선수입니다.</p>
    <p className="muted sm">추천은 영입·성장·승리를 보장하지 않습니다. 현재 기록이 없는 미래 신인의 능력은 추정하지 않습니다. 금액은 게임용 가상 금액이며, 조건 선택은 기존 협상 폼을 엽니다.</p>
    <div className="row wrap gap">
      <input aria-label="스카우팅 선수 검색" data-testid="scout-query" placeholder="추천 안에서 선수 검색" value={query} onChange={e => setQuery(e.target.value)} />
      <select aria-label="스카우팅 목적" data-testid="scout-goal" value={pref.goal} onChange={e => change({ goal: e.target.value as ScoutGoal })}>{Object.entries(SCOUT_GOALS).map(([v, label]) => <option key={v} value={v}>{label}</option>)}</select>
      <select aria-label="스카우팅 포지션" data-testid="scout-pos" value={pref.pos} onChange={e => change({ pos: e.target.value === "all" ? "all" : Number(e.target.value) })}><option value="all">전 포지션</option>{POS_KO.map((p, i) => <option key={p} value={i}>{p}</option>)}</select>
      <label><input type="checkbox" data-testid="scout-affordable" checked={pref.affordableOnly} disabled={pref.goal === "watch"} onChange={e => change({ affordableOnly: e.target.checked })} />자금·명단 조건 충족만</label>
    </div>
    <p className="muted sm" data-testid="scout-summary">현재 기록 검토 {report.total}명 · 제약 {report.blocked}명 · 현재 연도까지 근거 기록 없음 {report.missingEvidence}명 · 관심 {watch.length}/20명</p>
    {pref.goal === "watch" && <p className="muted sm">관심 선수는 영입 가능 여부와 관계없이 현재 기록과 상태를 표시합니다. 관심은 개인별로 저장되어 시즌이 바뀌어도 이어집니다.</p>}
    {report.notice && <p className="notice" data-testid="scout-notice">{report.notice}</p>}
    {message && <p className="sm" role="status">{message}</p>}
    {!!bench.length && <div className="notice" data-testid="scout-bench"><b>영입 전 보유 벤치 검토 · 추가 영입 비용 없음</b>{bench.map(b => <div className="sm" key={b.key}>
      <p>{POS_KO[b.pos]} {b.name} · 현재 능력치 {ratingOf(PL[b.key]) ?? "–"} / 주전 {ratingOf(PL[s.starters[s.team]?.[b.pos]]) ?? "–"} · 피로 {b.fatigue.toFixed(1)}/100{b.promise && <><br />{b.promise}</>}</p>
      <button className="btn sm" data-testid={`scout-promote-${b.pos}`} disabled={!!s.session || s.story?.phase !== "regular"} onClick={() => setStarter(s.team, b.pos, b.key)}>선발 구성에 반영</button>
    </div>)}<p className="muted xs">자동 로테이션과 출전 약속 기한에 따라 실제 첫 선발이 조정될 수 있습니다.</p></div>}
    {!report.candidates.length && <p data-testid="scout-empty">{pref.goal === "watch" ? "저장한 관심 선수 중 이 포지션의 기록이 없습니다." : "현재 목적·예산·명단 조건에 맞는 추천이 없습니다. 관심 검토는 자금 조건 필터를 풀어 확인할 수 있습니다."}</p>}
    <div className="card-grid" data-testid="scout-list">{report.candidates.map(c => <article className="card-tile" key={c.person} data-testid={`scout-candidate-${c.person}`}>
      <div className="row between wrap"><b>{c.card?.name ?? c.person}</b><span className="tag">{c.card ? POS_KO[c.card.posIdx] : "포지션 기록 없음"}</span></div>
      <p className="muted sm">근거 {c.card ? `${c.card.year}년 · 당시 ${c.card.team} · ${c.card.games > 0 ? `${c.card.games}경기` : "기록 없음"}` : "현재 연도 기록 없음"}<br />현재 게임 소속 {TM[c.owner]?.ko ?? c.owner}</p>
      <p className="sm">현재 기록 기반 능력치 <b>{c.card ? cardRating(c.card, c.estimated) : "기록 없음"}</b> · {c.age == null ? "생년 정보 없음" : `만 ${c.age}세`}</p>
      {c.card && <p className="xs muted">KDA {recTxt(c.card.kda, n => n.toFixed(2))} · GD@15 {recTxt(c.card.gd15, n => n.toFixed(0))} · DPM {recTxt(c.card.dpm, n => n.toFixed(0))}</p>}
      <ul className="sm">{c.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      {c.offerCardId && c.salary != null && c.cost != null && <p className="sm">기존 시장 희망 연봉 {fmtMoney(c.salary)} · {c.years}시즌<br />이번 지급 참고 {fmtMoney(c.cost)}{context === "season" && ` (이적료 ${fmtMoney(c.fee ?? 0)} + 남은 연봉)`}<br />기존 계약·다른 제안·가입금 유보 {fmtMoney(c.reserve ?? 0)}</p>}
      {c.warnings.map((w, i) => <p className="xs muted" key={i}>{w}</p>)}
      {c.blocked && <p className="err sm" data-testid="scout-blocked">{c.blocked}</p>}
      <div className="row wrap gap"><button className="btn primary sm" data-testid={`scout-select-${c.person}`} disabled={!!c.blocked || !c.offerCardId} onClick={() => onSelect(c)}>협상 조건 선택</button><button className="btn sm" data-testid={`scout-watch-${c.person}`} onClick={() => mutate(x => setMessage(toggleScoutWatch(x, c.person) ?? (watch.includes(c.person) ? "관심 선수를 해제했습니다." : "관심 선수를 저장했습니다.")))}>{watch.includes(c.person) ? "관심 해제" : "관심 저장"}</button></div>
    </article>)}</div>
    <p className="muted xs">목적별 상위 6명, 관심 목록은 최대 20명을 표시합니다. 스토브는 기존 선수를 모두 유지해도 감당할 수 있게 연봉·제안·가입금을 보수적으로 유보합니다. 육성 순서는 현재 나이·현재 전력 기준이며 미래 잠재력 점수가 아닙니다. 계약 폼의 주전 옵션과 선수단의 4시리즈 출전 약속은 별도입니다.</p>
    <a className="xs" href="#/method">데이터 출처·계산 기준</a>
  </Card>;
}

export function OpeningScouting({ year, cap, selected, priceOf, onPick }: { year: number; cap: number; selected: string[]; priceOf: (c: SeasonCard) => number; onPick: (c: SeasonCard) => void }) {
  const candidates = openingScout(year, cap, selected, priceOf);
  return <section className="notice" data-testid="opening-scout"><h3>창단 스카우팅 · 남은 포지션 예산 우선</h3><p className="sm">선발이 비어 있는 포지션을 먼저 추천합니다. 다른 빈 포지션의 최저 연봉을 남기고 현재 확인된 기록으로 비교합니다. 선수당 한 명이며 과거 기록은 추정 기준을 함께 표시합니다.</p>
    <div className="card-grid">{candidates.map(c => <div className="card-tile" key={c.card.pkey} data-testid={`opening-scout-${c.card.pkey}`}><b>{c.card.name} · {POS_KO[c.card.posIdx]}</b><p className="sm">{c.card.year} 기록 · {c.card.games}경기 · 현재 기준 능력치 {cardRating(c.card, c.card.year < Math.min(year, 2026))}{c.card.year < Math.min(year, 2026) && " · 과거 기록 기반 추정"}{c.card.small && " · 표본 부족"}</p><p className="sm">연봉 {fmtMoney(c.salary)} · 다른 빈 포지션 유보 {fmtMoney(c.reserve)}</p><button className="btn sm" data-testid={`opening-scout-pick-${c.card.pkey}`} onClick={() => onPick(c.card)}>추천 선수 선택</button></div>)}</div>
    {!candidates.length && <p className="sm">현재 예산·남은 자리에서 추천할 후보가 없습니다. 보유 선택과 포지션을 확인해 주세요.</p>}
    <p className="muted xs">추천은 게임용 비교이며 성장이나 승리를 보장하지 않습니다. 모든 연봉은 게임용 가상 금액입니다.</p>
  </section>;
}
