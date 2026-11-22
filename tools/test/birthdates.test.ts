import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PLAYER_BIRTHDATES } from "../../src/game/playerBirthdates";
import { trainingProfile, trainingSession } from "../../src/game/training";

const cards = JSON.parse(readFileSync("public/data/cards.json", "utf8")).cards as { pkey: string; year: number }[];
const core = JSON.parse(readFileSync("public/data/core.json", "utf8")).players as { key: string; personKey?: string }[];
const audit = JSON.parse(readFileSync("docs/research/player_birthdates_verified.json", "utf8"));
const all = new Set([...cards.map((c) => c.pkey), ...core.map((p) => p.personKey ?? p.key.toLowerCase())]);
const verified = Object.keys(PLAYER_BIRTHDATES);
assert.equal(all.size, 396); // 2026-11-22 오너 결정으로 선수 1명 카드를 제외해 397에서 396
assert.equal(verified.length, 390);
assert.equal(audit.verified.length, verified.length);
assert.equal(audit.missing.length, 6);
assert.equal(new Set([...audit.verified, ...audit.missing].map((r) => r.person)).size, all.size);
for (const row of audit.verified) {
  assert(all.has(row.person));
  assert.equal(PLAYER_BIRTHDATES[row.person]?.date, row.date);
  assert.equal(PLAYER_BIRTHDATES[row.person]?.sourceUrl, row.sourceUrl);
  assert.equal(row.precision, "day");
  assert.equal(row.checkedAt, "2026-11-18");
  assert(trainingProfile(PLAYER_BIRTHDATES[row.person], "2027-01-20").known);
}
for (const row of audit.missing) {
  assert(all.has(row.person));
  assert.equal(PLAYER_BIRTHDATES[row.person], undefined);
  const p = trainingProfile(PLAYER_BIRTHDATES[row.person], "2027-01-20");
  assert.equal(p.known, false); assert.equal(p.age, undefined);
  assert.deepEqual([p.mechanics, p.strategy, p.recovery, p.fatigueLoad], [1, 1, 1, 1]);
}
assert.deepEqual(audit.missing.map((r) => r.person).sort(), ["ashart", "clear (kim jae-yeol)", "nolja", "nonamed", "raccoon (hwang won-jun)", "vin (shin min-jae)"].sort());
console.log("OK complete birth coverage audit: 390/396 IDs; remaining 6 neutral with source reasons");

assert.equal(PLAYER_BIRTHDATES.calix.date, "2007-03-22");
assert.equal(PLAYER_BIRTHDATES.smash.date, "2006-07-20");
assert.equal(PLAYER_BIRTHDATES.clear.date, "2002-12-19");
assert.equal(PLAYER_BIRTHDATES["clear (kim jae-yeol)"], undefined);
assert.equal(PLAYER_BIRTHDATES.fly.date, "1996-02-25");
assert.equal(PLAYER_BIRTHDATES.way.date, "2002-06-29");
assert.equal(PLAYER_BIRTHDATES["promise (cheon min-ki)"].date, "1992-01-16");
assert(PLAYER_BIRTHDATES["promise (cheon min-ki)"].sourceUrl.includes("news=79465"));
for (const [alias, canonical] of [["a lilac", "lilac"], ["captainjack", "cpt jack"], ["a wolf", "wolf"], ["ganked by mom", "gbm"], ["mandu", "poohmandu"], ["cheonju", "acorn"], ["chunyang", "heart"], ["solo (lee gwan-hyung)", "heart"]]) {
  assert.equal(PLAYER_BIRTHDATES[alias].date, PLAYER_BIRTHDATES[canonical].date);
  assert.equal(PLAYER_BIRTHDATES[alias].sourceUrl, PLAYER_BIRTHDATES[canonical].sourceUrl);
}
for (const person of ["slayer", "enosh", "bluffing", "painter", "minous"]) assert(trainingProfile(PLAYER_BIRTHDATES[person], "2026-06-01").known);
console.log("OK homonyms, historical aliases, primary roster evidence and five core-only players");

const birth = PLAYER_BIRTHDATES.catch;
assert.equal(birth.date, "1997-04-03");
assert.equal(trainingProfile(birth, "2018-01-20").age, 20);
const empty = { person: "catch", mechanicsXp: 0, strategyXp: 0, fatigue: 0 };
const young = trainingSession(empty, "mechanics", "2018-01-20", birth).progress;
const neutral = trainingSession(empty, "mechanics", "2018-01-20").progress;
assert(young.mechanicsXp > neutral.mechanicsXp);
assert(young.fatigue < neutral.fatigue);
const older = trainingSession(empty, "mechanics", "2027-01-20", birth).progress;
assert(older.fatigue > young.fatigue);
const restored = JSON.parse(JSON.stringify(young));
assert.deepEqual(trainingSession(restored, "mechanics", "2018-01-20", birth).progress, young);
console.log("OK newly verified real player age changes training and fatigue without duplicate save growth");
