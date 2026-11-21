import { useState } from "react";
import { CARDS, PL, POS_KO, TM, cardLabel } from "../data";
import { useSave, mutate, confirmStove, autoStove } from "../store";
import { Card } from "../ui";
import { cardRating } from "../rating";
import { fmtMoney } from "../game/money";
import type { Bonus } from "../game/stove";
import { storySalary } from "../game/story";
import { ScoutingPanel } from "./Scouting";
import { scoutPreferences } from "../game/scouting";
import {
  TRYOUT_MAX, allExpiryDecided, answerIncoming, awardsDone, canBidNow, closeStoveWeek,
  decideExpiry, expiryDone, placeFaBid, placeTryoutOffer, prestige, resolveTransferStep1,
  resolveTransferStep2, resolveTryout, startTransfer, stoveOf, tryoutDone,
} from "../game/stove";

export default function StovePage() {
  const s = useSave()!;
  const st = s.story;
  const stove = stoveOf(s);
  if (!st || !stove || !["awards", "tryout", "expiry", "stove"].includes(st.phase)) {
    return <Card title="스토브리그"><p className="muted">지금은 스토브리그 기간이 아닙니다. 시즌이 끝나면 시상식부터 이어집니다.</p><a className="btn" href="#/home">홈으로</a></Card>;
  }
  return (
    <div className="grid home">
      <Card title={`${st.year} 스토브리그 · ${{ awards: "시상식", tryout: "트라이아웃", expiry: "계약 만료", stove: `${stove.week}주차` }[st.phase as "awards" | "tryout" | "expiry" | "stove"]}`} className="span2" right={<span className="muted sm">잔고 {fmtMoney(s.eco.cash)} (게임용 가상 금액)</span>}>
        {st.phase === "stove" && !stove.closed && <div className="banner-note" style={{ marginBottom: 16 }}>
          <p>자동 감독은 다음 시즌에 쓸 카드의 종합으로 비교합니다. 보유 벤치를 먼저 주전으로 올리고, 대체 선수 연봉을 감당할 수 있으면 들어온 이적 제안을 검토합니다. 선수의 이적 거절과 다른 구단의 입찰 경쟁은 그대로 적용됩니다.</p>
          <button className="btn" data-testid="auto-stove" onClick={() => autoStove(true)}>자동 감독에게 남은 스토브 맡기기</button>
        </div>}
        {st.phase === "awards" && <Awards />}
        {st.phase === "tryout" && <Tryout />}
        {st.phase === "expiry" && <Expiry />}
        {st.phase === "stove" && <Weeks />}
      </Card>
    </div>
  );
}

function Awards() {
  const s = useSave()!;
  const stove = stoveOf(s)!;
  return (
    <div>
      <p>포지션별 1팀·2팀입니다. 성적은 이번 스플릿 기록이며, 표본이 적으면 ‘표본 부족’으로 표시합니다. 기록이 없으면 ‘기록 없음’입니다.</p>
      <ul className="news-list">
        {stove.awards.map((a) => (
          <li key={a.pos}>
            <b>{POS_KO[a.pos]}</b>
            <p>1팀 {a.first ? `${a.first.name} (${TM[a.first.team]?.ko ?? a.first.team}) · ${a.first.note}` : "기록 없음"}</p>
            <p className="muted">2팀 {a.second ? `${a.second.name} (${TM[a.second.team]?.ko ?? a.second.team}) · ${a.second.note}` : "기록 없음"}</p>
          </li>
        ))}
      </ul>
      <button className="btn primary" data-testid="awards-done" onClick={() => mutate((x) => awardsDone(x))}>트라이아웃으로</button>
    </div>
  );
}

