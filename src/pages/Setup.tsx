import { useMemo, useRef, useState } from "react";
import { CARDS, CORE, PL, TM, POS_KO, cardLabel } from "../data";
import { BUDGETS, FANTASY_BUDGETS, fantasyPrice, fantasyRatingOf, rosterSalary, weakestTeam, type Diff } from "../game/cards";
import { STORY_BUDGETS, storySalary, newStoryCareer, lckTeamsOf, CK_POOL, fmtMoney, franchisePlayers } from "../game/story";
import { newCareer, type CareerBg, type ClubInfo, type Economy, type Manager, type Mode } from "../game/season";
import { slots, setSave } from "../store";
import { CardMarket, type DraftRules, type MarketView } from "./Market";
import { DraftBoard } from "./DraftBoard";
import { FANTASY_ROUNDS, aiPick, applyPick, ctxLockReason, ctxPickMax, draftCtx, lockReason, whoPicks } from "../game/fantasy";
import { Rng } from "../game/rng";
import { FanNotice, Ovr, TeamChip } from "../ui";
import { go } from "../nav";
import { GOALS, STORY_GOALS } from "../game/goals";
import type { SeasonCard } from "../types";
import { moneyRound } from "../game/money";

type Step = "mode" | "club" | "roster" | "market" | "fantasy" | "contract" | "goal" | "sponsor" | "tutor";
const NATIONS = ["한국", "중국", "베트남", "미국", "유럽"];
const CAREERS: { id: CareerBg; t: string; d: string }[] = [
  { id: "amateur", t: "비선수 출신", d: "프로 무대를 선수로는 밟지 않았습니다. 시작 신뢰는 평범합니다." },
  { id: "academy", t: "전 프로 2군 출신", d: "육성과 2군 경험을 조금 더 살립니다." },
  { id: "pro", t: "전 프로 1군 출신", d: "선수 생활의 감각이 있어 시작 신뢰가 조금 높습니다." },
  { id: "worlds", t: "전 월드 우승자 출신", d: "큰 무대 경험이 있어 팬심과 시작 신뢰가 높습니다." },
];
const SPONSORS = [
  { name: "한빛통신", amount: 2.4, goal: "플레이오프 진출", years: 3 },
  { name: "청람은행", amount: 3.0, goal: "4강", years: 3 },
  { name: "남산음료", amount: 2.0, goal: "8위 이내", years: 2 },
  { name: "북악스포츠", amount: 3.5, goal: "결승 진출", years: 3 },
];

const STORY_SPONSORS = [
  { name: "한빛통신", amount: 0.45, goal: "상위권 유지", years: 3 },
  { name: "청람은행", amount: 0.6, goal: "승강전 진출", years: 3 },
  { name: "남산음료", amount: 0.35, goal: "중위권 이상", years: 2 },
  { name: "북악스포츠", amount: 0.75, goal: "2부 우승", years: 3 },
];
function startersFrom(ids: string[]): string[] {
  const out: string[] = [];
  for (let i = 0; i < 5; i++) {
    const hit = ids.find((id) => CARDS[id]?.posIdx === i && !out.includes(id));
    if (hit) out.push(hit);
  }
  return out;
}
function validRoster(ids: string[]): string | null {
  const st = startersFrom(ids);
  if (st.length < 5) return "선발은 포지션마다 한 명이 필요합니다.";
  if (ids.length > 8) return "로스터는 최대 8명입니다.";
  const ppl = new Set(ids.map((id) => CARDS[id]?.pkey));
  if (ppl.size !== ids.length) return "같은 선수의 카드는 한 장만 쓸 수 있습니다.";
  return null;
}

