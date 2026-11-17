// 시즌 카드 → 시뮬용 선수, 로스터 규칙, 구단 하이드레이션
import { CARDS, CARDS_FILE, CORE, PL, TM, cardLabel, resetWorld } from "../data";
import type { CardsFile, SeasonCard, Player, Team } from "../types";
import type { Save, ClubInfo } from "./season";

export const BUDGETS = { easy: 120, normal: 100, hard: 80 } as const;
export type Diff = keyof typeof BUDGETS;

export function playerFromCard(c: SeasonCard): Player {
  const wins = c.wr != null ? Math.round(c.wr * c.games) : 0;
  const zOvr = c.composite;
  const zLane = c.metrics.includes("gd15") ? zOvr : 0;
  const zFight = c.metrics.includes("kda") || c.metrics.includes("kp") ? zOvr : 0;
  const zFarm = c.metrics.includes("cspm") || c.metrics.includes("dpm") ? zOvr * 0.5 : 0;
  const pct = Math.round(c.percentile);
  return {
    key: c.id, name: c.name, full: cardLabel(c), team: -1, pos: c.posIdx,
    games: c.games, gamesPos: c.games, wins, teamsPlayed: { [c.team]: c.games },
    m: { gd: c.gd15, csd: null, xpd: null, kda: c.kda ?? 0, kp: c.kp ?? 0, dpm: c.dpm ?? 0, dsh: 0, gpm: 0, cspm: c.cspm ?? 0, vspm: 0, wk: 0, pool: 0 },
    kdaRaw: [c.kills ?? 0, c.deaths ?? 0, c.assists ?? 0],
    pool: [],
    z: { lane: zLane, fight: zFight, farm: zFarm, vision: 0, pool: 0, ovr: zOvr },
    pct: { lane: c.gd15 == null ? 50 : pct, fight: pct, farm: c.cspm == null && c.dpm == null ? 50 : pct, vision: 50, pool: 50, ovr: pct },
    small: c.small, cardYear: c.year, cardTeam: c.team, personKey: c.pkey, salary: c.salary, limited: c.limited, label: cardLabel(c),
  };
}

export const salaryOf = (key: string): number => {
  if (CARDS[key]) return CARDS[key].salary;
  const p = PL[key];
  if (p?.salary != null) return p.salary;
  const c = Object.values(CARDS).find((x) => x.year === 2026 && x.pkey === (p?.personKey ?? key) && x.posIdx === p?.pos);
  return c?.salary ?? 0;
};

export function rosterSalary(keys: string[]): number { return keys.reduce((s, k) => s + salaryOf(k), 0); }

export function personUsed(keys: string[], pkey: string, except?: string): boolean {
  return keys.some((k) => k !== except && (CARDS[k]?.pkey ?? PL[k]?.personKey ?? k) === pkey);
}

export function weakestTeam(): string {
  return [...CORE.teams].sort((a, b) => a.gw / Math.max(1, a.gw + a.gl) - b.gw / Math.max(1, b.gw + b.gl))[0].short;
}

export function hydrateSave(s: Pick<Save, "team" | "mode" | "club" | "starters" | "cards"> & { story?: Save["story"] }): void {
  resetWorld();
  const cardIds = s.cards ?? [];
  for (const ids of Object.values(s.starters ?? {})) for (const id of ids) if (CARDS[id] && !PL[id]) PL[id] = playerFromCard(CARDS[id]);
  for (const id of cardIds) if (CARDS[id] && !PL[id]) PL[id] = playerFromCard(CARDS[id]);
  if (s.mode === "story") {
    for (const ids of Object.values(s.starters ?? {})) for (const id of ids) if (id && !PL[id] && CARDS[id]) PL[id] = playerFromCard(CARDS[id]);
    return; /* applyStoryWorld는 store에서 호출해 순환 참조를 피합니다 */
  }
  if (s.club) applyClub(s.club, s.starters[s.team] ?? [], s.cards ?? []);
  else if (s.mode === "fantasy" || (s.cards && s.cards.length)) {
    const starters = s.starters[s.team] ?? [];
    const players = unique([...starters, ...(s.cards ?? [])]);
    if (TM[s.team]) {
      TM[s.team] = { ...TM[s.team], starters: starters.length === 5 ? starters : TM[s.team].starters, players };
    }
  }
}

function unique(a: string[]): string[] { return [...new Set(a)]; }

export function applyClub(club: ClubInfo, starters: string[], bench: string[]): Team {
  const src = (club.replaced ? TM[club.replaced] : undefined) ?? CORE.teams.find((t) => t.short === club.replaced);
  const players = unique([...starters, ...bench]);
  const t: Team = {
    id: src?.id ?? 99, short: club.short, name: club.name, ko: club.name, color: club.color,
    starters: starters.length === 5 ? starters : (src?.starters ?? []),
    players, real: [0, 0, 0, 0], gw: 0, gl: 0, founded: true,
  };
  if (club.replaced && club.short !== club.replaced && TM[club.replaced]) delete TM[club.replaced];
  TM[club.short] = t;
  return t;
}

export function defaultStartersFor(short: string): string[] {
  return TM[short]?.starters ?? CORE.teams.find((t) => t.short === short)!.starters;
}

export function card2026ForPlayer(key: string): SeasonCard | undefined {
  const p = PL[key];
  const pkey = (p?.personKey ?? key).toLowerCase();
  return Object.values(CARDS).find((c) => c.year === 2026 && (c.pkey === pkey || c.name.toLowerCase() === (p?.name ?? key).toLowerCase()) && (p ? c.posIdx === p.pos : true));
}

export const CARD_META = (): CardsFile["meta"] => CARDS_FILE.meta;
