import { useMemo, useState } from "react";
import { CARDS, CARDS_FILE, POS_KO, recTxt, cardLabel, fmt } from "../data";
import type { SeasonCard } from "../types";
import { personUsed } from "../game/cards";
import { getSave, useSave } from "../store";
import { Card } from "../ui";
import { cardRating, ratingColor } from "../rating";
import { compareByVisibleOvr, estimateOvr } from "../game/scoutEstimate";
import { StarRangeText } from "./ScoutRating";
import { HonorChips, MiniFour } from "../pcard";
import { go } from "../nav";
import { fmtMoney, moneyRound } from "../game/money";
import { franchisePlayers } from "../game/story";
import InSeasonMarket from "./InSeasonMarket";
import { OpeningScouting } from "./Scouting";

export function CardTile({ c, on, disabled, reason, onClick, price, personView, ratingOf, showFour = true, year }: { c: SeasonCard; on?: boolean; disabled?: boolean; reason?: string; onClick?: () => void; price?: number; personView?: boolean; ratingOf?: (c: SeasonCard) => number; showFour?: boolean; year?: number }) {
  const s = useSave(), rt = ratingOf ? ratingOf(c) : cardRating(c), est = estimateOvr(s, c.pkey, rt, c, undefined, year);
  const exact = est.kind === "exact", tone = exact ? rt : 84;
  return (
    <button type="button" className={"card-tile pc" + (exact && rt >= 92 ? " top" : "") + (on ? " on" : "") + (disabled ? " dim" : "")} style={{ "--tc": ratingColor(tone) } as React.CSSProperties} onClick={onClick} disabled={disabled && !on} data-testid={`card-${c.id}`} data-person={c.pkey}>
      <div className="pc-head">
        <div className={"pc-ovr" + (exact ? "" : " est")} aria-label={est.kind === "none" ? "능력치 기록 없음" : exact ? `능력치 ${rt}` : `능력치 추정 ${est.text}`} data-testid="scout-stars" data-kind={est.kind} data-lo={est.lo} data-hi={est.hi} title={est.reason}>{est.kind === "none" ? <b className="muted">–</b> : exact ? <b>{rt}</b> : <StarRangeText lo={est.lo} hi={est.hi} text={est.text} />}<small>{est.kind === "range" ? "능력치 추정" : est.kind === "none" ? "기록 없음" : "능력치"}</small></div>
        <div className="pc-id">
          <b className="pc-name">{personView ? c.name : cardLabel(c)}</b>
          <span className="pc-sub">{personView && `${c.year} 기록 · `}{POS_KO[c.posIdx]} · {c.team}</span>
          <HonorChips c={c} />
        </div>
        <span className="gold pc-price">{fmtMoney(price ?? c.salary)}</span>
      </div>
      {showFour && (exact ? <MiniFour c={c} /> : est.kind === "range" || est.kind === "none" ? <p className="muted xs" data-testid="four-hidden">세부 능력치(교전·압박·판단·운영)는 관찰을 마친 뒤 확인할 수 있습니다.</p> : null)}
      <div className="muted xs pc-note">{c.games}경기{c.small ? " · 표본 부족" : ""}{c.limited ? " · 지표 제한(초기 시대)" : ""}{c.rank && c.pool ? ` · ${c.year} ${POS_KO[c.posIdx]} ${c.pool}명 중 ${c.rank}위` : exact && c.percentile != null ? ` · 퍼센타일 ${c.percentile}` : ""}</div>
      <div className="tile-metrics xs muted">
        <span>KDA {recTxt(c.kda, (n) => n.toFixed(2))}</span>
        <span>승률 {recTxt(c.wr, (n) => `${(n * 100).toFixed(1)}%`)}</span>
        <span>GD@15 {recTxt(c.gd15, (n) => (n >= 0 ? "+" : "") + fmt(n, 0))}</span>
        <span>DPM {recTxt(c.dpm, (n) => fmt(n, 0))}</span>
      </div>
      {reason && <div className="xs err">{reason}</div>}
    </button>
  );
}

export type MarketSort = "salary" | "salaryAsc" | "pct" | "year";
export type MarketView = { q: string; pos: number | "all" | "open"; year: number | "all"; sort: MarketSort; availOnly?: boolean; team?: string; tab?: number };
/** 판타지 드래프트용: 카드마다 잠금 이유, 남은 포지션, 한도 문구를 밖에서 정합니다. */
export type DraftRules = { lock: (c: SeasonCard) => string | undefined; open: number[]; headline: string };

