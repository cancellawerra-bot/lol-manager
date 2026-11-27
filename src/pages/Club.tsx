import { useEffect } from "react";
import { CARDS, CARDS_FILE, PL, POS_KO, TM, recTxt, fmt } from "../data";
import { useSave } from "../store";
import { fantasyPrice, rosterSalary } from "../game/cards";
import { fmtMoney } from "../game/money";
import { Card, PName, Ovr, TeamChip } from "../ui";
import { standings } from "../game/season";
import ClubTimeline from "./ClubTimeline";
import GoalTable from "./GoalTable";
import Ledger from "./Ledger";
import TrophyCase from "./TrophyCase";
import { MarketingCard } from "./Marketing";
import { staffPayroll } from "../game/staff";

export default function Club() {
  const s = useSave()!;
  const t = TM[s.team];
  const keys = s.starters[s.team] ?? [];
  const bench = s.cards.filter((k) => !keys.includes(k));
  const rows = standings(s);
  const me = rows.find((r) => r.t === s.team);
  const payOf = (k: string): number | undefined => {
    const ct = s.story?.contracts.find((c) => c.key === k || c.cardId === k);
    if (ct) return ct.salary;
    const c = CARDS[k];
    return c ? (s.mode === "fantasy" ? fantasyPrice(c) : c.salary) : undefined;
  };
  const sal = s.story || s.mode === "fantasy"
    ? [...keys, ...bench].reduce((n, k) => n + (payOf(k) ?? 0), 0)
    : rosterSalary(s.cards.length ? s.cards : keys);

  useEffect(() => {
    const sub = location.hash.replace(/^#\/?/, "").split("/")[1];
    if (sub !== "marketing") return;
    const el = document.getElementById("club-marketing");
    const t = window.setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, [location.hash]);
  return (
    <div className="col gap">
      <Card title="구단 개요" right={<TeamChip t={s.team} full />}>
        <p>{t?.ko} · {s.manager} 감독{s.managerInfo?.career ? ` · ${{ amateur: "비선수 출신", academy: "전 프로 2군 출신", pro: "전 프로 1군 출신", worlds: "전 월드 우승자 출신" }[s.managerInfo.career]}` : ""}{s.club?.replaced ? ` · ${s.club.replaced} 자리를 대신한 창단 구단` : s.club ? " · 신생 구단" : ""}</p>
        <div className="facts">
          <li><b>{me ? `${me.w}승 ${me.l}패` : "–"}</b><span>정규 전적</span></li>
          <li><b>{s.eco.trust}</b><span>구단주 신뢰</span></li>
          <li><b>{s.eco.fans}</b><span>팬심</span></li>
          <li><b>{fmtMoney(s.eco.cash)}</b><span>자금 (한도 {fmtMoney(s.eco.cap)})</span></li>
        </div>
        {s.eco.sponsor && <p className="sm">스폰서 {s.eco.sponsor.name} 연 {fmtMoney(s.eco.sponsor.amount)} · 목표 {s.eco.sponsor.goal}{!s.story && <> · 시즌 시작 때 자금에 더해졌습니다</>}</p>}
        <p className="muted xs">{CARDS_FILE.meta.salaryNote}</p>
      </Card>
      <TrophyCase s={s} />
      <p className="row gap wrap"><a className="btn" href="#/club/staff" data-testid="club-staff">코칭스태프</a><a className="btn" href="#/report" data-testid="club-report">지금까지 수업 보고서</a></p>
      {s.story && <Ledger s={s} />}
      <div id="club-marketing" data-testid="club-marketing"><MarketingCard /></div>
      {s.story && <ClubTimeline />}
      <Card title="선수 기록">
        <div className="tbl-wrap">
          <table className="tbl">
            <thead><tr><th>선수</th><th>포지션</th><th>경기</th><th>KDA</th><th>승률</th><th>GD@15</th><th>DPM</th><th>종합</th><th>연봉</th></tr></thead>
            <tbody>
              {[...keys, ...bench].map((k) => {
                const p = PL[k]; const c = CARDS[k];
                if (!p) return null;
                return (
                  <tr key={k}>
                    <td><PName k={k} /> {p.small && <span className="tag warn">표본 부족</span>}{p.limited && <span className="tag">지표 제한</span>}</td>
                    <td>{POS_KO[p.pos]}</td>
                    <td>{p.games}</td>
                    <td>{c ? recTxt(c.kda, (n) => n.toFixed(2)) : p.m.kda.toFixed(2)}</td>
                    <td>{c ? recTxt(c.wr, (n) => `${(n * 100).toFixed(1)}%`) : `${((p.wins / Math.max(1, p.games)) * 100).toFixed(1)}%`}</td>
                    <td>{c ? recTxt(c.gd15, (n) => (n >= 0 ? "+" : "") + fmt(n, 0)) : recTxt(p.m.gd, (n) => (n >= 0 ? "+" : "") + fmt(n, 0))}</td>
                    <td>{c ? recTxt(c.dpm, (n) => fmt(n, 0)) : recTxt(p.m.dpm || null, (n) => fmt(n, 0))}</td>
                    <td><Ovr p={p} /></td>
                    <td>{payOf(k) != null ? fmtMoney(payOf(k)!) : "–"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="muted sm">연봉 합 {fmtMoney(sal)}. 없는 지표는 기록 없음이며 0으로 채우지 않았습니다.</p>
      </Card>
      <GoalTable s={s} />
      <Card title="예산">
        <ul className="sm">
          <li>한도 {fmtMoney(s.eco.cap)} ({({ easy: "쉬움", normal: "보통", hard: "어려움" } as const)[s.eco.difficulty]})</li>
          <li>선수 연봉 {fmtMoney(sal)}{staffPayroll(s) ? ` · 스태프 연봉 ${fmtMoney(staffPayroll(s))}` : ""} · 보유 자금 {fmtMoney(s.eco.cash)}</li>
        </ul>
      </Card>
    </div>
  );
}