export default function Setup() {
  const sl = slots();
  const firstEmpty = sl.findIndex((x) => !x);
  const [slot, setSlot] = useState(firstEmpty >= 0 ? firstEmpty + 1 : 1);
  const [step, setStep] = useState<Step>("mode");
  const [mode, setMode] = useState<Mode>("story");
  const [diff, setDiff] = useState<Diff>("normal");
  const cap = mode === "story" ? STORY_BUDGETS[diff] : mode === "fantasy" ? FANTASY_BUDGETS[diff] : BUDGETS[diff];
  const priceOf = mode === "story" ? (c: import("../types").SeasonCard) => storySalary(c, "CK") : mode === "fantasy" ? fantasyPrice : undefined;
  const sponsors = mode === "story" ? STORY_SPONSORS : SPONSORS;
  const goals = mode === "story" ? STORY_GOALS : GOALS;
  const [clubName, setClubName] = useState("");
  const [clubShort, setClubShort] = useState("");
  const [color, setColor] = useState("#2DD4BF");
  const [replaced, setReplaced] = useState(weakestTeam());
  const [team, setTeam] = useState("");
  const [picks, setPicks] = useState<string[]>([]);
  const rosterPay = picks.reduce((n, id) => n + (CARDS[id] ? (priceOf ? priceOf(CARDS[id]) : CARDS[id].salary) : 0), 0);
  const [mgr, setMgr] = useState<Manager>({ name: "", birth: "", nation: "한국", career: "amateur" });
  const [sig, setSig] = useState<string>("");
  const [goal, setGoal] = useState<Economy["goal"]>("top8");
  const [sponsor, setSponsor] = useState<number | null>(0);
  const [tut, setTut] = useState(true);
  const [err, setErr] = useState("");
  // fantasy
  const [order, setOrder] = useState<string[]>([]);
  const [reshuffle, setReshuffle] = useState(3);
  const [fRound, setFRound] = useState(0);
  const [fPick, setFPick] = useState(0);
  const [fRosters, setFRosters] = useState<Record<string, string[]>>({});
  const [fBusy, setFBusy] = useState(false);

  const club: ClubInfo | undefined = mode !== "roster" ? { name: clubName.trim() || (mode === "fantasy" && team ? TM[team].ko : ""), short: (clubShort.trim() || team).toUpperCase(), color, replaced: mode === "club" ? replaced : (team || replaced) } : undefined;

  const goStep = (s: Step): void => { setErr(""); setStep(s); window.scrollTo(0, 0); };

  const confirmMode = (): void => {
    if (mode === "story") {
      const available = new Map(franchisePlayers(2018).map((c) => [c.pkey, c.id]));
      setPicks((ids) => [...new Set(ids.map((id) => available.get(CARDS[id]?.pkey)).filter((id): id is string => !!id))]);
    }
    if (mode === "story" || mode === "club") goStep("club");
    else if (mode === "roster") goStep("roster");
    else { // fantasy: pick a 2026 brand to occupy, then draft
      setReplaced(weakestTeam());
      goStep("club");
    }
  };

  const startFantasy = (): void => {
    const shorts = CORE.teams.map((t) => t.short);
    const o = [...shorts].sort(() => Math.random() - 0.5);
    setOrder(o); setReshuffle(3); setFRosters({}); setFRound(0); setFPick(0);
    if (mode === "fantasy" && !team) setTeam(o[o.length - 1]);
    goStep("fantasy");
  };

  const reshuf = (): void => {
    if (reshuffle <= 0) return;
    setOrder((o) => [...o].sort(() => Math.random() - 0.5));
    setReshuffle((n) => n - 1);
  };

  const fantasyTick = (start: { rosters: Record<string, string[]>; round: number; pick: number }): void => {
    // AI 차례를 하나씩 진행하다가 우리 차례이거나 드래프트가 끝나면 멈춥니다.
    setFBusy(true);
    const rng = new Rng((Date.now() ^ (Math.random() * 1e9)) >>> 0);
    const tick = (cur: typeof start): void => {
      if (cur.round >= FANTASY_ROUNDS) { setFRosters(cur.rosters); setFRound(cur.round); setFPick(cur.pick); setFBusy(false); setPicks(cur.rosters[team] ?? []); return; }
      const w = whoPicks(order, cur.round, cur.pick)!;
      if (w === team) { setFRosters(cur.rosters); setFRound(cur.round); setFPick(cur.pick); setFBusy(false); return; }
      cur = applyPick(aiPick(w, cur.rosters, cap, rng), order, cur.rosters, cur.round, cur.pick);
      setFRosters(cur.rosters); setFRound(cur.round); setFPick(cur.pick);
      setTimeout(() => tick(cur), 40);
    };
    tick(start);
  };

  const onFantasyUser = (c: SeasonCard): void => {
    if (fBusy || whoPicks(order, fRound, fPick) !== team) return;
    if (lockReason(c, team, fRosters, cap)) return;
    fantasyTick(applyPick(c.id, order, fRosters, fRound, fPick));
  };

  const kickFantasy = (): void => {
    if (fBusy) return;
    fantasyTick({ rosters: fRosters, round: fRound, pick: fPick });
  };

  const startCareer = (): void => {
    setErr("");
    const name = mgr.name.trim();
    if (!name) { setErr("감독 이름을 입력해 주세요."); goStep("contract"); return; }
    if (sl[slot - 1] && !confirm(`슬롯 ${slot}에 있는 커리어를 덮어씁니다. 계속할까요?`)) return;
    let myTeam = team;
    let optClub = club;
    let cards = picks;
    let starters: Record<string, string[]> | undefined;
    if (mode === "story") {
      if (!clubName.trim() || clubShort.trim().length < 2) { setErr("구단 이름과 2~4글자 약칭을 정해 주세요."); goStep("club"); return; }
      const sh = clubShort.trim().toUpperCase();
      const reserved = [...lckTeamsOf(2018), ...CK_POOL].map((x) => x.short);
      if (reserved.includes(sh)) { setErr("그 약칭은 2018 시즌 구단과 겹칩니다."); goStep("club"); return; }
      const v = validRoster(picks); if (v) { setErr(v); goStep("market"); return; }
      const spent = picks.reduce((n, id) => n + storySalary(CARDS[id], "CK"), 0);
      if (moneyRound(spent) > moneyRound(cap)) { setErr("예산을 초과했습니다."); goStep("market"); return; }
      const info0: Manager = { ...mgr, name, signature: sig || undefined };
      const g0 = goals.find((x) => x.id === goal)!;
      const eco0: Partial<Economy> = {
        difficulty: diff, cap, cash: cap,
        trust: mgr.career === "worlds" ? 68 : mgr.career === "pro" ? 62 : 55,
        fans: mgr.career === "worlds" ? 60 : 50,
        goal, grant: g0.grant, bonus: g0.bonus, trustHit: g0.hit, trustWin: g0.win,
        sponsor: sponsor != null ? sponsors[sponsor] : undefined,
      };
      const save0 = newStoryCareer(sh, name, slot, (Date.now() ^ (Math.random() * 1e9)) >>> 0, {
        club: { name: clubName.trim(), short: sh, color }, managerInfo: info0, eco: eco0, cards: picks,
        starters: startersFrom(picks), difficulty: diff,
      });
      save0.seen = tut ? "tut1" : "done";
      setSave(save0);
      go("#/home");
      return;
    }
    if (mode === "club") {
      if (!clubName.trim() || clubShort.trim().length < 2) { setErr("구단 이름과 2~4글자 약칭을 정해 주세요."); goStep("club"); return; }
      const sh = clubShort.trim().toUpperCase();
      if (CORE.teams.some((t) => t.short === sh && t.short !== replaced)) { setErr("그 약칭은 이미 있는 팀과 겹칩니다."); goStep("club"); return; }
      const v = validRoster(picks); if (v) { setErr(v); goStep("market"); return; }
      if (rosterSalary(picks) > cap) { setErr("예산을 초과했습니다."); goStep("market"); return; }
      myTeam = sh;
      optClub = { name: clubName.trim(), short: sh, color, replaced };
      starters = { [sh]: startersFrom(picks) };
    } else if (mode === "roster") {
      if (!team) { setErr("팀을 골라 주세요."); goStep("roster"); return; }
      myTeam = team;
      optClub = undefined;
      cards = [];
    } else {
      if (!team) { setErr("드래프트에서 맡을 팀을 정해 주세요."); goStep("club"); return; }
      const v = validRoster(picks); if (v) { setErr(v); goStep("fantasy"); return; }
      myTeam = team;
      optClub = undefined;
      starters = {};
      for (const [k, ids] of Object.entries(fRosters)) starters[k] = startersFrom(ids);
      cards = fRosters[team] ?? picks;
    }
    const g = goals.find((x) => x.id === goal)!;
    const trust0 = mgr.career === "worlds" ? 68 : mgr.career === "pro" ? 62 : mgr.career === "academy" ? 58 : 55;
    const fans0 = mgr.career === "worlds" ? 60 : mgr.career === "pro" ? 55 : 50;
    const sp = sponsor != null ? sponsors[sponsor] : undefined;
    const eco: Partial<Economy> = {
      difficulty: diff, cap, cash: cap, trust: trust0, fans: fans0,
      goal, grant: g.grant, bonus: g.bonus, trustHit: g.hit, trustWin: g.win,
      sponsor: sp,
    };
    const info: Manager = { ...mgr, name, signature: sig || undefined };
    const save = newCareer(myTeam, name, slot, (Date.now() ^ (Math.random() * 1e9)) >>> 0, {
      mode, managerInfo: info, club: optClub, eco, cards, replace: optClub?.replaced, starters,
    });
    save.seen = tut ? "tut1" : "done";
    save.intro = true;
    setSave(save);
    go("#/home");
  };

  return (
    <div className={"title-wrap" + (mode === "fantasy" && (step === "club" || step === "fantasy") ? " fit" : "")}>
      <div className="newc">
        <div className="row between wrap gap">
          <div><a href="#/" className="muted">← 타이틀</a><h1>새 게임</h1></div>
          <label className="sm">저장 슬롯 <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>슬롯 {n}{sl[n - 1] ? ` (사용 중: ${sl[n - 1]!.team})` : ""}</option>)}</select></label>
        </div>
        {err && <p className="err">{err}</p>}

        {step === "mode" && (
          <div>
            <h2>어떤 방식으로 시작할까요?</h2>
            <p className="muted">추천은 프랜차이즈 스토리입니다. 감독 이름은 다음 계약서에서 직접 씁니다. 기본 감독 이름은 두지 않습니다.</p>
            <div className="mode-grid">
              <button className={"mode-card" + (mode === "story" ? " on" : "")} onClick={() => setMode("story")} data-testid="mode-story">
                <small>추천 · 기본 모드</small><b>프랜차이즈 스토리</b>
                <p>2018년 2부에서 구단을 창단해 승강전으로 LCK에 오르고, 2021 프랜차이즈를 지켜 2027 월즈 우승을 노립니다.</p>
              </button>
              <button className={"mode-card" + (mode === "roster" ? " on" : "")} onClick={() => setMode("roster")} data-testid="mode-roster">
                <b>실제 로스터 2026</b>
                <p>2026 LCK 10개 팀 중 하나를 맡아, 그해 실제 명단으로 한 시즌을 운영합니다.</p>
              </button>
              <button className={"mode-card" + (mode === "fantasy" ? " on" : "")} onClick={() => setMode("fantasy")} data-testid="mode-fantasy">
                <b>판타지 드래프트</b>
                <p>시즌 카드를 스네이크 드래프트로 10개 구단이 나눠 갖습니다.</p>
              </button>
              <button className={"mode-card" + (mode === "club" ? " on" : "")} onClick={() => setMode("club")} data-testid="mode-club">
                <b>2026 한 시즌 창단</b>
                <p>2026 LCK 한 자리를 대신하는 단기 창단입니다. 멀티시즌 스토리는 위 기본 모드를 이용해 주세요.</p>
              </button>
            </div>
            <div className="row gap" style={{ marginTop: 16 }}><span className="muted sm">난이도(기본 자금)</span>
              {(mode === "story"
                ? ([["easy", `쉬움 ${fmtMoney(STORY_BUDGETS.easy)}`], ["normal", `보통 ${fmtMoney(STORY_BUDGETS.normal)}`], ["hard", `어려움 ${fmtMoney(STORY_BUDGETS.hard)}`]] as const)
                : mode === "fantasy"
                  ? ([["easy", `쉬움 ${fmtMoney(FANTASY_BUDGETS.easy)}`], ["normal", `보통 ${fmtMoney(FANTASY_BUDGETS.normal)}`], ["hard", `어려움 ${fmtMoney(FANTASY_BUDGETS.hard)}`]] as const)
                  : ([["easy", "쉬움 120억"], ["normal", "보통 100억"], ["hard", "어려움 80억"]] as const)
              ).map(([k, l]) => (
                <button key={k} className={"btn sm" + (diff === k ? " primary" : "")} onClick={() => setDiff(k)}>{l}</button>
              ))}
            </div>
            <div className="setup-foot"><button className="btn primary lg" onClick={confirmMode} data-testid="mode-next">다음</button></div>
          </div>
        )}

        {step === "club" && (mode === "club" || mode === "story") && (
          <ClubForm name={clubName} setName={setClubName} short={clubShort} setShort={setClubShort} color={color} setColor={setColor} replaced={replaced} setReplaced={setReplaced} story={mode === "story"}
            onBack={() => goStep("mode")} onNext={() => { if (!clubName.trim() || clubShort.trim().length < 2 || clubShort.trim().length > 4) { setErr("구단 이름과 2–4글자 영문 약칭이 필요합니다."); return; } goStep("market"); }} />
        )}
        {step === "club" && mode === "fantasy" && (
          <div>
            <h2>어느 팀 자리에서 드래프트할까요?</h2>
            <p className="muted sm">기존 2026 구단 자리 하나를 맡아 완전히 새로운 로스터를 뽑습니다. 로고는 쓰지 않습니다. 아래 명단은 그 팀의 실제 2026 선수(참고용)입니다.</p>
            <TeamGrid value={team} onChange={setTeam} compact />
            <div className="setup-foot sticky"><button className="btn" onClick={() => goStep("mode")}>뒤로</button><button className="btn primary lg" disabled={!team} onClick={startFantasy}>드래프트 순서</button></div>
          </div>
        )}

        {step === "roster" && (
          <div>
            <h2>어느 팀을 맡으시겠습니까</h2>
            <TeamGrid value={team} onChange={setTeam} compact big />
            <div className="setup-foot sticky"><button className="btn" onClick={() => goStep("mode")}>뒤로</button><button className="btn primary lg" disabled={!team} data-testid="roster-next" onClick={() => goStep("contract")}>다음 · 감독 계약서</button></div>
          </div>
        )}

        {step === "market" && (
          <div>
            <h2>{mode === "story" ? "선수 영입" : "시즌 카드 시장"}</h2>
            <p className="muted">선발 5명(포지션당 1)과 벤치(최대 3)를 고르세요. 선수는 한 명씩, 연봉 합이 {fmtMoney(cap)}을 넘으면 안 됩니다. {mode === "story" ? "2018년 기준 선수당 한 명만 표시하고 시즌 기록은 자동으로 적용합니다. 미래 시즌의 선수는 나오지 않습니다. 2부 연봉은 전형적으로 2천만~5천만 원이며, LCK에서 이름 있던 선수는 최대 약 1–2억입니다." : "예: 2022 Faker, 2014 Faker."} 연봉은 게임용 가상 금액입니다.</p>
            <CardMarket cap={cap} selected={picks} onChange={setPicks} yearMax={mode === "story" ? 2018 : undefined} priceOf={priceOf} seasonYear={mode === "story" ? 2018 : undefined} />
            <div className="picked-line">{picks.map((id) => <span key={id} className="tag">{mode === "story" ? CARDS[id].name : cardLabel(CARDS[id])} {fmtMoney(priceOf ? priceOf(CARDS[id]) : CARDS[id].salary)}</span>)}</div>
            <div className="setup-foot"><button className="btn" onClick={() => goStep("club")}>뒤로</button>
              <button className="btn primary lg" data-testid="market-next" onClick={() => { const v = validRoster(picks); if (v) { setErr(v); return; } const spent = picks.reduce((n, id) => n + (priceOf ? priceOf(CARDS[id]) : CARDS[id].salary), 0); if (moneyRound(spent) > moneyRound(cap)) { setErr("예산을 초과했습니다."); return; } goStep("contract"); }}>다음 · 감독 계약서</button></div>
          </div>
        )}

        {step === "fantasy" && (
          <FantasyBoard order={order} reshuffle={reshuffle} onReshuf={reshuf} round={fRound} pick={fPick} rosters={fRosters} me={team} cap={cap} busy={fBusy} onPick={onFantasyUser} onKick={kickFantasy}
            onBack={() => goStep("club")} onDone={() => { const v = validRoster(fRosters[team] ?? []); if (v) { setErr(v); return; } setPicks(fRosters[team] ?? []); goStep("contract"); }} />
        )}

        {step === "contract" && (
          <ContractForm mgr={mgr} setMgr={setMgr} sig={sig} setSig={setSig} onBack={() => goStep(mode === "roster" ? "roster" : mode === "fantasy" ? "fantasy" : "market")} onNext={() => { if (!mgr.name.trim()) { setErr("이름을 입력해 주세요."); return; } if (!sig) { setErr("계약서에 서명해 주세요."); return; } goStep("goal"); }} />
        )}
        {step === "goal" && (
          <GoalForm goal={goal} setGoal={setGoal} cap={cap} salary={mode === "roster" ? 0 : rosterPay} story={mode === "story"} trust={mgr.career === "worlds" ? 68 : mgr.career === "pro" ? 62 : 55} options={goals}
            onBack={() => goStep("contract")} onNext={() => goStep("sponsor")} />
        )}
        {step === "sponsor" && (
          <div>
            <h2>스폰서 협상</h2>
            <p className="muted">첫 시즌 메인 스폰서입니다. 모두 가상의 회사이며, 실제 브랜드와 관련이 없습니다. 비워 두어도 됩니다.</p>
            <div className="mode-grid">
              {sponsors.map((sp, i) => (
                <button key={sp.name} className={"mode-card" + (sponsor === i ? " on" : "")} onClick={() => setSponsor(i)}>
                  <b>{sp.name}</b><p>연 {fmtMoney(sp.amount)} · {sp.years}년 · 목표 {sp.goal}</p>
                </button>
              ))}
              <button className={"mode-card" + (sponsor === null ? " on" : "")} onClick={() => setSponsor(null)}><b>이번엔 비워 둔다</b><p>스폰서 수입 없이 시작합니다.</p></button>
            </div>
            <div className="setup-foot"><button className="btn" onClick={() => goStep("goal")}>뒤로</button><button className="btn primary lg" data-testid="sponsor-next" onClick={() => goStep("tutor")}>다음</button></div>
          </div>
        )}
        {step === "tutor" && (
          <div>
            <h2>수석코치 안내</h2>
            <p>부임 첫날입니다. 홈 화면의 다음 경기·선수단 일정·진행하기 같은 곳을 하나씩 짚어 가며 1분 정도 안내할까요? 나중에 설정에서 다시 볼 수도 있습니다.</p>
            <div className="row gap wrap">
              <button className={"btn" + (!tut ? " primary" : "")} onClick={() => setTut(false)}>아니요, 바로 시작</button>
              <button className={"btn" + (tut ? " primary" : "")} onClick={() => setTut(true)}>안내 받기</button>
            </div>
            <div className="setup-foot"><button className="btn" onClick={() => goStep("sponsor")}>뒤로</button><button className="btn primary lg" data-testid="start-career" onClick={startCareer}>시즌 시작</button></div>
          </div>
        )}
      </div>
      <FanNotice />
    </div>
  );
}

