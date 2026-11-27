// 검증용 헬퍼. ?qa=1 또는 localStorage.lolmQa=1 일 때만 붙습니다.
// 경기 승패를 조작하지 않으며, 스토브 입찰·자동 시뮬만 빠르게 밟습니다.
import { CARDS, RANKED } from "./data";
import { getSave, mutate, persist, setSave, loadSlot, lastSlot } from "./store";
import { pumpStory, newStoryCareer, marketCards, storySalary, STORY_BUDGETS, FRANCHISE_BUYIN, resolveFranchise, ensureStartingFive, type StoryDiff } from "./game/story";
import { autoAdvanceOffseason, stepYear } from "./game/stove";
import { Rng } from "./game/rng";
import type { Save } from "./game/season";
import { fireStaff, hireStaff, STAFF_CATALOG } from "./game/staff";
import { callUpAcademy, demoteToAcademy, setAcademyLevel } from "./game/academy";
import { addNews } from "./game/season";

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
    rankedReady: () => !!RANKED,
    hireStaff: (id: string) => { let err: string | null = null; mutate((s) => { err = hireStaff(s, id); if (!err) { const e = STAFF_CATALOG.find((c) => c.id === id)!; addNews(s, "season", `코칭스태프 · ${e.name} 고용`, `${e.name}을 연봉 가상 금액으로 고용했습니다.`, s.team); } }); return err; },
    fireStaff: (role: string) => { let err: string | null = null; mutate((s) => { err = fireStaff(s, role as "head" | "phys" | "ops" | "cond" | "acad"); }); return err; },
    setAcademyLevel: (level: string) => { let err: string | null = null; mutate((s) => { err = setAcademyLevel(s, level as "lean" | "standard" | "aggressive" | "off"); if (!err && level !== "off") addNews(s, "season", "2군 육성 투자", "2군 육성 단계를 정했습니다.", s.team); }); return err; },
    callUpAcademy: (key: string) => { let err: string | null = null; mutate((s) => { err = callUpAcademy(s, key); if (!err) addNews(s, "season", "2군 콜업", "1군 명단으로 올렸습니다.", s.team); }); return err; },
    demoteToAcademy: (key: string) => { let err: string | null = null; mutate((s) => { err = demoteToAcademy(s, key); if (!err) { ensureStartingFive(s); addNews(s, "season", "2군 강등", "2군으로 내렸습니다.", s.team); } }); return err; },

    runToEnd: (opts: { acceptBuyIn?: boolean; signStars?: boolean } = {}) => {
      const s = getSave();
      if (!s?.story) return null;
      const years: { year: number; phase: string; tier: string; cash: number; pay: number; trophies: { lck: number; msi: number; worlds: number } }[] = [];
      const rng = new Rng(s.rng);
      while (!s.story.ended && s.story.year <= 2027) {
        const y = s.story.year;
        years.push({
          year: y, phase: s.story.phase, tier: s.story.tier, cash: s.eco.cash,
          pay: Math.round(s.story.contracts.reduce((n, c) => n + c.salary, 0) * 100) / 100,
          trophies: { ...s.story.trophies },
        });
        const reserved = (!s.story.franchised && s.story.year <= 2020) ? FRANCHISE_BUYIN[s.eco.difficulty] : 0;
        stepYear(s, rng, { acceptBuyIn: !!opts.acceptBuyIn, signStars: opts.signStars !== false, reserveCash: reserved });
        if (s.story.year === y && !s.story.ended) break;
      }
      s.rng = rng.s;
      persist();
      return { year: s.story.year, split: s.story.split, phase: s.story.phase, tier: s.story.tier, ended: s.story.ended, cash: s.eco.cash, trophies: { ...s.story.trophies }, franchised: s.story.franchised, ranked: !!RANKED, years };
    },
        exportJson: () => JSON.stringify(getSave()),
    snapshot: () => {
      const s = getSave();
      if (!s) return null;
      return { year: s.story?.year, split: s.story?.split, phase: s.story?.phase, tier: s.story?.tier, ended: s.story?.ended, cash: s.eco.cash, trophies: s.story?.trophies ? { ...s.story.trophies } : undefined, week: s.story?.stove?.week, franchised: s.story?.franchised };
    },
  };
}
export type QaSave = Save;
