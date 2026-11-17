import { Suspense, lazy, useEffect, useState } from "react";
import { CORE, loadCore, loadRanked } from "./data";
import { useSave, advance, loadSlot, lastSlot } from "./store";
import { standings, nextMySeries, dateKo, STAGE_KO } from "./game/season";
import { FanNotice, TeamChip, form5 } from "./ui";
import { PATCH_VERSION } from "./pages/patchdata";
import { go } from "./nav";

const Title = lazy(() => import("./pages/Title"));
const Home = lazy(() => import("./pages/Home"));
const NewsPage = lazy(() => import("./pages/News"));
const Schedule = lazy(() => import("./pages/Schedule"));
const Standings = lazy(() => import("./pages/Standings"));
const Squad = lazy(() => import("./pages/Squad"));
const PlayerPage = lazy(() => import("./pages/PlayerPage"));
const Scout = lazy(() => import("./pages/Scout"));
const Meta = lazy(() => import("./pages/Meta"));
const Method = lazy(() => import("./pages/Method"));
const Patch = lazy(() => import("./pages/Patch"));
const Settings = lazy(() => import("./pages/Settings"));
const Match = lazy(() => import("./pages/Match"));

function useHash(): string {
  const [h, setH] = useState(location.hash || "#/");
  useEffect(() => { const f = (): void => { setH(location.hash || "#/"); window.scrollTo(0, 0); }; window.addEventListener("hashchange", f); return () => window.removeEventListener("hashchange", f); }, []);
  return h;
}

const NAV: [string, string, string][] = [
  ["#/home", "홈", "⌂"], ["#/news", "소식", "✉"], ["#/schedule", "일정", "▦"], ["#/standings", "순위", "≡"],
  ["#/squad", "선수단", "☺"], ["#/scout", "상대 분석", "◎"], ["#/meta", "챔피언 메타", "★"],
  ["#/method", "데이터 출처·방법", "ⓘ"], ["#/patch", "패치 노트", "✎"], ["#/settings", "저장·설정", "⚙"],
];

function Loading({ text = "불러오는 중…" }: { text?: string }) { return <div className="loading"><span className="spin" />{text}</div>; }

export default function App() {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState("");
  const [menu, setMenu] = useState(false);
  const hash = useHash();
  const save = useSave();
  useEffect(() => {
    loadCore().then(() => { const l = lastSlot(); if (l && /^#\/(home|news|schedule|standings|squad|player|scout|meta|settings|match)/.test(location.hash)) loadSlot(l); setReady(true); }).catch((e) => setErr(String(e)));
  }, []);
  useEffect(() => { if (save) loadRanked(); }, [save]);
  useEffect(() => { setMenu(false); }, [hash]);
  if (err) return <div className="loading">데이터를 불러오지 못했습니다: {err}</div>;
  if (!ready) return <Loading text="LOL Manager 준비 중…" />;

  const route = hash.replace(/^#\/?/, "").split("/");
  const page = route[0] || "";
  const publicPages = ["method", "patch"];
  if (!save && !publicPages.includes(page)) return <Suspense fallback={<Loading />}><Title mode={page === "new" ? "new" : "title"} /></Suspense>;
  if (!save) return (
    <div className="public"><a className="btn ghost" href="#/">← 타이틀로</a>
      <Suspense fallback={<Loading />}>{page === "method" ? <Method /> : <Patch />}</Suspense><FanNotice /></div>
  );
  if (page === "match" && !save.session) { location.hash = "#/home"; }
  const rows = standings(save);
  const rank = rows.findIndex((r) => r.t === save.team) + 1;
  const me = rows.find((r) => r.t === save.team)!;
  const nx = nextMySeries(save);
  const day = save.days[Math.min(save.day, save.days.length - 1)];
  const unread = save.news.filter((n) => !n.read).length;
  const onAdvance = (): void => {
    const r = advance();
    if (r === "match") go("#/match");
    else if (page !== "home") go("#/home");
  };
  const inMatch = page === "match";
  return (
    <div className={"shell" + (inMatch ? " in-match" : "")}>
      <aside className={"side" + (menu ? " open" : "")}>
        <a className="brand" href="#/home"><span className="logo">LM</span><span><b>LOL Manager</b><small>2026 시즌 · v{PATCH_VERSION}</small></span></a>
        <div className="side-team"><TeamChip t={save.team} full /><small>{save.manager} 감독</small></div>
        <nav>{NAV.map(([h, label, ic]) => (
          <a key={h} href={h} className={hash.startsWith(h) ? "on" : ""}><i>{ic}</i>{label}{h === "#/news" && unread > 0 && <em>{unread}</em>}</a>
        ))}</nav>
        <div className="side-foot">데이터: LCK 2026 {CORE.meta.games}경기 · 선수 {CORE.meta.players}명</div>
      </aside>
      {menu && <div className="scrim" onClick={() => setMenu(false)} />}
      <div className="main">
        <header className="top">
          <button className="hamb" onClick={() => setMenu(!menu)} aria-label="메뉴">☰</button>
          <div className="top-date"><b>{dateKo(day.date)}</b><small>{save.phase === "done" ? "시즌 종료" : `${day.label} · ${STAGE_KO[day.stage]}`}</small></div>
          <div className="chips">
            <div className="chip"><small>순위</small><b>{me.w + me.l > 0 ? `${rank}위` : "–"}</b></div>
            <div className="chip"><small>전적</small><b>{me.w}승 {me.l}패</b></div>
            <div className="chip hide-s"><small>세트 득실</small><b>{me.gw - me.gl >= 0 ? "+" : ""}{me.gw - me.gl}</b></div>
            <div className="chip hide-s"><small>최근 5경기</small><b>{me.last.length ? form5(me.last) : "–"}</b></div>
            <div className="chip hide-m"><small>다음 경기</small><b>{nx ? <>vs {nx.a === save.team ? nx.b : nx.a} <span className="muted">· {dateKo(save.days[nx.day].date)}</span></> : "없음"}</b></div>
          </div>
          {!inMatch && <button className="btn primary go" onClick={onAdvance} disabled={save.phase === "done"} data-testid="advance">
            {save.phase === "done" ? "시즌 종료" : save.session ? "경기 계속하기 ▶" : nx && nx.day === save.day ? "경기 시작 ▶" : "진행하기 ▶"}
          </button>}
        </header>
        <main className="content">
          <Suspense fallback={<Loading />}>
            {page === "home" || page === "" ? <Home /> : page === "news" ? <NewsPage /> : page === "schedule" ? <Schedule /> : page === "standings" ? <Standings />
              : page === "squad" ? <Squad /> : page === "player" ? <PlayerPage k={route[1]} /> : page === "scout" ? <Scout team={route[1]} /> : page === "meta" ? <Meta />
              : page === "method" ? <Method /> : page === "patch" ? <Patch /> : page === "settings" ? <Settings /> : page === "match" ? <Match /> : <Home />}
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
