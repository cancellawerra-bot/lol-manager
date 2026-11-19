import { useEffect, useMemo, useState } from "react";
import { CH, CHAMPS, PL, POS_KO, TM, loadRanked, fmt } from "../data";
import { useSave, choose, mySide, userAct, aiAct, autoRest, simNext, endSeries, sessionSeries, setPress, afterPress, confirmLineup, afterMeet, afterPog, afterResult, afterLocker, setStarter, toMeet, toPog } from "../store";
import { turn, recommend, PHASE_OF, SEQ, openPos, used, posWeight, DraftState, Side, other, Rec } from "../game/draft";
import { STAGE_KO } from "../game/season";
import type { GameResult } from "../game/sim";
import { sigmoid } from "../game/rng";
import { ChampIcon, TeamChip, Pct } from "../ui";
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
      {ss.stage === "press" && <Press />}
      {ss.stage === "lineup" && <Lineup />}
      {ss.stage === "select" && <Select />}
      {ss.stage === "draft" && ss.draft && <Draft d={ss.draft} />}
      {ss.stage === "meet" && <Meet />}
      {ss.stage === "sim" && ss.result && <Sim d={ss.draft!} r={ss.result} step={ss.simStep} />}
      {ss.stage === "pog" && ss.result && <Pog r={ss.result} />}
      {ss.stage === "result" && ss.result && <Result d={ss.draft!} r={ss.result} />}
      {ss.stage === "locker" && <Locker />}
      {ss.stage === "end" && <End />}
    </div>
  );
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
            return <li key={k}><small>{POS_KO[i]}</small><span>{PL[k]?.label ?? PL[k]?.name}</span><Pct v={PL[k]?.pct.ovr ?? 0} />
              {opts.length > 0 && <select data-testid={`lineup-player-${i}`} value={k} onChange={(e) => setStarter(s.team, i, e.target.value)}>{[k, ...opts].map((x) => <option key={x} value={x}>{PL[x]?.name}</option>)}</select>}
            </li>;
          })}</ul>
        </div>
        <div className="brief-team"><TeamChip t={op} full />
          <ul>{s.starters[op].map((k, i) => <li key={k}><small>{POS_KO[i]}</small><span>{PL[k]?.label ?? PL[k]?.name}</span><Pct v={PL[k]?.pct.ovr ?? 0} /></li>)}</ul>
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
function Pog({ r }: { r: GameResult }) {
  const p = PL[r.mvp];
  const perf = r.perf.find((x) => x.key === r.mvp);
  return (
    <div className="panel pog-wrap">
      <h2>Player Of the Game</h2>
      <div className="pog-card">
        <div><b className="big">{p?.label ?? p?.name ?? r.mvp}</b><div className="muted">{p ? POS_KO[p.pos] : ""} · {CH[perf?.c ?? ""]?.ko ?? ""}</div></div>
        <div>KDA {perf ? `${perf.k}/${perf.d}/${perf.a}` : "–"} · 평점 {perf?.rating.toFixed(1)}</div>
      </div>
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

function Scoreboard({ d, r, upto }: { d: DraftState; r: GameResult; upto: number }) {
  const ev = r.events.slice(0, upto);
  const cnt = (side: Side, k: string): number => ev.filter((e) => e.side === side && e.kind === k).length;
  const lastLead = [...ev].reverse().find((e) => e.lead != null)?.lead;
  return (
    <div className="sboard">
      {(["B", "R"] as Side[]).map((sd) => (
        <div key={sd} className={"sb-side " + sd}><TeamChip t={d.teams[sd]} /><span>드래곤 {cnt(sd, "drake")}</span><span>전령 {cnt(sd, "herald")}</span><span>바론 {cnt(sd, "baron")}</span></div>
      ))}
      {lastLead != null && <div className="sb-lead">골드 {lastLead >= 0 ? d.teams.B : d.teams.R} +{fmt(Math.abs(lastLead))}</div>}
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

function Sim({ d, r, step }: { d: DraftState; r: GameResult; step: number }) {
  const [auto, setAuto] = useState(false);
  const end = step >= r.events.length;
  useEffect(() => { if (auto && !end) { const id = setTimeout(() => simNext(), 900); return () => clearTimeout(id); } }, [auto, step, end]);
  const ev = r.events.slice(0, step);
  return (
    <div className="sim">
      <div className="sim-head">
        {(["B", "R"] as Side[]).map((sd) => (
          <div key={sd} className={"sim-team " + sd}>
            <TeamChip t={d.teams[sd]} full />
            <div className="sim-picks">{[...d.picks[sd]].sort((a, b) => a.pos - b.pos).map((p) => <span key={p.c}><ChampIcon id={p.c} size={36} /><small>{PL[d.lineup[sd][p.pos]].name}</small></span>)}</div>
          </div>
        ))}
      </div>
      <div className="sim-body">
        <div className="feed">
          {ev.length === 0 && <p className="muted">경기가 곧 시작됩니다. "다음 장면"을 눌러 진행하세요.</p>}
          {ev.map((e, i) => (
            <div key={i} className={`ev ${e.kind} ${e.side ?? ""}` + (i === ev.length - 1 ? " new" : "")}>
              <span className="ev-t">{e.t}:00</span><span className="ev-k">{EV_KO[e.kind]}</span><span>{e.text}</span>
            </div>
          ))}
        </div>
        <div className="sim-side">
          <Scoreboard d={d} r={r} upto={step} />
          <LeadChart d={d} r={r} upto={step} />
          <div className="col gap">
            {!end && <button className="btn primary lg block" onClick={() => simNext()} data-testid="sim-next">다음 장면 ▶</button>}
            {!end && <button className="btn block" onClick={() => setAuto(!auto)}>{auto ? "자동 진행 멈춤" : "자동 진행"}</button>}
            {!end && <button className="btn ghost block rc-insta" onClick={() => simNext(true)} data-testid="sim-all">즉시 결과</button>}
            {end && <button className="btn primary lg block" onClick={toPog} data-testid="to-result">Player Of the Game ▶</button>}
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
  return (
    <div className="result">
      <div className={"res-banner " + (won ? "win" : "lose")}>
        <b>{won ? "승리" : "패배"}</b><span>{d.teams[r.winner]} 승 · {r.dur}분 · 킬 {r.kills.B}:{r.kills.R} · 시리즈 {sr.a === s.team ? sr.sa : sr.sb}:{sr.a === s.team ? sr.sb : sr.sa}</span>
      </div>
      <TacticsReview record={r.tactics} side={me} />
      <AppearanceReview record={sessionSeries(s).games[s.session!.gameIdx]?.appearances} side={me} />
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
          <div className="card-h"><h2>밴픽 기록</h2></div>
          <ol className="dlog">{d.log.map((l, i) => (
            <li key={i} className={l.side}><span className="muted">{i + 1}</span><ChampIcon id={l.c} size={24} dim={l.kind === "ban"} /><b>{d.teams[l.side]} {l.kind === "ban" ? "밴" : "픽"} {CH[l.c].ko}</b>{l.pos != null && l.kind === "pick" && <small>{POS_KO[l.pos]}</small>}<small className="muted">{l.why.join(" · ")}</small></li>
          ))}</ol>
        </section>
      </div>
      <div className="row gap center-row">
        <button className="btn primary lg" onClick={afterResult} data-testid="next-game">{sr.winner ? "시리즈 결과 보기 ▶" : "라커룸으로 ▶"}</button>
      </div>
    </div>
  );
}

function End() {
  const s = useSave()!; const sr = sessionSeries(s);
  const won = sr.winner === s.team;
  return (
    <div className="panel center">
      <h2 className={won ? "up" : "down"}>{won ? "시리즈 승리" : "시리즈 패배"}</h2>
      <p className="big">{sr.a} {sr.sa} : {sr.sb} {sr.b}</p>
      <ul className="plist">{sr.games.map((g, i) => <li key={i}>{i + 1}세트 {g.winner} 승 · {g.dur}분 · MVP {PL[g.mvp].name}</li>)}</ul>
      <button className="btn primary lg" onClick={() => { endSeries(); go("#/home"); }} data-testid="end-series">계속 (같은 날 다른 경기 진행) ▶</button>
    </div>
  );
}
