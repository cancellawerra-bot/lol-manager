import { useEffect, useMemo, useState } from "react";
import { CH, CHAMPS, PL, POS_KO, TM, loadRanked, fmt } from "../data";
import { useSave, choose, mySide, userAct, aiAct, autoRest, simNext, endSeries, sessionSeries, setPress, afterPress, confirmLineup, afterMeet, afterPog, afterResult, afterLocker, setStarter, toMeet, toPog } from "../store";
import { turn, recommend, PHASE_OF, SEQ, openPos, used, posWeight, DraftState, Side, other, Rec } from "../game/draft";
import { STAGE_KO, standings } from "../game/season";
import type { GameResult, GEvent } from "../game/sim";
import { sigmoid } from "../game/rng";
import { ChampIcon, TeamChip, Ovr, form5 } from "../ui";
import { ratingOf } from "../rating";
import type { PosIdx } from "../types";
import { go } from "../nav";
import { TacticsControls, TacticsReview } from "./Tactics";
import { AppearanceReview } from "./Rotation";
import { playerTraining } from "../game/trainingRuntime";

export default function Match() {
  const s = useSave()!;
  const [ready, setReady] = useState(false);
  useEffect(() => { loadRanked().then(() => setReady(true)); }, []);
  const ss = s.session;
  if (!ss) return null;
  if (!ready) return <div className="loading"><span className="spin" />랭크 상성 데이터 불러오는 중…</div>;
  const sr = sessionSeries(s);
  const op = sr.a === s.team ? sr.b : sr.a;
  const myScore = sr.a === s.team ? sr.sa : sr.sb, opScore = sr.a === s.team ? sr.sb : sr.sa;
  return (
    <div className="match">
      <div className="match-top">
        <div className="mt-l"><span className="muted">{STAGE_KO[sr.stage]} · Bo{sr.bo}</span><b>{ss.stage === "end" ? "시리즈 종료" : `${ss.gameIdx + 1}세트`}</b></div>
        <div className="mt-score"><TeamChip t={s.team} size="lg" /><b>{myScore}</b><span>:</span><b>{opScore}</b><TeamChip t={op} size="lg" /></div>
        <div className="mt-r">{sr.games.length > 0 && <span className="muted sm">피어리스 잠금 {sr.games.length * 10}개</span>}<button className="btn ghost sm" onClick={() => go("#/home")}>나가기(저장됨)</button></div>
      </div>
      <Steps stage={ss.stage} />
      {ss.stage === "press" && <WithOpponent><Press /></WithOpponent>}
      {ss.stage === "lineup" && <Lineup />}
      {ss.stage === "select" && <WithOpponent><Select /></WithOpponent>}
      {ss.stage === "draft" && ss.draft && <Draft d={ss.draft} />}
      {ss.stage === "meet" && <WithOpponent><Meet /></WithOpponent>}
      {ss.stage === "sim" && ss.result && <Sim d={ss.draft!} r={ss.result} step={ss.simStep} />}
      {ss.stage === "pog" && ss.result && <Pog d={ss.draft!} r={ss.result} />}
      {ss.stage === "result" && ss.result && <Result d={ss.draft!} r={ss.result} />}
      {ss.stage === "locker" && <Locker />}
      {ss.stage === "end" && <End />}
    </div>
  );
}

// 경기 진행 단계 표시 (화면만 — 단계 순서·동작은 그대로)
const STEPS: [string, string][] = [["press", "기자회견"], ["lineup", "라인업"], ["select", "선택권"], ["draft", "밴픽"], ["meet", "작전"], ["sim", "경기"], ["pog", "MVP"], ["result", "결과"]];
function Steps({ stage }: { stage: string }) {
  const idx = STEPS.findIndex(([k]) => k === stage);
  const cur = idx < 0 ? STEPS.length : idx; // 라커룸·시리즈 종료는 모두 지난 상태
  return (
    <ol className="m-steps" aria-label="경기 진행 단계" data-testid="match-steps">
      {STEPS.map(([k, ko], i) => <li key={k} className={i < cur ? "done" : i === cur ? "now" : ""} aria-current={i === cur ? "step" : undefined}><i>{i < cur ? "✓" : i + 1}</i><span>{ko}</span></li>)}
    </ol>
  );
}

// 경기 전 화면(기자회견·선택권·미팅) 오른쪽에 상대 팀 정보를 보여 줍니다. 이미 있는 순위·전적·선발 능력치만 씁니다.
function OpponentCard() {
  const s = useSave()!; const sr = sessionSeries(s);
  const op = sr.a === s.team ? sr.b : sr.a;
  const rows = standings(s);
  const idx = rows.findIndex((r) => r.t === op), row = idx >= 0 ? rows[idx] : undefined;
  const mine = s.starters[s.team] ?? [], theirs = s.starters[op] ?? [];
  const avg = (ks: string[]): number | null => { const v = ks.map((k) => ratingOf(PL[k])).filter((x): x is number => x != null); return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null; };
  const a1 = avg(mine), a2 = avg(theirs);
  return (
    <aside className="opp-card" data-testid="opp-card">
      <small className="opp-k">상대</small>
      <div className="opp-h"><TeamChip t={op} size="lg" /><b>{TM[op]?.ko ?? op}</b></div>
      <p className="muted sm">{row && row.w + row.l > 0 ? `정규 시즌 ${idx + 1}위 · ${row.w}승 ${row.l}패` : "아직 기록 없음"}{row && row.last.length > 0 && <span className="opp-form"> {form5(row.last)}</span>}</p>
      {a1 != null && a2 != null && (
        <div className="opp-vs" aria-label="선발 5명 평균 능력치">
          <span><small>우리 평균</small><b>{a1.toFixed(1)}</b></span>
          <span className="opp-bar"><i style={{ width: `${Math.max(10, Math.min(90, 50 + (a1 - a2) * 6))}%` }} /></span>
          <span><small>상대 평균</small><b>{a2.toFixed(1)}</b></span>
        </div>
      )}
      <ul className="opp-five">{theirs.map((k, i) => <li key={k}><small>{POS_KO[i]}</small><span>{PL[k]?.name ?? k}</span><Ovr p={PL[k]} /></li>)}</ul>
    </aside>
  );
}
function WithOpponent({ children }: { children: React.ReactNode }) {
  return <div className="mt-cols"><div className="mt-main">{children}</div><OpponentCard /></div>;
}

