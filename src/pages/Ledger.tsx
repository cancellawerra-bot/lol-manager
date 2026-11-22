import type { Save } from "../game/season";
import { projectLedger, type LedgerExtra } from "../game/ledger";
import { fmtMoney } from "../game/money";
import { Card } from "../ui";

const signed = (n: number): string => `${n >= 0 ? "+" : "−"}${fmtMoney(Math.abs(n))}`;

// 예상 장부(영수증 모양): 결정하기 전에 다음 시즌 시작 잔고를 미리 보여 줍니다. 스토리 모드 전용.
export default function Ledger({ s, extras = [], title = "예상 장부", className }: { s: Save; extras?: LedgerExtra[]; title?: string; className?: string }) {
  const l = projectLedger(s, extras);
  if (!l) return null;
  return (
    <Card title={title} className={className} right={<span className="muted sm">현재 계약·순위 기준 추정</span>}>
      <div className="ledger" data-testid="ledger">
        <div className="lg-row"><span>지금 잔고</span><b>{fmtMoney(l.start)}</b></div>
        {l.lines.map((x) => (
          <div key={x.label} className="lg-row"><span>{x.label}{x.note && <small> · {x.note}</small>}</span><b className={x.amount < 0 ? "neg" : "pos"}>{signed(x.amount)}</b></div>
        ))}
        {l.extras.filter((x) => x.amount > 0).map((x) => (
          <div key={x.label} className="lg-row new"><span>{x.label}</span><b className="neg">{signed(-x.amount)}</b></div>
        ))}
        <div className={"lg-row total" + (l.end < 0 ? " bad" : "")}><span>{l.incomeLeft ? "다음 시즌 시작 예상 잔고" : "다음 시즌 시작 예상 잔고(수입은 이미 반영)"}</span><b data-testid="ledger-end">{fmtMoney(l.end)}</b></div>
      </div>
      {l.warn && <p className={"ledger-warn " + l.warn.level} data-testid="ledger-warn">{l.warn.text}</p>}
      <p className="muted xs">성적이 지금과 같다고 가정한 추정이며, 올해 끝에 만료되는 계약은 새로 정해야 해서 빠져 있습니다. 모든 금액은 게임용 가상 금액입니다.</p>
    </Card>
  );
}
