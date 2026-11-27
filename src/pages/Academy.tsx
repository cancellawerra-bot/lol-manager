import { useEffect, useState } from "react";
import { useSave, mutate } from "../store";
import { Card } from "../ui";
import { fmtMoney } from "../game/money";
import { addNews } from "../game/season";
import { ensureStartingFive } from "../game/story";
import { hiredOf } from "../game/staff";
import { trainedRatingOf } from "../game/trainingRuntime";
import { PL } from "../data";
import {
  ACADEMY_CALLUP_SALARY, ACADEMY_GROWTH_CAP, ACADEMY_LEVELS, ACADEMY_LEVEL_META, POS_KO,
  academyEffectLines, academyGrowthBoost, academyLevel, academyPayroll, academyProspects, academyTrained,
  callUpAcademy, callUpNews, demoteNews, demoteToAcademy, isAcademyActive, isMainSquad,
  markAcademyOfferSeen, setAcademyLevel, academyLevelNews,
  type AcademyLevel,
} from "../game/academy";

function setLevel(level: AcademyLevel | "off", setErr: (m: string) => void): void {
  mutate((s) => {
    const prev = academyLevel(s);
    const cash = s.eco.cash;
    const err = setAcademyLevel(s, level);
    if (err) { setErr(err); return; }
    setErr("");
    const due = moneyDue(cash, s.eco.cash);
    const news = academyLevelNews(level, prev, due);
    addNews(s, "season", news.title, news.body, s.team);
  });
}

function moneyDue(before: number, after: number): number {
  return Math.max(0, Math.round((before - after) * 100) / 100);
}

function callUp(key: string, setErr: (m: string) => void): void {
  mutate((s) => {
    const prosp = academyProspects(s).find((p) => p.key === key);
    const name = prosp?.name ?? PL[key]?.name ?? key;
    const firstVirtual = prosp?.origin === "virtual";
    const err = callUpAcademy(s, key);
    if (err) { setErr(err); return; }
    setErr("");
    const news = callUpNews(name, ACADEMY_CALLUP_SALARY, !!firstVirtual);
    addNews(s, "season", news.title, news.body, s.team);
  });
}

function demote(key: string, setErr: (m: string) => void): void {
  mutate((s) => {
    const name = PL[key]?.name ?? key;
    const err = demoteToAcademy(s, key);
    if (err) { setErr(err); return; }
    ensureStartingFive(s);
    setErr("");
    const news = demoteNews(name);
    addNews(s, "season", news.title, news.body, s.team);
  });
}

