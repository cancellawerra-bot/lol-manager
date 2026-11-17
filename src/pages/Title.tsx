import { useMemo, useRef, useState } from "react";
import { CORE, PL, POS_KO, TM, fmt } from "../data";
import { slots, loadSlot, setSave, deleteSlot, importJson } from "../store";
import { newCareer, dateKo } from "../game/season";
import { FanNotice, Pct, TeamChip } from "../ui";
import { PATCH_VERSION } from "./patchdata";
import { go } from "../nav";

export default function Title({ mode }: { mode: "title" | "new" }) {
  const [sl, setSl] = useState(slots());
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  if (mode === "new") return <NewCareer />;
  const cont = sl.filter(Boolean).sort((a, b) => (b!.updated > a!.updated ? 1 : -1))[0];
  const onFile = async (f: File): Promise<void> => {
    const empty = sl.findIndex((x) => !x); const slot = empty >= 0 ? empty + 1 : 3;
    const e = importJson(await f.text(), slot);
    if (e) setMsg(e); else go("#/home");
  };
  return (
    <div className="title-wrap">
      <div className="title-hero">
        <div className="title-mark"><span className="logo xl">LM</span></div>
        <h1>LOL Manager</h1>
        <p className="lead">실제 2026 LCK 기록으로 움직이는 e스포츠 구단 운영 게임</p>
        <ul className="title-points">
          <li><b>{CORE.meta.games}</b>경기 실제 기록으로 만든 선수 능력치</li>
          <li><b>{fmt(CORE.meta.rankedGames)}</b>판 랭크 상성 · 30판 이상만 사용</li>
          <li>2026 첫 번째 선택권 · 피어리스 밴픽</li>
          <li>경기마다 승부 요인을 근거와 함께 설명</li>
        </ul>
        <div className="title-actions">
          {cont && <button className="btn primary lg" data-testid="continue" onClick={() => { loadSlot(cont.slot); go("#/home"); }}>이어하기 · {cont.team} {cont.label}</button>}
          <button className="btn lg" data-testid="new-career" onClick={() => go("#/new")}>새 커리어</button>
          <button className="btn ghost lg" onClick={() => fileRef.current?.click()}>세이브 파일 불러오기</button>
          <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])} />
        </div>
        {msg && <p className="err">{msg}</p>}
        <div className="slots">
          {sl.map((s, i) => (
            <div key={i} className={"slot" + (s ? "" : " empty")}>
              <small>슬롯 {i + 1}</small>
              {s ? <>
                <div className="slot-main"><TeamChip t={s.team} full /><span className="muted">{s.manager} 감독</span></div>
                <div className="muted sm">{s.label} · {dateKo(s.date)}</div>
                <div className="row gap">
                  <button className="btn sm" onClick={() => { loadSlot(s.slot); go("#/home"); }}>불러오기</button>
                  <button className="btn ghost sm" onClick={() => { if (confirm(`슬롯 ${i + 1}을 지울까요? 되돌릴 수 없습니다.`)) { deleteSlot(s.slot); setSl(slots()); } }}>지우기</button>
                </div>
              </> : <div className="muted">비어 있음</div>}
            </div>
          ))}
        </div>
        <p className="muted sm">v{PATCH_VERSION} · <a href="#/patch">패치 노트</a> · <a href="#/method">데이터 출처·방법</a> · 저장은 이 브라우저에만 됩니다. 중요한 커리어는 저장·설정에서 파일로 내보내 두세요.</p>
      </div>
      <FanNotice />
    </div>
  );
}

function NewCareer() {
  const [team, setTeam] = useState<string>("");
  const [name, setName] = useState("홍승표");
  const sl = slots();
  const firstEmpty = sl.findIndex((x) => !x);
  const [slot, setSlot] = useState(firstEmpty >= 0 ? firstEmpty + 1 : 1);
  const teams = useMemo(() => [...CORE.teams].sort((a, b) => b.gw / (b.gw + b.gl) - a.gw / (a.gw + a.gl)), []);
  const start = (): void => {
    if (!team) return;
    if (sl[slot - 1] && !confirm(`슬롯 ${slot}에 있는 커리어를 덮어씁니다. 계속할까요?`)) return;
    setSave(newCareer(team, name.trim() || "감독", slot, (Date.now() ^ (Math.random() * 1e9)) >>> 0));
    go("#/home");
  };
  return (
    <div className="title-wrap">
      <div className="newc">
        <div className="row between wrap gap"><div><a href="#/" className="muted">← 타이틀</a><h1>팀 선택</h1><p className="muted">2026 LCK 10개 팀 중 하나를 맡습니다. 실제 팀·선수 이름만 쓰고 로고와 사진은 쓰지 않습니다. 숫자는 포지션 내 종합 지표 백분위(2026 LCK 기록)입니다.</p></div></div>
        <div className="team-grid">
          {teams.map((t) => (
            <button key={t.short} className={"team-card" + (team === t.short ? " on" : "")} onClick={() => setTeam(t.short)} data-testid={`team-${t.short}`} style={{ ["--tc" as string]: t.color }}>
              <div className="row between"><TeamChip t={t.short} size="lg" /><span className="muted sm">2026 LCK 세트 {t.gw}승 {t.gl}패</span></div>
              <b className="tc-name">{t.name}</b>
              <div className="tc-roster">
                {t.starters.map((k, i) => <span key={k}><small>{POS_KO[i]}</small>{PL[k].name}<Pct v={PL[k].pct.ovr} /></span>)}
              </div>
              <div className="muted sm">실제 2026 정규 1·2라운드 {t.real[0]}승 {t.real[1]}패</div>
            </button>
          ))}
        </div>
        <div className="newc-foot">
          <label>감독 이름 <input value={name} maxLength={16} onChange={(e) => setName(e.target.value)} /></label>
          <label>저장 슬롯 <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>슬롯 {n}{sl[n - 1] ? ` (사용 중: ${sl[n - 1]!.team})` : ""}</option>)}</select></label>
          <button className="btn primary lg" disabled={!team} onClick={start} data-testid="start-career">{team ? `${TM[team].ko}로 시작하기` : "팀을 골라 주세요"}</button>
        </div>
      </div>
      <FanNotice />
    </div>
  );
}
