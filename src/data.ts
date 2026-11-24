import type { Core, Champ, Ranked, Player, Team, CardsFile, SeasonCard } from "./types";
import { setYearMeta, type YearMetaFile } from "./game/yearRecords";

export let CORE: Core;
export let CHAMPS: Champ[] = [];
export const CH: Record<string, Champ> = {};
export const PL: Record<string, Player> = {};
export const TM: Record<string, Team> = {};
export let RANKED: Ranked | null = null;
export let CARDS_FILE: CardsFile;
export const CARDS: Record<string, SeasonCard> = {};
export const CARDS_BY_PERSON: Record<string, SeasonCard[]> = {};

async function get<T>(name: string): Promise<T> {
  const r = await fetch(`./data/${name}.json`, { cache: "no-cache" });
  if (!r.ok) throw new Error(`${name}.json ${r.status}`);
  return r.json() as Promise<T>;
}

export async function loadCore(): Promise<void> {
  if (CORE) return;
  const [core, champs, cards, yearMeta] = await Promise.all([get<Core>("core"), get<Champ[]>("champs"), get<CardsFile>("cards"), get<YearMetaFile>("yearMeta")]);
  CORE = core; CHAMPS = champs; CARDS_FILE = cards; setYearMeta(yearMeta);
  for (const c of champs) CH[c.id] = c;
  for (const c of cards.cards) {
    CARDS[c.id] = c;
    (CARDS_BY_PERSON[c.pkey] ??= []).push(c);
  }
  resetWorld();
}

/** CORE 원본으로 PL/TM 을 다시 채웁니다. 커리어를 불러올 때 hydrate 전에 호출합니다. */
export function resetWorld(): void {
  for (const k of Object.keys(PL)) delete PL[k];
  for (const k of Object.keys(TM)) delete TM[k];
  for (const p of CORE.players) PL[p.key] = p;
  for (const t of CORE.teams) TM[t.short] = { ...t, starters: [...t.starters], players: [...t.players] };
}

let rankedP: Promise<Ranked> | null = null;
export function loadRanked(): Promise<Ranked> {
  if (!rankedP) rankedP = get<Ranked>("ranked").then((r) => { RANKED = r; return r; });
  return rankedP;
}

export const POS_KO = ["탑", "정글", "미드", "원딜", "서포터"];
export const POS_EN = ["TOP", "JGL", "MID", "BOT", "SUP"];
export const POS_CARD = ["TOP", "JNG", "MID", "BOT", "SUP"];
export const TAG_KO: Record<string, string> = { F: "전사", T: "탱커", M: "마법사", A: "암살자", K: "원거리 딜러", S: "서포터" };
export const fmt = (n: number, d = 0): string => { const s = Math.abs(n).toFixed(d); const [i, f] = s.split("."); return (n < 0 && Number(s) !== 0 ? "-" : "") + i.replace(/\B(?=(\d{3})+(?!\d))/g, ",") + (f ? "." + f : ""); };
export const pctTxt = (w: number, n: number, d = 1): string => (n > 0 ? `${((w / n) * 100).toFixed(d)}%` : "–");
export function teamPlayers(short: string): Player[] { return (TM[short]?.players ?? []).map((k) => PL[k]).filter(Boolean); }
export const cardLabel = (c: SeasonCard): string => `${c.year} ${c.name}`;
export const recTxt = (v: number | null | undefined, fmt0?: (n: number) => string): string => (v == null ? "기록 없음" : (fmt0 ? fmt0(v) : String(v)));