export default function Academy() {
  const s = useSave()!;
  const [err, setErr] = useState("");
  useEffect(() => { mutate((x) => { markAcademyOfferSeen(x); }); }, []);
  const lv = academyLevel(s);
  const active = isAcademyActive(s);
  const boost = academyGrowthBoost(s);
  const pay = academyPayroll(s);
  const coach = hiredOf(s, "acad");
  const bench = academyProspects(s);
  const mains = (s.story?.contracts ?? []).filter((c) => c.years > 0 && isMainSquad(c));
  return (
    <div className="staff-page academy-page" data-testid="academy-page">
      <Card title="2군 육성">
        <p className="muted sm">우리 구단의 2군(CL) 육성입니다. 가상 유망주는 「2군 탑 A」처럼 가상 이름만 쓰며 사진·실존 선수 발언·성격은 넣지 않습니다. 육성 비용은 게임용 가상 금액이며 지금 구단 자금에서 나갑니다. 육성하지 않으면 1군 승부·성장·경제는 기존과 같습니다. 2군에 있는 선수는 1군 선발·경기에 나가지 않고, 콜업한 뒤에만 라인업에 넣을 수 있습니다.</p>
        {err && <p className="err sm" data-testid="academy-error">{err}</p>}
        <div className="facts staff-facts academy-facts" data-testid="academy-effects">
          <li><b>{lv ? ACADEMY_LEVEL_META[lv].label : "미운영"}</b><span>육성 단계</span></li>
          <li><b>{pay ? fmtMoney(pay) : "없음"}</b><span>연간 육성비</span></li>
          <li><b>{fmtMoney(s.eco.cash)}</b><span>보유 자금</span></li>
          <li><b>{boost ? `×${boost.toFixed(2)}` : "기본"}</b><span>2군 성장 배율</span></li>
          <li><b>{coach ? coach.name : "공석"}</b><span>2군 감독</span></li>
          <li><b>{bench.length}명</b><span>2군 명단</span></li>
        </div>
        <p className="muted xs">성장 상한은 100, 배율 상한은 ×{ACADEMY_GROWTH_CAP.toFixed(2)}입니다. 역사 모드 약팀 성장 가속과 1군 훈련·밴픽은 그대로입니다. 판타지 드래프트 예산(90/85/80억)은 선수 선발용이며 여기 비용과 별개입니다. 단계를 낮추거나 멈춰도 이미 나간 비용은 돌아오지 않습니다. 2군 감독은 코칭스태프에서 고용하며, 효과는 2군 성장에만 더해집니다.</p>
      </Card>

      <Card title="육성 투자">
        <div className="staff-market" data-testid="academy-levels">
          {ACADEMY_LEVELS.map((id) => {
            const m = ACADEMY_LEVEL_META[id];
            const on = lv === id;
            const short = !on && (s.eco.cash < (on ? 0 : Math.max(0, m.salary - (s.academy?.prepaid && lv ? ACADEMY_LEVEL_META[lv].salary : 0))));
            return (
              <div key={id} className={`staff-card${on ? " on" : ""}`} data-testid={`academy-level-${id}`}>
                <p><b>{m.label}</b> <span className="muted">연 {fmtMoney(m.salary)}</span></p>
                <ul className="xs">{academyEffectLines(id, coach?.train ?? 1).map((l) => <li key={l}>{l}</li>)}</ul>
                <p className="muted xs">{m.blurb}</p>
                {on
                  ? <span className="muted sm">운영 중</span>
                  : <button className="btn sm primary" data-testid={`academy-set-${id}`} disabled={short} onClick={() => setLevel(id, setErr)}>{short ? "자금 부족" : lv ? "단계 변경" : "이 단계로 시작"}</button>}
              </div>
            );
          })}
        </div>
        <p className="row gap wrap" style={{ marginTop: "0.7rem" }}>
          <button className="btn sm" data-testid="academy-set-off" disabled={!active} onClick={() => setLevel("off", setErr)}>육성 중지</button>
          <a className="btn sm" href="#/club/staff">코칭스태프(2군 감독)</a>
        </p>
      </Card>

      <Card title="2군 명단">
        {bench.length === 0 ? (
          <p className="muted" data-testid="academy-vacant">{active ? "이번 시즌 2군이 비었습니다. 빈 가상 자리는 다음 시즌 초에 채워집니다." : "육성을 시작하면 포지션마다 가상 유망주가 들어옵니다. 1군 선수를 내릴 수도 있습니다."}</p>
        ) : (
          <div className="staff-market" data-testid="academy-roster">
            {bench.map((p) => {
              const tr = academyTrained(s, p);
              const short = p.origin === "virtual" && !s.story?.contracts.some((c) => c.key === p.key) && s.eco.cash < ACADEMY_CALLUP_SALARY;
              return (
                <div key={p.key} className="staff-card" data-testid={`academy-prospect-${p.key}`}>
                  <p><b>{p.name}</b> <span className="muted">{POS_KO[p.pos]} · {p.origin === "virtual" ? "가상 유망주" : "1군에서 강등"}</span></p>
                  <p className="sm">종합 {tr.overall} (시작 {tr.base}) · 교전 {p.four.fight} · 압박 {p.four.press} · 판단 {p.four.judge} · 운영 {p.four.ops}</p>
                  <p className="muted xs">공식 시즌 기록 없음. 숫자는 게임 안 육성 능력치입니다.</p>
                  {p.origin === "virtual" && <p className="muted xs">콜업 연봉 {fmtMoney(ACADEMY_CALLUP_SALARY)} · 지금 자금에서 나감</p>}
                  <button className="btn sm primary" data-testid={`academy-callup-${p.key}`} disabled={short} onClick={() => callUp(p.key, setErr)}>{short ? "자금 부족" : "1군으로 콜업"}</button>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Card title="1군에서 2군으로">
        <p className="muted sm">1군 선수를 내리면 선발에서 빠지고 그 경기에는 나가지 않습니다. 계약 연봉은 그대로 나갑니다. 빈 선발은 기존 규칙으로 채웁니다.</p>
        {mains.length === 0 ? <p className="muted">1군 계약 선수가 없습니다.</p> : (
          <ul className="cr-growth" data-testid="academy-main">
            {mains.map((c) => {
              const pl = PL[c.key];
              const tr = trainedRatingOf(s, c.key);
              const starter = (s.starters[s.team] ?? []).includes(c.key);
              return (
                <li key={c.key} data-testid={`academy-main-${c.key}`}>
                  <b>{pl?.name ?? c.person}</b> {POS_KO[pl?.pos ?? 0]} · {starter ? "선발" : "벤치"} · 연봉 {fmtMoney(c.salary)}
                  {tr ? ` · 종합 ${tr.overall}` : ""}
                  <button className="btn sm" style={{ marginLeft: "0.5rem" }} data-testid={`academy-demote-${c.key}`} onClick={() => demote(c.key, setErr)}>2군으로 내리기</button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
      <p><a className="btn" href="#/club">구단으로</a></p>
    </div>
  );
}
