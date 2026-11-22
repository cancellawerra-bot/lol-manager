import { useRef, useState } from "react";
import { TM } from "../data";
import { useSave, exportJson, importJson, persist, setSave, slots } from "../store";
import { Card } from "../ui";
import { go } from "../nav";
import { SPEED_KO, setPrefs, usePrefs, type Prefs } from "../prefs";

export default function Settings() {
  const s = useSave();
  const [msg, setMsg] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const download = (): void => {
    const blob = new Blob([exportJson()], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    if (!s) return;
    a.download = `lol-manager_${s.team}_${s.days[Math.min(s.day, s.days.length - 1)].date}.json`; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    setMsg("세이브 파일을 내려받았습니다.");
  };
  const sl = slots();
  const pf = usePrefs();
  return (
    <div className="grid">
      <Card title="저장" className="span2">
        {s ? <>
        <p>이 커리어는 <b>슬롯 {s.slot}</b>에 있고, 진행할 때마다 이 브라우저에 자동 저장됩니다. 마지막 저장: {new Date(s.updated).toLocaleString("ko-KR")}.</p>
        <p className="muted sm">브라우저 기록을 지우거나 시크릿 창, 다른 기기에서는 저장이 보이지 않습니다. 파일로 내보내 두면 어디서든 불러올 수 있습니다.</p>
        <div className="row gap wrap">
          <button className="btn primary" onClick={() => setMsg(persist() ? "저장했습니다." : "저장하지 못했습니다(브라우저 저장 공간을 확인해 주세요).")}>지금 저장</button>
          <button className="btn" onClick={download} data-testid="export">JSON 내보내기</button>
          <button className="btn" onClick={() => ref.current?.click()}>JSON 불러오기 (슬롯 {s.slot}에 덮어쓰기)</button>
          <input ref={ref} type="file" accept=".json,application/json" hidden onChange={async (e) => { const f = e.target.files?.[0]; if (!f) return; if (!confirm(`슬롯 ${s.slot}의 현재 커리어를 파일 내용으로 바꿉니다. 계속할까요?`)) return; const err = importJson(await f.text(), s.slot); setMsg(err ?? "불러왔습니다."); }} />
        </div>
        </> : <p className="muted">진행 중인 커리어가 없습니다. 타이틀에서 새 게임을 시작하거나 세이브 파일을 불러 주세요.</p>}
        {msg && <p className="ok">{msg}</p>}
      </Card>
      <Card title="경기 연출">
        <p className="muted sm">표시와 속도만 바꿉니다. 경기 결과에는 영향이 없고, 이 브라우저에만 저장됩니다.</p>
        <div className="speedrow"><span>자동 진행 속도</span>
          {(Object.keys(SPEED_KO) as Prefs["speed"][]).map((k) => <button key={k} className={"btn" + (pf.speed === k ? " primary" : "")} onClick={() => setPrefs({ speed: k })}>{SPEED_KO[k]}</button>)}</div>
        <p><label><input type="checkbox" checked={pf.map} onChange={(e) => setPrefs({ map: e.target.checked })} /> 경기 중 협곡 미니맵 연출 보이기</label></p>
        <p><label><input type="checkbox" checked={pf.intro} onChange={(e) => setPrefs({ intro: e.target.checked })} /> 새 게임 시작 때 부임 발표 연출 보이기</label></p>
        <p><label><input type="checkbox" checked={pf.sound} onChange={(e) => setPrefs({ sound: e.target.checked })} /> 부임 발표 효과음 내기</label></p>
      </Card>
      <Card title="슬롯">
        <ul className="plist">{sl.map((x, i) => <li key={i}>슬롯 {i + 1}: {x ? `${TM[x.team]?.ko ?? x.team} · ${x.manager} 감독 · ${x.label}` : "비어 있음"}{s && x && x.slot === s.slot ? " (현재)" : ""}</li>)}</ul>
        <button className="btn ghost" onClick={() => { setSave(null); go("#/"); }}>타이틀로 나가기</button>
      </Card>
      <Card title="정보">
        <ul className="plist"><li><a href="./terms.html">이용약관</a></li><li><a href="./privacy.html">개인정보처리방침</a></li><li><a href="#/method">데이터 출처·방법</a></li><li><a href="#/patch">패치 노트</a></li></ul>
        <p className="muted sm">운영: 홍승표 (신구대학교 e스포츠과) · 무료 비상업 교육용 팬 프로젝트</p>
      </Card>
    </div>
  );
}
