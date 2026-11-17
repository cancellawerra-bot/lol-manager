import { readFileSync } from "fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CARDS, TM } from "../../src/data";
import { newStoryCareer, simRestOfPhase, finishStoryDay, STORY_BUDGETS, storySalary, marketCards } from "../../src/game/story";
import { Rng } from "../../src/game/rng";

(async () => {
  await loadCore(); await loadRanked();
  const cheap: string[] = [];
  const used = new Set<string>();
  for (let pos = 0; pos < 5; pos++) {
    const c = marketCards(2018).filter((x) => x.posIdx === pos && !used.has(x.pkey)).sort((a, b) => a.salary - b.salary)[0];
    if (!c) throw new Error("no card pos " + pos);
    used.add(c.pkey); cheap.push(c.id);
  }
  const spent = cheap.reduce((n, id) => n + storySalary(CARDS[id].salary, "CK"), 0);
  if (spent > STORY_BUDGETS.normal) throw new Error("cheap roster exceeds 20억: " + spent);
  const s = newStoryCareer("SGU", "김감독", 1, 2026, {
    club: { name: "신구 이글스", short: "SGU", color: "#2DD4BF" },
    managerInfo: { name: "김감독", birth: "1988-01-01", nation: "한국", career: "amateur" },
    cards: cheap, starters: cheap, difficulty: "normal",
  });
  if (!s.story || s.story.year !== 2018 || s.story.tier !== "CK") throw new Error("story init");
  if (s.story.ck.length !== 8 || !s.story.ck.includes("SGU")) throw new Error("ck league " + s.story.ck);
  if (s.story.lck.length !== 10) throw new Error("lck");
  if (!s.series.some((x) => x.a === s.team || x.b === s.team)) throw new Error("no user series");
  if (!TM.SGU) throw new Error("SGU not injected");
  const rng = new Rng(s.rng);
  simRestOfPhase(s, rng, false);
  if (s.story.phase !== "promo") throw new Error("expected promo after spring auto, got " + s.story.phase);
  let guard = 0;
  while (s.story.phase === "promo" && guard++ < 20) finishStoryDay(s, rng);
  if (s.story.phase === "promo") throw new Error("promo stuck");
  console.log("OK", { phase: s.story.phase, split: s.story.split, year: s.story.year, tier: s.story.tier, spent });
})().catch((e) => { console.error(e); process.exit(1); });
