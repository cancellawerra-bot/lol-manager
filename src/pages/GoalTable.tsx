import type { Save } from "../game/season";
import { GOALS, GOAL_RULE, goalStatus } from "../game/goals";
import { fmtMoney } from "../game/money";
import { Card } from "../ui";

// 시즌 목표 표: 구단주가 시즌 끝에 실제로 적용하는 보상·벌칙만 보여 줍니다.
export default function GoalTable({ s }: { s: Save }) {
  if (s.story) {
    return (
      <Card title="구단주 평가 규칙">
        <p className="sm">스토리 모드에서는 시즌 목표를 달성했는지로 신뢰나 보너스가 바뀌지 않습니다. 구단주 신뢰는 <b>연봉 정산 뒤 잔고가 0 아래일 때</b> −15 줄어들고, 적자가 2년 이어지고 신뢰가 20 이하가 되면 해임·파산으로 끝납니다.</p>
        <p className="muted sm">그래서 이 모드에서는 「예상 장부」로 다음 시즌 잔고를 미리 보고 계약을 정하는 것이 가장 중요합니다.</p>
      </Card>
    );
  }
  const st = goalStatus(s);
  const mine = s.eco.goal;
  const tone = { ok: "good", risk: "warn", fail: "bad", wait: "" }[st.state];
  return (
    <Card title="시즌 목표" right={<span className="muted sm">구단주 신뢰 {s.eco.trust}</span>}>
      <div className="tbl-wrap">
        <table className="tbl goal-tbl" data-testid="goal-table">
          <thead><tr><th>목표</th><th>달성 조건</th><th>달성하면</th><th>못 하면</th></tr></thead>
          <tbody>
            {GOALS.map((g) => (
              <tr key={g.id} className={g.id === mine ? "me" : ""}>
                <td><b>{g.t}</b>{g.id === mine && <span className="tag good"> 우리 목표</span>}</td>
                <td>{GOAL_RULE[g.id]}</td>
                <td>보너스 +{fmtMoney(g.bonus)} · 신뢰 +{g.win}</td>
                <td>신뢰 −{g.hit}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className={"goal-now " + tone} data-testid="goal-status"><b>지금 상태</b> · {st.text}</p>
      <p className="muted xs">보너스는 시즌이 끝날 때 한 번 자금에 더해지고, 신뢰는 그때 함께 바뀝니다. 목표를 중간에 바꿀 수는 없습니다.</p>
    </Card>
  );
}
