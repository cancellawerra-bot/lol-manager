import { useState } from "react";
import { PL, POS_KO } from "../data";
import { useSave, manageRotation, promisePlayingTime, withdrawPlayingTime } from "../store";
import { Card } from "../ui";
import { ROLE_LABEL, rotationLocked, type AppearanceRecord } from "../game/rotation";
import { playerTraining } from "../game/trainingRuntime";

export function RotationControls() {
  const s = useSave()!, [roles, setRoles] = useState<Record<string, number>>({}), [message, setMessage] = useState("");
  if (s.mode !== "story" || !s.story) return null;
  const state = s.rotation, locked = rotationLocked(s), automatic = state?.automatic ?? true;
  return <Card title="출전 약속 · 로테이션">
    <p className="sm">수석코치는 현재 종합·피로와 출전 약속 기한을 비교해 시리즈 첫 선발을 정합니다. 수동으로 바꿀 수 있고, 다음 세트 기용은 감독의 선택을 유지합니다.</p>
    <button className={"btn " + (automatic ? "primary" : "")} data-testid="rotation-auto" aria-pressed={automatic} disabled={locked} onClick={() => manageRotation(!automatic)}>자동 로테이션 {automatic ? "켜짐" : "꺼짐"}</button>
    <p className="muted sm">약속은 소속 중 앞으로 치르는 정규 시리즈 4회의 <b>첫 세트 선발</b> 기준입니다. 주전 3회·로테이션 2회·육성 1회이며 플레이오프·국제대회는 기회에 세지 않습니다. 시즌이 바뀌어도 남은 약속은 이어집니다.</p>
    <p className="muted sm">4회 평가에서 이행하면 구단 신뢰 +1, 미이행·중도 철회는 −2입니다. 소속 종료는 평가 없이 닫습니다. 실제 선수의 성격이 아닌 게임 내 운영 약속입니다. 진행 중인 경기는 약속·자동 관리 설정을 잠급니다.</p>
    {message && <p className="sm" role="status">{message}</p>}
    <div className="card-grid" data-testid="rotation-roster">{s.story.contracts.map(c => {
      const person = c.person, p = state?.promises[person], stats = state?.players[person], fatigue = playerTraining(s, c.key)?.fatigue ?? 0;
      const target = roles[person] ?? ((s.starters[s.team] ?? []).includes(c.key) ? 3 : 1);
      return <div className="card-tile" key={person} data-testid={`rotation-${person}`}>
        <b>{PL[c.key]?.name ?? person}</b><span className="tag">{PL[c.key] ? POS_KO[PL[c.key].pos] : "포지션 기록 없음"} · {(s.starters[s.team] ?? []).includes(c.key) ? "현재 선발" : "벤치"}</span>
        <p className="sm">현재 피로 {fatigue.toFixed(1)}/100<br />도입 후 출전: {stats ? `${stats.sets}세트 · 첫 선발 ${stats.starts}회` : "기록 없음"}</p>
        {p ? <><p data-testid={`promise-progress-${person}`}><b>{ROLE_LABEL[p.target]} 약속</b><br />첫 선발 {p.starts}/{p.target}회 · 기회 {p.opportunities}/4회</p><button className="btn sm" disabled={locked} data-testid={`promise-cancel-${person}`} onClick={() => withdrawPlayingTime(person)}>약속 철회 (신뢰 −2)</button></> : <>
          <select aria-label={`${PL[c.key]?.name ?? person} 출전 역할`} data-testid={`promise-role-${person}`} value={target} disabled={locked || s.story!.phase !== "regular"} onChange={e => setRoles({ ...roles, [person]: Number(e.target.value) })}><option value={3}>주전 · 3/4회 선발</option><option value={2}>로테이션 · 2/4회 선발</option><option value={1}>육성 · 1/4회 선발</option></select>
          <button className="btn sm" data-testid={`promise-set-${person}`} disabled={locked || s.story!.phase !== "regular"} onClick={() => setMessage(promisePlayingTime(c.key, target) ?? "출전 약속을 저장했습니다.")}>출전 약속하기</button>
        </>}
      </div>;
    })}</div>
    <p className="muted xs">같은 포지션에서 기한 내 지킬 수 없는 약속은 받지 않습니다. 약속이 없으면 선발 의무도 없습니다. 출전 선수는 세트당 피로 2 × 나이별 누적 배수가 쌓이고, 벤치는 경기 피로가 쌓이지 않습니다. 휴식 계획으로 회복하며 생년 미확인은 중립 배수입니다.</p>
    {!!state?.history.length && <details data-testid="promise-history"><summary>최근 약속 평가 {state.history.length}건</summary>{state.history.slice(0, 12).map((h, i) => <p className="sm" key={i}>{h.date} · {h.name} · {h.outcome === "fulfilled" ? "이행" : h.outcome === "missed" ? "미이행" : h.outcome === "departed" ? "소속 종료" : "철회"} · 선발 {h.starts}/{h.target} · 신뢰 {h.trust >= 0 ? "+" : ""}{h.trust}</p>)}</details>}
  </Card>;
}
export function AppearanceReview({ record, side }: { record?: AppearanceRecord; side: "B" | "R" }) {
  const s = useSave()!;
  const entries = record?.[side] ?? [];
  if (!record) return s.mode === "story" ? <p className="muted sm" data-testid="appearance-no-record">출전·경기 피로 기록 없음 · 이전 경기를 소급 계산하지 않습니다.</p> : null;
  return <div className="sm" data-testid="appearance-review"><b>경기 당시 출전·피로</b>{entries.map(p => <p key={p.person}>{p.name} · {p.first ? "첫 세트 선발" : "세트 출전"} · 경기 피로 +{p.load.toFixed(2)} ({p.before.toFixed(1)} → {p.after.toFixed(1)})</p>)}</div>;
}