export function CardMarket({ cap, selected, onChange, hideOwn, yearMax, priceOf, ratingOf, seasonYear, view: viewProp, onView, draft }: { cap: number; selected: string[]; onChange: (ids: string[]) => void; hideOwn?: boolean; yearMax?: number; priceOf?: (c: SeasonCard) => number; ratingOf?: (c: SeasonCard) => number; seasonYear?: number; view?: MarketView; onView?: (v: MarketView) => void; draft?: DraftRules }) {
  const [own, setOwn] = useState<MarketView>({ q: "", pos: "all", year: "all", sort: "salary" });
  const view = viewProp ?? own;
  const setView = (patch: Partial<MarketView>): void => { const v = { ...view, ...patch }; if (onView) onView(v); else setOwn(v); };
  const { q, pos, year, sort } = view;
  const s = useSave();
  const setQ = (x: string): void => setView({ q: x });
  const setPos = (x: MarketView["pos"]): void => setView({ pos: x });
  const setYear = (x: MarketView["year"]): void => setView({ year: x });
  const setSort = (x: MarketSort): void => setView({ sort: x });
  const openKey = draft ? draft.open.join(",") : "";
  const list = useMemo(() => {
    let arr = seasonYear ? franchisePlayers(seasonYear) : Object.values(CARDS);
    if (yearMax) arr = arr.filter((c) => c.year <= yearMax);
    if (pos === "open") { const op = openKey.split(",").filter(Boolean).map(Number); arr = arr.filter((c) => op.includes(c.posIdx)); }
    else if (pos !== "all") arr = arr.filter((c) => c.posIdx === pos);
    if (!seasonYear && year !== "all") arr = arr.filter((c) => c.year === year);
    if (q.trim()) { const t = q.trim().toLowerCase(); arr = arr.filter((c) => c.name.toLowerCase().includes(t) || String(c.year).includes(t) || c.team.toLowerCase().includes(t)); }
    arr = [...arr].sort((a, b) => {
      const pa = priceOf ? priceOf(a) : a.salary, pb = priceOf ? priceOf(b) : b.salary;
      if (sort === "salary") return pb - pa;
      if (sort === "salaryAsc") return pa - pb;
      if (sort === "pct") {
        const ra = ratingOf ? ratingOf(a) : cardRating(a), rb = ratingOf ? ratingOf(b) : cardRating(b);
        return compareByVisibleOvr(s, { person: a.pkey, value: ra, card: a, id: a.id }, { person: b.pkey, value: rb, card: b, id: b.id }, seasonYear);
      }
      return b.year - a.year || pb - pa;
    });
    return arr;
  }, [q, pos, year, sort, yearMax, priceOf, ratingOf, seasonYear, openKey, s]);
  const price = (c: SeasonCard): number => priceOf ? priceOf(c) : c.salary;
  const used = selected.reduce((n, id) => n + (CARDS[id] ? price(CARDS[id]) : 0), 0);
  const toggle = (c: SeasonCard): void => {
    if (draft) { if (!selected.includes(c.id) && !draft.lock(c)) onChange([...selected, c.id]); return; }
    if (selected.includes(c.id)) { onChange(selected.filter((x) => x !== c.id)); return; }
    const starters = selected.filter((id) => CARDS[id]);
    if (starters.filter((id) => CARDS[id].posIdx === c.posIdx).length >= 2 && !selected.includes(c.id)) {
      // allow 1 starter + 1 bench per pos basically, max 8 total handled below
    }
    if (selected.length >= 8) return;
    if (personUsed(selected, c.pkey)) return;
    if (moneyRound(used + price(c)) > moneyRound(cap)) return;
    onChange([...selected, c.id]);
  };
  const reason = (c: SeasonCard): string | undefined => {
    if (selected.includes(c.id)) return;
    if (draft) return draft.lock(c);
    if (personUsed(selected, c.pkey)) return seasonYear ? "이미 영입한 선수입니다" : "같은 선수의 다른 시즌 카드가 이미 있습니다";
    if (selected.length >= 8) return "로스터는 최대 8명입니다";
    if (moneyRound(used + price(c)) > moneyRound(cap)) return "예산을 초과합니다";
  };
  // 드래프트: 지금 지명할 수 있는 카드를 먼저 보여 주고(정렬 순서 유지), 잠긴 카드는 뒤에 흐리게 둡니다.
  const avail = draft ? list.filter((c) => !draft.lock(c)) : list;
  const shown = !draft ? list : view.availOnly ? avail : [...avail, ...list.filter((c) => !!draft.lock(c))];
  const years = useMemo(() => [...new Set(Object.values(CARDS).filter((c) => !yearMax || c.year <= yearMax).map((c) => c.year))].sort((a, b) => b - a), [yearMax]);
  return (
    <div data-testid={seasonYear ? "franchise-market" : "card-market"}>
      {seasonYear && <OpeningScouting year={seasonYear} cap={cap} selected={selected} priceOf={price} onPick={toggle} />}
      <div className="row between wrap gap market-bar">
        <div className="row wrap gap">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={seasonYear ? "선수 이름·팀 검색" : "이름·팀·연도 검색"} aria-label={seasonYear ? "선수 검색" : "카드 검색"} />
          <select value={pos} onChange={(e) => setPos(e.target.value === "all" || e.target.value === "open" ? e.target.value : Number(e.target.value))} data-testid="card-pos">
            {draft && <option value="open">남은 포지션 ({draft.open.map((i) => POS_KO[i]).join("·") || "없음"})</option>}
            <option value="all">전 포지션</option>
            {POS_KO.map((n, i) => <option key={n} value={i}>{n}</option>)}
          </select>
          {!seasonYear && <select value={year} onChange={(e) => setYear(e.target.value === "all" ? "all" : Number(e.target.value))}>
            <option value="all">전 연도</option>
            {years.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>}
          <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} data-testid="card-sort">
            <option value="salary">연봉 높은 순</option>
            <option value="salaryAsc" data-testid="sort-asc">연봉 낮은 순</option>
            <option value="pct">능력치 높은 순</option>
            {!seasonYear && <option value="year">최신 연도 순</option>}
          </select>
          {draft && <label className="sm row gap" style={{ gap: 4 }}><input type="checkbox" checked={!!view.availOnly} onChange={(e) => setView({ availOnly: e.target.checked })} data-testid="avail-only" />지명 가능한 카드만</label>}
        </div>
        <div className="sm">{draft && <b className="gold" data-testid="pick-max">{draft.headline} · 지명 가능 {fmt(avail.length)}장 · </b>}사용 {fmtMoney(used)} / 한도 {fmtMoney(cap)} · {selected.length}명 · {CARDS_FILE.meta.salaryNote}</div>
      </div>
      <div className="card-grid">
        {shown.slice(0, hideOwn ? 240 : 240).map((c) => {
          const r = reason(c);
          return <CardTile key={c.id} c={c} on={selected.includes(c.id)} disabled={!!r} reason={r} onClick={() => toggle(c)} price={price(c)} personView={!!seasonYear} ratingOf={ratingOf} year={seasonYear} />;
        })}
      </div>
      {seasonYear && <p className="muted sm">{seasonYear}년 기준 선수당 한 명만 표시합니다. 시즌 기록은 연도에 맞춰 자동 적용하며, 해당 연도 기록이 없으면 가장 가까운 과거 기록을 사용합니다.</p>}
      {draft && shown.length === 0 && <p className="muted sm">조건에 맞는 카드가 없습니다. 필터를 바꿔 주세요.</p>}
      {shown.length > 240 && <p className="muted sm">검색·필터로 더 좁혀 주세요. {fmt(shown.length)}{seasonYear ? "명" : "장"} 중 240{seasonYear ? "명" : "장"}만 표시합니다.</p>}
    </div>
  );
}

export default function MarketPage() {
  const s = useSave();
  if (!s) { go("#/"); return null; }
  const selected = s.cards.length ? s.cards : (s.starters[s.team] ?? []);
  if (s.mode === "story" && s.story) {
    return <InSeasonMarket s={s} />;
  }
  return (
    <Card title="영입 · 시즌 카드 시장" right={<span className="muted sm">같은 실존 인물은 로스터에 한 장만 · 선발 5 + 벤치 최대 3</span>}>
      <p className="muted sm">{CARDS_FILE.meta.rule} 연봉은 게임용 가상 금액입니다. 시즌이 시작된 뒤에는 보유 카드를 살펴볼 수 있습니다. 영입·이적·FA 입찰은 시즌이 끝난 뒤 스토브리그 본편에서 진행합니다. 연봉은 게임용 가상 금액입니다.</p>
      <div className="card-grid" style={{ marginTop: 12 }}>
        {selected.map((id) => CARDS[id] ? <CardTile key={id} c={CARDS[id]} on /> : <div key={id} className="card-tile"><b>{id}</b><div className="muted sm">2026 로스터 선수</div></div>)}
      </div>
    </Card>
  );
}
// keep getSave imported usage free
void getSave;
