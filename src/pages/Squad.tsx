import { POS_KO, PL } from "../data";
import { useSave, mutate, fillSchedule, setStarter } from "../store";
import { Card, PName, Ovr } from "../ui";
import type { DayAct } from "../game/season";
import { playerTraining, trainingPlan, trainingPerson, trainingDate, setTrainingPlan, trainedRatingOf } from "../game/trainingRuntime";
import { trainingProfile, trainingBonuses, fatiguePenalty, WEEKLY_POINTS } from "../game/training";
import { ratingColor } from "../rating";
import { PLAYER_BIRTHDATES } from "../game/playerBirthdates";
import { RotationControls } from "./Rotation";
import { TalkControls } from "./Talks";
import ScheduleGrid from "./ScheduleGrid";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];
const ACT: { id: DayAct; t: string }[] = [{ id: "train", t: "훈련" }, { id: "scrim", t: "스크림" }, { id: "rest", t: "휴식" }, { id: "", t: "미정" }];

export default function Squad() {
  const s = useSave()!;
  const keys = s.starters[s.team] ?? [];
  const story = s.mode === "story";
  const date = trainingDate(s);
  const plans = (k: string): DayAct[] => story ? trainingPlan(s, k) : s.sched[k] ?? ["", "", "", "", "", "", ""];
  const all = [...keys, ...((s.mode === "roster" ? [] : s.cards.filter((k) => !keys.includes(k))))];
  const setAct = (k: string, d: number, a: DayAct): void => {
    mutate((x) => {
      const row = story ? trainingPlan(x, k) : [...(x.sched[k] ?? ["", "", "", "", "", "", ""])];
      row[d] = a; setTrainingPlan(x, k, row);
      const people = x.starters[x.team] ?? [];
      x.schedOk = people.every((p) => { const plan = story ? trainingPlan(x, p) : x.sched[p] ?? []; return plan.length === 7 && plan.every(Boolean) && plan.includes("rest"); });
    });
  };
  return (
    <div className="col gap">
      <RotationControls />
      <TalkControls />
      {story && <ScheduleGrid />}
      {!story && <Card title="선수단 일정" right={<button className="btn sm" data-testid="delegate-sched" onClick={() => fillSchedule()}>수석코치에게 맡기기</button>}>
        <p className="muted sm">한 주에 하루는 휴식으로 두세요. {story ? "피지컬 훈련·스크림·휴식을 현재 날짜에 맞춰 처리합니다. 수석코치에게 맡기면 나이에 맞춘 계획을 자동 배정합니다." : "빈 칸이 있거나 휴식이 없으면 경기를 진행할 수 없습니다. 한 번 정하면 매주 같은 패턴이 이어집니다."}</p>
        <div className="tbl-wrap">
          <table className="tbl sched-grid">
            <thead><tr><th>선수</th>{DAYS.map((d) => <th key={d}>{d}</th>)}</tr></thead>
            <tbody>
              {keys.map((k, i) => (
                <tr key={k}>
                  <td><small className="muted">{POS_KO[i]}</small> <PName k={k} /></td>
                  {plans(k).map((a, d) => (
                    <td key={d}>
                      <select value={a} aria-label={`${PL[k]?.name ?? k} ${DAYS[d]}요일 훈련`} style={story ? { minWidth: 82 } : undefined} onChange={(e) => setAct(k, d, e.target.value as DayAct)}>
                        {ACT.map((x) => <option key={x.id || "e"} value={x.id}>{story && x.id === "train" ? "피지컬" : story && x.id === "scrim" ? "스크림" : x.t}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {story && <p className="muted xs">요일표를 좌우로 넘겨 모든 요일의 계획을 확인할 수 있습니다.</p>}
        <p className={s.schedOk ? "ok sm" : "err sm"}>{s.schedOk ? "일정이 준비되었습니다." : story ? "권장 계획을 변경하거나 수석코치에게 맡겨 확정해 주세요. 선수마다 휴식일이 하나 이상 필요합니다." : "빈 칸을 채우고, 선수마다 휴식일을 하나 이상 넣어 주세요."}</p>
        <p className="muted xs">이 모드의 일정은 한 주에 휴식을 하루 이상 두었는지 확인하는 용도이며, 경기와 성장에는 영향이 없습니다. 훈련·성장·챔피언 연습은 스토리 모드에서 작동합니다.</p>
      </Card>}
      {story && <Card title="선수 성장 · 훈련과 회복" right={<span className="muted sm">다음 일정 {date}</span>}>
        <p className="muted sm">훈련 성장은 선수 개인에게 쌓이고 시즌이 바뀌어도 유지됩니다(원본 시즌 기록·연봉과 별개인 게임 효과). 피지컬 훈련은 교전·압박(손으로 실행), 스크림(팀 연습경기)과 출전 경험은 판단·운영(뇌지컬)을 올립니다. 모든 선수가 100까지 키울 수 있습니다. 다만 능력치가 높을수록 천천히 올라 한 시즌 만에는 닿지 않고, 재능(커리어 최고 기록)은 성장 속도에만 영향을 줍니다(최상위 약 4시즌, 80대 초반 약 8시즌). 한 주 훈련은 5포인트까지 성장에 반영되고, 넘으면 피로만 크게 쌓여 컨디션이 떨어집니다. 어린 선수는 피지컬이 빨리 오르고, 25세부터는 한 주에 피지컬 훈련을 2번 미만 하면 피지컬이 조금씩 내려갑니다(꾸준히 훈련하면 막을 수 있음).</p>
        <div className="card-grid" data-testid="training-roster">{[...new Map([...keys, ...(s.story?.contracts.map((c) => c.key) ?? [])].map((k) => [trainingPerson(s, k), k])).values()].map((k) => {
          const person = trainingPerson(s, k), p = playerTraining(s, k); if (!person || !p) return null;
          const birth = PLAYER_BIRTHDATES[person], profile = trainingProfile(birth, date), bonus = trainingBonuses(p), tr = trainedRatingOf(s, k);
          return <div className="card-tile" key={person} data-testid={`training-${person}`}>
            <b>{PL[k]?.name ?? person}</b><div className="muted sm">{profile.known ? `만 ${profile.age}세` : "생년 정보 없음 · 나이 보정 없음"}</div>
            {tr && <p className="sm" data-testid={`trained-${person}`}>능력치 <b style={{ color: ratingColor(tr.overall) }}>{tr.overall}</b> · 피지컬 {tr.phys.toFixed(1)} · 뇌지컬 {tr.brain.toFixed(1)}</p>}
            <p className="sm">이번 주 훈련 {p.weekPts ?? 0} / {WEEKLY_POINTS}포인트{(p.overDays ?? 0) > 0 ? ` · 과훈련 ${p.overDays}일` : ""}<br />피로 {p.fatigue.toFixed(1)} / 100{p.fatigue >= 60 ? " · 컨디션 저하" : ""}</p>
            <div className="xs muted">학습 효율: 피지컬 {profile.mechanics.toFixed(2)}배 · 뇌지컬 {profile.strategy.toFixed(2)}배 · 회복 {profile.recovery.toFixed(2)}배<br />피로 누적 {profile.fatigueLoad.toFixed(2)}배</div>
            <div className="xs muted">반영 기준: {p.lastDate ?? "훈련 시작 전"}</div>
            <p className="sm">경기 보정: 피지컬 +{(bonus.mechanics * 100).toFixed(2)}% · 뇌지컬 +{(bonus.strategy * 100).toFixed(2)}% · 피로 −{(fatiguePenalty(p.fatigue) * 100).toFixed(2)}%</p>
            {birth && <a className="xs" href={birth.sourceUrl} target="_blank" rel="noreferrer">생년 자료 출처</a>}
          </div>;
        })}</div>
        <p className="muted xs">진행하기를 누르면 해당 경기 날짜까지 훈련을 처리합니다. 자동 관리는 피로 60 이상이면 훈련을 휴식으로 조정합니다. 보정값은 승률이 아닙니다. 같은 날짜는 한 번만 처리하며 화면을 다시 열거나 불러와도 훈련을 중복 획득하지 않습니다. 생년이 확인된 선수만 나이 보정합니다.</p>
      </Card>}
      <Card title="선발 라인업">
        <div className="tbl-wrap">
        <table className="tbl">
          <thead><tr><th>포지션</th><th>선수</th><th>종합</th><th>교체</th></tr></thead>
          <tbody>
            {keys.map((k, i) => {
              const p = PL[k];
              const opts = all.filter((x) => PL[x]?.pos === i || x === k);
              return (
                <tr key={k}>
                  <td>{POS_KO[i]}</td>
                  <td><PName k={k} /> {p?.small && <span className="tag warn">표본 부족</span>}</td>
                  <td><Ovr p={p} /></td>
                  <td>{opts.length > 1 && <select disabled={!!s.session && !["press", "lineup"].includes(s.session.stage)} value={k} onChange={(e) => setStarter(s.team, i, e.target.value)}>{opts.map((x) => <option key={x} value={x}>{PL[x]?.label ?? PL[x]?.name ?? x}</option>)}</select>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      </Card>
    </div>
  );
}