function Press() {
  const s = useSave()!; const sr = sessionSeries(s); const op = sr.a === s.team ? sr.b : sr.a;
  const tones = [
    ["적극적", "오늘 우리 플랜을 자신 있게 말합니다. 사기가 조금 오를 수 있습니다."],
    ["신중", "상대를 존중하며 조심스럽게 답합니다."],
    ["절제", "말을 아낍니다. 실언은 줄지만 임팩트도 작습니다."],
    ["노코멘트", "질문에 답하지 않습니다."],
  ];
  return (
    <div className="panel">
      <h2>경기 전 기자회견</h2>
      <p className="muted">{TM[s.team]?.ko} vs {TM[op]?.ko}. 질문: "오늘 경기를 어떻게 보십니까?"</p>
      <div className="mode-grid">
        {tones.map(([t, d]) => <button key={t} className={"mode-card" + (s.session?.pressTone === t ? " on" : "")} onClick={() => setPress(t)}><b>{t}</b><p>{d}</p></button>)}
      </div>
      <div className="row gap wrap" style={{ marginTop: 16 }}>
        <button className="btn primary lg" data-testid="press-next" onClick={() => { if (!s.session?.pressTone) setPress("신중"); afterPress(); }}>라인업으로 ▶</button>
        <button className="btn" onClick={() => { setPress("신중"); afterPress(); }}>수석코치에게 맡기기</button>
      </div>
    </div>
  );
}
function Lineup() {
  const s = useSave()!; const sr = sessionSeries(s); const op = sr.a === s.team ? sr.b : sr.a;
  const mine = s.starters[s.team];
  const bench = (s.cards.length ? s.cards : []).filter((k) => !mine.includes(k));
  return (
    <div className="panel">
      <h2>선발 라인업 · {sr.games.length + 1}세트</h2>
      <p className="muted">같은 포지션 벤치와만 교체할 수 있습니다. 상대 컨디션은 보이지 않습니다.</p>
      {s.mode === "story" && <p className="sm" data-testid="rotation-lineup">{mine.map((k, i) => `${POS_KO[i]} ${PL[k]?.name} · 피로 ${(playerTraining(s, k)?.fatigue ?? 0).toFixed(1)} · ${sr.rotation?.[s.team]?.keys[i] === k ? sr.rotation[s.team].reasons[i] : "감독 수동 교체"}`).join(" / ")}</p>}
      <div className="brief-grid">
        <div className="brief-team"><TeamChip t={s.team} full />
          <ul>{mine.map((k, i) => {
            const opts = bench.filter((x) => PL[x]?.pos === i);
            return <li key={k}><small>{POS_KO[i]}</small><span>{PL[k]?.label ?? PL[k]?.name}</span><Ovr p={PL[k]} />
              {opts.length > 0 && <select data-testid={`lineup-player-${i}`} value={k} onChange={(e) => setStarter(s.team, i, e.target.value)}>{[k, ...opts].map((x) => <option key={x} value={x}>{PL[x]?.name}</option>)}</select>}
            </li>;
          })}</ul>
        </div>
        <div className="brief-team"><TeamChip t={op} full />
          <ul>{s.starters[op].map((k, i) => <li key={k}><small>{POS_KO[i]}</small><span>{PL[k]?.label ?? PL[k]?.name}</span><Ovr p={PL[k]} /></li>)}</ul>
        </div>
      </div>
      <button className="btn primary lg" data-testid="lineup-next" onClick={confirmLineup}>선발 확정 · 선택권 ▶</button>
    </div>
  );
}
function Meet() {
  const s = useSave()!;
  return (
    <div className="panel">
      <h2>경기 전 미팅</h2>
      <p className="muted">오늘 경기 방향을 정하세요. 수석코치에게 맡겨도 됩니다.</p>
      <TacticsControls draft={s.session?.draft} />
      <div className="row gap wrap" style={{ marginTop: 16 }}>
        <button className="btn primary lg" data-testid="meet-next" onClick={afterMeet}>작전 확정 · 경기 시작 ▶</button>
      </div>
    </div>
  );
}
function Pog({ d, r }: { d: DraftState; r: GameResult }) {
  const p = PL[r.mvp];
  const perf = r.perf.find((x) => x.key === r.mvp);
  return (
    <div className="pog2" data-testid="pog-screen">
      <small className="pog2-k">Player Of the Game</small>
      {perf && <ChampIcon id={perf.c} size={112} ring="#E9C46A" />}
      <b className="pog2-name">{p?.label ?? p?.name ?? r.mvp}</b>
      <span className="pog2-sub">{p ? POS_KO[p.pos] : ""}{perf ? ` · ${CH[perf.c]?.ko ?? ""} · ` : ""}{perf && <TeamChip t={d.teams[perf.side]} />}</span>
      {perf && (
        <div className="pog2-stats">
          <span><small>K / D / A</small><b>{perf.k} / {perf.d} / {perf.a}</b></span>
          <span><small>KDA</small><b>{((perf.k + perf.a) / Math.max(1, perf.d)).toFixed(1)}</b></span>
          <span><small>평점</small><b>{perf.rating.toFixed(1)}</b></span>
        </div>
      )}
      <button className="btn primary lg" data-testid="pog-next" onClick={afterPog}>세트 결과 · 왜 이겼나/졌나 ▶</button>
    </div>
  );
}
function Locker() {
  const [tone, setTone] = useState<"calm" | "firm" | "harsh">("firm");
  return (
    <div className="panel">
      <h2>라커룸</h2>
      <p className="muted">다음 세트 전에 한 마디 합니다. 말투만 고르면 됩니다.</p>
      <div className="row gap wrap">
        {([["calm", "침착"], ["firm", "단호"], ["harsh", "강하게"]] as const).map(([id, t]) => (
          <button key={id} className={"btn" + (tone === id ? " primary" : "")} onClick={() => setTone(id)}>{t}</button>
        ))}
      </div>
      <div className="setup-foot" style={{ marginTop: 16 }}>
        <button className="btn primary lg" data-testid="locker-next" onClick={afterLocker}>다음 세트 ▶</button>
        <button className="btn" onClick={afterLocker}>수석코치에게 맡긴다</button>
      </div>
    </div>
  );
}