function TeamGrid({ value, onChange, compact, big }: { value: string; onChange: (t: string) => void; compact?: boolean; big?: boolean }) {
  const teams = useMemo(() => [...CORE.teams].sort((a, b) => b.gw / (b.gw + b.gl) - a.gw / (a.gw + a.gl)), []);
  if (compact) return (
    <div className={"team-grid compact" + (big ? " big" : "")}>
      {teams.map((t) => (
        <button key={t.short} className={"team-card" + (value === t.short ? " on" : "")} onClick={() => onChange(t.short)} data-testid={`team-${t.short}`} style={{ ["--tc" as string]: t.color }} aria-pressed={value === t.short}>
          <div className="tc-head"><TeamChip t={t.short} size={big ? "md" : "sm"} /><b className="tc-name">{t.ko}</b>{!big && <span className="muted xs tc-rec">{t.gw}승 {t.gl}패</span>}</div>
          <div className="tc-roster">
            {t.starters.map((k, i) => <span key={k}><small>{POS_KO[i]}</small><span className="tc-pl">{PL[k].name}</span><Ovr p={PL[k]} /></span>)}
          </div>
        </button>
      ))}
    </div>
  );
  return (
    <div className="team-grid">
      {teams.map((t) => (
        <button key={t.short} className={"team-card" + (value === t.short ? " on" : "")} onClick={() => onChange(t.short)} data-testid={`team-${t.short}`} style={{ ["--tc" as string]: t.color }}>
          <div className="row between"><TeamChip t={t.short} size="lg" /><span className="muted sm">2026 LCK 세트 {t.gw}승 {t.gl}패</span></div>
          <b className="tc-name">{t.name}</b>
          <div className="tc-roster">
            {t.starters.map((k, i) => <span key={k}><small>{POS_KO[i]}</small>{PL[k].name}<Ovr p={PL[k]} /></span>)}
          </div>
        </button>
      ))}
    </div>
  );
}

