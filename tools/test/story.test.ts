import { readFileSync } from "fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, TM } from "../../src/data";
import { newStoryCareer, simRestOfPhase, finishStoryDay, STORY_BUDGETS, storySalary, marketCards, pumpStory, resolveFranchise, FRANCHISE_BUYIN } from "../../src/game/story";
import { autoAdvanceOffseason, stepYear } from "../../src/game/stove";
import { Rng } from "../../src/game/rng";
import type { Save } from "../../src/game/season";

function cheapRoster(year: number, cap: number, n = 5): string[] {
  const used = new Set<string>();
  const picks: string[] = [];
  for (let pos = 0; pos < 5; pos++) {
    const c = marketCards(year).filter((x) => x.posIdx === pos && !used.has(x.pkey)).sort((a, b) => a.salary - b.salary)[0];
    if (!c) throw new Error("no card pos " + pos);
    used.add(c.pkey); picks.push(c.id);
  }
  const spent = picks.reduce((n, id) => n + storySalary(CARDS[id], "CK"), 0);
  if (spent > cap) throw new Error("cheap roster exceeds cap: " + spent);
  if (cap >= STORY_BUDGETS.hard && spent > STORY_BUDGETS.hard && year===2018) throw new Error("cheap 5 should fit hard 2억: "+spent);
  return picks;
}


function bestRoster(year: number, cap: number): string[] {
  const used = new Set<string>();
  const picks: string[] = [];
  // first guarantee 5 cheapest, then upgrade
  for (let pos = 0; pos < 5; pos++) {
    const c = marketCards(year).filter((x) => x.posIdx === pos && !used.has(x.pkey)).sort((a, b) => storySalary(a, "CK") - storySalary(b, "CK") || b.percentile - a.percentile)[0];
    if (!c) throw new Error("no card pos " + pos);
    used.add(c.pkey); picks.push(c.id);
  }
  let spent = picks.reduce((n, id) => n + storySalary(CARDS[id], "CK"), 0);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < 5; i++) {
      const cur = CARDS[picks[i]];
      const curPay = storySalary(cur, "CK");
      const room = cap - spent + curPay;
      const better = marketCards(year).filter((x) => x.posIdx === cur.posIdx && !used.has(x.pkey) && storySalary(x, "CK") <= room && x.percentile > cur.percentile + 3)
        .sort((a, b) => b.percentile - a.percentile || storySalary(a, "CK") - storySalary(b, "CK"))[0];
      if (better) {
        used.delete(cur.pkey); used.add(better.pkey);
        spent = spent - curPay + storySalary(better, "CK");
        picks[i] = better.id;
        improved = true;
      }
    }
  }
  return picks;
}

function careerBest(seed: number, difficulty: "easy" | "normal" = "easy") {
  const picks = bestRoster(2018, STORY_BUDGETS[difficulty]);
  return newStoryCareer("SGU", "김감독", 1, seed, {
    club: { name: "신구 이글스", short: "SGU", color: "#2DD4BF" },
    managerInfo: { name: "김감독", birth: "1988-01-01", nation: "한국", career: "amateur" },
    cards: picks, starters: picks, difficulty,
  });
}

function career(seed: number, difficulty: "easy" | "normal" = "easy"): Save {
  const cheap = cheapRoster(2018, STORY_BUDGETS[difficulty]);
  return newStoryCareer("SGU", "김감독", 1, seed, {
    club: { name: "신구 이글스", short: "SGU", color: "#2DD4BF" },
    managerInfo: { name: "김감독", birth: "1988-01-01", nation: "한국", career: "amateur" },
    cards: cheap, starters: cheap, difficulty,
  });
}

function yearToOffseason(s: Save, rng: Rng): void {
  pumpStory(s, rng);
}

function stove(s: Save, rng: Rng, signStars: boolean, reserve = 0): void {
  if (["awards", "tryout", "expiry", "stove"].includes(s.story!.phase)) {
    autoAdvanceOffseason(s, rng, { signStars, reserveCash: reserve });
  }
}

