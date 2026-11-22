import { CH, CHAMPS, PL, POS_KO } from "../data";
import { useSave, mutate, fillSchedule } from "../store";
import { Card, PName } from "../ui";
import type { DayAct, Save } from "../game/season";
import { playable, comfort, PRACTICE_PER_GAME } from "../game/draft";
import { masteryOf } from "../game/mastery";
import { WEEKLY_POINTS } from "../game/training";
import { playerTraining, previewWeek, setChampFocus, setTrainingPlan, trainingPlan } from "../game/trainingRuntime";

// 스토리 모드 선수단 일정표(v2.34.0): 칸마다 선택창(피지컬·전략·챔피언·휴식·미정). 맨 위 「전원」 줄에서 요일별로 모든 선수를 한 번에 바꿀 수 있고,
// 줄마다 훈련 일수·예상 피로(게임이 실제로 처리하는 계산을 미리 돌린 값)와 연습 챔피언을 보여 줍니다.
const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const OPTIONS: { id: DayAct; t: string }[] = [{ id: "train", t: "피지컬" }, { id: "scrim", t: "전략" }, { id: "champ", t: "챔피언" }, { id: "rest", t: "휴식" }, { id: "", t: "미정" }];
const PRESETS: { id: string; t: string; plan: DayAct[]; note: string }[] = [
  { id: "bal", t: "균형 주간", plan: ["train", "scrim", "champ", "rest", "train", "scrim", "rest"], note: "피지컬 2·전략 2·챔피언 1, 휴식 2일" },
  { id: "match", t: "경기 대비 주간", plan: ["scrim", "champ", "champ", "scrim", "champ", "rest", "rest"], note: "전략·챔피언 위주, 주말 휴식" },
  { id: "recover", t: "회복 주간", plan: ["rest", "scrim", "rest", "train", "rest", "scrim", "rest"], note: "훈련 3일, 휴식 4일" },
  { id: "champ", t: "챔피언 집중 주간", plan: ["champ", "champ", "champ", "rest", "champ", "champ", "rest"], note: "연습 챔피언 숙련 집중(주 5점 모두 사용)" },
];

/** 포지션에서 많이 쓰이는 챔피언 순으로 연습 후보를 보여 줍니다. */
function champOptions(pos: number): { id: string; ko: string }[] {
  return CHAMPS.filter((c) => playable(c, pos)).sort((a, b) => (b.proPos?.[pos] ?? 0) - (a.proPos?.[pos] ?? 0) || a.ko.localeCompare(b.ko, "ko")).map((c) => ({ id: c.id, ko: c.ko }));
}

function applyPlans(x: Save, plans: Record<string, DayAct[]>): void {
  for (const [k, plan] of Object.entries(plans)) {
    setTrainingPlan(x, k, plan, false);
    // 챔피언 칸이 처음 생기는 선수는 그 포지션에서 많이 쓰이는 챔피언을 연습 챔피언으로 임시 지정합니다(바꿀 수 있음).
    if (plan.includes("champ") && !playerTraining(x, k)?.champFocus) {
      const pos = PL[k]?.pos ?? 0; const first = champOptions(pos)[0];
      if (first) setChampFocus(x, k, first.id);
    }
  }
  const people = x.starters[x.team] ?? [];
  x.schedOk = people.every((p) => { const plan = trainingPlan(x, p); return plan.length === 7 && plan.every(Boolean) && plan.includes("rest"); });
}