function ClubForm({ name, setName, short, setShort, color, setColor, replaced, setReplaced, onBack, onNext, story }: {
  name: string; setName: (v: string) => void; short: string; setShort: (v: string) => void; color: string; setColor: (v: string) => void; story?: boolean;
  replaced: string; setReplaced: (v: string) => void; onBack: () => void; onNext: () => void;
}) {
  const weak = weakestTeam();
  return (
    <div>
      <h2>{story ? "2018 2부 창단" : "신규 구단 창단"}</h2>
      <p className="muted">로고는 쓰지 않습니다. 이름·약칭·색 칩만 사용합니다.{story ? " 2018 챌린저스에서 출발하며, 기존 LCK 자리를 대체하지 않습니다." : " 선택한 2026 LCK 팀 자리를 이 구단이 대신합니다."}</p>
      <div className="form-grid">
        <label>구단 이름 <input value={name} maxLength={20} onChange={(e) => setName(e.target.value)} placeholder="예: 신구 이글스" data-testid="club-name" /></label>
        <label>약칭 (2–4자, 영문) <input value={short} maxLength={4} onChange={(e) => setShort(e.target.value.toUpperCase())} placeholder="SGU" data-testid="club-short" /></label>
        <label>대표 색 <input type="color" value={color} onChange={(e) => setColor(e.target.value)} /></label>
      </div>
      {!story && <><h3>어느 팀 자리를 대신할까요?</h3>
      <p className="muted sm">추천은 2026 세트 승률이 가장 낮은 {weak}입니다.</p>
      <div className="row wrap gap">
        <button className={"btn sm" + (replaced === weak ? " primary" : "")} onClick={() => setReplaced(weak)}>가장 약한 팀 ({weak})</button>
        {CORE.teams.map((t) => <button key={t.short} className={"btn sm" + (replaced === t.short ? " primary" : "")} onClick={() => setReplaced(t.short)}>{t.short}</button>)}
      </div></>}
      <div className="setup-foot"><button className="btn" onClick={onBack}>뒤로</button><button className="btn primary lg" data-testid="club-next" onClick={onNext}>다음 · 카드 영입</button></div>
    </div>
  );
}

