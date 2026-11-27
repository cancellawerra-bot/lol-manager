// v2.19.0 판타지 드래프트 선택 화면: 포지션 5칸 보드 + 팀 필터 (Grok 2026-11-22).
// PC는 탑·정글·미드·원딜·서포터 다섯 열을 나란히, 열마다 안쪽 스크롤. 휴대폰은 포지션 탭으로 한 열씩.
import { useMemo, useState } from "react";
import { useSave } from "../store";
import { compareByVisibleOvr, estimateOvr } from "../game/scoutEstimate";
import { CARDS, POS_KO, cardLabel, fmt } from "../data";
import type { SeasonCard } from "../types";
import { ratingColor } from "../rating";
import { HonorChips } from "../pcard";
import { fmtMoney } from "../game/money";
import { TEAM_LINEAGE, LINEAGE_TEAMS, teamMatch } from "../game/teamLineage";
import { CardTile, type DraftRules, type MarketView, type MarketSort } from "./Market";

export function DraftBoard({ cap, mine, view, onView, rules, priceOf, ratingOf, onPick }: {
  cap: number; mine: string[]; view: MarketView; onView: (v: MarketView) => void; rules: DraftRules;
  priceOf: (c: SeasonCard) => number; ratingOf: (c: SeasonCard) => number; onPick: (c: SeasonCard) => void;
}) {
  const set = (p: Partial<MarketView>): void => onView({ ...view, ...p });
  const [detail, setDetail] = useState<string | null>(null);
  const { q, year, sort } = view;
  const s = useSave();
  const team = view.team ?? "all";
  const all = useMemo(() => Object.values(CARDS), []);
  const years = useMemo(() => [...new Set(all.map((c) => c.year))].sort((a, b) => b - a), [all]);
  const others = useMemo(() => [...new Set(all.map((c) => c.team))].filter((t) => !LINEAGE_TEAMS.has(t)).sort(), [all]);
  const filtered = useMemo(() => {
    let arr = all.filter((c) => teamMatch(team, c.team));
    if (year !== "all") arr = arr.filter((c) => c.year === year);
    if (q.trim()) { const t = q.trim().toLowerCase(); arr = arr.filter((c) => c.name.toLowerCase().includes(t) || String(c.year).includes(t) || c.team.toLowerCase().includes(t)); }
    return [...arr].sort((a, b) => {
      const pa = priceOf(a), pb = priceOf(b);
      const vis = () => compareByVisibleOvr(s, { person: a.pkey, value: ratingOf(a), card: a, id: a.id }, { person: b.pkey, value: ratingOf(b), card: b, id: b.id });
      return sort === "salary" ? pb - pa : sort === "salaryAsc" ? pa - pb : sort === "year" ? b.year - a.year || vis() || pb - pa : vis() || pb - pa;
    });
  }, [all, team, year, q, sort, priceOf, ratingOf, s]);
  const cols = POS_KO.map((n, i) => {
    const pickedId = mine.find((id) => CARDS[id]?.posIdx === i);
    const list = filtered.filter((c) => c.posIdx === i);
    const avail = list.filter((c) => !rules.lock(c));
    const shown = view.availOnly ? avail : [...avail, ...list.filter((c) => !!rules.lock(c))];
    return { n, i, pickedId, shown, avail: avail.length };
  });
  const firstOpen = rules.open[0] ?? 0;
  const tab = view.tab !== undefined && rules.open.includes(view.tab) ? view.tab : firstOpen;
  const totalAvail = cols.reduce((n, c) => n + (c.pickedId ? 0 : c.avail), 0);
  const dc = detail ? CARDS[detail] : undefined;
  const dReason = dc ? rules.lock(dc) : undefined;
  return (
    <div data-testid="draft-board">
      <div className="row wrap gap market-bar db-bar">
        <select value={team} onChange={(e) => set({ team: e.target.value })} data-testid="team-filter" aria-label="팀 필터">
          <option value="all">전체 팀</option>
          <optgroup label="LCK 구단 (옛 이름 포함)">{TEAM_LINEAGE.map((l) => <option key={l.key} value={`g:${l.key}`}>{l.label}</option>)}</optgroup>
          <optgroup label="그 밖의 팀">{others.map((t) => <option key={t} value={`t:${t}`}>{t}</option>)}</optgroup>
        </select>
        <select value={year} onChange={(e) => set({ year: e.target.value === "all" ? "all" : Number(e.target.value) })} data-testid="year-filter" aria-label="연도">
          <option value="all">전 연도</option>
          {years.map((y) => <option key={y} value={y}>{y}</option>)}
        </select>
        <select value={sort} onChange={(e) => set({ sort: e.target.value as MarketSort })} data-testid="card-sort" aria-label="정렬">
          <option value="pct">능력치 높은 순</option>
          <option value="year">최신 연도 순</option>
          <option value="salary">연봉 높은 순</option>
          <option value="salaryAsc">연봉 낮은 순</option>
        </select>
        <input value={q} onChange={(e) => set({ q: e.target.value })} placeholder="이름·팀·연도 검색" aria-label="카드 검색" />
        <label className="sm row gap" style={{ gap: 4 }}><input type="checkbox" checked={!!view.availOnly} onChange={(e) => set({ availOnly: e.target.checked })} data-testid="avail-only" />지명 가능한 카드만</label>
      </div>
      <div className="sm db-head"><b className="gold" data-testid="pick-max">{rules.headline} · 지명 가능 {fmt(totalAvail)}장</b> · 한도 {fmtMoney(cap)} · 게임용 가상 금액입니다.</div>
      <div className="db-tabs" role="tablist">
        {cols.map((c) => <button key={c.n} type="button" role="tab" aria-selected={tab === c.i} className={"db-tab" + (tab === c.i ? " on" : "") + (c.pickedId ? " done" : "")} disabled={!!c.pickedId} onClick={() => set({ tab: c.i })} data-testid={`pos-tab-${c.i}`}>{c.n}{c.pickedId ? " ✓" : ` ${c.avail}`}</button>)}
      </div>
      <div className="db-board">
        {cols.map((c) => (
          <section key={c.n} className={"db-col" + (tab === c.i ? " active" : "") + (c.pickedId ? " filled" : "")} data-testid={`pos-col-${c.i}`}>
            <header className="db-colhead"><b>{c.n}</b><span className="muted xs">{c.pickedId ? "선택 완료 · 잠김" : `지명 가능 ${c.avail} / ${c.shown.length}`}</span></header>
            {c.pickedId ? (
              <div className="db-mine" data-testid={`mine-${c.i}`} style={{ "--tc": ratingColor(ratingOf(CARDS[c.pickedId])) } as React.CSSProperties}>
                <span className="db-mine-ovr" aria-label={`능력치 ${ratingOf(CARDS[c.pickedId])}`}><b>{ratingOf(CARDS[c.pickedId])}</b><small>능력치</small></span>
                <b>{cardLabel(CARDS[c.pickedId])}</b>
                <span className="xs muted">{CARDS[c.pickedId].team}</span>
                <HonorChips c={CARDS[c.pickedId]} />
                <span className="gold">{fmtMoney(priceOf(CARDS[c.pickedId]))}</span>
              </div>
            ) : (
              <div className="db-list">
                {c.shown.slice(0, 400).map((x) => {
                  const r = rules.lock(x), rt = ratingOf(x);
                  return (
                    <button key={x.id} type="button" className={"db-row" + (rt >= 92 ? " top" : "") + (r ? " dim" : "") + (detail === x.id ? " cur" : "")} style={{ "--tc": ratingColor(rt) } as React.CSSProperties} onClick={() => setDetail(x.id)} title={r ?? ""} data-testid={`card-${x.id}`} data-person={x.pkey} data-locked={r ? "1" : "0"}>
                      <span className="db-ovr" aria-label={`능력치 ${rt}`}><b>{rt}</b></span>
                      <span className="db-main">
                        <span className="db-r1"><b>{cardLabel(x)}</b><span className="gold">{fmtMoney(priceOf(x))}</span></span>
                        <span className="db-r2"><span className="db-team">{x.team}</span><HonorChips c={x} /></span>
                        {r && <span className="db-lock xs">{r}</span>}
                      </span>
                    </button>
                  );
                })}
                {c.shown.length === 0 && <p className="muted xs" style={{ padding: 8 }}>조건에 맞는 카드가 없습니다.</p>}
              </div>
            )}
          </section>
        ))}
      </div>
      {dc && (
        <div className="db-modal" role="dialog" aria-label="카드 상세" onClick={() => setDetail(null)} data-testid="card-detail">
          <div className="db-panel" onClick={(e) => e.stopPropagation()}>
            <CardTile c={dc} price={priceOf(dc)} ratingOf={ratingOf} reason={dReason} showFour={false} />
            <FourStats c={dc} />
            <div className="row gap" style={{ marginTop: 10, justifyContent: "flex-end" }}>
              <button type="button" className="btn" onClick={() => setDetail(null)}>닫기</button>
              <button type="button" className="btn primary" disabled={!!dReason} onClick={() => { setDetail(null); onPick(dc); }} data-testid="detail-pick">지명하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const FOUR_GROUPS: { title: string; items: { k: "fight" | "press" | "judge" | "ops"; n: string }[] }[] = [
  { title: "피지컬", items: [{ k: "fight", n: "교전" }, { k: "press", n: "압박" }] },
  { title: "뇌지컬", items: [{ k: "judge", n: "판단" }, { k: "ops", n: "운영" }] },
];

/** 상세 창: 4대 능력치 막대 (60–99, 기록 없으면 '기록 없음') */
function FourStats({ c }: { c: SeasonCard }) {
  const s = useSave();
  const est = estimateOvr(s, c.pkey, undefined, c);
  if (est.kind !== "exact") {
    return <p className="muted xs" data-testid="four-hidden">세부 능력치(교전·압박·판단·운영)는 관찰을 마친 뒤 확인할 수 있습니다.</p>;
  }
  if (!c.four) return null;
  return (
    <div className="four" data-testid="four-stats">
      {FOUR_GROUPS.map((g) => (
        <div key={g.title} className="four-g">
          <b className="sm">{g.title}</b>
          {g.items.map((it) => {
            const v = c.four![it.k];
            return (
              <div key={it.k} className="four-row" data-testid={`four-${it.k}`}>
                <span className="four-n sm">{it.n}</span>
                <span className="four-bar">{v != null && <i style={{ width: `${Math.max(4, ((v - 60) / 39) * 100)}%`, background: ratingColor(v) }} />}</span>
                <span className="four-v sm">{v != null ? <b style={{ color: ratingColor(v) }}>{v}</b> : <span className="muted xs">기록 없음</span>}</span>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
