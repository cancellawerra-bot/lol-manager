// 정적 데이터 타입 (tools/build_data.py 가 만드는 public/data/*.json)
export type PosIdx = 0 | 1 | 2 | 3 | 4;
export interface Player {
  key: string; name: string; full: string; team: number; pos: PosIdx;
  games: number; gamesPos: number; wins: number; teamsPlayed: Record<string, number>;
  m: { gd: number | null; csd: number | null; xpd: number | null; kda: number; kp: number; dpm: number; dsh: number; gpm: number; cspm: number; vspm: number; wk: number; pool: number };
  kdaRaw: [number, number, number];
  pool: [string, number, number][];
  z: Record<"lane" | "fight" | "farm" | "vision" | "pool" | "ovr", number>;
  pct: Record<"lane" | "fight" | "farm" | "vision" | "pool" | "ovr", number>;
  small: boolean;
}
export interface Team {
  id: number; short: string; name: string; ko: string; color: string;
  starters: string[]; players: string[]; real: [number, number, number, number]; gw: number; gl: number;
}
export interface Style {
  games: number; bans: [string, number][]; p1bans: [string, number][]; picks: [string, number][]; p1picks: [string, number][]; firstPos: number[];
}
export interface Core {
  meta: {
    builtAt: string; season: string; games: number; players: number; rankedGames: number; rankedMin: number; blueWins: number; redWins: number; shrinkK: number; small: number;
    weights: Record<string, Record<string, number>>; groups: Record<string, string[]>; tierPolicy: string; laningSource: string;
    fullCompute: string; fullComputeLocked: string; period: [string, string]; rounds12: string[];
  };
  teams: Team[]; players: Player[]; styles: Record<string, Style>;
  laning: Record<string, { games: number; gd: number; csd: number; xpd: number }>;
}
export interface Champ {
  id: string; ko: string; tags: string; pos: string[]; dmg: string; ranged: boolean; d: number; u: number; c: number; mo: number; ut: number; grp: string[];
  pro: { p: number; b: number; w: number; eb: number | null; pr: number | null; tier: number | null; ok: boolean } | null;
  proPos: number[];
}
export interface Ranked {
  meta: { games: number; tiers: Record<string, number>; versions: Record<string, number>; min: number; source: string };
  lane: Record<string, [number, number]>; mu: Record<string, [number, number]>; syn: Record<string, [number, number]>;
}
