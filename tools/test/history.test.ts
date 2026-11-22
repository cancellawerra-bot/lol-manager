// v2.35.0 역사 모드: 연도별 실제 팀으로 시작 — 명단·구단 규모 등급·모기업 지원·끝까지 진행을 검사하고 연도·팀별 결과를 출력합니다.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, PL } from "../../src/data";
import { newHistoryCareer, lckTeamsOf, exactRosterIds, historyGrade, historySupport, HISTORY_RESERVE, LCK_PAYROLL_SOFT, cardsForOrgYear } from "../../src/game/story";
import { stepYear } from "../../src/game/stove";
import { projectLedger } from "../../src/game/ledger";
import { historyStartBonus, historySupportFloor, historyPowerRank, historyGrowthBoost, sponsorBonus, LCK_SPONSOR_BONUS } from "../../src/game/story";
import { challengeLog } from "../../src/game/achievements";
import { Rng } from "../../src/game/rng";
await loadCore(); await loadRanked();
const original = JSON.stringify(CARDS);
const info = { name: "역사 검증", birth: "1988-01-01", nation: "한국", career: "amateur" as const };

// 1) 모든 해·팀: 실제 선발 5명(그해 카드), 등급·지원 공식, 시작 자금, 프랜차이즈 이후 상태
let teams = 0;
for (const year of [2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025, 2026]) {
  for (const t of lckTeamsOf(year)) {
    const s = newHistoryCareer(t.short, 1, 7, { startYear: year, managerInfo: info, difficulty: "normal" });
    teams++;
    const st = s.story!;
    assert.equal(st.tier, "LCK"); assert.equal(st.franchised, year >= 2021); assert.equal(st.year, year); assert.equal(st.ended, undefined);
    assert(st.lck.includes(t.short) && !st.ck.includes(t.short));
    const starters = s.starters[t.short];
    assert.equal(starters.length, 5); assert(starters.every(Boolean), `${year} ${t.short} 선발 5명`);
    const ex = exactRosterIds(t.short, year);
    assert(ex.starters.every((id) => !!CARDS[id]), `${year} ${t.short} 카드로 채워짐`);
    const real = cardsForOrgYear(t.short, year).length;
    assert(real >= 4, `${year} ${t.short} 그해 카드 ${real}장`);
    // 선발은 그해 카드(2026 이후는 2026)
    const y = Math.min(year, 2026);
    const own = ex.starters.map((id) => CARDS[id]).filter((c) => c.year === y).length;
    assert(own >= 4, `${year} ${t.short} 그해 카드 선발 ${own}명`);
    const pay = Math.round(ex.starters.reduce((n, id) => n + CARDS[id].salary, 0) * 100) / 100;
    assert.equal(st.history!.grade, historyGrade(pay, year)); assert.equal(st.history!.support, Math.max(historySupport(pay, year), historySupportFloor(historyPowerRank(t.short, year))));
    assert.equal(s.eco.cash, HISTORY_RESERVE.normal + historyStartBonus(historyPowerRank(t.short, year)));
    assert(st.history!.support === 0 || pay > (year <= 2020 ? 70 : LCK_PAYROLL_SOFT) || st.history!.support === historySupportFloor(st.history!.rank!));
    // 은퇴한 옛 스타가 AI 선발에 섞이지 않음: 다른 팀 선발 대부분이 그해 카드
    for (const o of st.lck.filter((x) => x !== t.short)) {
      const ks = s.starters[o]; assert.equal(ks.length, 5);
      const fresh = ks.filter((k) => PL[k] && (PL[k].cardYear ?? 0) >= y - 1).length;
      assert(fresh >= (year <= 2020 ? 3 : 4), `${year} ${o} AI 선발 중 최신 카드 ${fresh}명`);
    }
    assert(projectLedger(s) !== null);
    assert.equal(st.history!.rank, historyPowerRank(t.short, year)); assert.equal(st.history!.growth, historyGrowthBoost(st.history!.rank!));
  }
  // 순위는 1~10을 한 번씩(동률 제외 가정 없이 범위만)
  const rs = lckTeamsOf(year).map((t) => historyPowerRank(t.short, year)); assert(rs.every((r) => r >= 1 && r <= 10) && rs.includes(1), `${year} 전력 순위`);
}
console.log("OK history start for every team/year", teams);

