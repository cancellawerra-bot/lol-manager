import { readFileSync } from "fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS } from "../../src/data";
import { newStoryCareer, marketCards, storySalary, STORY_BUDGETS, FRANCHISE_BUYIN } from "../../src/game/story";
import { stepYear } from "../../src/game/stove";
import { Rng } from "../../src/game/rng";
import type { StoryDiff } from "../../src/game/story";

function bestRoster(year: number, cap: number): string[] {
  const used = new Set<string>();
  const picks: string[] = [];
  for (let pos = 0; pos < 5; pos++) {
    const c = marketCards(year).filter((x) => x.posIdx === pos && !used.has(x.pkey)).sort((a, b) => storySalary(a, "CK") - storySalary(b, "CK") || b.percentile - a.percentile)[0];
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
        picks[i] = better.id; improved = true;
      }
    }
  }
  return picks;
}

function play(seed: number, difficulty: StoryDiff) {
  const picks = bestRoster(2018, STORY_BUDGETS[difficulty]);
  const s = newStoryCareer("SGU", "김감독", 1, seed, {
    club: { name: "신구 이글스", short: "SGU", color: "#2DD4BF" },
    managerInfo: { name: "김감독", birth: "1988-01-01", nation: "한국", career: "amateur" },
    cards: picks, starters: picks, difficulty,
  });
  const rng = new Rng(s.rng);
  const worlds: number[] = [];
  let minCash = s.eco.cash;
  while (!s.story!.ended && s.story!.year <= 2027) {
    const y = s.story!.year;
    const reserved = (!s.story!.franchised && s.story!.year <= 2020) ? FRANCHISE_BUYIN[difficulty] : 0;
    stepYear(s, rng, { acceptBuyIn: true, signStars: true, reserveCash: reserved });
    minCash = Math.min(minCash, s.eco.cash);
    if (s.story!.trophies.worlds > worlds.length) worlds.push(s.story!.year === y ? y : y);
    if (s.story!.year === y && !s.story!.ended) break;
  }
  return {
    seed,
    ended: s.story!.ended ?? s.story!.phase,
    franchised: !!s.story!.franchised,
    trophies: s.story!.trophies,
    cash: s.eco.cash,
    minCash,
    year: s.story!.year,
  };
}

const difficulty = (process.argv[2] ?? "normal") as StoryDiff;
const start = Number(process.argv[3] ?? 1);
const n = Number(process.argv[4] ?? 20);
(async () => {
  await loadCore(); await loadRanked();
  const rows = [];
  for (let i = 0; i < n; i++) {
    const seed = start + i;
    const r = play(seed, difficulty);
    rows.push(r);
    console.log(JSON.stringify(r));
  }
  const clear = rows.filter((r) => r.ended === "clear").length;
  const fail = rows.filter((r) => r.ended === "fail").length;
  const bank = rows.filter((r) => r.ended === "bankrupt").length;
  const franch = rows.filter((r) => r.franchised).length;
  const anyW = rows.filter((r) => r.trophies.worlds > 0).length;
  const w27 = rows.filter((r) => r.ended === "clear").map((r) => r.seed);
  const deep = rows.filter((r) => r.minCash < -5).length;
  console.log("SUMMARY", JSON.stringify({ difficulty, start, n, clear, fail, bank, franch, anyW, clearRate: clear / n, w27, deepNeg: deep }));
})();
