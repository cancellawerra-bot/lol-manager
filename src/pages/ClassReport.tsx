import { useEffect, useState } from "react";
import { useSave, mutate } from "../store";
import { Card, ChampIcon } from "../ui";
import { PATCH_VERSION } from "./patchdata";
import {
  NONE, buildClassReport, markReportSeen, setReportReflection, setReportStudent,
  reportToCsv, reportToJson, type ReportScope,
} from "../game/classReport";

function download(name: string, text: string, type: string): void {
  const blob = new Blob([text], { type });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  URL.revokeObjectURL(a.href);
}

function wr(n: number, wins: number): string {
  return `${n}회${wins != null ? ` · 승률 ${((wins / n) * 100).toFixed(0)}%` : ""}`;
}

export default function ClassReport() {
  const s = useSave()!;
  const [scope, setScope] = useState<ReportScope>("until-now");
  // save 객체 참조는 mutate 후에도 같으므로, 매 렌더에서 다시 집계해야 이름·성찰 입력이 반영됩니다.
  const view = buildClassReport(s, scope);
  useEffect(() => { mutate((x) => { markReportSeen(x); }); }, []);
  const mark = (): void => { mutate((x) => { markReportSeen(x); }); };

  return (
    <div className="class-report" data-testid="class-report">
      <header className="cr-head no-print-hide">
        <p className="cr-kicker">신구대 e스포츠과 코칭 수업 · LOL Manager v{PATCH_VERSION}</p>
        <h1>수업 보고서</h1>
        <p className="muted sm">한 시즌 또는 스플릿을 마친 뒤 과제로 제출할 한 장 보고서입니다. 성찰 칸은 빈 칸이며 답이 자동으로 채워지지 않습니다.</p>
        <div className="row gap wrap cr-toolbar">
          <label className="cr-scope">범위{" "}
            <select data-testid="report-scope" value={view.scopeId} onChange={(e) => setScope(e.target.value as ReportScope)}>
              {view.scopes.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
            </select>
          </label>
          <button className="btn primary" data-testid="report-print" onClick={() => { mark(); window.print(); }}>인쇄 / PDF로 저장</button>
          <button className="btn" data-testid="report-json" onClick={() => download("lol-manager-report.json", reportToJson(view), "application/json")}>JSON 내보내기</button>
          <button className="btn" data-testid="report-csv" onClick={() => download("lol-manager-report.csv", reportToCsv(view), "text/csv")}>CSV 내보내기</button>
          <a className="btn" href="#/club">구단으로</a>
          <a className="btn" href="#/help">기록·도움말</a>
        </div>
      </header>

      <section className="cr-paper" data-testid="report-paper">
        <p className="cr-print-only cr-kicker">신구대 e스포츠과 코칭 수업 · LOL Manager v{PATCH_VERSION} · {view.scopeLabel}</p>
        <h2 className="cr-print-only">수업 보고서</h2>

        <Card title="제출 정보">
          <div className="cr-fields">
            <label>이름(선택)
              <input data-testid="report-name" maxLength={40} value={view.studentName} placeholder="저장에만 남습니다"
                onChange={(e) => mutate((x) => setReportStudent(x, e.target.value, x.classReport?.studentId ?? ""))} />
            </label>
            <label>학번(선택)
              <input data-testid="report-sid" maxLength={24} value={view.studentId} placeholder="저장에만 남습니다"
                onChange={(e) => mutate((x) => setReportStudent(x, x.classReport?.studentName ?? "", e.target.value))} />
            </label>
          </div>
        </Card>

        <Card title="커리어 개요">
          <ul className="facts cr-facts" data-testid="report-overview">
            <li><b>{view.modeLabel}</b><span>모드</span></li>
            <li><b>{view.yearLabel}</b><span>연도</span></li>
            <li><b>{view.teamName} ({view.team})</b><span>팀</span></li>
            <li><b>{view.manager}</b><span>감독</span></li>
            <li><b>{view.record}</b><span>전적</span></li>
            <li><b>{view.rank}</b><span>정규 순위</span></li>
          </ul>
          <p data-testid="report-playoff"><b>플레이오프·우승:</b> {view.playoff}</p>
          <p data-testid="report-trophies"><b>트로피:</b> {view.trophies.length ? view.trophies.map((t) => `${t.label}${t.detail ? ` (${t.detail})` : ""}`).join(" · ") : NONE}</p>
          <p data-testid="report-feats"><b>업적:</b> {view.feats.length ? view.feats.map((t) => t.label).join(" · ") : NONE}</p>
        </Card>

        <Card title="밴픽 요약">
          <div className="cr-split">
            <div>
              <h3>우리가 많이 뽑은 챔피언</h3>
              {view.picks?.length ? (
                <ul className="cr-champs" data-testid="report-picks">
                  {view.picks.slice(0, 6).map((c) => (
                    <li key={c.id}><ChampIcon id={c.id} size={28} title={c.name} /><span>{c.name}</span><em>{wr(c.n, c.wins)}</em></li>
                  ))}
                </ul>
              ) : <p className="muted" data-testid="report-picks-none">{NONE}</p>}
            </div>
            <div>
              <h3>우리가 많이 밴한 챔피언</h3>
              {view.bans?.length ? (
                <ul className="cr-champs" data-testid="report-bans">
                  {view.bans.slice(0, 6).map((c) => (
                    <li key={`b-${c.id}`}><ChampIcon id={c.id} size={28} title={c.name} /><span>{c.name}</span><em>{wr(c.n, c.wins)}</em></li>
                  ))}
                </ul>
              ) : <p className="muted" data-testid="report-bans-none">{NONE}</p>}
            </div>
          </div>
          <p className="muted xs">챔피언 아이콘만 쓰고, 팀 로고나 선수 사진은 넣지 않습니다. 승률은 우리가 그 챔피언을 뽑거나 밴한 세트의 실제 승패입니다.</p>
        </Card>

        <Card title="경기 흐름">
          <p data-testid="report-gold15">{view.gold15}</p>
          <p data-testid="report-comeback">{view.comeback}</p>
          {view.objectives ? (
            <ul className="cr-obj" data-testid="report-obj">
              {view.objectives.map((o) => (
                <li key={o.label}>
                  <b>{o.label}</b>
                  {o.sample ? <span>우리 {o.ours} · 상대 {o.opp} ({o.sample}세트 상세 기록)</span> : <span>{NONE}</span>}
                  {o.missing > 0 && o.sample > 0 && <em className="muted"> 상세 없는 세트 {o.missing}은 넣지 않음</em>}
                </li>
              ))}
            </ul>
          ) : <p className="muted" data-testid="report-obj-none">오브젝트 선취 {NONE}</p>}
          <p className="muted xs">시뮬이 세트에 남긴 15분 골드 차와, 상세 장면이 남은 세트의 선취만 집계합니다. 없는 세트는 0으로 채우지 않습니다.</p>
        </Card>

        <Card title="로스터·영입·예산">
          <p data-testid="report-cash"><b>현재 자금:</b> {view.cashNow} · <b>연봉 합:</b> {view.payroll}</p>
          <p className="muted xs">{view.cashNote}</p>
          {view.moves.length ? (
            <ul className="cr-moves" data-testid="report-moves">
              {view.moves.slice(-12).map((m, i) => (
                <li key={`${m.date}-${i}`}><span className="muted">{m.date}</span> <b>{m.title}</b> {m.cash != null && <em>잔고 {m.cash.toFixed(2)}억</em>}<p>{m.body}</p></li>
              ))}
            </ul>
          ) : <p className="muted" data-testid="report-moves-none">영입·방출 기록 {NONE}</p>}
          {view.growth ? (
            <div>
              <h3>선수 성장(현재 로스터, 훈련 반영)</h3>
              <ul className="cr-growth" data-testid="report-growth">
                {view.growth.map((g) => (
                  <li key={g.key}><b>{g.name}</b> <span className="muted">{g.pos}</span> {g.base} → {g.overall} ({g.delta >= 0 ? "+" : ""}{g.delta})</li>
                ))}
              </ul>
            </div>
          ) : <p className="muted" data-testid="report-growth-none">성장 기록 {NONE}</p>}
        </Card>

        <Card title="기자회견 어조·여론">
          <p data-testid="report-press"><b>기자회견 어조:</b> {view.press}</p>
          <p data-testid="report-form"><b>최근 전적:</b> {view.form}</p>
          <p data-testid="report-opinion"><b>여론(표시용):</b> {view.opinion}</p>
          <p className="muted xs">여론 온도는 표시만 하며 자금·팬심·승부 수치를 바꾸지 않습니다. 선수 발언은 짓지 않습니다. 「현재 N위」는 지금 저장의 정규 시즌 순위표이며, 위의 정규 순위(지난 스플릿까지 모은 값)나 진행 중인 월즈·MSI 성적과 다를 수 있습니다.</p>
        </Card>

        <Card title="코칭스태프">
          <p data-testid="report-staff-pay"><b>스태프 연봉 합:</b> {view.staffPay}</p>
          <ul className="cr-growth" data-testid="report-staff">
            {view.staff.map((st) => (
              <li key={st.role}><b>{st.role}</b> {st.name === NONE ? <span className="muted">{NONE}</span> : <span>{st.name} ({st.grade}) · {st.salary}{st.effects.length ? ` · ${st.effects.join(" ")}` : ""}</span>}</li>
            ))}
          </ul>
          <p className="muted xs">가상 코치이며 실존 인물 이름·사진은 쓰지 않습니다. 고용하지 않았으면 기록 없음입니다. 연봉은 게임용 가상 금액입니다.</p>
        </Card>

        <Card title="2군 육성">
          <p data-testid="report-academy-level"><b>육성 단계:</b> {view.academy.level}</p>
          <p data-testid="report-academy-cost"><b>연간 육성비:</b> {view.academy.cost}</p>
          <p data-testid="report-academy-boost"><b>성장 배율:</b> {view.academy.boost}</p>
          <ul className="cr-growth" data-testid="report-academy">
            {view.academy.people.length
              ? view.academy.people.map((p) => (
                <li key={p.name + p.pos}><b>{p.name}</b> {p.pos} · 종합 {p.overall} · {p.origin}</li>
              ))
              : <li className="muted">{NONE}</li>}
          </ul>
          <p className="muted xs">가상 유망주는 가상 이름만 쓰며 공식 시즌 기록이 없으면 기록 없음입니다. 육성하지 않았으면 기록 없음입니다. 금액은 게임용 가상 금액입니다.</p>
        </Card>

        <Card title="성찰 (학생이 직접 작성)">
          <div className="cr-reflect" data-testid="report-reflect">
            {view.reflections.map((q) => (
              <label key={q.id}>{q.prompt}
                <textarea data-testid={`report-q-${q.id}`} maxLength={800} rows={3} value={q.answer} placeholder="여기에 직접 적어 주세요. 자동으로 답을 채우지 않습니다."
                  onChange={(e) => mutate((x) => setReportReflection(x, q.id, e.target.value))} />
              </label>
            ))}
          </div>
        </Card>

        <p className="muted xs cr-note">{view.note}</p>
      </section>
    </div>
  );
}

