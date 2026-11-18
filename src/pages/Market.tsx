import { useMemo, useState } from "react";
import { CARDS, CARDS_FILE, POS_KO, recTxt, cardLabel, fmt } from "../data";
import type { SeasonCard } from "../types";
import { personUsed } from "../game/cards";
import { getSave, useSave } from "../store";
import { Card } from "../ui";
import { go } from "../nav";
import { fmtMoney } from "../game/money";
import { franchisePlayers } from "../game/story";
import InSeasonMarket from "./InSeasonMarket";

export function CardTile({ c, on, disabled, reason, onClick, price, personView }: { c: SeasonCard; on?: boolean; disabled?: boolean; reason?: string; onClick?: () => void; price?: number; personView?: boolean }) {
  return (
    <button type="button" className={"card-tile" + (on ? " on" : "") + (disabled ? " dim" : "")} onClick={onClick} disabled={disabled && !on} data-testid={`card-${c.id}`} data-person={c.pkey}>
      <div className="row between"><b>{personView ? c.name : cardLabel(c)}</b><span className="gold">{fmtMoney(price ?? c.salary)}</span></div>
      <div className="muted sm">{POS_KO[c.posIdx]} · {c.team} · {c.games}경기{c.small ? " · 표본 부족" : ""}{c.limited ? " · 지표 제한(초기 시대)" : ""}</div>
      <div className="sm">{c.rank && c.pool ? `${c.year} ${POS_KO[c.posIdx]} ${c.pool}명 중 ${c.rank}위` : `퍼센타일 ${c.percentile}`}</div>
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

export function CardMarket({ cap, selected, onChange, hideOwn, yearMax, priceOf, seasonYear }: { cap: number; selected: string[]; onChange: (ids: string[]) => void; hideOwn?: boolean; yearMax?: number; priceOf?: (c: SeasonCard) => number; seasonYear?: number }) {
  const [q, setQ] = useState("");
  const [pos, setPos] = useState<number | "all">("all");
  const [year, setYear] = useState<number | "all">("all");
  const [sort, setSort] = useState<"salary" | "salaryAsc" | "pct" | "year">("salary");
  const list = useMemo(() => {
    let arr = seasonYear ? franchisePlayers(seasonYear) : Object.values(CARDS);
    if (yearMax) arr = arr.filter((c) => c.year <= yearMax);
    if (pos !== "all") arr = arr.filter((c) => c.posIdx === pos);
    if (!seasonYear && year !== "all") arr = arr.filter((c) => c.year === year);
    if (q.trim()) { const t = q.trim().toLowerCase(); arr = arr.filter((c) => c.name.toLowerCase().includes(t) || String(c.year).includes(t) || c.team.toLowerCase().includes(t)); }
    arr = [...arr].sort((a, b) => { const pa = priceOf ? priceOf(a) : a.salary, pb = priceOf ? priceOf(b) : b.salary; return sort === "salary" ? pb - pa : sort === "salaryAsc" ? pa - pb : sort === "pct" ? b.percentile - a.percentile : b.year - a.year || pb - pa; });
    return arr;
  }, [q, pos, year, sort, yearMax, priceOf, seasonYear]);
  const price = (c: SeasonCard): number => priceOf ? priceOf(c) : c.salary;
  const used = selected.reduce((n, id) => n + (CARDS[id] ? price(CARDS[id]) : 0), 0);
  const toggle = (c: SeasonCard): void => {
    if (selected.includes(c.id)) { onChange(selected.filter((x) => x !== c.id)); return; }
    const starters = selected.filter((id) => CARDS[id]);
    if (starters.filter((id) => CARDS[id].posIdx === c.posIdx).length >= 2 && !selected.includes(c.id)) {
      // allow 1 starter + 1 bench per pos basically, max 8 total handled below
    }
    if (selected.length >= 8) return;
    if (personUsed(selected, c.pkey)) return;
    if (used + price(c) > cap) return;
    onChange([...selected, c.id]);
  };
  const reason = (c: SeasonCard): string | undefined => {
    if (selected.includes(c.id)) return;
    if (personUsed(selected, c.pkey)) return seasonYear ? "이미 영입한 선수입니다" : "같은 선수의 다른 시즌 카드가 이미 있습니다";
    if (selected.length >= 8) return "로스터는 최대 8명입니다";
    if (used + price(c) > cap) return "예산을 초과합니다";
  };
  const years = useMemo(() => [...new Set(Object.values(CARDS).filter((c) => !yearMax || c.year <= yearMax).map((c) => c.year))].sort((a, b) => b - a), [yearMax]);
  return (
    <div data-testid={seasonYear ? "franchise-market" : "card-market"}>
      <div className="row between wrap gap market-bar">
        <div className="row wrap gap">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={seasonYear ? "선수 이름·팀 검색" : "이름·팀·연도 검색"} aria-label={seasonYear ? "선수 검색" : "카드 검색"} />
          <select value={pos} onChange={(e) => setPos(e.target.value === "all" ? "all" : Number(e.target.value))} data-testid="card-pos">
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
            <option value="pct">퍼센타일 순</option>
            {!seasonYear && <option value="year">최신 연도 순</option>}
          </select>
        </div>
        <div className="sm">사용 {fmtMoney(used)} / 한도 {fmtMoney(cap)} · {selected.length}명 · {CARDS_FILE.meta.salaryNote}</div>
      </div>
      <div className="card-grid">
        {list.slice(0, hideOwn ? 240 : 240).map((c) => {
          const r = reason(c);
          return <CardTile key={c.id} c={c} on={selected.includes(c.id)} disabled={!!r} reason={r} onClick={() => toggle(c)} price={price(c)} personView={!!seasonYear} />;
        })}
      </div>
      {seasonYear && <p className="muted sm">{seasonYear}년 기준 선수당 한 명만 표시합니다. 시즌 기록은 연도에 맞춰 자동 적용하며, 해당 연도 기록이 없으면 가장 가까운 과거 기록을 사용합니다.</p>}
      {list.length > 240 && <p className="muted sm">검색·필터로 더 좁혀 주세요. {fmt(list.length)}{seasonYear ? "명" : "장"} 중 240{seasonYear ? "명" : "장"}만 표시합니다.</p>}
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