export default function ScheduleGrid() {
  const s = useSave()!;
  const keys = (s.starters[s.team] ?? []).filter(Boolean);
  const plans = (k: string): DayAct[] => trainingPlan(s, k);
  const setCell = (k: string, d: number, a: DayAct): void => mutate((x) => { const row = trainingPlan(x, k); row[d] = a; applyPlans(x, { [k]: row }); });
  /** 한 요일을 모든 선수에게 한 번에 */
  const setDay = (d: number, a: DayAct): void => mutate((x) => {
    const upd: Record<string, DayAct[]> = {};
    for (const k of keys) { const row = trainingPlan(x, k); row[d] = a; upd[k] = row; }
    applyPlans(x, upd);
  });
  const setAll = (plan: DayAct[]): void => mutate((x) => { const upd: Record<string, DayAct[]> = {}; for (const k of keys) upd[k] = [...plan]; applyPlans(x, upd); });
  const dayValue = (d: number): string => { const v = new Set(keys.map((k) => plans(k)[d])); return v.size === 1 ? [...v][0] : "mixed"; };
  return (
    <Card title="선수단 일정" right={<button className="btn sm" data-testid="delegate-sched" onClick={() => fillSchedule()}>수석코치에게 맡기기</button>}>
      <p className="muted sm">한 주에 하루는 휴식으로 두세요. 빈 칸이 있거나 휴식이 없으면 경기를 진행할 수 없습니다. 한 번 정하면 매주 같은 패턴이 이어집니다. 맨 위 <b>「전원」</b> 줄에서 요일을 고르면 모든 선수가 한 번에 바뀝니다. 훈련은 한 주에 최대 {WEEKLY_POINTS}번(피지컬·전략·챔피언이 같은 점수를 나눠 씁니다)이고, 넘기면 과훈련(성장 없음·피로 3배)입니다.</p>
      <div className="sg-tools" data-testid="sched-presets">{PRESETS.map((p) => <button key={p.id} className="btn sm" title={p.note} data-testid={"preset-" + p.id} onClick={() => setAll(p.plan)}>{p.t}</button>)}</div>
      <div className="tbl-wrap">
        <table className="tbl sched-grid" data-testid="sched-grid">
          <thead><tr><th>선수</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
          <tbody>
            <tr className="sg-all" data-testid="sched-all">
              <td><b>전원</b> <small className="muted">요일별 한 번에</small></td>
              {DAYS.map((d, i) => (
                <td key={d}>
                  <select value={dayValue(i)} aria-label={`${d}요일 전원 활동`} data-testid={`day-all-${i}`} style={{ minWidth: 82 }} onChange={(e) => { if (e.target.value !== "mixed") setDay(i, e.target.value as DayAct); }}>
                    <option value="mixed" disabled>선택…</option>
                    {OPTIONS.map((o) => <option key={o.id || "e"} value={o.id}>{o.t}</option>)}
                  </select>
                </td>
              ))}
            </tr>
            {keys.map((k, i) => {
              const plan = plans(k), tr = playerTraining(s, k), pv = previewWeek(s, k, plan);
              const focus = tr?.champFocus, days = focus ? tr?.champs?.[focus] ?? 0 : 0;
              const cf = focus ? comfort(PL[k], focus, days) : undefined;
              return (
                <tr key={k} data-testid={`sched-row-${i}`}>
                  <td className="sg-name">
                    <div><small className="muted">{POS_KO[i]}</small> <PName k={k} /></div>
                    <select className="sg-focus" aria-label={`${PL[k]?.name ?? k} 연습 챔피언`} value={focus ?? ""} onChange={(e) => mutate((x) => setChampFocus(x, k, e.target.value))}>
                      <option value="">연습 챔피언 정하기</option>
                      {champOptions(PL[k]?.pos ?? i).map((c) => <option key={c.id} value={c.id}>{c.ko}</option>)}
                    </select>
                    {focus && <small className="muted">{CH[focus]?.ko} 연습 {days}일{cf && cf.n > 0 ? ` · ${masteryOf(cf.n).ko}(${cf.base}경기 + 연습 ${cf.bonus}경기 상당)` : ""}</small>}
                    {pv && <div className="sg-sum">
                      <div className="sg-line"><span className="gauge"><i style={{ width: `${Math.min(100, pv.trainDays / WEEKLY_POINTS * 100)}%`, background: pv.trainDays > WEEKLY_POINTS ? "var(--bad)" : undefined }} /></span> 훈련 {pv.trainDays}/{WEEKLY_POINTS}일
                        <span className="sg-bars" aria-label="앞으로 7일 예상 피로">{pv.days.map((d, j) => <i key={j} title={`${j + 1}일 뒤 피로 ${Math.round(d.fatigue)}`} className={d.fatigue >= 60 ? "vh" : d.fatigue >= 40 ? "hi" : ""} style={{ height: `${Math.max(8, d.fatigue)}%` }} />)}</span> <small className="muted">최고 {pv.maxFatigue}</small></div>
                      {pv.overDays > 0 && <small className="neg">과훈련 {pv.overDays}일</small>}
                      {pv.needFocus && <small className="neg" data-testid="need-focus">연습 챔피언을 정해 주세요</small>}
                    </div>}
                  </td>
                  {plan.map((a, d) => (
                    <td key={d}>
                      <select value={a} aria-label={`${PL[k]?.name ?? k} ${DAYS[d]}요일 훈련`} style={{ minWidth: 82 }} onChange={(e) => setCell(k, d, e.target.value as DayAct)}>
                        {OPTIONS.map((o) => <option key={o.id || "e"} value={o.id}>{o.t}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p className="muted xs">피지컬 = 교전·압박(손) 성장 · 전략 = 판단·운영(머리) 성장 · 챔피언 = 정한 챔피언의 숙련을 쌓음(연습 {PRACTICE_PER_GAME}일 = 1경기 상당, 경기의 챔피언 숙련도 보정에 반영) · 휴식 = 피로 회복. 예상 피로 막대는 지금 상태에서 앞으로 7일을 이 일정대로 보낼 때의 값이며 실제 처리와 같은 계산입니다. 요일표는 좌우로 넘겨 볼 수 있습니다.</p>
      <p className={s.schedOk ? "ok sm" : "err sm"}>{s.schedOk ? "일정이 준비되었습니다." : "빈 칸을 채우고, 선수마다 휴식일을 하루 이상 두거나 수석코치에게 맡겨 확정해 주세요."}</p>
    </Card>
  );
}