// 2) 끝까지 진행: 팀 등급별 표본(시작 해 2024)으로 2027 월즈까지. 오류 없이 진행되고 지원금이 들어오는지 확인하고 결과를 출력합니다.
const rows: string[] = [];
for (const [year, short] of [[2024, "GEN"], [2024, "T1"], [2024, "HLE"], [2024, "DK"], [2024, "BRO"], [2024, "DRX"], [2021, "DK"], [2022, "T1"], [2018, "KT"], [2018, "BBQ"], [2019, "JAG"], [2019, "SKT"], [2020, "SP"], [2020, "DWG"]] as [number, string][]) {
  let clears = 0, bankrupt = 0, minCash = 1e9, worlds = 0, relegated = 0, n = year <= 2020 ? 3 : 6;
  for (let seed = 1; seed <= n; seed++) {
    const s = newHistoryCareer(short, 1, seed, { startYear: year, managerInfo: info, difficulty: "normal" });
    const rng = new Rng(s.rng);
    while (!s.story!.ended && s.story!.year <= 2027) {
      const y = s.story!.year;
      stepYear(s, rng, { acceptBuyIn: false, signStars: true, reserveCash: 0 });
      minCash = Math.min(minCash, s.eco.cash);
      if (s.story!.year === y && !s.story!.ended) break;
    }
    if (s.story!.ended === "clear") clears++;
    if (s.story!.ended === "bankrupt") bankrupt++;
    worlds += s.story!.trophies.worlds;
    if (year <= 2020) { assert(s.story!.franchised || s.story!.tier === "CK" || s.story!.ended, `${year} ${short} 프랜차이즈 판정이 끝났어야 함`); if (s.story!.tier === "CK") relegated++; }
    // 도전 성과: 우승 기록과 모순되지 않아야 함(LCK 우승 → 결승·플레이오프 진출, 월즈 우승 → 최종 성과)
    const log = challengeLog(s)!, by = Object.fromEntries(log.map((x) => [x.id, x.done]));
    assert.equal(log.length, 6);
    assert.equal(by.lck, s.story!.trophies.lck > 0); assert.equal(by.msi, s.story!.trophies.msi > 0); assert.equal(by.worlds, s.story!.trophies.worlds > 0);
    if (by.lck) assert(by.final && by.top6, "LCK 우승이면 결승·플레이오프 진출도 기록");
    if (by.final) assert(by.top6);
  }
  const g = historyGrade(exactRosterIds(short, year).starters.reduce((x, id) => x + CARDS[id].salary, 0));
  rows.push(`${year} ${short.padEnd(4)} 등급 ${g}  클리어 ${clears}/${n}  파산 ${bankrupt}/${n}  월즈 우승 합 ${worlds}  2부행 ${relegated}  최저 잔고 ${Math.round(minCash)}`);
}
console.log("OK history full careers run to the end\n" + rows.join("\n"));
// 3) 스폰서 목표 보너스: LCK는 6위 이내, 2부는 고른 목표. 순위 미정(0)은 달성 아님
{
  const l = newHistoryCareer("T1", 1, 3, { startYear: 2024, managerInfo: info, difficulty: "normal" });
  assert.equal(sponsorBonus(l, 6)!.hit, true); assert.equal(sponsorBonus(l, 7)!.hit, false); assert.equal(sponsorBonus(l, 0)!.hit, false);
  assert.equal(sponsorBonus(l, 1)!.amount, LCK_SPONSOR_BONUS);
  const ck = { story: { tier: "CK" }, eco: { sponsor: { amount: 0.6, goal: "승강전 진출" } } };
  assert.deepEqual(sponsorBonus(ck as any, 2), { amount: 0.3, goal: "승강전 진출", hit: true }); assert.equal(sponsorBonus(ck as any, 3)!.hit, false);
  assert.equal(sponsorBonus({ story: { tier: "CK" }, eco: {} } as any, 1), null);
  console.log("OK sponsor goal bonus");
}
assert.equal(JSON.stringify(CARDS), original, "원본 카드는 수정하지 않음");
