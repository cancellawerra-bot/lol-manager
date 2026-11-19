import assert from "node:assert/strict";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { loadCore, loadRanked, CARDS, PL } from "../../src/data";
import { newStoryCareer, marketCards, storySalary, ensurePlayer, cardForYear } from "../../src/game/story";
import { simSeries, type Save, type SeriesRec } from "../../src/game/season";
import { Rng } from "../../src/game/rng";
import { initializeRotation, makePromise, cancelPromise, promiseCapacity, prepareSeriesLineups, recordAppearances, syncPromises } from "../../src/game/rotation";
import { initializeTraining, prepareSeriesTraining, playerTraining } from "../../src/game/trainingRuntime";
import { trainingProfile } from "../../src/game/training";
import { PLAYER_BIRTHDATES } from "../../src/game/playerBirthdates";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
await loadCore(); await loadRanked();
const raw = JSON.stringify(CARDS), used = new Set<string>();
const cards = Array.from({length:5}, (_, pos) => { const c = marketCards(2018).filter(c => c.posIdx === pos && !used.has(c.pkey)).sort((a,b) => storySalary(a,"CK") - storySalary(b,"CK"))[0]; used.add(c.pkey); return c.id; });
function start(): Save {
  const s = newStoryCareer("ROT", "검증", 1, 21, { club: {name:"로테이션 검증",short:"ROT",color:"#009999"}, managerInfo:{name:"검증",birth:"",nation:"한국",career:"amateur"}, cards:[...cards], starters:[...cards], difficulty:"normal" });
  const bench = marketCards(2018).filter(c => c.posIdx === 0 && !s.story!.contracts.some(ct => ct.person === c.pkey)).sort((a,b) => storySalary(a,"CK")-storySalary(b,"CK"))[0];
  const key = ensurePlayer(bench,2018,!!cardForYear(bench.pkey,2018,0)?.estimated), salary=storySalary(bench,"CK"); s.story!.contracts.push({key,person:bench.pkey,cardId:bench.id,salary,years:2,prepaid:true}); s.cards.push(key);s.eco.cash=Math.round((s.eco.cash-salary)*100)/100;assert(s.eco.cash>=0);assert.equal(s.story!.contracts.length,6);
  s.schedOk = true; initializeTraining(s); return s;
}
function regular(s:Save,n:number):SeriesRec { const sr:SeriesRec={id:`ROT-${n}`,day:0,stage:"R",a:s.team,b:s.story!.ck.find(t=>t!==s.team)!,bo:3,games:[],sa:0,sb:0}; s.days[0].date=`2018-02-${String(1+n*2).padStart(2,"0")}`; s.day=0;s.story!.phase="regular";s.series=[sr];return sr; }
const s=start(), a=s.starters[s.team][0], b=s.story!.contracts.at(-1)!.key, bp=s.story!.contracts.at(-1)!.person;
assert.equal(s.rotation,undefined); initializeRotation(s); assert.equal(Object.keys(s.rotation!.players).length,0);
assert.equal(makePromise(s,a,3),undefined); assert(makePromise(s,b,2)?.includes("선발 기회")); assert.equal(makePromise(s,b,1),undefined);
assert(promiseCapacity(Object.values(s.rotation!.promises)));
const rng=new Rng(44), before=s.eco.trust, snapshot=JSON.stringify(s.story!.contracts);
for(let n=0;n<4;n++) { const sr=regular(s,n); simSeries(s,sr,rng); assert(sr.games.length>=2); assert(sr.games.every(g=>g.appearances?.B.length===5&&g.appearances.R.length===5)); for(const g of sr.games)for(const p of [...g.appearances!.B,...g.appearances!.R])assert.equal(p.after,Math.min(100,p.before+2*trainingProfile(PLAYER_BIRTHDATES[p.person],s.days[0].date).fatigueLoad)); const stats=JSON.stringify(s.rotation),fatigue=JSON.stringify(s.training);recordAppearances(s,sr,0);assert.equal(JSON.stringify(s.rotation),stats);assert.equal(JSON.stringify(s.training),fatigue); }
assert.equal(Object.keys(s.rotation!.promises).length,0);assert.equal(s.rotation!.history.filter(h=>h.outcome==="fulfilled").length,2);assert.equal(s.eco.trust,before+2);assert.equal(JSON.stringify(s.story!.contracts),snapshot);assert(s.rotation!.players[bp].starts>=1);
console.log("OK actual automatic matches honor 3/4 + 1/4 promises, recorded once, no money or contract changes");
const manual=start(); initializeRotation(manual)!.automatic=false;const mb=manual.story!.contracts.at(-1)!;makePromise(manual,mb.key,1);const trust=manual.eco.trust;
for(let n=0;n<4;n++)simSeries(manual,regular(manual,n),new Rng(100+n));assert.equal(manual.rotation!.history[0].outcome,"missed");assert.equal(manual.eco.trust,trust-2);
const lock=regular(manual,5);manual.session={seriesId:lock.id,gameIdx:0,holder:"",stage:"draft",simStep:0};assert(makePromise(manual,mb.key,1));manual.session=undefined;assert.equal(makePromise(manual,mb.key,1),undefined);cancelPromise(manual,mb.person);assert.equal(manual.eco.trust,trust-4);assert.equal(makePromise(manual,mb.key,1),undefined);manual.story!.contracts=manual.story!.contracts.filter(c=>c!==mb);syncPromises(manual);assert.equal(manual.rotation!.history[0].outcome,"departed");assert.equal(manual.eco.trust,trust-4);
console.log("OK actual manual non-selection misses promise; lock, withdrawal and transfer closure are explicit");
const rest=start(),rsr=regular(rest,0),rb=rest.story!.contracts.at(-1)!;initializeRotation(rest)!.automatic=false;prepareSeriesTraining(rest,rsr);const rested=playerTraining(rest,rb.key)!.fatigue;simSeries(rest,rsr,new Rng(22));assert.equal(playerTraining(rest,rb.key)!.fatigue,rested);assert(rsr.games[0].appearances!.B.some(p=>p.load>0));
console.log("OK only actual participants receive age-adjusted match fatigue; bench load stays unchanged");
const fatigue=start(), fsr=regular(fatigue,0);prepareSeriesTraining(fatigue,fsr);const fk=fatigue.starters[fatigue.team][0],fb=fatigue.story!.contracts.at(-1)!.key,fp=fatigue.story!.contracts.find(c=>c.key===fk)!.person;
// 실제 카드끼리 충분한 피로 차이가 있을 때 선발이 바뀌는지 검사합니다.
const same=PL[fb].pct.ovr-PL[fk].pct.ovr;if(Math.abs(same)>8) { const card=marketCards(2018).filter(c=>c.posIdx===0&&!fatigue.story!.contracts.some(ct=>ct.person===c.pkey)).sort((a,b)=>Math.abs(a.percentile-PL[fk].pct.ovr)-Math.abs(b.percentile-PL[fk].pct.ovr))[0];const key=ensurePlayer(card,2018,false);fatigue.story!.contracts[5]={key,person:card.pkey,cardId:card.id,salary:storySalary(card,"CK"),years:2};fatigue.cards=[...fatigue.starters[fatigue.team],key]; }
fatigue.training!.players[fp]={...playerTraining(fatigue,fk)!,fatigue:100};prepareSeriesLineups(fatigue,fsr);assert.notEqual(fatigue.starters[fatigue.team][0],fk);const chosen=JSON.stringify(fatigue.starters);prepareSeriesLineups(fatigue,fsr);assert.equal(JSON.stringify(fatigue.starters),chosen);
console.log("OK fatigue changes actual selected lineup; repeated preparation cannot reselect");
const playoff=start(),pc=playoff.story!.contracts.at(-1)!;makePromise(playoff,pc.key,1);const psr=regular(playoff,0);psr.stage="SF";playoff.story!.phase="playoffs";simSeries(playoff,psr,new Rng(17));assert.equal(playoff.rotation!.promises[pc.person].opportunities,0);
const prior=JSON.stringify(psr.games[0].appearances);playoff.story!.contracts=[];playoff.rotation=undefined;initializeRotation(playoff);assert.equal(JSON.stringify(psr.games[0].appearances),prior);assert.equal(Object.keys(playoff.rotation!.players).length,0);assert.equal(JSON.stringify(CARDS),raw);
console.log("OK playoffs do not consume promises; prior snapshots, legacy saves and real source data preserved");
const finalYear=start();finalYear.story!.year=2027;finalYear.story!.split="summer";finalYear.series=finalYear.series.filter(sr=>sr.a===finalYear.team||sr.b===finalYear.team).slice(0,3);assert(makePromise(finalYear,finalYear.starters[finalYear.team][0],1)?.includes("4시리즈"));
console.log("OK final career season refuses a four-series promise with only three fixtures left");
const storage=new Map<string,string>();(globalThis as any).localStorage={getItem:(k:string)=>storage.get(k)??null,setItem:(k:string,v:string)=>storage.set(k,v),removeItem:(k:string)=>storage.delete(k)};
const store=await import("../../src/store");const live=start(), lb=live.story!.contracts.at(-1)!;store.setSave(live);assert.equal(store.advance(),"match");store.afterPress();store.setStarter(live.team,0,lb.key);assert.equal(live.starters[live.team][0],lb.key);store.confirmLineup();const lockedKey=live.starters[live.team][0];store.setStarter(live.team,0,live.story!.contracts[0].key);assert.equal(live.starters[live.team][0],lockedKey);assert(store.promisePlayingTime(lb.key,1));store.choose("first");store.autoRest();store.runSim();store.toResult();const ledger=JSON.stringify(live.rotation),progress=JSON.stringify(live.training),past=JSON.stringify(live.series.find(sr=>sr.id===live.session!.seriesId)!.games[0].appearances);store.toResult();assert.equal(JSON.stringify(live.rotation),ledger);assert.equal(JSON.stringify(live.training),progress);store.loadSlot(1);assert.equal(JSON.stringify(store.getSave()!.rotation),ledger);assert.equal(JSON.stringify(store.getSave()!.series.find(sr=>sr.id===live.session!.seriesId)!.games[0].appearances),past);
console.log("OK actual store allows pre-draft swap, freezes drafted lineup and promise, persists one appearance/load");
if(process.argv.includes("--fixtures")){const fixture=start();mkdirSync("../rotation-qa",{recursive:true});writeFileSync("../rotation-qa/start.json",JSON.stringify(fixture));console.log("WROTE rotation QA fixture from real 2018 roster");}
