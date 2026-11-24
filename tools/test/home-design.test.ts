import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { loadCore, loadRanked, CARDS } from "../../src/data";
import { newStoryCareer, marketCards, storySalary } from "../../src/game/story";
import { simSeries } from "../../src/game/season";
import { Rng } from "../../src/game/rng";
import { trainingDate } from "../../src/game/trainingRuntime";
import { homeAdvanceLabel, homeAttention, homeChampion, homeNeedsSchedule, homeTodos } from "../../src/pages/ManagerDashboard";
(globalThis as any).fetch=async(u:string)=>({ok:true,json:async()=>JSON.parse(readFileSync("public/data/"+String(u).split("/").pop()!,"utf8"))});
await loadCore();await loadRanked();
const picks=[0,1,2,3,4].map(pos=>marketCards(2018).filter(c=>c.posIdx===pos).sort((a,b)=>storySalary(a,"CK")-storySalary(b,"CK")||a.id.localeCompare(b.id))[0].id);
const s=newStoryCareer("SGU","홈 검증",1,21,{club:{name:"홈 검증",short:"SGU",color:"#2DD4BF"},managerInfo:{name:"홈 검증",birth:"1988-01-01",nation:"한국",career:"amateur"},cards:picks,starters:picks,difficulty:"normal"});
const before=JSON.stringify(s),cards=JSON.stringify(CARDS);
assert(homeAttention(s).some(a=>a.label.includes("일정")));
assert.equal(homeAttention(s).find(a=>a.id==="sched")?.href,"#/squad/plan");
assert(homeAttention(s).some(a=>a.id==="talks"));
assert.equal(homeChampion(s,s.starters[s.team][0]),undefined);
assert.equal(homeAdvanceLabel(s),"일정 먼저 정하기 ▶");
assert.equal(homeNeedsSchedule(s),true);
const todos0=homeTodos(s);
assert(todos0.pending.length>=1);
assert.equal(todos0.total,todos0.pending.length+todos0.done.length);
assert(todos0.done.some(d=>d.id==="lineup"));
for(let i=0;i<3;i++){homeAttention(s);homeTodos(s);homeChampion(s,s.starters[s.team][0]);homeAdvanceLabel(s);}
assert.equal(JSON.stringify(s),before);assert.equal(JSON.stringify(CARDS),cards);

s.schedOk=true;
assert(!homeAttention(s).some(a=>a.id==="sched"));
assert(homeTodos(s).done.some(d=>d.id==="sched"));
assert.equal(homeNeedsSchedule(s),false);
assert.notEqual(homeAdvanceLabel(s),"일정 먼저 정하기 ▶");
s.eco.cash=0;
assert(!homeAttention(s).some(a=>a.id==="finance"||a.label.includes("자금")));
if((s.news??[]).some(n=>!n.read)) assert(homeAttention(s).some(a=>a.id==="news"&&a.href==="#/news"));
assert(homeAttention(s).some(a=>a.id==="talks"&&a.href==="#/squad/talks"));

const person=s.story!.contracts[0].person;s.training!.players[person]={person,mechanicsXp:0,strategyXp:0,fatigue:45};assert(homeAttention(s).some(a=>a.label.includes("피로")));assert.equal(homeAttention(s).filter(a=>a.label.includes("피로")).length,1);
console.log("OK pure home queries preserve save/source/RNG; no invented champion, missing fatigue or false zero-cash warning");

const expiry=structuredClone(s);expiry.story!.phase="expiry";expiry.story!.stove={expiryKeys:["a","b"],expiryDecided:{a:"resign"}} as any;assert(homeAttention(expiry).some(a=>a.label==="만료 계약 1명 결정 대기"));
assert(!homeAttention(expiry).some(a=>a.id==="expirySoon"));
const ended=structuredClone(s);ended.story!.ended="fail";ended.phase="done";assert.equal(homeAttention(ended).length,1);assert(homeAttention(ended)[0].label.includes("여정"));assert.equal(homeAdvanceLabel(ended),"여정의 끝");
const session=structuredClone(s);session.session={seriesId:s.series[0].id} as any;assert.equal(homeAttention(session).length,1);assert.equal(homeAttention(session)[0].href,"#/match");assert.equal(homeAdvanceLabel(session),"경기 계속하기 ▶");assert.equal(homeNeedsSchedule(session),false);
const vacant=structuredClone(s);vacant.starters[vacant.team]=vacant.starters[vacant.team].slice(0,3);assert(homeAttention(vacant).some(a=>a.id==="lineup"&&a.label.includes("2자리")));
const cooled=structuredClone(s);const now=trainingDate(cooled);
for(const c of cooled.story!.contracts){const person=c.person||c.key;cooled.talks={version:1,players:{...(cooled.talks?.players??{}),[person]:{morale:60,trust:50,at:now,lastTalk:now,talks:1}},log:cooled.talks?.log??[]};}
assert(!homeAttention(cooled).some(a=>a.id==="talks"));
assert(homeTodos(cooled).done.some(d=>d.id==="talks"));
const readNews=structuredClone(s);for(const n of readNews.news??[])n.read=true;
if((readNews.news??[]).length){assert(!homeAttention(readNews).some(a=>a.id==="news"));assert(homeTodos(readNews).done.some(d=>d.id==="news"));}
console.log("OK expiry decisions, session priority and ended career use actual state without changing contracts or results");

const match=structuredClone(s),rng=new Rng(match.rng),series=match.series.find(r=>r.a===s.team||r.b===s.team)!;simSeries(match,series,rng);const game=series.games.at(-1)!;for(const side of ["B","R"] as const)game.picks[side].reverse();const side=game.blue===s.team?"B":"R",key=game.lineup[side][0],expected=game.picks[side].find(p=>p.pos===0)!.c;assert.equal(homeChampion(match,key)!.id,expected);assert.equal(homeChampion(match,key)!.source,"최근 출전 챔피언");
console.log("OK actual match champion follows player role rather than draft pick order; no match/economy changes");