function ContractForm({ mgr, setMgr, sig: _sig, setSig, onBack, onNext }: { mgr: Manager; setMgr: (m: Manager) => void; sig: string; setSig: (s: string) => void; onBack: () => void; onNext: () => void }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const start = (e: React.PointerEvent): void => {
    const c = ref.current!; const r = c.getBoundingClientRect();
    const ctx = c.getContext("2d")!;
    if (!c.dataset.init) { c.width = r.width * 2; c.height = r.height * 2; ctx.scale(2, 2); ctx.strokeStyle = "#E8EEF6"; ctx.lineWidth = 2; ctx.lineCap = "round"; c.dataset.init = "1"; }
    drawing.current = true; ctx.beginPath(); ctx.moveTo(e.clientX - r.left, e.clientY - r.top); c.setPointerCapture(e.pointerId);
  };
  const move = (e: React.PointerEvent): void => {
    if (!drawing.current) return;
    const c = ref.current!; const r = c.getBoundingClientRect(); const ctx = c.getContext("2d")!;
    ctx.lineTo(e.clientX - r.left, e.clientY - r.top); ctx.stroke();
  };
  const end = (): void => { if (!drawing.current) return; drawing.current = false; setSig(ref.current!.toDataURL("image/png")); };
  const clear = (): void => { const c = ref.current!; const ctx = c.getContext("2d")!; ctx.clearRect(0, 0, c.width, c.height); setSig(""); };
  return (
    <div>
      <h2>감독 계약서 작성</h2>
      <p className="muted">이름을 직접 입력해 주세요. 미리 채워 두지 않습니다.</p>
      <div className="form-grid">
        <label>이름 <input value={mgr.name} maxLength={16} onChange={(e) => setMgr({ ...mgr, name: e.target.value })} placeholder="감독 이름" data-testid="mgr-name" /></label>
        <label>생년월일 <input type="date" value={mgr.birth} onChange={(e) => setMgr({ ...mgr, birth: e.target.value })} data-testid="mgr-birth" /></label>
        <label>국적 <select value={mgr.nation} onChange={(e) => setMgr({ ...mgr, nation: e.target.value })}>{NATIONS.map((n) => <option key={n}>{n}</option>)}</select></label>
      </div>
      <h3>경력</h3>
      <div className="mode-grid four">
        {CAREERS.map((c) => <button key={c.id} className={"mode-card" + (mgr.career === c.id ? " on" : "")} onClick={() => setMgr({ ...mgr, career: c.id })} data-testid={"career-"+c.id}><b>{c.t}</b><p>{c.d}</p></button>)}
      </div>
      <h3>서명</h3>
      <p className="muted sm">아래 칸에 서명해 주세요.</p>
      <canvas ref={ref} className="sig-pad" onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerLeave={end} data-testid="sig-pad" />
      <button className="btn sm" onClick={clear}>다시 쓰기</button>
      <div className="setup-foot"><button className="btn" onClick={onBack}>뒤로</button><button className="btn primary lg" data-testid="contract-next" onClick={onNext}>프로필 확정</button></div>
    </div>
  );
}