function Select() {
  const s = useSave()!; const ss = s.session!; const sr = sessionSeries(s); const op = sr.a === s.team ? sr.b : sr.a;
  const mine = ss.holder === s.team;
  const why = ss.gameIdx === 0 ? (sr.stage === "R" ? "1세트 선택권은 추첨으로 정했습니다." : "1세트 선택권은 상위 시드에게 있습니다.") : "직전 세트에서 진 팀이 선택권을 갖습니다.";
  return (
    <div className="panel select">
      <h2>첫 번째 선택권 · {mine ? "우리 팀" : op}</h2>
      <p className="muted">{why} 선택권 팀은 <b>진영(블루/레드)</b> 또는 <b>순서(선픽/후픽)</b> 중 하나를 고르고, 상대가 나머지를 고릅니다.</p>
      {mine ? (
        <div className="sel-grid">
          <button className="sel b" onClick={() => choose("blue")} data-testid="sel-blue"><b>블루 진영</b><small>2026 LCK 블루 승률이 더 높았습니다. 상대가 순서를 고릅니다.</small></button>
          <button className="sel r" onClick={() => choose("red")}><b>레드 진영</b><small>상대가 순서를 고릅니다.</small></button>
          <button className="sel" onClick={() => choose("first")} data-testid="sel-first"><b>선픽</b><small>가장 강한 챔피언을 먼저 가져옵니다. 상대가 진영을 고릅니다.</small></button>
          <button className="sel" onClick={() => choose("last")}><b>후픽</b><small>마지막 픽으로 카운터를 노립니다. 상대가 진영을 고릅니다.</small></button>
        </div>
      ) : (
        <>
          <p className="note">{ss.choiceNote}</p>
          <div className="sel-grid two">
            {ss.aiTook === "first" ? <>
              <button className="sel b" onClick={() => choose("blue")} data-testid="sel-blue"><b>블루 진영</b><small>상대가 선픽이라 우리는 후픽입니다.</small></button>
              <button className="sel r" onClick={() => choose("red")}><b>레드 진영</b><small>상대가 선픽이라 우리는 후픽입니다.</small></button>
            </> : <>
              <button className="sel" onClick={() => choose("first")} data-testid="sel-first"><b>선픽</b><small>우리는 레드 진영에서 먼저 픽합니다.</small></button>
              <button className="sel" onClick={() => choose("last")}><b>후픽</b><small>우리는 레드 진영에서 마지막에 픽합니다.</small></button>
            </>}
          </div>
        </>
      )}
    </div>
  );
}

