import type { Core, Champ, Ranked, Player, Team } from "./types";

export let CORE: Core;
export let CHAMPS: Champ[] = [];
export const CH: Record<string, Champ> = {};
export const PL: Record<string, Player> = {};
export const TM: Record<string, Team> = {};
export let RANKED: Ranked | null = null;

async function get<T>(name: string): Promise<T> {
  const r = await fetch(`./data/${name}.json`, { cache: "force-cache" });
  if (!r.ok) throw new Error(`${name}.json ${r.status}`);
  return r.json() as Promise<T>;
}

export async function loadCore(): Promise<void> {
  if (CORE) return;
  const [core, champs] = await Promise.all([get<Core>("core"), get<Champ[]>("champs")]);
  CORE = core; CHAMPS = champs;
  for (const c of champs) CH[c.id] = c;
  for (const p of core.players) PL[p.key] = p;
  for (const t of core.teams) TM[t.short] = t;
}
let rankedP: Promise<Ranked> | null = null;
export function loadRanked(): Promise<Ranked> {
  if (!rankedP) rankedP = get<Ranked>("ranked").then((r) => { RANKED = r; return r; });
  return rankedP;
}

export const POS_KO = ["탑", "정글", "미드", "원딜", "서폿"];
export const POS_EN = ["TOP", "JGL", "MID", "BOT", "SUP"];
export const TAG_KO: Record<string, string> = { F: "전사", T: "탱커", M: "마법사", A: "암살자", K: "원거리 딜러", S: "서포터" };
// toLocaleString 은 느려서(시뮬 중 수만 번 호출) 직접 천 단위 구분
export const fmt = (n: number, d = 0): string => { const s = Math.abs(n).toFixed(d); const [i, f] = s.split("."); return (n < 0 && Number(s) !== 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : ""); };
export const pctTxt = (w: number, n: number, d = 1): string => (n > 0 ? `${((w / n) * 100).toFixed(d)}%` : "–");
export function teamPlayers(short: string): Player[] { return TM[short].players.map((k) => PL[k]); }
