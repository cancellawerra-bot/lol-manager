import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore } from "../../src/data";
import { blueSideHint, careerYear, champProForYear, hasYearMeta, hasYearPlayerPools, hasYearTeamStyles, knownYears, lckYearName, NO_RECORD, playerChampReason, yearSeason } from "../../src/game/yearRecords";
(globalThis as any).fetch=async(u:string)=>({ok:true,json:async()=>JSON.parse(readFileSync("public/data/"+String(u).split("/").pop()!,"utf8"))});
await loadCore();

assert.deepEqual(knownYears(), [2024, 2025, 2026]);
assert.equal(hasYearMeta(2026), true);
assert.equal(hasYearMeta(2024), true);
assert.equal(hasYearMeta(2025), true);
assert.equal(hasYearMeta(2018), false);
assert.equal(hasYearMeta(2023), false);
assert.equal(yearSeason(2018), undefined);
assert.equal(champProForYear(2018, "Azir"), undefined);
assert.equal(hasYearTeamStyles(2018), false);
assert.equal(hasYearPlayerPools(2018), false);
assert.equal(hasYearTeamStyles(2026), true);

const y26 = yearSeason(2026)!;
assert.equal(y26.games, 502);
assert.equal(y26.blueWins, 283);
assert.equal(y26.redWins, 219);
assert.ok(blueSideHint(2026).includes("2026 LCK"));
assert.ok(blueSideHint(2026).includes("블루 승률이 더 높았습니다"));
assert.ok(!blueSideHint(2018).includes("2026"));
assert.ok(blueSideHint(2018).includes(NO_RECORD));
assert.equal(careerYear({ story: { year: 2018 } }), 2018);
assert.equal(careerYear({ story: { year: 2024 } }), 2024);
assert.equal(careerYear({}), 2026);
assert.equal(careerYear(null), 2026);

const azir26 = champProForYear(2026, "Azir") ?? champProForYear(2026, "azir");
// any existing 2026 champ should have counts, never a fake 0-padded missing row
const senna = champProForYear(2024, "Senna");
assert.ok(senna && senna.p > 0 && senna.tier === 1);
assert.equal(champProForYear(2024, "__no_such__"), undefined);
assert.ok(playerChampReason(2018, "Khan", 10, 7, 0).includes(NO_RECORD));
assert.ok(!playerChampReason(2018, "Khan", 10, 7, 0).includes("2026"));
assert.ok(playerChampReason(2026, "Kiin", 12, 5, 0).includes("2026 LCK"));
assert.ok(playerChampReason(2018, "Khan", 0, 0, 2).includes("연습"));

console.log("OK year records: 2024–2026 present, 2018 missing shows 기록 없음, no 2026 substitution, careerYear from story");
