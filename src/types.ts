// 정적 데이터 타입 (tools/build_data.py · tools/build_cards.py)
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
  cardYear?: number;
  cardTeam?: string;
  personKey?: string;
  salary?: number;
  limited?: boolean;
  label?: string;
  /** 화면 능력치를 따로 정한 선수(과거 카드 추정 등). 없으면 z.ovr로 계산 (src/rating.ts) */
  rating?: number;
  /** 국제대회 성적 보정 내역 (tools/apply_honors.py) */
  honors?: string[];
  /** 교수님(오너) 평가 능력치 (tools/owner_ratings.json) */
  ownerRating?: number;
}
export interface Team {
  id: number; short: string; name: string; ko: string; color: string;
  starters: string[]; players: string[]; real: [number, number, number, number]; gw: number; gl: number;
  founded?: boolean;
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
export interface SeasonCard {
  id: string; pkey: string; name: string; year: number; pos: string; posIdx: PosIdx; team: string; games: number;
  kills: number | null; deaths: number | null; assists: number | null;
  kda: number | null; wr: number | null; kp: number | null; gd15: number | null; dpm: number | null; cspm: number | null;
  percentile: number; rank: number | null; pool: number | null; salary: number; composite: number;
  honors?: string[]; honorBonus?: number; compositeBase?: number; percentileBase?: number; ownerRating?: number;
  /** 판타지 드래프트 전용 시장 추정 연봉(억, 게임용 가상 금액, tools/market_salaries.json). 없으면 salary */
  fantasySalary?: number; market?: boolean; marketNote?: string;
  small: boolean; limited: boolean; source: string; metrics: string[]; eligible: boolean;
}
export interface CardsFile { meta: { builtAt: string; years: [number, number]; cards: number; eligible: number; minGames: number; eligibleMinGames: number; formula: string; salaryNote: string; sources: string[]; rule: string }; cards: SeasonCard[] }
