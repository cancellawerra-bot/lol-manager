// 시즌 여정 지도 (v2.25.0, 2026-11-22): 2018 창단 → 2027 월즈 우승까지 지금 어디쯤인지 한눈에.
// 저장된 스토리 진행(연도·1부/2부·프랜차이즈·트로피)과 구단 연표 기록만 읽습니다. 기록이 없는 과거 시즌은 "–"로 두고 채우지 않습니다.
import type { Save } from "../game/season";
import { SPLIT_KO, TIER_KO } from "../game/story";
import { readClubTimeline } from "../game/clubTimeline";

const FIRST = 2018, LAST = 2027;
const YEARS = Array.from({ length: LAST - FIRST + 1 }, (_, i) => FIRST + i);
const KEY: Record<number, string> = { 2018: "창단", 2021: "프랜차이즈", 2027: "월즈 우승" };

type Ms = { key: string; title: string; sub: string; state: "done" | "now" | "todo" | "miss" };
const STATE_KO: Record<Ms["state"], string> = { done: "완료", now: "지금", todo: "예정", miss: "미확보" };

export default function SeasonJourney({ s }: { s: Save }) {
  const st = s.story;
  if (s.mode !== "story" || !st) return null;
  const splits = readClubTimeline(s)?.splits ?? [];
  const ended = st.ended;
  const cur = Math.max(FIRST, Math.min(LAST, st.year));
  const tierOf = (y: number): "LCK" | "CK" | undefined => {
    if (y === st.year) return st.tier;
    const rs = splits.filter((r) => r.year === y);
    return rs.length ? (rs.some((r) => r.tier === "LCK") ? "LCK" : "CK") : undefined;
  };
  const lckYears = splits.filter((r) => r.tier === "LCK").map((r) => r.year);
  if (st.tier === "LCK") lckYears.push(st.year);
  const firstLck = lckYears.length ? Math.min(...lckYears) : undefined;
  const franchiseNow = st.phase === "franchise";
  const pct = Math.round((((cur - FIRST) + (st.split === "summer" ? 0.5 : 0)) / (LAST - FIRST)) * 100);
  const ms: Ms[] = [
    { key: "found", title: "창단", sub: `${FIRST} · 2부(챌린저스)에서 시작`, state: "done" },
    firstLck != null
      ? { key: "promo", title: "LCK 승격", sub: `${firstLck}년 LCK 무대에 올랐습니다`, state: "done" }
      : { key: "promo", title: "LCK 승격", sub: "승강전 2018–2020", state: st.year <= 2020 ? "now" : "todo" },
    st.franchised
      ? { key: "fran", title: "프랜차이즈", sub: "2021 프랜차이즈 자리를 지켰습니다", state: "done" }
      : franchiseNow
        ? { key: "fran", title: "프랜차이즈", sub: "지금 슬롯·예산을 정할 차례", state: "now" }
        : st.year > 2021 ? { key: "fran", title: "프랜차이즈", sub: "자리를 얻지 못했습니다", state: "miss" } : { key: "fran", title: "프랜차이즈", sub: "2021 슬롯 확보", state: "todo" },
    ended === "clear"
      ? { key: "goal", title: "월즈 우승", sub: "2027 월즈 우승으로 클리어", state: "done" }
      : ended
        ? { key: "goal", title: "월즈 우승", sub: ended === "bankrupt" ? "파산으로 여정이 끝났습니다" : "이번 여정은 목표에 닿지 못했습니다", state: "miss" }
        : { key: "goal", title: "월즈 우승", sub: "2027 · 이 여정의 목표", state: "todo" },
  ];
  const nowLabel = ended === "clear" ? "클리어" : ended ? "여정 종료" : `${st.year} ${SPLIT_KO[st.split]} · ${TIER_KO[st.tier]}`;
  const tr = st.trophies;
  return (
    <section className="sj" aria-label="시즌 여정" data-testid="season-journey">
      <div className="sj-head">
        <div><small>시즌 여정</small><h2>2018 창단에서 2027 월즈까지</h2></div>
        <span className="sj-now" data-testid="journey-now">{nowLabel}</span>
      </div>
      <ol className="sj-track" aria-label="연도별 여정 (표시는 그해 가장 높은 리그)" title="표시는 그해 가장 높은 리그입니다">
        {YEARS.map((y) => {
          const done = ended === "clear" ? true : y < cur;
          const here = !ended && y === cur;
          const t = y > cur && !ended ? undefined : tierOf(y);
          return (
            <li key={y} className={"sj-y" + (done ? " done" : "") + (here ? " here" : "") + (y === LAST ? " last" : "") + (t ? " t-" + t : "")} aria-current={here ? "step" : undefined}>
              {KEY[y] && <em className="sj-key">{KEY[y]}</em>}
              <i className="sj-dot" />
              <b>{y}</b>
              <small>{t ? TIER_KO[t] : "·"}</small>
            </li>
          );
        })}
      </ol>
      <div className="sj-bar" aria-hidden="true"><i style={{ width: `${ended === "clear" ? 100 : pct}%` }} /></div>
      <ul className="sj-ms">
        {ms.map((m) => (
          <li key={m.key} className={"sj-m " + m.state} data-testid={`journey-${m.key}`}>
            <span className="sj-tag">{STATE_KO[m.state]}</span>
            <b>{m.title}</b>
            <small>{m.sub}</small>
          </li>
        ))}
      </ul>
      <p className="sj-trophy" data-testid="journey-trophies">
        <span>LCK 우승 <b>{tr.lck}</b>회</span><span>MSI 우승 <b>{tr.msi}</b>회</span><span>월즈 우승 <b>{tr.worlds}</b>회</span>
      </p>
    </section>
  );
}
