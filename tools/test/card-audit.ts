// v2.22.0 카드 역전 검수 (교수님 지적 2026-11-22: "지표가 24가 더 높은데 연봉이 더 높아야지", "판단도 더 높아야 하는 거 아냐?")
// 같은 선수·같은 포지션의 2024–2026 카드 쌍에서, 실제 지표(KDA·승률·GD@15·DPM·KP) 5개 중 4개 이상이 더 좋은데
// 능력치·연봉·판단이 더 낮으면 '역전'으로 셉니다. (같으면 역전 아님)
import { readFileSync } from "node:fs";
export type Card = { id: string; pkey: string; name: string; year: number; pos: string; games: number; kda: number | null; wr: number | null; gd15: number | null; dpm: number | null; kp: number | null; fantasyRating: number; fantasySalary: number; four?: Record<string, number | null>; ownerRating?: number; market?: boolean; marketNote?: string };
export const METRICS = ["kda", "wr", "gd15", "dpm", "kp"] as const;
export const YEARS = [2024, 2025, 2026];
export type Inv = { kind: "rating" | "salary" | "judge"; better: string; worse: string; wins: number; of: number; a: number; b: number };
export function dominates(a: Card, b: Card): { wins: number; of: number } {
  let wins = 0, of = 0;
  for (const m of METRICS) { const x = a[m], y = b[m]; if (x == null || y == null) continue; of++; if (x > y) wins++; }
  return { wins, of };
}
export function audit(cards: Card[]): Inv[] {
  const out: Inv[] = [];
  const by = new Map<string, Card[]>();
  for (const c of cards) if (YEARS.includes(c.year)) { const k = `${c.pkey}|${c.pos}`; by.set(k, [...(by.get(k) ?? []), c]); }
  for (const cs of by.values()) for (const a of cs) for (const b of cs) {
    if (a === b) continue;
    const { wins, of } = dominates(a, b);
    if (of < 4 || wins < 4) continue;
    const add = (kind: Inv["kind"], x?: number | null, y?: number | null) => { if (x != null && y != null && x < y) out.push({ kind, better: a.id, worse: b.id, wins, of, a: x, b: y }); };
    add("rating", a.fantasyRating, b.fantasyRating);
    add("salary", a.fantasySalary, b.fantasySalary);
    add("judge", a.four?.judge, b.four?.judge);
  }
  return out;
}
export const loadCards = (p = "public/data/cards.json"): Card[] => JSON.parse(readFileSync(p, "utf8")).cards;
if (process.argv[1]?.endsWith("card-audit.ts")) {
  const inv = audit(loadCards(process.argv[2]));
  const cnt = (k: string) => inv.filter((i) => i.kind === k).length;
  console.log(`역전: 능력치 ${cnt("rating")} · 연봉 ${cnt("salary")} · 판단 ${cnt("judge")} (합계 ${inv.length})`);
  for (const i of inv) console.log(`  ${i.kind}\t${i.better} (${i.a}) < ${i.worse} (${i.b})\t지표 ${i.wins}/${i.of}`);
}
