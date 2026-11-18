import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, CARDS } from "../../src/data";
import { franchisePlayers } from "../../src/game/story";
await loadCore();
const original = JSON.stringify(CARDS);
for (const year of [2018, 2024, 2027]) {
  const list = franchisePlayers(year);
  assert.equal(new Set(list.map((c) => c.pkey)).size, list.length, "한 선수는 한 항목");
  assert(list.every((c) => c.year <= Math.min(year, 2026)), "미래 기록 사용 금지");
  for (const c of list) assert(!Object.values(CARDS).some((x) => x.pkey === c.pkey && x.year <= Math.min(year, 2026) && x.year > c.year), "해당 연도에 가장 가까운 기록 사용");
  assert.equal(list.filter((c) => c.pkey === "faker").length, 1);
  assert.equal(list.find((c) => c.pkey === "faker")!.year, Math.min(year, 2026));
  assert.deepEqual(franchisePlayers(year).map((c) => c.id), list.map((c) => c.id), "조회 순서 고정");
  console.log("OK one person / latest available real record", year, list.length);
}
assert.equal(JSON.stringify(CARDS), original, "원본 시즌 기록은 변경하지 않음");
console.log("OK original season data unchanged");
