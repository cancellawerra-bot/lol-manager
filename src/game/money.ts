/** 게임용 가상 금액 표시. 1억 미만은 만원 단위(예: 3,500만). */
export function fmtMoney(n: number): string {
  const v = Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;
  if (v === 0) return "0억";
  if (Math.abs(v) < 1) {
    const man = Math.round(v * 10000);
    return `${man.toLocaleString("ko-KR")}만`;
  }
  const dec = Math.abs(v % 1) < 1e-9 ? 0 : (Math.abs(Math.round(v * 10) - v * 10) < 1e-9 ? 1 : 2);
  return `${v.toLocaleString("ko-KR", { maximumFractionDigits: dec, minimumFractionDigits: dec })}억`;
}

export const moneyRound = (n: number, places = 2): number => {
  const f = 10 ** places;
  return Math.round(n * f) / f;
};