function GoalForm({ goal, setGoal, cap, salary, story, trust, options, onBack, onNext }: { goal: Economy["goal"]; setGoal: (g: Economy["goal"]) => void; cap: number; salary: number; story: boolean; trust: number; options: typeof GOALS; onBack: () => void; onNext: () => void }) {
  const g = options.find((x) => x.id === goal)!;
  const rec = cap + g.grant - (story ? salary : 0);   // 스토리 모드는 시작할 때 선수 연봉을 먼저 냅니다
  return (
    <div>
      <h2>시즌 목표 및 예산</h2>
      <p className="muted">구단주는 신생·약팀에는 보통 8위 이내를 제안합니다. 더 높은 목표를 고르면 추가 예산이 붙고, 실패 시 신뢰 감소가 커집니다. 현재 구단주 신뢰 {trust}.</p>
      <div className="mode-grid">
        {options.map((x) => (
          <button key={x.id} className={"mode-card" + (goal === x.id ? " on" : "")} onClick={() => setGoal(x.id)}>
            <b>{x.t}</b>
            <p>추가 예산 +{fmtMoney(x.grant)} · 달성 보너스 +{fmtMoney(x.bonus)} · 실패 시 신뢰 −{x.hit} / 성공 +{x.win}</p>
          </button>
        ))}
      </div>
      <div className="card" style={{ marginTop: 16 }}>
        <h3>시작 자금</h3>
        <p className="sm">예산 한도 {fmtMoney(cap)} + 목표 추가 지원 {fmtMoney(g.grant)}{story ? <> − 시작 선수 연봉 {fmtMoney(salary)}</> : null}</p>
        <p>시즌을 시작할 때 자금 <b>{fmtMoney(rec)}</b></p>
        <p className="muted xs">연봉은 게임용 가상 금액입니다. 실제 LCK 계약과 무관합니다.</p>
      </div>
      <div className="setup-foot"><button className="btn" onClick={onBack}>뒤로</button><button className="btn primary lg" data-testid="goal-next" onClick={onNext}>확정하고 다음</button></div>
    </div>
  );
}