function Tryout() {
  const s = useSave()!;
  const stove = stoveOf(s)!;
  const ours = stove.tryoutOffers.filter((o) => o.team === s.team);
  const [pick, setPick] = useState(stove.tryoutPool[0] ?? "");
  const [salary, setSalary] = useState(1);
  const [starter, setStarter] = useState(false);
  const [msg, setMsg] = useState("");
  const [bon, setBon] = useState<Bonus>({});
  const c = CARDS[pick];
  return (
    <div>
      <p>신인·비주전 후보에게 제안할 수 있습니다. 팀마다 최대 {TRYOUT_MAX}명, 계약 2년. 트라이아웃 창의 제안은 주가 끝날 때 한꺼번에 결과가 납니다. 선수는 구단 명성, 주전 자리, 연봉(보너스 포함)을 보고 팀을 고릅니다.</p>
      {!stove.tryoutResults && (
        <>
          <ScoutingPanel context="tryout" onSelect={r => { if (r.offerCardId && r.salary != null) { setPick(r.offerCardId); setSalary(r.salary); setStarter(scoutPreferences(s).goal !== "development"); setMsg("추천 조건을 불러왔습니다. 제안 버튼에서 조건을 확인해 주세요."); } }} />
          <div className="row gap wrap" style={{ margin: "12px 0" }}>
            <select value={pick} onChange={(e) => { setPick(e.target.value); const x = CARDS[e.target.value]; if (x) setSalary(storySalary(x, s.story!.tier)); }} data-testid="tryout-pick">
              {stove.tryoutPool.map((id) => <option key={id} value={id}>{cardLabel(CARDS[id])} · {fmtMoney(storySalary(CARDS[id], s.story!.tier))}</option>)}
            </select>
            <label>연봉 <input type="number" step={0.1} min={0.3} value={salary} onChange={(e) => setSalary(Number(e.target.value))} style={{ width: 80 }} />억</label>
            <label><input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} /> 주전 보장</label>
            <label><input type="checkbox" checked={!!bon.callup} onChange={(e) => setBon({ ...bon, callup: e.target.checked })} /> 1부 콜업 보너스</label>
          </div>
          {c && <p className="muted sm">{c.name} · {c.year}시즌 · 능력치 {cardRating(c)} · 2부 계약가 {fmtMoney(storySalary(c, s.story!.tier))} (게임용 가상 금액)</p>}
          <div className="row gap wrap">
            <button className="btn" data-testid="tryout-offer" onClick={() => {
              if (!c) return;
              mutate((x) => {
                const err = placeTryoutOffer(x, { team: x.team, person: c.pkey, cardId: c.id, salary, years: 2, starter, bonuses: bon, kind: "tryout" });
                setMsg(err ?? `${c.name} 선수에게 제안했습니다.`);
              });
            }}>제안 넣기</button>
            <button className="btn primary" data-testid="tryout-resolve" onClick={() => mutate((x, rng) => resolveTryout(x, rng))}>트라이아웃 주간 결과</button>
          </div>
          <p className="muted sm">우리 제안 {ours.length}/{TRYOUT_MAX}. {ours.map((o) => CARDS[o.cardId]?.name).join(", ") || "아직 없음"}.</p>
        </>
      )}
      {msg && <p className="banner-note" style={{ margin: "8px 0" }}>{msg}</p>}
      {stove.tryoutResults && (
        <div data-testid="tryout-results">
          <h3>트라이아웃 결과</h3>
          <ResultList rows={stove.tryoutResults} us={s.team} />
          <button className="btn primary" data-testid="tryout-done" onClick={() => mutate((x) => tryoutDone(x))}>계약 만료로</button>
        </div>
      )}
    </div>
  );
}

