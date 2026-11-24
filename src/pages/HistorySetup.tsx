import { useMemo, useState } from "react";
import { CARDS } from "../data";
import { historyGrowthBoost, historyStartBonus, historySupportFloor, lckTeamsOf, exactRosterIds, historyGrade, historySupport, newHistoryCareer, HISTORY_RESERVE, type StoryDiff } from "../game/story";
import { PLAYER_BIRTHDATES } from "../game/playerBirthdates";
import { cardRating } from "../rating";
import { fmtMoney } from "../game/money";
import { slots, setSave } from "../store";
import { go } from "../nav";

// 역사 모드 새 게임: 시작 연도(2018~2026) → 실제 LCK 팀 선택. 숫자는 그해 시즌 카드로 계산한 값입니다(게임용 가상 금액).
const YEARS = [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026];
const GRADE_NOTE: Record<string, string> = { S: "최상위 규모 — 모기업 지원이 큼", A: "상위 규모 — 모기업 지원", B: "표준 규모", C: "수입 안에서 운영하는 규모" };
const DIFF: [StoryDiff, string][] = [["easy", "쉬움"], ["normal", "보통"], ["hard", "어려움"]];

export default function HistorySetup() {
  const [year, setYear] = useState(2024);
  const [team, setTeam] = useState("");
  const [name, setName] = useState("");
  const [diff, setDiff] = useState<StoryDiff>("normal");
  const [slot, setSlot] = useState(() => { const sl = slots(); const i = sl.findIndex((x) => !x); return i < 0 ? 1 : i + 1; });
  const [err, setErr] = useState("");
  const sl = slots();
  const rows = useMemo(() => lckTeamsOf(year).map((t) => {
    const ex = exactRosterIds(t.short, year);
    const cs = ex.starters.map((id) => CARDS[id]).filter(Boolean);
    const strength = cs.length ? Math.round(cs.reduce((n, c) => n + cardRating(c, false), 0) / cs.length * 10) / 10 : 0;
    const ages = cs.map((c) => PLAYER_BIRTHDATES[c.pkey]?.date).filter(Boolean).map((d) => Math.min(year, 2026) + 0.5 - Number(d!.slice(0, 4)) - (Number(d!.slice(5, 7)) - 1) / 12);
    const age = ages.length ? Math.round(ages.reduce((a, b) => a + b, 0) / ages.length * 10) / 10 : undefined;
    const payroll = Math.round(cs.reduce((n, c) => n + c.salary, 0) * 10) / 10;
    return { t, names: cs.map((c) => c.name).join(" · "), strength, age, payroll, grade: historyGrade(payroll, year), support: historySupport(payroll, year) };
  }).sort((a, b) => b.strength - a.strength), [year]);
  const pick = rows.find((r) => r.t.short === team);
  const label = (rank: number): { t: string; k: string } => rank <= 2 ? { t: "쉬움", k: "ok" } : rank <= 4 ? { t: "보통", k: "mid" } : rank <= 7 ? { t: "어려움", k: "warn" } : { t: "매우 어려움", k: "hard" };
  const start = (): void => {
    if (!name.trim()) { setErr("감독 이름을 입력해 주세요."); return; }
    if (!pick) { setErr("팀을 골라 주세요."); return; }
    if (sl[slot - 1] && !confirm(`슬롯 ${slot}의 기존 커리어를 덮어씁니다. 계속할까요?`)) return;
    try {
      const s = newHistoryCareer(pick.t.short, slot, (Date.now() ^ (Math.random() * 1e9)) >>> 0, { startYear: year, managerInfo: { name: name.trim(), birth: "", nation: "한국", career: "amateur" }, difficulty: diff });
      s.seen = "tut1"; s.intro = true;
      setSave(s); go("#/home");
    } catch (e) { setErr(String((e as Error).message)); }
  };
  return (
    <div className="title-wrap">
      <div className="newc" data-testid="history-setup">
        <div className="row between wrap gap"><div><a href="#/setup" className="muted">← 새 게임 방식 고르기</a><h1>역사 모드</h1></div>
          <label className="sm">저장 슬롯 <select value={slot} onChange={(e) => setSlot(Number(e.target.value))}>{[1, 2, 3].map((n) => <option key={n} value={n}>슬롯 {n}{sl[n - 1] ? ` (사용 중: ${sl[n - 1]!.team})` : ""}</option>)}</select></label></div>
        <p className="muted">원하는 해의 실제 LCK 팀을 맡아 2027 월즈 우승에 도전합니다. 그해 실제 선발 5명으로 시작합니다. 2021년부터는 프랜차이즈라 2부 리그와 승강전이 없고, 2018~2020년에 시작하면 정규 9·10위가 2부 팀과 승강전을 치르며 2020 시즌을 LCK에서 마쳐야 2021 프랜차이즈 자리를 받습니다. 선수 이름·기록은 공개 기록이며 구단 로고는 쓰지 않습니다.</p>
        {err && <p className="err">{err}</p>}

        <h2>① 시작 연도</h2>
        <div className="row gap wrap" data-testid="history-years">{YEARS.map((y) => <button key={y} className={"btn" + (year === y ? " primary" : "")} onClick={() => { setYear(y); setTeam(""); }}>{y}</button>)}</div>

        <h2>② 팀 고르기</h2>
        <div className="tbl-wrap"><table className="tbl" data-testid="history-teams">
          <thead><tr><th>팀</th><th>전력</th><th>평균 나이</th><th>선발 연봉 합</th><th>구단 규모</th><th>도전 난이도</th><th>선발 5명</th></tr></thead>
          <tbody>{rows.map((r, idx) => (
            <tr key={r.t.short} className={team === r.t.short ? "me" : ""}>
              <td><button className={"btn sm" + (team === r.t.short ? " primary" : "")} data-testid={`hteam-${r.t.short}`} onClick={() => setTeam(r.t.short)}><i className="tdot" style={{ background: r.t.color, display: "inline-block", width: 10, height: 10, borderRadius: 3, marginRight: 6 }} />{r.t.ko}</button></td>
              <td><b>{r.strength}</b></td><td>{r.age != null ? `${r.age}세` : "–"}</td><td>{r.payroll}</td>
              <td><b>{r.grade}</b>{r.support > 0 ? ` · 지원 연 +${fmtMoney(r.support)}` : ""}</td>
              <td><span className={"tag " + label(idx + 1).k}>{label(idx + 1).t}</span></td>
              <td style={{ textAlign: "left", whiteSpace: "normal" }} className="sm">{r.names}</td>
            </tr>))}</tbody>
        </table></div>
        <p className="muted xs">도전 난이도는 그해 10개 팀 중 전력 순위로 붙인 라벨입니다(1~2위 쉬움 · 3~4위 보통 · 5~7위 어려움 · 8~10위 매우 어려움). 월즈·MSI의 해외 팀은 실제 선수 데이터가 없는 가상 시드 팀이며, 아래 난이도 버튼(쉬움·보통·어려움)에 따라 강도가 달라집니다. 전력 5~7위 팀은 낮은 능력치에서 훈련 성장 +40%·시작 자금 +5억·모기업 최소 지원 연 2억, 8~10위 팀은 +80%·+10억·연 5억의 약팀 지원을 받습니다. 이 성장 가속은 종합 능력치 80 이하에서 온전히 적용되고 90 이상에서는 붙지 않습니다. 그래도 약한 팀은 월즈 우승이 매우 어려우니 「도전 성과」(플레이오프 진출·결승·LCK 우승 등)를 단계별 목표로 삼아 보세요.</p>
        <p className="muted xs">전력 = 선발 5명의 평균 능력치, 연봉 합 = 선발 5명 연봉(게임용 가상 금액, 억). 구단 규모는 연봉 합으로 정하며(2021 이후 S 200↑ · A 150↑ · B 115↑ · C 그 미만, 2018~2020은 수입이 작아 70/115 비율로 낮춘 S 122↑ · A 91↑ · B 70↑), S·A·B 등급은 게임의 평균 수입을 넘는 연봉만큼 매 시즌 말 모기업 지원을 받아 적자를 막습니다. 이 지원은 시작할 때 정해져 선수를 더 사도 늘지 않습니다.</p>

        {pick && <div className="card" data-testid="history-pick">
          <h3>{year} {pick.t.ko} · {pick.grade}등급</h3>
          {historyGrowthBoost(rows.indexOf(pick) + 1) > 1 && <p className="sm">약팀 지원: 낮은 능력치에서 훈련 성장 +{Math.round((historyGrowthBoost(rows.indexOf(pick) + 1) - 1) * 100)}%(90 이상에서는 가속 없음) · 시작 자금 +{fmtMoney(historyStartBonus(rows.indexOf(pick) + 1))} · 모기업 최소 지원 연 {fmtMoney(historySupportFloor(rows.indexOf(pick) + 1))}.</p>}
          <p className="sm">{GRADE_NOTE[pick.grade]}. 시작 자금 {fmtMoney(HISTORY_RESERVE[diff] + historyStartBonus(rows.indexOf(pick) + 1))}{Math.max(pick.support, historySupportFloor(rows.indexOf(pick) + 1)) > 0 ? ` · 매 시즌 말 모기업 지원 +${fmtMoney(Math.max(pick.support, historySupportFloor(rows.indexOf(pick) + 1)))}` : ""}.</p>
        </div>}

        <h2>③ 감독과 난이도</h2>
        <div className="row gap wrap">
          <input aria-label="감독 이름" data-testid="history-name" placeholder="감독 이름" value={name} onChange={(e) => setName(e.target.value)} maxLength={20} />
          {DIFF.map(([k, l]) => <button key={k} className={"btn sm" + (diff === k ? " primary" : "")} onClick={() => setDiff(k)}>{l} (시작 자금 {fmtMoney(HISTORY_RESERVE[k])})</button>)}
        </div>
        <div className="setup-foot"><a className="btn" href="#/setup">뒤로</a><button className="btn primary lg" data-testid="history-start" disabled={!pick || !name.trim()} onClick={start}>시즌 시작</button></div>
      </div>
    </div>
  );
}
