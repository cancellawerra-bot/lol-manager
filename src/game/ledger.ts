// 예상 장부: 스토리 모드에서 "지금 계약을 하면 다음 시즌 시작 때 잔고가 얼마가 되는지"를 미리 계산합니다.
// 실제 정산(payIncome·settlePayrollAndSolvency)과 같은 공식을 쓰되, 성적은 지금 순위가 끝까지 이어진다고 가정한 추정입니다.
import type { Save } from "./season";
import { standings } from "./season";
import { goodsIncomeEstimate } from "./marketing";
import { sponsorBonus, CK_OPS, LCK_OPS, LCK_SHARE, LCK_SHARE_PRE, LCK_SPONSOR, lckPrizeOf } from "./story";
import { moneyRound } from "./money";

export interface LedgerExtra { label: string; amount: number }
export interface LedgerLine { label: string; amount: number; note?: string }
export interface Ledger {
  start: number;
  lines: LedgerLine[];
  extras: LedgerExtra[];
  end: number;
  incomeLeft: boolean;
  warn?: { level: "bad" | "warn"; text: string };
}

const STOVE_PHASES = ["awards", "tryout", "expiry", "stove"];

/** extras: 지금 고민 중인 계약·입찰 비용(양수). 없으면 현재 상태만 계산합니다. */
export function projectLedger(s: Save, extras: LedgerExtra[] = []): Ledger | null {
  const st = s.story;
  if (!st) return null;
  const incomeLeft = !STOVE_PHASES.includes(st.phase);   // 스토브리그에서는 이번 시즌 수입이 이미 들어온 뒤입니다.
  const lines: LedgerLine[] = [];
  if (incomeLeft) {
    const rows = standings(s);
    const idx = rows.findIndex((r) => r.t === s.team);
    const played = idx >= 0 && rows[idx].w + rows[idx].l > 0;   // 경기를 치르기 전의 순위는 의미가 없습니다
    const rank = st.lastRank || (played ? idx + 1 : 0);
    const lck = st.tier === "LCK";
    const prize = lck ? lckPrizeOf(rank) : ([0.7, 0.45, 0.3, 0.15][Math.min(Math.max((rank || 4) - 1, 0), 3)]);
    const share = lck ? (st.franchised ? LCK_SHARE : LCK_SHARE_PRE) : 0;
    const cur = s.eco.sponsor?.amount;
    const sp = lck ? ((cur ?? 0) < 15 ? LCK_SPONSOR : cur!) : (cur ?? 0.5);
    const ops = lck ? LCK_OPS : CK_OPS;
    const rankTxt = rank ? `${rank}위 기준` : "순위 미정 · 최하위 기준(보수적)";
    lines.push({ label: "시즌 상금", amount: prize, note: rankTxt });
    if (share) lines.push({ label: st.franchised ? "프랜차이즈 배분" : "LCK 중계 배분", amount: share });
    lines.push({ label: "스폰서", amount: sp });
    lines.push({ label: "운영비", amount: -ops });
    const sb = sponsorBonus(s, rank);
    if (sb) lines.push({ label: "스폰서 목표 보너스", amount: sb.hit ? sb.amount : 0, note: `${sb.goal} · ${sb.hit ? "현재 순위 기준 달성" : `미달성 시 0 (달성하면 +${sb.amount})`}` });
    const gi = goodsIncomeEstimate(s, rank);
    if (gi > 0) lines.push({ label: "굿즈 판매 수입(예상)", amount: gi, note: "제작비는 이미 지출 · 현재 순위 기준" });
    if (st.history?.support && lck) lines.push({ label: "모기업 지원", amount: st.history.support, note: `구단 규모 ${st.history.grade}등급` });
  }
  // 다음 시즌까지 이어지는 계약의 연봉(이번 시즌 끝에 계약 햇수가 1 줄어듭니다)
  const keep = st.contracts.filter((c) => c.years >= (incomeLeft ? 2 : 1) && c.salary > 0);
  const pay = moneyRound(keep.reduce((n, c) => n + c.salary, 0));
  lines.push({ label: "다음 시즌 연봉", amount: -pay, note: `이어지는 계약 ${keep.length}명` });
  const extra = moneyRound(extras.reduce((n, e) => n + e.amount, 0));
  const start = s.eco.cash;
  const end = moneyRound(start + lines.reduce((n, l) => n + l.amount, 0) - extra);
  let warn: Ledger["warn"];
  if (end < 0) warn = { level: "bad", text: "예상 잔고가 0 아래입니다. 연봉 정산 때 적자면 벤치·고연봉 선수가 강제 매각되고 구단주 신뢰가 −15 됩니다." };
  else if (end < 2) warn = { level: "warn", text: "예상 잔고가 2억 미만입니다. 정산 뒤 잔고가 2억 미만이면 구단주 주의 경고가 뜨고, 적자가 쌓이면 해임·파산 위험이 있습니다." };
  return { start, lines, extras, end, incomeLeft, warn };
}
