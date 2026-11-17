import { useRef, useState } from "react";
import { CARDS_FILE, fmt } from "../data";
import { slots, loadSlot, deleteSlot, importJson } from "../store";
import { dateKo } from "../game/season";
import { FanNotice, TeamChip } from "../ui";
import { PATCH_VERSION } from "./patchdata";
import { go } from "../nav";

export default function Title() {
  const [sl, setSl] = useState(slots());
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
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
        <p className="lead">실제 LCK 시즌 기록으로 구단을 운영하는 비상업 팬메이드 게임</p>
        <ul className="title-points">
          <li>기본 모드: <b>프랜차이즈 스토리</b> — 2018 2부 창단부터 2027 월즈 우승까지</li>
          <li><b>{fmt(CARDS_FILE?.meta.eligible ?? 1011)}</b>장의 시즌 카드(2012–2026). 그해 성적만 쓰며 미래 카드는 나오지 않습니다</li>
          <li>능력치는 그해·포지션 안 성적, 연봉은 게임용 가상 금액</li>
          <li>첫 번째 선택권 · 피어리스 밴픽 · 경기마다 승부 요인 설명</li>
        </ul>
        <div className="title-actions">
          {cont && <button className="btn primary lg" data-testid="continue" onClick={() => { if (loadSlot(cont.slot)) go("#/home"); else setMsg("세이브 버전이 달라 불러올 수 없습니다. 새 게임을 시작해 주세요."); }}>이어하기 · {cont.team} {cont.label}</button>}
          <button className="btn primary lg" data-testid="new-career" onClick={() => go("#/setup")}>새 게임</button>
          <button className="btn lg" onClick={() => fileRef.current?.click()}>불러오기</button>
          <button className="btn ghost lg" onClick={() => go("#/settings")}>설정</button>
          <button className="btn ghost lg" onClick={() => go("#/help")}>도움말</button>
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
                  <button className="btn sm" onClick={() => { if (loadSlot(s.slot)) go("#/home"); else setMsg("세이브 버전이 달라 불러올 수 없습니다."); }}>불러오기</button>
                  <button className="btn ghost sm" onClick={() => { if (confirm(`슬롯 ${i + 1}을 지울까요? 되돌릴 수 없습니다.`)) { deleteSlot(s.slot); setSl(slots()); } }}>지우기</button>
                </div>
              </> : <div className="muted">비어 있음</div>}
            </div>
          ))}
        </div>
        <p className="muted sm">v{PATCH_VERSION} · <a href="#/patch">패치 노트</a> · <a href="#/help">데이터 출처·방법</a> · 저장은 이 브라우저에만 됩니다.</p>
      </div>
      <FanNotice />
    </div>
  );
}
