// v2.22.0 2024–2026 카드 검수 테스트 (교수님 지적: 지표가 좋은 시즌이 능력치·판단·연봉도 높아야 함)
import assert from "node:assert/strict";
import { audit, loadCards, YEARS } from "./card-audit";
const cards = loadCards();
const by = Object.fromEntries(cards.map((c) => [c.id, c]));
// 쵸비: 2024(KDA 6.22·승률 83.5%·GD +410·DPM 801)가 2025·2026보다 능력치·판단·연봉 모두 높음
for (const o of ["chovy-2025", "chovy-2026"]) {
  assert(by["chovy-2024"].fantasyRating > by[o].fantasyRating, `쵸비 2024 능력치 > ${o}`);
  assert(by["chovy-2024"].four!.judge! > by[o].four!.judge!, `쵸비 2024 판단 > ${o}`);
  assert(by["chovy-2024"].fantasySalary > by[o].fantasySalary, `쵸비 2024 연봉 > ${o}`);
}
// 4대 평균 = 종합 (교수님 평가 카드 제외, 반올림만 차이)
for (const c of cards.filter((c) => YEARS.includes(c.year) && c.ownerRating == null)) {
  const v = Object.values(c.four ?? {}).filter((x): x is number => x != null);
  if (!v.length || !v.every((x) => x > 60 && x < 99)) continue;
  const avg = v.reduce((a, b) => a + b, 0) / v.length;
  assert(Math.abs(avg - c.fantasyRating) <= 0.75, `${c.id} 4대 평균 ${avg} vs 종합 ${c.fantasyRating}`);
}
// 연도 하향 없음: 세 시즌 평균 능력치 차이가 작음
const mean = (y: number) => { const r = cards.filter((c) => c.year === y && c.ownerRating == null).map((c) => c.fantasyRating); return r.reduce((a, b) => a + b, 0) / r.length; };
assert(Math.abs(mean(2024) - mean(2026)) < 1.2 && Math.abs(mean(2025) - mean(2026)) < 1.2, `연도별 평균 ${mean(2024)} ${mean(2025)} ${mean(2026)}`);
const inv = audit(cards);
const ownerCard = (id: string) => by[id].ownerRating != null || id === "faker-2026";
// 능력치·연봉 역전은 교수님 평가(2026 owner_ratings)·2026 페이커 지정 연봉 카드가 낀 경우만 허용
for (const i of inv.filter((i) => i.kind !== "judge")) assert(ownerCard(i.better) || ownerCard(i.worse), `기록 기반 ${i.kind} 역전 ${i.better} < ${i.worse}`);
// 판단 역전은 평가 카드이거나, 더 좋은 시즌의 킬 관여가 3%p 이상 낮은 경우(판단 재료)만, 차이 2점 이내
for (const i of inv.filter((i) => i.kind === "judge")) assert(ownerCard(i.better) || ownerCard(i.worse) || (by[i.worse].kp! - by[i.better].kp! >= 0.03 && i.b - i.a <= 2), `판단 역전 ${i.better} < ${i.worse}`);
const cnt = (k: string) => inv.filter((i) => i.kind === k).length;
console.log(`OK card audit 2024–26: 역전 능력치 ${cnt("rating")} · 연봉 ${cnt("salary")} · 판단 ${cnt("judge")} (모두 교수님 평가/지정 카드 또는 킬 관여 차이)`);
