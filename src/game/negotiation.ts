// 스토브/시즌 중 이적의 공통 선수 선택. 기존 계산을 그대로 옮겼습니다.
import { CARDS, PL } from "../data";
import type { SeasonCard } from "../types";
import type { Save } from "./season";
import { standings } from "./season";
import { teamPower, storySalary, cmpStr, type Tier } from "./story";
import { Rng } from "./rng";

export type Bonus = { lck?: number; intl?: number; mvp?: number; callup?: boolean; cut?: number };
export interface Bid {
  team: string; person: string; cardId: string; salary: number; years: number;
  starter: boolean; bonuses: Bonus; kind: "tryout" | "fa" | "transfer";
}
export interface BidResult {
  person: string; name: string; winner?: string; salary?: number; years?: number;
  reason: string; rejected: { team: string; why: string }[];
}
export function prestige(s: Save, team: string): number {
  const st = s.story!;
  const lck = st.lck.includes(team);
  let p = lck ? 56 : 32;
  if (team === s.team) {
    p += st.trophies.lck * 8 + st.trophies.worlds * 14 + st.trophies.msi * 6;
    p += Math.max(0, (s.eco.trust - 50) / 5);
  } else {
    p += teamPower(team) / 8;
  }
  const rows = standings(s);
  const rk = rows.findIndex((r) => r.t === team);
  if (rk >= 0) p += Math.max(0, 12 - rk * 1.2);
  return Math.max(15, Math.min(100, p));
}

function topPowerTeams(s: Save, n = 5): string[] {
  const st = s.story!;
  return [...st.lck, ...st.ck].sort((a, b) => teamPower(b) - teamPower(a) || cmpStr(a, b)).slice(0, n);
}

function contractAsk(card: SeasonCard, tier: Tier): number {
  return storySalary(card, tier);
}

function bonusVal(b: Bonus): number {
  return (b.lck ?? 0) + (b.intl ?? 0) + (b.mvp ?? 0) + (b.callup ? 0.3 : 0) - (b.cut ?? 0);
}

/** 구단 명성·주전·돈으로 한 팀을 고릅니다. */
export function chooseTeam(s: Save, person: string, offers: Bid[], rng: Rng): BidResult {
  const name = CARDS[offers[0]?.cardId]?.name ?? PL[offers.find((o) => o.person === person)?.cardId ?? ""]?.name ?? person;
  if (!offers.length) return { person, name, reason: "제안이 없었습니다.", rejected: [] };
  const strong = new Set(topPowerTeams(s, 5));
  const scored = offers.map((o) => {
    const card = CARDS[o.cardId];
    const ask = card ? contractAsk(card, s.story!.lck.includes(o.team) ? "LCK" : "CK") : o.salary;
    const pr = prestige(s, o.team);
    const money = o.salary + bonusVal(o.bonuses);
    let score = pr * 0.5 + (o.starter ? 22 : 6) + Math.min(40, money * 2);
    let why = "";
    if (strong.has(o.team) && o.salary + 1e-6 >= ask * 0.85) {
      score += 14;
      why = "육성보다 안정 — 강팀의 제안이라 최저연봉이어도 좋다고 봤습니다";
    }
    if (o.starter) { score += 8; if (!why) why = "주전 자리가 비어 있던 팀으로 갔습니다"; }
    if (pr >= 62 && !why) why = "구단 명성을 우선시한 선택입니다";
    if (money >= ask * 1.15 && !why) why = "연봉 조건을 우선시한 선택입니다";
    if (!strong.has(o.team) && money < ask) score -= 18;
    if (!why) why = "조건이 가장 균형 있다고 판단했습니다";
    return { o, score: score + rng.next() * 4, why };
  });
  scored.sort((a, b) => b.score - a.score || cmpStr(a.o.team, b.o.team));
  const win = scored[0];
  const rejected = scored.slice(1).map((x) => {
    let why = "다른 팀의 조건이 더 맞았습니다";
    if (prestige(s, win.o.team) - prestige(s, x.o.team) >= 8) why = "구단 명성을 우선시한 선택입니다";
    else if (win.o.starter && !x.o.starter) why = "주전 자리를 우선했습니다";
    else if (win.o.salary > x.o.salary + 0.5) why = "연봉 조건을 우선했습니다";
    if (!topPowerTeams(s, 5).includes(x.o.team) && x.o.salary < (CARDS[x.o.cardId] ? contractAsk(CARDS[x.o.cardId], "CK") : x.o.salary)) {
      why = "약팀 제안은 더 높은 연봉과 보너스가 필요했습니다";
    }
    return { team: x.o.team, why };
  });
  return { person, name, winner: win.o.team, salary: win.o.salary, years: win.o.years, reason: win.why, rejected };
}

