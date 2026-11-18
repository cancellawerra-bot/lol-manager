import { useSave, setTacticPlan } from "../store";
import { POS_KO } from "../data";
import type { DraftState, Side } from "../game/draft";
import { FOCUS_LABEL, TEMPO_LABEL, TEMPO_NOTE, normalizeTactic, recommendTactic, tacticAllocation, tacticLabel, TACTIC_STAGE_LABEL, type Tempo, type Focus, type TacticsRecord } from "../game/tactics";

export function TacticsControls({ draft }: { draft?: DraftState }) {
  const s = useSave()!;
  const base = normalizeTactic(s.tactics?.[s.team]);
  const plan = normalizeTactic({ tempo: s.session?.meetPlan ?? base.tempo, focus: s.session?.meetFocus ?? base.focus });
  const locked = !!s.session && (!!s.session.result || ["sim", "pog", "result", "locker", "end"].includes(s.session.stage));
  const advice = draft ? recommendTactic(draft, draft.teams.B === s.team ? "B" : "R") : undefined;
  return <div data-testid="tactics-controls">
    <p className="muted sm">선택한 작전은 다음 경기와 자동 진행에도 사용합니다.</p>
    <h3>경기 운영 방향</h3>
    <div className="row wrap gap">{(Object.keys(TEMPO_LABEL) as Tempo[]).map((tempo) => <button disabled={locked} aria-pressed={plan.tempo === tempo} className={"btn " + (plan.tempo === tempo ? "primary" : "")} key={tempo} data-testid={`tactic-tempo-${tempo}`} onClick={() => setTacticPlan({ ...plan, tempo })}>{TEMPO_LABEL[tempo]}</button>)}</div>
    <p className="muted sm">{TEMPO_NOTE[plan.tempo]}</p>
    <h3>정글·팀 지원 방향</h3>
    <div className="row wrap gap">{(Object.keys(FOCUS_LABEL) as Focus[]).map((focus) => <button disabled={locked} aria-pressed={plan.focus === focus} className={"btn " + (plan.focus === focus ? "primary" : "")} key={focus} data-testid={`tactic-focus-${focus}`} onClick={() => setTacticPlan({ ...plan, focus })}>{FOCUS_LABEL[focus]}</button>)}</div>
    <p data-testid="tactic-allocation" className="sm">{tacticAllocation(plan)}</p>
    <p className="muted sm">지원에 집중한 만큼 다른 라인의 자원이 줄어듭니다. 탑은 유충 우세, 미드는 라인전 우세, 바텀은 첫 드래곤이 집중 목표입니다. 목표를 이루면 중후반 운영에 힘이 실리고 실패하면 부담이 남습니다. 수치는 게임 설정이며 승리를 보장하지 않습니다.</p>
    {advice && <details><summary>수석코치 추천: {tacticLabel(advice.plan)}</summary><ul className="sm">{advice.reasons.map((r) => <li key={r}>{r}</li>)}</ul><button className="btn" data-testid="delegate-tactics" disabled={locked} onClick={() => setTacticPlan(advice.plan)}>추천 적용</button><p className="muted sm">현재 선수 지표와 30판 이상 랭크 상성으로 계산한 게임용 조언입니다.</p></details>}
    {locked && <p className="muted sm">진행 중인 세트의 작전은 확정됐습니다. 다음 세트 준비 때 바꿀 수 있습니다.</p>}
  </div>;
}
const signed = (n: number, digits = 0): string => `${n >= 0 ? "+" : ""}${n.toFixed(digits)}`;
export function TacticsReview({ record, side }: { record?: TacticsRecord; side: Side }) {
  if (!record) return <p className="muted sm" data-testid="tactic-no-record">이 경기의 전술 기록 없음 · 이전 결과는 그대로 보존합니다.</p>;
  const sign = side === "B" ? 1 : -1, other = side === "B" ? "R" : "B", plan = record.plans[side];
  const objective = plan.focus === "top" ? "river" : plan.focus === "bot" ? "dragon" : undefined;
  const own = objective ? record.decisions.find((x) => x.stage === objective) : undefined;
  const label = record.teamNames[side];
  return <section className="card" data-testid="tactics-review">
    <div className="card-h"><h2>감독 작전 복기 · {label}</h2></div>
    <p><b>{tacticLabel(plan)}</b> · 상대 {tacticLabel(record.plans[other])}</p>
    <p className="sm">{TEMPO_NOTE[plan.tempo]}</p>
    <p className="sm">우리 지원 배분: {tacticAllocation(plan)}</p>
    <p className="sm" data-testid="tactic-observed">실제 14분 골드: {record.lanes15.map((n, i) => `${POS_KO[i]} ${signed(n * sign)}`).join(" / ")}</p>
    {plan.focus !== "balanced" && <p data-testid="tactic-execution">집중 목표: {record.execution[side].target} · {record.execution[side].success ? "달성 — 중후반 운영에 보탬" : "미달성 — 중후반 운영 부담"}</p>}
    {own && <p>{TACTIC_STAGE_LABEL[own.stage]}은 {own.winner === side ? `${label} 확보` : `${record.teamNames[other]} 확보`}. {own.winner === side ? "계획한 방향의 초반 오브젝트를 가져왔습니다." : "지원 계획이 있어도 확보로 이어지지는 않았습니다."}</p>}
    <div className="table-wrap"><table className="tbl compact"><thead><tr><th>판정</th><th>전술 직접 보정</th><th>실제 결과</th></tr></thead><tbody>{record.decisions.map((x) => <tr key={x.stage}><td>{TACTIC_STAGE_LABEL[x.stage]}</td><td>{signed((x.after - x.before) * 100 * sign, 2)}%p</td><td>{record.teamNames[x.winner]}</td></tr>)}</tbody></table></div>
    <p className="muted xs">직접 보정은 해당 판정 순간에 전술 보정을 뺐을 때와 비교한 확률 차이입니다. 전체 승률 증가량이나 단독 승리 원인이 아닙니다. 라인 골드 배분에는 상대 전술도 반영되며 선수 기량·밴픽·훈련·경기 흐름이 함께 작용합니다.</p>
  </section>;
}
