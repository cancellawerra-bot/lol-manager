import { Suspense, lazy, useEffect, useState } from "react";
import { fmtMoney } from "./game/money";
import { CORE, CARDS_FILE, loadCore, loadRanked, TM } from "./data";
import { useSave, advance, loadSlot, lastSlot } from "./store";
import { standings, nextMySeries, dateKo, STAGE_KO } from "./game/season";
import { FanNotice, TeamChip, form5 } from "./ui";
import { PATCH_VERSION } from "./pages/patchdata";
import { go } from "./nav";
import { swissRows } from "./game/swiss";

const Title = lazy(() => import("./pages/Title"));
const Setup = lazy(() => import("./pages/Setup"));
const Home = lazy(() => import("./pages/Home"));
const NewsPage = lazy(() => import("./pages/News"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Standings = lazy(() => import("./pages/Standings"));
const Squad = lazy(() => import("./pages/Squad"));
const Club = lazy(() => import("./pages/Club"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const Scout = lazy(() => import("./pages/Scout"));
const Market = lazy(() => import("./pages/Market"));
const Meta = lazy(() => import("./pages/Meta"));
const Help = lazy(() => import("./pages/Help"));
const Patch = lazy(() => import("./pages/Patch"));
const Settings = lazy(() => import("./pages/Settings"));
const Match = lazy(() => import("./pages/Match"));
const Stove = lazy(() => import("./pages/Stove"));

function useHash(): string {
  const [h, setH] = useState(location.hash || "#/");
  useEffect(() => { const f = (): void => { setH(location.hash || "#/"); window.scrollTo(0, 0); }; window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return h;
}

const NAV: [string, string, string][] = [
  ["#/home", "홈", "⌂"], ["#/news", "소식", "✉"], ["#/club", "구단", "⚑"],
  ["#/squad", "선수단 일정", "▦"], ["#/market", "영입", "✎"],
  ["#/standings", "LCK", "≡"], ["#/schedule", "일정", "📅"],
  ["#/help", "기록·도움말", "ⓘ"], ["#/settings", "설정", "⚙"],
];

function Loading({ text = "불러오는 중…" }: { text?: string }) { return <div className="loading"><span className="spin" />{text}</div>; }

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const [note, setNote] = useState("");
  const hash = useHash();
  const save = useSave();
  useEffect(() => {
    loadCore().then(() => loadRanked()).then(() => { const l = lastSlot(); if (l && /^#\/(home|news|schedule|standings|squad|player|scout|meta|settings|match|club|market|stove)/.test(location.hash)) loadSlot(l); setReady(true); }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { if (save) loadRanked(); }, [save]);
  useEffect(() => { setMenu(false); setNote(""); }, [hash]);
  if (err) return <div className="loading">데이터를 불러오지 못했습니다: {err}</div>;
  if (!ready) return <Loading text="LOL Manager 준비 중…" />;

  const route = hash.replace(/^#\/?/, "").split("/");
  const page = route[0] || "";
  const publicPages = ["help", "patch", "method", "settings", "setup", "new"];
  if (!save && (page === "setup" || page === "new")) return <Suspense fallback={<Loading />}><Setup /></Suspense>;
  if (!save && !publicPages.includes(page)) return <Suspense fallback={<Loading />}><Title /></Suspense>;
  if (!save) return (
    <div className="public"><a className="btn ghost" href="#/">← 타이틀로</a>
      <Suspense fallback={<Loading />}>{page === "patch" ? <Patch /> : page === "settings" ? <Settings /> : <Help />}</Suspense><FanNotice /></div>
  );
  if (page === "match" && !save.session) { location.hash = "#/home"; }
  const rows = standings(save);
  const rank = rows.findIndex((r) => r.t === save.team) + 1;
  const me = rows.find((r) => r.t === save.team) ?? { t: save.team, w: 0, l: 0, gw: 0, gl: 0, streak: "–", last: [] as string[] };
  const nx = nextMySeries(save);
  const storyEnded = save.story?.ended;
  const activeSwiss = save.story?.phase === "worlds" ? save.story.swiss : undefined;
  const swissMe = activeSwiss ? swissRows(activeSwiss, save.series).find((r) => r.t === save.team) : undefined;
  const endLabel = storyEnded === "clear" ? "클리어" : storyEnded === "bankrupt" ? "파산" : storyEnded === "fail" ? "여정의 끝" : "";
  const day = save.days[Math.min(save.day, save.days.length - 1)];
  const unread = save.news.filter((n) => !n.read).length;
  const onAdvance = (): void => {
    const r = advance();
    if (r === "sched") { setNote("선수단 주간 일정을 먼저 정해 주세요."); go("#/home"); }
    else if (r === "match") go("#/match");
    else if (r === "franchise") { setNote("2021 프랜차이즈 전환을 확인해 주세요."); go("#/home"); }
    else if (r === "stove") { setNote("스토브리그 본편으로 이동합니다."); go("#/stove"); }
    else if (r === "endstory") go("#/home");
    else if (page !== "home") go("#/home");
  };
  const inMatch = page === "match";
  const goalKo = { win: "우승", final: "결승", sf: "4강", po: "PO", top8: "8위 이내" }[save.eco?.goal ?? "top8"];
  return (
    <div className={"shell" + (inMatch ? " in-match" : "")}>
      <aside className={"side" + (menu ? " open" : "")}>
        <a className="brand" href="#/home"><span className="logo">LM</span><span><b>LOL Manager</b><small>{save.story ? `${save.story.year} · 스토리${storyEnded ? " · " + endLabel : ""}` : "2026 시즌"} · v{PATCH_VERSION}</small></span></a>
        <div className="side-team"><TeamChip t={save.team} full /><small>{save.manager} 감독</small></div>
        <nav>{NAV.map(([h, label, ic]) => (
          <a key={h} href={h} className={hash.startsWith(h) ? "on" : ""}><i>{ic}</i>{label}{h === "#/news" && unread > 0 && <em>{unread}</em>}</a>
        ))}</nav>
        <div className="side-foot">시즌 카드 {CARDS_FILE.meta.eligible}장 · LCK {CORE.meta.games}경기</div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="top">
          <button className="hamb" onClick={() => setMenu(!menu)} aria-label="메뉴">☰</button>
          <div className="top-date"><b>{storyEnded ? `${save.story!.year} 시즌` : dateKo(day.date)}</b><small>{storyEnded ? endLabel : (save.phase === "done" ? "시즌 종료" : `${day.label} · ${STAGE_KO[day.stage]}`)}</small></div>
          <div className="chips">
            <div className="chip"><small>{activeSwiss ? "월즈" : "순위"}</small><b>{activeSwiss ? !swissMe ? "미출전" : swissMe.w === 3 ? "8강 진출" : swissMe.l === 3 ? "탈락" : `${activeSwiss.round}라운드` : storyEnded && save.story?.lastRank ? `${save.story.lastRank}위` : (me.w + me.l > 0 ? `${rank}위` : "–")}</b></div>
            {save.story && <div className="chip"><small>{save.story.year}</small><b>{save.story.tier === "LCK" ? "LCK" : "2부"}</b></div>}
            <div className="chip"><small>{activeSwiss ? "스위스 전적" : storyEnded && save.story?.lastRank ? "최종 순위" : "전적"}</small><b>{activeSwiss ? swissMe ? `${swissMe.w}승 ${swissMe.l}패` : "경기 없음" : storyEnded && save.story?.lastRank ? `${save.story.lastRank}위` : `${me.w}승 ${me.l}패`}</b></div>
            <div className="chip hide-s"><small>목표</small><b>{goalKo}</b></div>
            <div className="chip hide-s"><small>자금</small><b>{fmtMoney(save.eco.cash)}</b></div>
            <div className="chip hide-m"><small>구단주 신뢰</small><b>{save.eco.trust}</b></div>
            <div className="chip hide-m"><small>다음 경기</small><b>{storyEnded ? "종료" : (nx ? <>vs {nx.a === save.team ? nx.b : nx.a} <span className="muted">· {dateKo(save.days[nx.day].date)}</span></> : "없음")}</b></div>
            <div className="chip hide-s"><small>최근 5경기</small><b>{me.last.length ? form5(me.last) : "–"}</b></div>
          </div>
          {!inMatch && <button className="btn primary go" onClick={onAdvance} disabled={save.phase === "done" || !!storyEnded} data-testid="advance">
            {storyEnded || save.phase === "done" ? (endLabel || "시즌 종료") : save.session ? "경기 계속하기 ▶" : nx && nx.day === save.day ? "경기 시작 ▶" : "진행하기 ▶"}
          </button>}
        </header>
        {note && <div className="banner-note">{note}</div>}
        <main className="content">
          <Suspense fallback={<Loading />}>
            {page === "home" || page === "" ? <Home onAdvance={onAdvance} /> : page === "news" ? <NewsPage /> : page === "schedule" ? <Schedule /> : page === "standings" ? <Standings />
              : page === "squad" ? <Squad /> : page === "club" ? <Club /> : page === "market" ? <Market /> : page === "player" ? <PlayerPage k={route[1]} /> : page === "scout" ? <Scout team={route[1]} /> : page === "meta" ? <Meta />
              : page === "help" || page === "method" ? <Help /> : page === "patch" ? <Patch /> : page === "settings" ? <Settings /> : page === "match" ? <Match /> : page === "stove" ? <Stove /> : <Home onAdvance={onAdvance} />}
          </Suspense>
          {!inMatch && <FanNotice />}
        </main>
      </div>
      <nav className="bnav">
        {NAV.slice(0, 5).map(([h, label, ic]) => <a key={h} href={h} className={hash.startsWith(h) ? "on" : ""}><i>{ic}</i>{label}</a>)}
        <button onClick={() => setMenu(true)}><i>☰</i>더보기</button>
      </nav>
    </div>
  );
}
void TM;
