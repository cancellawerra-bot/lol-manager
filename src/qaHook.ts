// 검증용 헬퍼. ?qa=1 또는 localStorage.lolmQa=1 일 때만 붙습니다.
// 경기 승패를 조작하지 않으며, 스토브 입찰·자동 시뮬만 빠르게 밟습니다.
import { CARDS } from "./data";
import { getSave, mutate, persist, setSave, loadSlot, lastSlot } from "./store";
import { pumpStory, newStoryCareer, marketCards, storySalary, STORY_BUDGETS, type StoryDiff } from "./game/story";
import { autoAdvanceOffseason, stepYear } from "./game/stove";
import { resolveFranchise } from "./game/story";
import type { Save } from "./game/season";

function openingRoster(best: boolean, cap: number): string[] {
  const year = 2018;
  const used = new Set<string>();
  const picks: string[] = [];
  const price = (c: (typeof CARDS)[string]): number => storySalary(c, "CK");
  for (let pos = 0; pos < 5; pos++) {
    const c = marketCards(year).filter((x) => x.posIdx === pos && !used.has(x.pkey)).sort((a, b) => price(a) - price(b) || b.percentile - a.percentile)[0];
    used.add(c.pkey); picks.push(c.id);
  }
  if (!best) return picks;
  let spent = picks.reduce((n, id) => n + price(CARDS[id]), 0);
  let improved = true;
  while (improved) {
    improved = false;
    for (let i = 0; i < 5; i++) {
      const cur = CARDS[picks[i]];
      const curPay = price(cur);
      const room = cap - spent + curPay;
      const better = marketCards(year).filter((x) => x.posIdx === cur.posIdx && !used.has(x.pkey) && price(x) <= room && x.percentile > cur.percentile + 3)
        .sort((a, b) => b.percentile - a.percentile)[0];
      if (better) {
        used.delete(cur.pkey); used.add(better.pkey);
        spent = spent - curPay + price(better);
        picks[i] = better.id; improved = true;
      }
    }
  }
  return picks;
}

function weakRoster(): string[] {
  const used = new Set<string>();
  const picks: string[] = [];
  for (let pos = 0; pos < 5; pos++) {
    const c = marketCards(2018).filter((x) => x.posIdx === pos && !used.has(x.pkey)).sort((a, b) => a.percentile - b.percentile || storySalary(a, "CK") - storySalary(b, "CK"))[0];
    used.add(c.pkey); picks.push(c.id);
  }
  return picks;
}

export function installQaHook(): void {
  if (typeof window === "undefined") return;
  const q = window.location.search + window.location.hash;
  const on = /(?:\?|&|#)qa=1\b/.test(q) || window.localStorage.getItem("lolmQa") === "1";
  if (!on) return;
  (window as unknown as { __LOLM: Record<string, unknown> }).__LOLM = {
    getSave,
    persist,
    setSave,
    loadSlot,
    loadLast: () => { const n = lastSlot(); return n ? loadSlot(n) : false; },
    pumpToOffseason: () => mutate((s, rng) => { if (s.story) pumpStory(s, rng); }),
    autoStove: (signStars = true, reserveCash = 0) => mutate((s, rng) => { if (s.story) autoAdvanceOffseason(s, rng, { signStars, reserveCash }); }),
    franchise: (ok: boolean) => { let e: string | null = null; mutate((s) => { e = resolveFranchise(s, ok); }); return e; },
    stepYear: (opts: { acceptBuyIn?: boolean; signStars?: boolean; reserveCash?: number } = {}) =>
      mutate((s, rng) => { if (s.story) stepYear(s, rng, opts); }),
    startStory: (opts: { seed: number; difficulty?: StoryDiff; best?: boolean; weak?: boolean }) => {
      const difficulty = opts.difficulty ?? "easy";
      const picks = opts.weak ? weakRoster() : openingRoster(!!opts.best, STORY_BUDGETS[difficulty]);
      const s = newStoryCareer("SGU", "김감독", 1, opts.seed, {
        club: { name: "신구 이글스", short: "SGU", color: "#2DD4BF" },
        managerInfo: { name: "김감독", birth: "1988-03-15", nation: "한국", career: "amateur" },
        cards: picks, starters: picks, difficulty,
      });
      s.schedOk = true; s.seen = "done";
      setSave(s);
      return { cash: s.eco.cash, cap: s.eco.cap, names: picks.map((id) => CARDS[id].name) };
    },
    exportJson: () => JSON.stringify(getSave()),
    snapshot: () => {
      const s = getSave();
      if (!s) return null;
      return { year: s.story?.year, split: s.story?.split, phase: s.story?.phase, tier: s.story?.tier, ended: s.story?.ended, cash: s.eco.cash, trophies: s.story?.trophies, week: s.story?.stove?.week, franchised: s.story?.franchised };
    },
  };
}
export type QaSave = Save;
