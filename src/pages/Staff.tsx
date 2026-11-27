import { useEffect, useState } from "react";
import { useSave, mutate } from "../store";
import { Card } from "../ui";
import { fmtMoney } from "../game/money";
import { addNews } from "../game/season";
import {
  STAFF_ROLES, STAFF_CATALOG, fireNews, fireStaff, hireNews, hireStaff, hiredOf, markStaffOfferSeen,
  staffEffectLines, staffGradeLabel, staffHires, staffPayroll, staffRoleFocus, staffRoleLabel, staffSessionBoost, staffAdviceTemp, STAFF_DEFAULT_TEMP,
  type StaffRole,
} from "../game/staff";

function hire(id: string, setErr: (m: string) => void): void {
  mutate((s) => {
    const entry = STAFF_CATALOG.find((c) => c.id === id);
    if (!entry) return;
    const prev = hiredOf(s, entry.role);
    const err = hireStaff(s, id);
    if (err) { setErr(err); return; }
    setErr("");
    const news = hireNews(entry, prev);
    addNews(s, "season", news.title, news.body, s.team);
  });
}

function fire(role: StaffRole): void {
  mutate((s) => {
    const cur = hiredOf(s, role);
    const err = fireStaff(s, role);
    if (err || !cur) return;
    const news = fireNews(cur);
    addNews(s, "season", news.title, news.body, s.team);
  });
}

export default function Staff() {
  const s = useSave()!;
  const [err, setErr] = useState("");
  useEffect(() => { mutate((x) => { markStaffOfferSeen(x); }); }, []);
  const boost = staffSessionBoost(s) ?? { mechanics: 1, strategy: 1, recovery: 1, fatigueLoad: 1 };
  const temp = staffAdviceTemp(s);
  const pay = staffPayroll(s);
  const hiredN = staffHires(s).length;
  return (
    <div className="staff-page" data-testid="staff-page">
      <Card title="코칭스태프">
        <p className="muted sm">가상 코치를 역할마다 한 명씩 고용할 수 있습니다(수석·피지컬·운영·컨디션·2군 감독). 실존 인물 이름·사진·발언·성격은 쓰지 않습니다. 연봉은 게임용 가상 금액이며 지금 구단 자금에서 나갑니다. 고용하지 않으면 승부·성장·경제는 기존과 같습니다.</p>
        {err && <p className="err sm" data-testid="staff-error">{err}</p>}
        <div className="facts staff-facts" data-testid="staff-effects">
          <li><b>{hiredN}명</b><span>고용 중</span></li>
          <li><b>{fmtMoney(pay)}</b><span>스태프 연봉 합</span></li>
          <li><b>{fmtMoney(s.eco.cash)}</b><span>보유 자금</span></li>
          <li><b>{boost.mechanics === 1 ? "기본" : `+${Math.round((boost.mechanics - 1) * 100)}%`}</b><span>피지컬 훈련</span></li>
          <li><b>{boost.strategy === 1 ? "기본" : `+${Math.round((boost.strategy - 1) * 100)}%`}</b><span>운영 훈련</span></li>
          <li><b>{boost.recovery === 1 ? "기본" : `+${Math.round((boost.recovery - 1) * 100)}%`}</b><span>피로 회복</span></li>
          <li><b>{temp === STAFF_DEFAULT_TEMP ? "기본" : `+${Math.round((1 - temp / STAFF_DEFAULT_TEMP) * 100)}%`}</b><span>밴픽 조언 정확도</span></li>
        </div>
        <p className="muted xs">1군 코치 효과는 우리 1군만 적용됩니다. 2군 감독의 효과는 2군 성장에만 더해집니다. 성장 상한 100과 역사 모드 약팀 성장 가속 규칙은 그대로입니다. 판타지 드래프트 예산(90/85/80억)은 선수 선발용이며 여기 연봉과 별개입니다. 해임하면 이미 나간 연봉은 돌아오지 않습니다.</p>
      </Card>

      {STAFF_ROLES.map((role) => {
        const cur = hiredOf(s, role);
        const market = STAFF_CATALOG.filter((c) => c.role === role);
        return (
          <Card key={role} title={`${staffRoleLabel(role)} · ${staffRoleFocus(role)}`}>
            <div data-testid={`staff-role-${role}`} className="staff-role">
              {cur ? (
                <div className="staff-hired" data-testid={`staff-hired-${role}`}>
                  <p><b>{cur.name}</b> · {staffGradeLabel(cur.grade)} · 연봉 {fmtMoney(cur.salary)}</p>
                  <ul className="sm staff-lines">{staffEffectLines(cur).map((l) => <li key={l}>{l}</li>)}</ul>
                  <button className="btn sm" data-testid={`staff-fire-${role}`} onClick={() => fire(role)}>해임</button>
                </div>
              ) : (
                <p className="muted" data-testid={`staff-vacant-${role}`}>공석입니다. 아래 후보 가운데 고용할 수 있습니다.</p>
              )}
              <div className="staff-market">
                {market.map((c) => {
                  const on = cur?.id === c.id;
                  const short = s.eco.cash < c.salary && !on;
                  return (
                    <div key={c.id} className={`staff-card${on ? " on" : ""}`} data-testid={`staff-card-${c.id}`}>
                      <p><b>{c.name}</b> <span className="muted">{staffGradeLabel(c.grade)} · {fmtMoney(c.salary)}</span></p>
                      <ul className="xs">{staffEffectLines(c).map((l) => <li key={l}>{l}</li>)}</ul>
                      {on
                        ? <span className="muted sm">고용 중</span>
                        : <button className="btn sm primary" data-testid={`staff-hire-${c.id}`} disabled={short} onClick={() => hire(c.id, setErr)}>{short ? "자금 부족" : cur ? "교체 고용" : "고용"}</button>}
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>
        );
      })}
      <p><a className="btn" href="#/club">구단으로</a></p>
    </div>
  );
}