function TeamBar({ d, side, me }: { d: DraftState; side: Side; me: boolean }) {
  const t = turn(d);
  const picks = d.picks[side]; const bans = d.bans[side];
  const pickSlots = Array.from({ length: 5 }, (_, i) => picks[i]);
  return (
    <div className={`tbar ${side}` + (t?.side === side ? " active" : "")}>
      <div className="tbar-h"><span className={"side-dot " + side}>{side === "B" ? "블루" : "레드"}</span><TeamChip t={d.teams[side]} full />{me && <span className="tag good">우리</span>}{d.firstSide === side && <span className="tag">선픽</span>}</div>
      <div className="tbar-bans">{Array.from({ length: 5 }, (_, i) => bans[i] ? <ChampIcon key={i} id={bans[i]} size={26} dim /> : <span key={i} className="slot-empty sm" />)}</div>
      <div className="tbar-picks">
        {pickSlots.map((p, i) => (
          <div key={i} className={"pslot" + (p ? " filled" : "")}>
            {p ? <ChampIcon id={p.c} size={44} /> : <span className="slot-empty" />}
            <div><b>{p ? CH[p.c].ko : `${i + 1}픽`}</b><small>{p ? `${POS_KO[p.pos]} · ${PL[d.lineup[side][p.pos]].name}` : ""}</small></div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Draft({ d }: { d: DraftState }) {
  if (!d?.bans) return <div className="panel"><p>밴픽 정보를 준비하는 중입니다.</p></div>;
  const s = useSave()!;
  const me = mySide(s); const t = turn(d);
  const myTurn = !!t && t.side === me;
  const [pos, setPos] = useState<PosIdx | null>(null);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<string | null>(null);
  const u = useMemo(() => used(d), [d]);
  const banned = useMemo(() => new Set([...d.bans.B, ...d.bans.R]), [d]);
  const locked = useMemo(() => new Set(d.locked), [d]);
  useEffect(() => { setSel(null); if (t?.kind === "pick" && t.side === me) setPos(openPos(d, me)[0] ?? null); else if (t?.kind === "ban") setPos(null); }, [d.step]);
  useEffect(() => { if (t && t.side !== me) { const id = setTimeout(aiAct, 650); return () => clearTimeout(id); } }, [d.step]);
  const recs: Rec[] = useMemo(() => (myTurn ? recommend(d, me, t!.kind, t!.kind === "pick" ? pos : null).slice(0, 6) : []), [d.step, pos, myTurn]);
  const list = CHAMPS.filter((c) => (!q || c.ko.includes(q)) && (pos == null || posWeight(c)[pos] >= 0.15));
  const confirm = (c: string): void => {
    if (!t || !myTurn || u.has(c)) return;
    const r = recommend(d, me, t.kind, t.kind === "pick" ? pos : null).find((x) => x.c === c);
    userAct(c, t.kind === "pick" ? (pos ?? r?.pos ?? null) : null, r ? r.reasons.filter((x) => x.v > 0.05).sort((a, b) => b.v - a.v).slice(0, 3).map((x) => x.t) : []);
  };
  const done = !t;
  const lastLog = d.log[d.log.length - 1];
  return (
    <div className="draft">
      <TeamBar d={d} side="B" me={me === "B"} />
      <div className="draft-center">
        <div className="draft-strip">
          <div className="ds-turn"><span className="phase">{PHASE_OF(d.step)}</span><b className="turn">{done ? "밴픽 완료" : `${d.teams[t!.side]} ${t!.kind === "ban" ? "밴" : "픽"}${myTurn ? " · 우리 차례" : ""}`}</b>{!done && !myTurn && <small className="muted thinking">상대 감독이 고르는 중…</small>}</div>
          <div className="steps">{SEQ.map((x, i) => <i key={i} className={(i < d.step ? "done " : i === d.step ? "now " : "") + (x.kind === "ban" ? "b " : "p ") + ((x.ord === "F" ? d.firstSide : other(d.firstSide)))} />)}</div>
          {lastLog && lastLog.by === "ai" && <div className="ai-why"><b>{d.teams[lastLog.side]} {lastLog.kind === "ban" ? "밴" : "픽"}: {CH[lastLog.c].ko}</b>{lastLog.why.slice(0, 2).map((w) => <small key={w}>{w}</small>)}</div>}
        </div>
        {done ? (
          <div className="panel center"><h2>밴픽이 끝났습니다</h2><button className="btn primary lg" onClick={toMeet} data-testid="run-sim">경기 전 미팅 ▶</button></div>
        ) : (
          <div className="draft-body">
            <div className="pool-panel">
              <div className="row gap wrap filters">
                <div className="seg">{([null, 0, 1, 2, 3, 4] as (PosIdx | null)[]).map((p) => <button key={String(p)} className={pos === p ? "on" : ""} onClick={() => setPos(p)} disabled={p != null && t!.kind === "pick" && myTurn && !openPos(d, me).includes(p)}>{p == null ? "전체" : POS_KO[p]}</button>)}</div>
                <input placeholder="챔피언 검색" value={q} onChange={(e) => setQ(e.target.value)} />
                {myTurn && <button className="btn ghost sm" onClick={autoRest} data-testid="auto-draft">남은 밴픽 AI에게 맡기기</button>}
              </div>
              <div className="cgrid">
                {list.map((c) => {
                  const st = banned.has(c.id) ? "밴" : locked.has(c.id) ? "피어리스" : u.has(c.id) ? "픽" : "";
                  return (
                    <button key={c.id} className={"cg" + (st ? " off" : "") + (sel === c.id ? " sel" : "")} disabled={!!st || !myTurn} onClick={() => setSel(c.id)} onDoubleClick={() => confirm(c.id)} title={c.ko}>
                      <ChampIcon id={c.id} size={50} dim={!!st} /><span>{c.ko}</span>{st && <em>{st}</em>}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="rec-panel">
              <h3>{myTurn ? `추천 ${t!.kind === "ban" ? "밴" : `픽${pos != null ? ` · ${POS_KO[pos]}` : ""}`}` : "상대 차례"}</h3>
              {myTurn && <button className="btn primary block lockbtn" disabled={!sel} onClick={() => sel && confirm(sel)} data-testid="lock">{sel ? `${CH[sel].ko} ${t!.kind === "ban" ? "밴" : "픽"} 확정` : "챔피언을 고르세요"}</button>}
              {myTurn && recs.map((r) => (
                <button key={r.c} className={"rec" + (sel === r.c ? " sel" : "")} onClick={() => setSel(r.c)} data-testid="rec">
                  <ChampIcon id={r.c} size={38} />
                  <span className="rec-t"><b>{CH[r.c].ko}{r.pos != null && <small> · {POS_KO[r.pos]}</small>}</b>
                    {r.reasons.filter((x) => Math.abs(x.v) > 0.05).sort((a, b) => Math.abs(b.v) - Math.abs(a.v)).slice(0, 2).map((x) => <small key={x.t} className={x.v < 0 ? "neg" : ""}>{x.t}</small>)}</span>
                </button>
              ))}
              {!myTurn && <p className="muted sm">상대 팀은 실제 2026 LCK 밴픽 기록과 선수 숙련도를 근거로 고릅니다. 고른 이유는 위쪽에 표시됩니다.</p>}
              <p className="muted xs">추천 근거: LCK 2026 챔피언 지표, 선수 2026 LCK 경기 수, 팀 실제 밴픽 횟수, 랭크 30판 이상 상성·시너지. 챔피언을 두 번 누르면 바로 확정됩니다.</p>
            </div>
          </div>
        )}
      </div>
      <TeamBar d={d} side="R" me={me === "R"} />
    </div>
  );
}

function LeadChart({ d, r, upto }: { d: DraftState; r: GameResult; upto: number }) {
  const pts = [{ t: 0, v: 0 }, ...r.events.slice(0, upto).filter((e) => e.lead != null).map((e) => ({ t: e.t, v: e.lead! }))];
  const W = 320, H = 90, maxT = Math.max(20, r.dur), maxV = Math.max(3000, ...pts.map((p) => Math.abs(p.v)));
  const x = (t: number): number => (t / maxT) * W; const y = (v: number): number => H / 2 - (v / maxV) * (H / 2 - 6);
  return (
    <svg className="lead" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="골드 차 흐름">
      <line x1="0" x2={W} y1={H / 2} y2={H / 2} className="axis" />
      <polyline points={pts.map((p) => `${x(p.t)},${y(p.v)}`).join(" ")} className="ln" />
      {pts.map((p, i) => <circle key={i} cx={x(p.t)} cy={y(p.v)} r="3" className={p.v >= 0 ? "b" : "r"} />)}
      <text x="4" y="12" className="lbl">{d.teams.B} 우세</text><text x="4" y={H - 4} className="lbl">{d.teams.R} 우세</text>
    </svg>
  );
}

// 사건 설명에 나온 챔피언 이름으로 그 팀의 실제 픽을 찾습니다(없으면 null — 아이콘을 지어내지 않음).
function champInEvent(d: DraftState, side: Side | undefined, text: string): string | null {
  const sides: Side[] = side ? [side, other(side)] : ["B", "R"];
  for (const sd of sides) { const p = d.picks[sd].find((x) => CH[x.c] && text.includes(CH[x.c].ko)); if (p) return p.c; }
  return null;
}
const OBJ_KEYS = [["drake", "드래곤"], ["herald", "전령"], ["baron", "바론"]] as const;

// ── 협곡 도식 미니맵 ──
// 엔진에는 선수 좌표가 없습니다. 위치는 "사건 종류"로 정한 도식이며(라인전=각 라인, 드래곤/바론=둥지, 종료=진 팀 본진),
// 화면에도 그렇게 밝힙니다. 아이콘은 실제 픽, 둥지 색은 실제로 그 오브젝트를 가져간 팀입니다.
type Pt = [number, number];
const LANE_POS: Record<Side, Pt[]> = { // 탑·정글·미드·원딜·서포터 (0~100)
  B: [[10, 30], [30, 66], [44, 56], [72, 90], [64, 87]],
  R: [[30, 10], [70, 34], [56, 44], [90, 72], [87, 64]],
};
const PIT = { baron: [31, 33] as Pt, drake: [69, 67] as Pt, base: { B: [9, 91] as Pt, R: [91, 9] as Pt } };
const GROUP: Pt[] = [[0, 0], [-7, 3], [3, -7], [-6, -6], [6, 4]];
function sceneFocus(e: GEvent | undefined): { at: Pt | null; mode: "lane" | "group" | "end" } {
  if (!e) return { at: null, mode: "lane" };
  if (e.kind === "end") return { at: PIT.base[other(e.side ?? "B")], mode: "end" };
  if (e.kind === "drake") return { at: PIT.drake, mode: "group" };
  if (e.kind === "baron" || e.kind === "herald" || e.kind === "grub") return { at: PIT.baron, mode: "group" };
  if (e.kind === "fight") return { at: e.text.includes("드래곤") ? PIT.drake : e.text.includes("바론") ? PIT.baron : [50, 50], mode: "group" };
  return { at: null, mode: "lane" };
}
function Minimap({ d, r, step }: { d: DraftState; r: GameResult; step: number }) {
  const ev = r.events.slice(0, step);
  const now = ev[ev.length - 1];
  const f = sceneFocus(now);
  const lastOf = (k: string): Side | undefined => [...ev].reverse().find((e) => e.kind === k)?.side;
  const drakeBy = lastOf("drake"), topBy = lastOf("baron") ?? lastOf("herald") ?? lastOf("grub");
  const hl = now?.kind === "kill" ? champInEvent(d, now.side, now.text) : null;
  const towers = ev.filter((e) => e.kind === "tower");
  const pos = (sd: Side, i: number): Pt => {
    if (f.mode === "end" && now?.side && f.at) {
      const [bx, by] = f.at; const g = GROUP[i];
      const dir: Pt = now.side === "B" ? [-1, 1] : [1, -1]; // 진 팀 본진에서 맵 가운데 쪽
      if (sd === now.side) return [bx + dir[0] * 13 + g[0], by + dir[1] * 13 + g[1]];
      return [bx + g[0] * 0.5, by + g[1] * 0.5];
    }
    if (f.mode === "group" && f.at) {
      const s = sd === "B" ? 1 : -1; const g = GROUP[i];
      return [f.at[0] - 8 * s + g[0], f.at[1] + 8 * s + g[1]];
    }
    return LANE_POS[sd][i];
  };
  const loser = now?.kind === "end" ? other(now.side ?? "B") : null;
  return (
    <div className="mm" data-testid="minimap">
      <div className="mm-field">
        <svg viewBox="0 0 100 100" aria-hidden="true">
          <rect x="1" y="1" width="98" height="98" rx="5" className="mm-bg" />
          <path d="M12 12 L88 88" className="mm-river" />
          <path d="M10 90 L10 10 L90 10" className="mm-lane" /><path d="M10 90 L90 90 L90 10" className="mm-lane" /><path d="M10 90 L90 10" className="mm-lane" />
          <circle cx={PIT.baron[0]} cy={PIT.baron[1]} r="6" className={"mm-pit " + (topBy ?? "")} />
          <circle cx={PIT.drake[0]} cy={PIT.drake[1]} r="6" className={"mm-pit " + (drakeBy ?? "")} />
          <rect x="2" y="84" width="14" height="14" rx="3" className={"mm-base B" + (loser === "B" ? " fall" : "")} />
          <rect x="84" y="2" width="14" height="14" rx="3" className={"mm-base R" + (loser === "R" ? " fall" : "")} />
          {f.at && <circle key={step} cx={f.at[0]} cy={f.at[1]} r="9" className={"mm-ping " + (now?.side ?? "")} />}
        </svg>
        <span className="mm-lbl" style={{ left: `${PIT.baron[0]}%`, top: `${PIT.baron[1] - 10}%` }}>바론·전령</span>
        <span className="mm-lbl" style={{ left: `${PIT.drake[0]}%`, top: `${PIT.drake[1] + 10}%` }}>드래곤</span>
        {(["B", "R"] as Side[]).map((sd) => [...d.picks[sd]].sort((a, b) => a.pos - b.pos).map((p, i) => {
          const [x, y] = pos(sd, i);
          return <span key={sd + p.c} className={`mm-ch ${sd}` + (hl === p.c ? " hl" : "") + (loser === sd ? " out" : "")} style={{ left: `${x}%`, top: `${y}%` }} title={`${CH[p.c]?.ko} · ${PL[d.lineup[sd][p.pos]]?.name}`}><ChampIcon id={p.c} size={30} /></span>;
        }))}
      </div>
      <div className="mm-foot muted xs">
        <span>포탑 파괴 {towers.length ? towers.map((t) => d.teams[t.side!]).join("·") : "없음"}</span>
        <span>위치는 사건 종류로 정한 도식(실제 좌표 아님)</span>
      </div>
    </div>
  );
}

function Sim({ d, r, step }: { d: DraftState; r: GameResult; step: number }) {
  const s = useSave()!; const me = mySide(s);
  const [auto, setAuto] = useState(false);
  const end = step >= r.events.length;
  useEffect(() => { if (auto && !end) { const id = setTimeout(() => simNext(), 1100); return () => clearTimeout(id); } }, [auto, step, end]);
  const ev = r.events.slice(0, step);
  const now = ev[ev.length - 1];
  const clock = now ? now.t : 0;
  const lead = [...ev].reverse().find((e) => e.lead != null)?.lead;
  const cnt = (sd: Side, k: string): number => ev.filter((e) => e.side === sd && e.kind === k).length;
  const pMe = me === "B" ? r.pPre : 1 - r.pPre;
  const nowChamp = now ? champInEvent(d, now.side, now.text) : null;
  const span = Math.max(30, clock + 5);
  const leadPct = lead == null ? 50 : 50 + Math.max(-46, Math.min(46, (lead / 8000) * 46));
  const sorted = (sd: Side) => [...d.picks[sd]].sort((a, b) => a.pos - b.pos);
  return (
    <div className="sim bc">
      <div className="bc-board" data-testid="sim-board">
        {(["B", "R"] as Side[]).map((sd) => (
          <div key={sd} className={"bc-team " + sd + (sd === me ? " me" : "")}>
            <div className="bc-name"><span className={"side-dot " + sd}>{sd === "B" ? "블루" : "레드"}</span><TeamChip t={d.teams[sd]} size="lg" full />{sd === me && <span className="tag good">우리</span>}</div>
            <div className="bc-obj">{OBJ_KEYS.map(([k, ko]) => <span key={k} className={cnt(sd, k) ? "on" : ""}><b>{cnt(sd, k)}</b>{ko}</span>)}</div>
          </div>
        ))}
        <div className="bc-mid">
          <div className="bc-clock" aria-label="경기 시간">{clock}:00</div>
          <div className="bc-gold">{lead == null ? <span className="muted">골드 차 집계 전</span> : <>골드 <b className={(lead >= 0 ? "B" : "R") === me ? "up" : "down"}>{lead >= 0 ? d.teams.B : d.teams.R} +{fmt(Math.abs(lead))}</b></>}</div>
          <div className="bc-tug" aria-hidden="true"><i style={{ width: `${leadPct}%` }} /></div>
          <div className="muted xs">경기 전 예상 승률 {d.teams[me]} {(pMe * 100).toFixed(0)}%</div>
        </div>
      </div>

      <div className="bc-track" aria-label="경기 흐름">
        {ev.map((e, i) => <i key={i} className={`${e.side ?? ""} ${e.kind}`} style={{ left: `${(e.t / span) * 100}%` }} title={`${e.t}:00 ${EV_KO[e.kind]} ${e.text}`} />)}
        <span className="bc-now" style={{ left: `${(clock / span) * 100}%` }} />
      </div>

      <div className="bc-body">
        <div className="bc-map">
          <Minimap d={d} r={r} step={step} />
          <LeadChart d={d} r={r} upto={step} />
        </div>
        <div className="bc-main">
          <div className={"bc-scene " + (now ? `${now.kind} ${now.side ?? ""}` : "idle")} key={step} data-testid="sim-scene">
            {now ? <>
              <div className="bc-scene-h"><span className="bc-kind">{EV_KO[now.kind] || "소식"}</span><span className="bc-t">{now.t}:00</span>{now.side && <TeamChip t={d.teams[now.side]} />}</div>
              <div className="bc-scene-b">{nowChamp && <ChampIcon id={nowChamp} size={64} ring={now.side === "B" ? "#3B82F6" : "#EF4444"} />}<p>{now.text}</p></div>
            </> : <div className="bc-scene-b"><p>선수들이 소환사의 협곡에 들어섰습니다. "다음 장면"을 눌러 경기를 시작하세요.</p></div>}
          </div>
          <div className="bc-controls">
            {!end && <button className="btn primary lg" onClick={() => simNext()} data-testid="sim-next">다음 장면 ▶</button>}
            {!end && <button className={"btn" + (auto ? " on" : "")} onClick={() => setAuto(!auto)}>{auto ? "❚❚ 자동 진행 멈춤" : "▶▶ 자동 진행"}</button>}
            {!end && <button className="btn ghost rc-insta" onClick={() => simNext(true)} data-testid="sim-all">즉시 결과</button>}
            {end && <button className="btn primary lg" onClick={toPog} data-testid="to-result">Player Of the Game ▶</button>}
          </div>
          <div className="feed bc-feed">
            {ev.length <= 1 && <p className="muted sm">지난 장면이 여기에 쌓입니다.</p>}
            {ev.slice(0, -1).reverse().map((e, i) => (
              <div key={i} className={`ev ${e.kind} ${e.side ?? ""}`}>
                <span className="ev-t">{e.t}:00</span><span className="ev-k">{EV_KO[e.kind]}</span><span>{e.text}</span>
              </div>
            ))}
          </div>
          <div className="bc-lanes">
            <div className="bc-lanes-h"><TeamChip t={d.teams.B} /><span className="muted xs">라인 맞대결</span><TeamChip t={d.teams.R} /></div>
            {[0, 1, 2, 3, 4].map((i) => {
              const b = sorted("B")[i], rr = sorted("R")[i];
              return (
                <div key={i} className="bc-lane">
                  <span className="bl B">{b && <><ChampIcon id={b.c} size={34} /><small>{PL[d.lineup.B[b.pos]]?.name}</small></>}</span>
                  <em>{POS_KO[i]}</em>
                  <span className="bl R">{rr && <><small>{PL[d.lineup.R[rr.pos]]?.name}</small><ChampIcon id={rr.c} size={34} /></>}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
const EV_KO: Record<string, string> = { kill: "킬", drake: "드래곤", grub: "유충", herald: "전령", tower: "포탑", baron: "바론", fight: "한타", lane: "라인전", end: "종료", info: "" };

function Result({ d, r }: { d: DraftState; r: GameResult }) {
  const s = useSave()!; const me = mySide(s); const sr = sessionSeries(s);
  const won = r.winner === me;
  const L0 = r.factors.reduce((a, f) => a + f.v, 0);
  const sign = me === "B" ? 1 : -1;
  const pMe = me === "B" ? r.pPre : 1 - r.pPre;
  // 요인별 기여(%p): 그 요인을 뺐을 때와 비교한 우리 팀 승리 확률 차이
  const contrib = r.factors.map((f) => ({ ...f, pp: (sigmoid(L0) - sigmoid(L0 - f.v)) * 100 * sign })).sort((a, b) => Math.abs(b.pp) - Math.abs(a.pp));
  const maxPP = Math.max(5, ...contrib.map((c) => Math.abs(c.pp)));
  const lane = r.lanes15.map((g) => g * sign);
  const big = lane.map((g, i) => [g, i]).sort((a, b) => Math.abs(b[0]) - Math.abs(a[0]))[0];
  const myPerf = r.perf.filter((p) => p.side === me), opPerf = r.perf.filter((p) => p.side !== me);
  const upset = (won && pMe < 0.4) || (!won && pMe > 0.6);
  const lines: string[] = [];
  lines.push(`경기 전 데이터로 본 우리 승리 확률은 ${(pMe * 100).toFixed(0)}%였습니다.`);
  const top = contrib.filter((c) => Math.abs(c.pp) >= 1).slice(0, 2);
  if (top.length) lines.push(`가장 크게 작용한 요인: ${top.map((c) => `${c.label}(${c.pp >= 0 ? "+" : ""}${c.pp.toFixed(1)}%p)`).join(", ")}.`);
  lines.push(`14분 골드 ${r.gold15 * sign >= 0 ? "우세" : "열세"} ${fmt(Math.abs(r.gold15))}, 가장 큰 차이는 ${POS_KO[big[1]]}(${big[0] >= 0 ? "+" : "−"}${fmt(Math.abs(big[0]))}).`);
  if (upset) lines.push(won ? "데이터상 불리한 경기를 경기 중 흐름(오브젝트·한타)으로 뒤집었습니다." : "데이터상 유리했지만 경기 중 흐름(오브젝트·한타)에서 밀렸습니다.");
  const mvpPerf = r.perf.find((p) => p.key === r.mvp);
  const opShort = sr.a === s.team ? sr.b : sr.a;
  const myNum = sr.a === s.team ? sr.sa : sr.sb, opNum = sr.a === s.team ? sr.sb : sr.sa;
  const goldMe = r.gold15 * sign;
  return (
    <div className="result">
      <section className={"res-hero " + (won ? "win" : "lose")} data-testid="res-hero">
        <div className="rh-main">
          <span className="rh-stage">{STAGE_KO[sr.stage]} · {s.session!.gameIdx + 1}세트</span>
          <b className="rh-title">{won ? "승리" : "패배"}</b>
          <div className="rh-score"><TeamChip t={s.team} size="lg" /><b>{myNum}</b><span>:</span><b>{opNum}</b><TeamChip t={opShort} size="lg" /></div>
          <span className="rh-sub">{r.dur}분 · 킬 {r.kills[me]}:{r.kills[other(me)]}{upset && <em className="rh-tag">{won ? "이변의 승리" : "예상 밖 패배"}</em>}</span>
          <button className="btn primary lg" onClick={afterResult} data-testid="next-game">{sr.winner ? "시리즈 결과 보기 ▶" : "라커룸으로 ▶"}</button>
        </div>
        {mvpPerf && (
          <div className="rh-mvp" data-testid="res-mvp">
            <span className="rh-mvp-k">MVP</span>
            <ChampIcon id={mvpPerf.c} size={72} ring="#E9C46A" />
            <b>{PL[mvpPerf.key]?.name ?? mvpPerf.key}</b>
            <small>{POS_KO[mvpPerf.pos]} · {CH[mvpPerf.c]?.ko ?? ""} · {d.teams[mvpPerf.side]}</small>
            <span>{mvpPerf.k}/{mvpPerf.d}/{mvpPerf.a} · 평점 {mvpPerf.rating.toFixed(1)}</span>
          </div>
        )}
      </section>
      <ul className="res-chips" data-testid="res-chips">
        <li><small>14분 가장 큰 격차</small><b className={big[0] >= 0 ? "up" : "down"}>{POS_KO[big[1]]} {big[0] >= 0 ? "+" : "−"}{fmt(Math.abs(big[0]))}</b></li>
        <li><small>14분 골드</small><b className={goldMe >= 0 ? "up" : "down"}>{goldMe >= 0 ? "우세" : "열세"} {fmt(Math.abs(goldMe))}</b></li>
        <li><small>오브젝트</small><b>드래곤 {r.obj[me].drake}:{r.obj[other(me)].drake} · 바론 {r.obj[me].baron}:{r.obj[other(me)].baron}</b></li>
        <li><small>경기 전 예상 승률</small><b>{(pMe * 100).toFixed(0)}%</b></li>
      </ul>
      <details className="res-fold" data-testid="res-fold-review">
        <summary>작전·출전 복기 자세히 보기</summary>
        <TacticsReview record={r.tactics} side={me} />
        <AppearanceReview record={sessionSeries(s).games[s.session!.gameIdx]?.appearances} side={me} />
      </details>
      <div className="grid">
        <section className="card span2">
          <div className="card-h"><h2>왜 {won ? "이겼나" : "졌나"}</h2><span className="muted sm">경기 전 우리 승리 확률 {(pMe * 100).toFixed(0)}%</span></div>
          <ul className="why-sum">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
          <div className="factors">
            {contrib.map((c) => (
              <details key={c.key} className="factor">
                <summary>
                  <span className="f-l">{c.label}</span>
                  <span className="f-bar"><span className="f-zero" /><i className={c.pp >= 0 ? "pos" : "neg"} style={{ width: `${(Math.abs(c.pp) / maxPP) * 50}%`, [c.pp >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span>
                  <b className={c.pp >= 0 ? "up" : "down"}>{c.pp >= 0 ? "+" : ""}{c.pp.toFixed(1)}%p</b>
                </summary>
                <ul>{c.lines.length ? c.lines.map((l) => <li key={l}>{l}</li>) : <li className="muted">해당 근거 없음</li>}</ul>
              </details>
            ))}
          </div>
          <p className="muted xs">%p = 그 요인을 뺐을 때와 비교한 우리 팀 경기 전 승리 확률 차이. 요인을 누르면 근거(경기 수·판수)가 보입니다. 경기 중 사건은 이 확률을 바탕으로 한 난수 규칙입니다(데이터 출처·방법 참고).</p>
        </section>
        <section className="card">
          <div className="card-h"><h2>경기 흐름</h2></div>
          <LeadChart d={d} r={r} upto={r.events.length} />
          <ul className="bars">{lane.map((g, i) => <li key={i}><span>{POS_KO[i]}</span><span className="dbar"><i className={g >= 0 ? "pos" : "neg"} style={{ width: `${Math.min(50, (Math.abs(g) / 2500) * 50)}%`, [g >= 0 ? "left" : "right"]: "50%" } as React.CSSProperties} /></span><b className={g >= 0 ? "up" : "down"}>{g >= 0 ? "+" : "−"}{fmt(Math.abs(g))}</b></li>)}</ul>
          <p className="muted xs">14분 포지션별 골드 차(우리 기준)</p>
          <ul className="facts sm">
            <li><b>{r.obj[me].drake}:{r.obj[other(me)].drake}</b><span>드래곤</span></li>
            <li><b>{r.obj[me].baron}:{r.obj[other(me)].baron}</b><span>바론</span></li>
            <li><b>{r.obj[me].tower}:{r.obj[other(me)].tower}</b><span>포탑</span></li>
          </ul>
        </section>
        <section className="card">
          <div className="card-h"><h2>선수 평점</h2><span className="muted sm">게임 안 기록</span></div>
          <table className="tbl compact perf"><thead><tr><th>{s.team}</th><th className="r">K/D/A</th><th className="r">평점</th></tr></thead>
            <tbody>{myPerf.map((p) => <tr key={p.key}><td><ChampIcon id={p.c} size={22} /> {PL[p.key].name}{p.key === r.mvp && <span className="tag good xs">MVP</span>}</td><td className="r">{p.k}/{p.d}/{p.a}</td><td className="r"><b>{p.rating.toFixed(1)}</b></td></tr>)}</tbody></table>
          <table className="tbl compact perf"><thead><tr><th>{d.teams[other(me)]}</th><th className="r">K/D/A</th><th className="r">평점</th></tr></thead>
            <tbody>{opPerf.map((p) => <tr key={p.key}><td><ChampIcon id={p.c} size={22} /> {PL[p.key].name}{p.key === r.mvp && <span className="tag good xs">MVP</span>}</td><td className="r">{p.k}/{p.d}/{p.a}</td><td className="r">{p.rating.toFixed(1)}</td></tr>)}</tbody></table>
        </section>
        <section className="card span2">
          <details className="res-fold in">
            <summary>밴픽 기록 ({d.log.length}단계) 보기</summary>
            <ol className="dlog">{d.log.map((l, i) => (
              <li key={i} className={l.side}><span className="muted">{i + 1}</span><ChampIcon id={l.c} size={24} dim={l.kind === "ban"} /><b>{d.teams[l.side]} {l.kind === "ban" ? "밴" : "픽"} {CH[l.c].ko}</b>{l.pos != null && l.kind === "pick" && <small>{POS_KO[l.pos]}</small>}<small className="muted">{l.why.join(" · ")}</small></li>
            ))}</ol>
          </details>
        </section>
      </div>
      <div className="row gap center-row">
        <button className="btn primary lg" onClick={afterResult}>{sr.winner ? "시리즈 결과 보기 ▶" : "라커룸으로 ▶"}</button>
      </div>
    </div>
  );
}

function End() {
  const s = useSave()!; const sr = sessionSeries(s);
  const won = sr.winner === s.team;
  const op = sr.a === s.team ? sr.b : sr.a;
  const myNum = sr.a === s.team ? sr.sa : sr.sb, opNum = sr.a === s.team ? sr.sb : sr.sa;
  const final = won && sr.stage === "F"; // 결승 시리즈 승리 = 그 대회 우승
  const bits = Array.from({ length: final ? 30 : 16 }, (_, i) => i);
  return (
    <div className={"end-hero " + (won ? "win" : "lose") + (final ? " final" : "")} data-testid="end-hero">
      {won && <div className="confetti" aria-hidden="true">{bits.map((i) => <i key={i} style={{ left: `${(i * 37 + 11) % 100}%`, animationDelay: `${(i % 8) * 0.28}s`, animationDuration: `${3.2 + (i % 5) * 0.5}s` }} />)}</div>}
      <small className="end-stage">{STAGE_KO[sr.stage]} · Bo{sr.bo}</small>
      <b className="end-title">{final ? "결승 승리 · 우승" : won ? "시리즈 승리" : "시리즈 패배"}</b>
      <div className="end-score"><TeamChip t={s.team} size="lg" /><b>{myNum}</b><span>:</span><b>{opNum}</b><TeamChip t={op} size="lg" /></div>
      <ol className="end-sets">
        {sr.games.map((g, i) => {
          const mp = g.res?.perf.find((p) => p.key === g.mvp);
          const mine = g.winner === s.team;
          return (
            <li key={i} className={mine ? "w" : "l"}>
              <span className="es-n">{i + 1}세트</span>
              <span className="es-r">{mine ? "승" : "패"}</span>
              <span className="es-t">{g.dur}분</span>
              <span className="es-m">{mp && <ChampIcon id={mp.c} size={26} />}<span>MVP {PL[g.mvp]?.name ?? g.mvp}</span></span>
            </li>
          );
        })}
      </ol>
      <button className="btn primary lg" onClick={() => { endSeries(); go("#/home"); }} data-testid="end-series">계속 (같은 날 다른 경기 진행) ▶</button>
    </div>
  );
}