function Expiry() {
  const s = useSave()!;
  const stove = stoveOf(s)!;
  const [msg, setMsg] = useState("");
  return (
    <div>
      <p>만료되는 우리 선수마다 재계약 또는 방출을 정해 주세요. 전원 결정해야 스토브리그 주간으로 넘어갑니다. 재계약 연봉은 다음 시즌 개막에 정산됩니다.</p>
      {!stove.expiryKeys.length && <p>올해 만료되는 우리 선수는 없습니다.</p>}
      <ul className="news-list">
        {stove.expiryKeys.map((k) => {
          const p = PL[k]; const ct = s.story!.contracts.find((c) => c.key === k);
          const dec = stove.expiryDecided[k];
          return (
            <li key={k}>
              <b>{p?.name ?? k}</b>
              <p className="muted">{POS_KO[p?.pos ?? 0]} · 현재 연봉 {fmtMoney(ct?.salary ?? 0)} · {p?.games ? `${p.games}경기` : "기록 없음"}</p>
              {dec ? <p>{dec === "resign" ? "재계약" : "방출"}으로 결정했습니다.</p> : (
                <div className="row gap wrap">
                  <button className="btn primary" data-testid={`expiry-resign-${k}`} onClick={() => mutate((x) => { const e = decideExpiry(x, k, "resign"); setMsg(e ?? ""); })}>재계약</button>
                  <button className="btn" data-testid={`expiry-release-${k}`} onClick={() => mutate((x) => { decideExpiry(x, k, "release"); })}>방출</button>
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {msg && <p>{msg}</p>}
      <button className="btn primary" data-testid="expiry-done" disabled={!allExpiryDecided(s)} onClick={() => mutate((x, rng) => expiryDone(x, rng))}>스토브리그로</button>
    </div>
  );
}

function Weeks() {
  const s = useSave()!;
  const stove = stoveOf(s)!;
  const [pick, setPick] = useState(stove.faPool[0] ?? "");
  const [salary, setSalary] = useState(3);
  const [starter, setStarter] = useState(true);
  const [years, setYears] = useState(2);
  const [fee, setFee] = useState(5);
  const [tMsg, setTMsg] = useState("");
  const c = CARDS[pick];
  return (
    <div>
      <p>{stove.week === 1 ? "1주차는 협상 기간입니다. 계약 제안은 2주차부터 넣을 수 있습니다." : `${stove.week}주차 밀봉 입찰. 제안은 주가 끝날 때 다른 구단과 함께 선수가 보고 한 팀을 고릅니다. 먼저 누른다고 먼저 데려오는 게 아닙니다.`} 구단 명성 지수 {Math.round(prestige(s, s.team))}.</p>
      <ScoutingPanel context="fa" onSelect={r => { if (r.offerCardId && r.salary != null) { setPick(r.offerCardId); setSalary(r.salary); setYears(1); setStarter(scoutPreferences(s).goal !== "development"); setTMsg("추천 조건을 불러왔습니다. 입찰 버튼에서 조건을 확인해 주세요."); } }} />
      {stove.rumors.length > 0 && (
        <div className="card" style={{ margin: "12px 0" }}>
          <b>루머</b>
          <ul className="news-mini">{stove.rumors.map((r) => <li key={r.id}><span>{r.text}</span></li>)}</ul>
        </div>
      )}
      {stove.incoming.filter((x) => x.status === "open").map((b) => (
        <div key={b.id} className="card" style={{ margin: "8px 0" }} data-testid="incoming-bid">
          <b>우리 선수에게 온 이적 제안</b>
          <p>{TM[b.from]?.ko ?? b.from}이(가) {PL[b.key]?.name ?? b.person}에게 이적료 {fmtMoney(b.fee)}, 연봉 {fmtMoney(b.salary)}을 제시했습니다. 구단 사정: {b.stance}. 이번 주 안에 답해야 합니다.</p>
          <div className="row gap wrap">
            <button className="btn primary" data-testid="incoming-accept" onClick={() => mutate((x, rng) => { const e = answerIncoming(x, b.id, true, rng); if (e) setTMsg(e); })}>수락</button>
            <button className="btn" data-testid="incoming-reject" onClick={() => mutate((x, rng) => { answerIncoming(x, b.id, false, rng); })}>거절</button>
          </div>
        </div>
      ))}
      {canBidNow(s) && !stove.closed && (
        <div style={{ margin: "12px 0" }}>
          <h3>FA 밀봉 입찰</h3>
          <div className="row gap wrap">
            <select data-testid="fa-pick" value={pick} onChange={(e) => { setPick(e.target.value); const x = CARDS[e.target.value]; if (x) setSalary(storySalary(x, s.story!.tier)); }} style={{ maxWidth: "100%" }}>
              {[...new Set([...(stove.faPool.includes(pick) ? [pick] : []), ...stove.faPool.slice(0, 80)])].map((id) => <option key={id} value={id}>{cardLabel(CARDS[id])} · {fmtMoney(storySalary(CARDS[id], s.story!.tier))} · {CARDS[id].year} · 퍼센타일 {CARDS[id].percentile}</option>)}
            </select>
            <label>연봉 <input type="number" step={0.1} min={0.3} value={salary} onChange={(e) => setSalary(Number(e.target.value))} style={{ width: 80 }} />억</label>
            <label>기간 <input type="number" min={1} max={4} value={years} onChange={(e) => setYears(Number(e.target.value))} style={{ width: 56 }} />년</label>
            <label><input type="checkbox" checked={starter} onChange={(e) => setStarter(e.target.checked)} /> 주전 보장</label>
            <button className="btn" data-testid="stove-bid" onClick={() => {
              if (!c) return;
              mutate((x) => {
                const err = placeFaBid(x, { team: x.team, person: c.pkey, cardId: c.id, salary, years, starter, bonuses: {}, kind: "fa" });
                setTMsg(err ?? `${c.name} 선수에게 밀봉 입찰을 넣었습니다.`);
              });
            }}>입찰 넣기</button>
          </div>
          <h3 style={{ marginTop: 16 }}>이적 제안 (2단계)</h3>
          <p className="muted sm">1단계 구단 이적료, 2단계 선수 연봉. 구단 사정 태그(간판은 안 팖 / 돈이 맞으면 판다 등)를 함께 보여 줍니다.</p>
          {!stove.ourTransfer && (
            <div className="row gap wrap">
              <label>이적료 <input type="number" step={0.1} min={0.3} value={fee} onChange={(e) => setFee(Number(e.target.value))} style={{ width: 80 }} />억</label>
              <button className="btn" data-testid="transfer-start" onClick={() => { if (!pick) return; mutate((x) => { setTMsg(startTransfer(x, pick, fee) ?? "1단계: 구단에 이적료를 제안합니다."); }); }}>1단계 시작</button>
            </div>
          )}
          {stove.ourTransfer?.step === 1 && (
            <button className="btn primary" data-testid="transfer-step1" onClick={() => mutate((x, rng) => { const r = resolveTransferStep1(x, rng); setTMsg(r.msg); })}>구단 회신 보기</button>
          )}
          {stove.ourTransfer?.step === 2 && (
            <button className="btn primary" data-testid="transfer-step2" onClick={() => mutate((x, rng) => { const r = resolveTransferStep2(x, salary, years, starter, rng); setTMsg(r.msg); })}>선수에게 연봉 제안</button>
          )}
        </div>
      )}
      {tMsg && <p className="banner-note" style={{ margin: "8px 0" }}>{tMsg}</p>}
      {stove.weekResults && stove.weekResults.length > 0 && (
        <div data-testid="stove-results">
          <h3>{stove.week}주차 입찰 결과{stove.closed ? " (스토브 마감)" : ""}</h3>
          <ResultList rows={stove.weekResults} us={s.team} />
        </div>
      )}
      <div className="row gap wrap" style={{ marginTop: 16 }}>
        {!stove.closed && <button className="btn primary" data-testid="stove-close-week" onClick={() => mutate((x, rng) => closeStoveWeek(x, rng))}>{stove.week === 1 ? "1주차 마치고 2주 입찰로" : "이번 주 마감 · 결과 보기"}</button>}
        {stove.closed && <button className="btn primary" data-testid="stove-next" onClick={() => confirmStove()}>다음 시즌으로</button>}
        <a className="btn" href="#/home">홈으로</a>
      </div>
    </div>
  );
}

function ResultList({ rows, us }: { rows: { person: string; name: string; winner?: string; salary?: number; years?: number; reason: string; rejected: { team: string; why: string }[] }[]; us: string }) {
  return (
    <ul className="news-list">
      {rows.map((r) => (
        <li key={r.person} style={r.winner === us ? { boxShadow: "inset 3px 0 0 var(--teal)" } : undefined}>
          <b>{r.name} {r.winner ? `→ ${TM[r.winner]?.ko ?? r.winner}` : "잔류·미계약"}</b>
          <p>{r.winner ? `${r.reason}${r.salary != null ? ` · 연봉 ${fmtMoney(r.salary)}` : ""}` : r.reason}</p>
          {r.rejected.length > 0 && <p className="muted sm">다른 구단: {r.rejected.map((x) => `${TM[x.team]?.ko ?? x.team} — ${x.why}`).join(" / ")}</p>}
        </li>
      ))}
    </ul>
  );
}