function FantasyBoard({ order, reshuffle, onReshuf, round, pick, rosters, me, cap, busy, onPick, onKick, onBack, onDone }: {
  order: string[]; reshuffle: number; onReshuf: () => void; round: number; pick: number;
  rosters: Record<string, string[]>; me: string; cap: number; busy: boolean;
  onPick: (c: SeasonCard) => void; onKick: () => void; onBack: () => void; onDone: () => void;
}) {
  const [started, setStarted] = useState(false);
  // 필터·정렬(팀·연도·검색·정렬·지명 가능만)은 차례가 바뀌어도 그대로 둡니다 (기본: 전체 팀 · 능력치 높은 순).
  const [view, setView] = useState<MarketView>({ q: "", pos: "open", year: "all", sort: "pct", team: "all" });
  const who = whoPicks(order, round, pick) ?? "";
  const mine = rosters[me] ?? [];
  const done = round >= FANTASY_ROUNDS;
  const ctx = useMemo(() => draftCtx(me, rosters, cap), [me, rosters, cap]);
  const teamName = (t: string): string => TM[t]?.ko ?? t;
  const max = ctx.open.length ? Math.max(...ctx.open.map((p) => ctxPickMax(ctx, p))) : 0;
  const rules: DraftRules = { lock: (c) => ctxLockReason(c, ctx, teamName), open: ctx.open, headline: `이번 픽 최대 ${fmtMoney(Math.max(0, max))}` };
  const slots = POS_KO.map((n, i) => ({ n, id: mine.find((id) => CARDS[id]?.posIdx === i) }));
  return (
    <div>
      <h2>판타지 드래프트</h2>
      <p className="muted">5라운드 스네이크(1→10, 10→1), 포지션마다 한 명. 예산 {cap}억, 같은 사람 한 장. 가격은 기본 5억 + 그 시즌 능력치에 따른 가산(높을수록 가파르게, 국제대회·포지션 1위는 소폭 보너스)이며 게임용 가상 금액입니다. 남은 포지션을 가장 싸게 채울 돈은 남겨 두도록 「이번 픽 최대」 금액을 넘는 카드는 잠깁니다. {reshuffle > 0 && !started ? <>순서를 다시 섞을 수 있습니다 ({reshuffle}번 남음).</> : null}</p>
      {!started && (
        <div className="card">
          <ol className="draft-order">{order.map((t) => <li key={t} className={t === me ? "me" : ""}>{t}{t === me ? " · 나" : ""}</li>)}</ol>
          <div className="row gap"><button className="btn" disabled={reshuffle <= 0} onClick={onReshuf}>순서 다시 섞기</button>
            <button className="btn primary" onClick={() => { setStarted(true); onKick(); }} data-testid="draft-start">드래프트 시작</button></div>
        </div>
      )}
      {started && (
        <div className="draft-slots" data-testid="draft-slots">
          {slots.map((x) => <span key={x.n} className={"tag" + (x.id ? " good" : " warn")}>{x.n} {x.id ? `${cardLabel(CARDS[x.id])} ${fmtMoney(fantasyPrice(CARDS[x.id]))}` : "비어 있음"}</span>)}
          <span className="tag">사용 {fmtMoney(ctx.spent)} / {fmtMoney(cap)}</span>
        </div>
      )}
      {started && !done && (
        <>
          <p data-testid="draft-turn"><b>{round + 1}라운드 · {pick + 1}번째 픽</b> — {who === me ? <>우리 차례입니다 · <span className="gold">{rules.headline}</span></> : `${teamName(who)} 차례`}{busy ? " · 진행 중…" : ""}</p>
          {who === me && !busy && <DraftBoard cap={cap} mine={mine} view={view} onView={setView} rules={rules} priceOf={fantasyPrice} ratingOf={fantasyRatingOf} onPick={onPick} />}
        </>
      )}
      {done && <p className="ok">드래프트가 끝났습니다. 우리 팀 {mine.length}명, 연봉 합 {fmtMoney(ctx.spent)}.</p>}
      <div className="setup-foot"><button className="btn" onClick={onBack}>뒤로</button>{done && <button className="btn primary lg" onClick={onDone}>다음 · 감독 계약서</button>}</div>
    </div>
  );
}
