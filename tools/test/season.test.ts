// 시즌 전체 자동 시뮬 회귀 테스트: node 로 실행 (esbuild 번들)
import { readFileSync } from "fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + u.split("/").pop()!, "utf8")) });
import { loadCore, loadRanked, CORE, PL, CH } from "../../src/data";
import { newCareer, finishDay, standings } from "../../src/game/season";
import { Rng } from "../../src/game/rng";
import { newDraft, autoDraft, SEQ } from "../../src/game/draft";
import { simulateGame } from "../../src/game/sim";

(async () => {
  await loadCore(); await loadRanked();
  // 1) 밴픽 규칙: 20단계, 중복 없음, 포지션 5개, 피어리스
  const rng = new Rng(7);
  const d = autoDraft(newDraft("GEN", "T1", CORE.teams.find(t=>t.short==="GEN")!.starters, CORE.teams.find(t=>t.short==="T1")!.starters, "R", []), rng);
  const all = [...d.bans.B, ...d.bans.R, ...d.picks.B.map(p=>p.c), ...d.picks.R.map(p=>p.c)];
  if (all.length !== 20 || new Set(all).size !== 20) throw new Error("draft dup");
  for (const s of ["B","R"] as const) if (new Set(d.picks[s].map(p=>p.pos)).size !== 5) throw new Error("pos");
  if (SEQ.length !== 20) throw new Error("seq");
  console.log("draft log sample:", d.log.slice(0,4).map(l=>`${l.side} ${l.kind} ${CH[l.c].ko} ← ${l.why.join(" | ")}`).join("\n  "));
  const locked = d.picks.B.map(p=>p.c).concat(d.picks.R.map(p=>p.c));
  const d2 = autoDraft(newDraft("T1", "GEN", CORE.teams.find(t=>t.short==="T1")!.starters, CORE.teams.find(t=>t.short==="GEN")!.starters, "B", locked), rng);
  if ([...d2.picks.B, ...d2.picks.R].some(p=>locked.includes(p.c))) throw new Error("fearless");
  // 2) 경기 전 확률 분포
  const r = simulateGame(d, {}, rng);
  console.log("pPre GEN(B) vs T1:", r.pPre.toFixed(3), r.factors.map(f=>`${f.key}:${f.v.toFixed(3)}`).join(" "));
  // 3) 시즌 20회 반복: 팀별 평균 순위
  const t0 = Date.now();
  const rankSum: Record<string, number> = {}; const champs: Record<string, number> = {};
  const N = Number(process.argv[2] ?? 10);
  for (let i = 0; i < N; i++) {
    const s = newCareer("T1", "테스트", 1, 1000 + i);
    const rr = new Rng(s.rng);
    while (s.phase !== "done") finishDay(s, rr);
    standings(s).forEach((row, k) => { rankSum[row.t] = (rankSum[row.t] ?? 0) + k + 1; });
    champs[s.champion!] = (champs[s.champion!] ?? 0) + 1;
    if (i === 0) { console.log("news sample:", s.news.slice(0, 6).map(n => n.title)); console.log("save size KB", (JSON.stringify(s).length/1024).toFixed(0)); }
  }
  console.log(`${N} seasons in ${Date.now()-t0}ms`);
  console.log("avg rank:", Object.entries(rankSum).sort((a,b)=>a[1]-b[1]).map(([t,v])=>`${t} ${(v/N).toFixed(1)}`).join(", "));
  console.log("champions:", champs);
  console.log("players", Object.keys(PL).length);
})().catch(e => { console.error(e); process.exit(1); });