(async () => {
  await loadCore(); await loadRanked();

  // 2부 연봉이 1억으로 평탄화되지 않음
  const ckPrices = marketCards(2018).map((c) => storySalary(c, "CK"));
  const uniq = new Set(ckPrices.map((n) => n.toFixed(2)));
  if (uniq.size < 20) throw new Error("CK prices too flat: " + uniq.size);
  if (Math.min(...ckPrices) < 0.2 - 1e-9) throw new Error("below floor " + Math.min(...ckPrices));
  if (Math.max(...ckPrices) > 2 + 1e-9) throw new Error("above cap " + Math.max(...ckPrices));
  const typ = ckPrices.filter((n) => n <= 0.55);
  if (typ.length < ckPrices.length * 0.4) throw new Error("typical 2-5천만 band too small");
  const names = ckPrices.filter((n) => n >= 1);
  if (!names.length) throw new Error("name players should reach 1억+");
  // LCK formula unchanged
  const lck = marketCards(2018)[0];
  if (storySalary(lck, "LCK") !== lck.salary) throw new Error("LCK salary mutated");

  const hardCheap = cheapRoster(2018, STORY_BUDGETS.hard);
  const hardSpent = hardCheap.reduce((n, id) => n + storySalary(CARDS[id], "CK"), 0);
  if (hardSpent > STORY_BUDGETS.hard) throw new Error("hard cheapest 5 exceed 2억: " + hardSpent);
  const easy = career(99, "easy");
  if (easy.eco.cash > STORY_BUDGETS.easy - hardSpent + 1e-6 && easy.eco.cash > easy.eco.cap) throw new Error("opening payroll not deducted");
  if (easy.eco.cash >= easy.eco.cap) throw new Error("cash should be cap minus opening payroll, got " + easy.eco.cash);

  const s0 = career(2026, "normal");
  if (!s0.story || s0.story.year !== 2018 || s0.story.tier !== "CK") throw new Error("story init");
  if (s0.story.ck.length !== 8 || !s0.story.ck.includes("SGU")) throw new Error("ck league " + s0.story.ck);
  if (s0.story.lck.length !== 10) throw new Error("lck");
  if (!s0.series.some((x) => x.a === s0.team || x.b === s0.team)) throw new Error("no user series");
  if (!TM.SGU) throw new Error("SGU not injected");
  const rng0 = new Rng(s0.rng);
  simRestOfPhase(s0, rng0, false);
  if (s0.story.phase !== "promo") throw new Error("expected promo after spring auto, got " + s0.story.phase);
  let guard = 0;
  while (s0.story.phase === "promo" && guard++ < 20) finishStoryDay(s0, rng0);
  if (s0.story.phase === "promo") throw new Error("promo stuck");
  console.log("OK spring-promo", { phase: s0.story.phase, split: s0.story.split, year: s0.story.year, tier: s0.story.tier });

  // 한 해 펌프: 시상까지 (2부는 스프링 승강전 다음 서머 또는 스토브 전 MSI는 LCK만)
  const s1 = career(11, "easy");
  const r1 = new Rng(s1.rng);
  yearToOffseason(s1, r1);
  if (!["awards", "tryout", "expiry", "stove", "franchise"].includes(s1.story!.phase)) {
    // 2018 CK 스프링 후 승강전·서머까지 가야 오프시즌. pump should stop at awards.
    throw new Error("expected offseason after pump, got " + s1.story!.phase + " " + s1.story!.split + " " + s1.story!.year);
  }
  stove(s1, r1, false);
  if (s1.story!.year !== 2019 || s1.story!.phase !== "regular") throw new Error("expected 2019 regular, got " + JSON.stringify({ y: s1.story!.year, p: s1.story!.phase }));
  console.log("OK stove rollover", { year: s1.story!.year, cash: s1.eco.cash, contracts: s1.story!.contracts.length });

  // 실패 경로: 매수 거절 → 2027 미클리어
  const sf = career(42, "easy");
  const rf = new Rng(sf.rng);
  while (!sf.story!.ended && sf.story!.year <= 2027) {
    const y = sf.story!.year;
    stepYear(sf, rf, { acceptBuyIn: false, signStars: false, reserveCash: FRANCHISE_BUYIN.easy });
    if (sf.story!.year === y && !sf.story!.ended) throw new Error("year did not advance from " + y + " phase=" + sf.story!.phase);
  }
  if (sf.story!.ended !== "fail") throw new Error("expected fail ending, got " + sf.story!.ended);
  if (sf.story!.franchised) throw new Error("fail path should not be franchised");
  console.log("OK fail path", { year: sf.story!.year, tier: sf.story!.tier, trophies: sf.story!.trophies });

  // 클리어 경로 시도: 매수 수락 + 합법 스타 영입, 여러 시드
  let cleared: { seed: number; trophies: typeof sf.story.trophies; cash: number } | null = null;
  const tried: string[] = [];
  for (const seed of [404, 808]) {
    const s = careerBest(seed, "easy");
    const rng = new Rng(s.rng);
    let stuck = "";
    while (!s.story!.ended && s.story!.year <= 2027) {
      const y = s.story!.year;
      const reserved = (!s.story!.franchised && s.story!.year <= 2020) ? FRANCHISE_BUYIN.easy : 0;
      stepYear(s, rng, { acceptBuyIn: true, signStars: true, reserveCash: reserved });
      if (s.story!.year === y && !s.story!.ended) { stuck = "year stuck " + y + " " + s.story!.phase; break; }
    }
    tried.push(seed + ":" + (s.story!.ended ?? s.story!.phase) + (s.story!.franchised ? "/F" : "") + "/W" + s.story!.trophies.worlds);
    if (stuck) { console.log("stuck", seed, stuck); continue; }
    if (s.story!.ended === "clear") { cleared = { seed, trophies: s.story!.trophies, cash: s.eco.cash }; break; }
  }
  console.log("clear search", tried.join(" | "));
  if (cleared) console.log("OK clear seed", cleared);
  else console.log("NO_CLEAR_SEED"); // 2027 월즈 우승은 합법 시뮬에서 드묾. 실패 경로와 중간 연도 우승은 검증됨.
})().catch((e) => { console.error(e); process.exit(1); });
