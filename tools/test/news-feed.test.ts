import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
(globalThis as any).fetch = async (u: string) => ({ ok: true, json: async () => JSON.parse(readFileSync("public/data/" + String(u).split("/").pop()!, "utf8")) });
import { loadCore, loadRanked } from "../../src/data";
import { newCareer, addNews, finishDay, standings } from "../../src/game/season";
import { newHistoryCareer, finishStoryDay } from "../../src/game/story";
import { Rng } from "../../src/game/rng";
import { fanOpinion, publishMatchdayNews, NEWS_CAP, teamKo } from "../../src/game/newsFeed";
import { homeTodos, homeAttention } from "../../src/pages/ManagerDashboard";

await loadCore(); await loadRanked();
const info = { name: "소식검증", birth: "1988-01-01", nation: "한국", career: "amateur" as const };

const beforeNews = (s: ReturnType<typeof newHistoryCareer>) => s.news.map((n) => n.title);
{
  const s = newHistoryCareer("KZ", 1, 11, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const opening = beforeNews(s);
  assert.ok(opening.some((t) => /부임|창단|개막/.test(t)), "시작 소식은 부임·개막");
  const startLen = s.news.length;
  const startCash = s.eco.cash, startFans = s.eco.fans;
  const snap = JSON.stringify(s);
  const o0 = fanOpinion(s);
  assert.equal(JSON.stringify(s), snap, "여론 계산은 저장을 바꾸지 않음");
  assert.equal(o0.mood, "calm");
  assert.equal(s.eco.fans, startFans);

  const rng = new Rng(s.rng);
  const startDay = s.day;
  for (let i = 0; i < 6 && s.story!.phase === "regular"; i++) finishStoryDay(s, rng);
  assert.ok(s.day > startDay, "며칠 진행됨");
  const mine = s.series.filter((x) => x.winner && (x.a === s.team || x.b === s.team));
  const others = s.series.filter((x) => x.winner && x.a !== s.team && x.b !== s.team && x.stage === "R");
  assert.ok(mine.length >= 1, "우리 경기가 있음");
  assert.ok(others.length >= 1, "같은 리그 다른 경기가 있음");
  const resultNews = s.news.filter((n) => n.kind === "result" || n.kind === "upset" || n.kind === "playoff");
  assert.ok(resultNews.length >= mine.length, "우리 경기 결과가 소식으로 남음");
  const otherNews = s.news.filter((n) => (n.kind === "result" || n.kind === "upset") && n.team !== s.team);
  assert.ok(otherNews.length >= 1, "리그 다른 경기 결과도 소식으로 남음");
  assert.ok(s.news.length > startLen, "소식이 쌓임");
  const withDetail = resultNews.filter((n) => n.detail?.standings?.length);
  assert.ok(withDetail.length >= 1, "상세에 순위 스냅샷");
  assert.ok(withDetail.some((n) => n.seriesId), "시리즈 id 연결");
  const unread = s.news.filter((n) => !n.read).length;
  assert.ok(unread >= 1);
  assert.ok(homeAttention(s).some((a) => a.id === "news" && a.href === "#/news"));
  const one = s.news.find((n) => !n.read)!;
  one.read = true;
  const mid = s.news.filter((n) => !n.read).length;
  assert.equal(mid, unread - 1);
  s.news.forEach((n) => { n.read = true; });
  assert.ok(!homeAttention(s).some((a) => a.id === "news"));
  assert.ok(homeTodos(s).done.some((d) => d.id === "news"));
  assert.equal(s.eco.cash, startCash, "소식 생성은 자금을 바꾸지 않음");
  assert.equal(s.eco.fans, startFans, "여론은 팬심 수치를 바꾸지 않음");
  const banned = /인벤|포모스|펨코|디시인사이드|FMKorea|fmkorea|골든보이|쓰레기|ㅂㅅ|꺼져/;
  const o = fanOpinion(s);
  assert.ok(o.score >= 5 && o.score <= 95);
  assert.equal(new Set(o.posts.map((p) => p.text)).size, o.posts.length, "여론 글 문장이 서로 다름");
  assert.equal(o.form.length, Math.min(5, mine.length));
  for (const p of o.posts) {
    assert.ok(!banned.test(p.text + p.board), "실제 커뮤니티 이름·욕설 금지: " + p.board + p.text);
    assert.ok(!/“.*”/.test(p.text), "팬 글에 지어낸 발언 인용 없음");
  }
  const mineNews = s.news.filter((n) => n.kind === "result" && n.team === s.team);
  assert.ok(mineNews.some((n) => /승리|패/.test(n.title)));
  {
  const s = newHistoryCareer("BBQ", 1, 13, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const fans = s.eco.fans;
  const rng = new Rng(s.rng);
  for (let i = 0; i < 8 && s.story!.phase === "regular"; i++) finishStoryDay(s, rng);
  const mine = s.series.filter((x) => x.winner && (x.a === s.team || x.b === s.team));
  const losses = mine.filter((x) => x.winner !== s.team);
  const wins = mine.filter((x) => x.winner === s.team);
  const lossNews = s.news.filter((n) => n.team === s.team && n.kind === "result" && /패$/.test(n.title));
  const winNews = s.news.filter((n) => n.team === s.team && n.kind === "result" && /승리$/.test(n.title));
  assert.ok(losses.length >= 1 || wins.length >= 1, "약한 팀도 결과가 있음");
  if (losses.length) assert.ok(lossNews.length >= 1, "패배 소식 제목에 패");
  const o = fanOpinion(s);
  assert.equal(s.eco.fans, fans);
  if (losses.length) assert.ok(/패/.test(o.summary + o.posts.map(p=>p.text).join(" ")), "패배 후 여론이 결과를 언급");
  console.log("history 2018 BBQ series", mine.length, "W", wins.length, "L", losses.length, "lossNews", lossNews.length, "mood", o.mood, o.score);
}

console.log("history 2018 KZ days", s.day, "news", s.news.length, "mine series", mine.length, "sample:", s.news.slice(0, 8).map((n) => `[${n.kind}] ${n.title}`));
}

{
  const s = newCareer("GEN", "로스터검증", 1, 21, { mode: "roster", managerInfo: { name: "로스터검증", birth: "", nation: "한국", career: "amateur" } });
  const rng = new Rng(s.rng);
  const fans = s.eco.fans;
  finishDay(s, rng);
  const others = s.news.filter((n) => n.kind === "result" && n.team !== s.team);
  const mine = s.news.filter((n) => (n.kind === "result" || n.kind === "upset") && (n.title.includes("GEN") || n.team === "GEN"));
  assert.ok(s.news.some((n) => n.kind === "result"), "로스터 모드도 경기 결과 소식");
  assert.ok(others.length >= 1, "로스터 모드 타 경기 소식");
  assert.ok(mine.length >= 1, "로스터 모드 우리 경기 소식");
  assert.equal(s.eco.fans, fans);
  console.log("roster day0 news", s.news.filter((n) => n.kind === "result").length, "other", others.length);
}

{
  const s = newHistoryCareer("KZ", 1, 3, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const startFans = s.eco.fans;
  for (let i = 0; i < 130; i++) addNews(s, "season", `채움 ${i}`, "본문", s.team);
  const unreadKeep = s.news.filter((n) => !n.read).length;
  assert.ok(s.news.length <= NEWS_CAP);
  assert.ok(s.news.length <= 100);
  // 안 읽음이 한도를 넘으면 최신 안 읽음만 남김
  assert.ok(unreadKeep <= NEWS_CAP);
  assert.equal(s.eco.fans, startFans);
  console.log("trim cap", s.news.length, "unread", unreadKeep);
}

{
  const s = newHistoryCareer("KZ", 1, 17, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const my = s.series.find((x) => x.day === 0 && (x.a === s.team || x.b === s.team));
  assert.ok(my);
  const rng = new Rng(s.rng);
  finishStoryDay(s, rng);
  my!.pressTone = "적극적";
  // 여론은 시리즈에 기록된 어조만 읽고, 저장의 팬심을 바꾸지 않음
  const fans = s.eco.fans;
  const o = fanOpinion(s);
  assert.equal(s.eco.fans, fans);
  if (my!.winner) {
    assert.ok(o.posts.some((p) => p.text.includes("적극적") || o.summary.includes("적극적") || !my!.pressTone) || o.summary.includes("기자회견") || o.posts.some((p) => /기자회견/.test(p.text)),
      "기자회견 어조가 여론 표시에 반영됨: " + o.posts.map((p) => p.text).join(" | "));
  }
  assert.ok(teamKo(s, "KZ").includes("킹존") || teamKo(s, "KZ") === "KZ");
}

// 승부 재계산 없음: 같은 시드로 이틀을 두 번 시뮬하면 전적·자금이 같다(소식만 추가 가능하지만 이미 posted)
{
  const a = newHistoryCareer("KZ", 1, 29, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  const b = newHistoryCareer("KZ", 1, 29, { startYear: 2018, managerInfo: info, difficulty: "normal" });
  finishStoryDay(a, new Rng(a.rng));
  finishStoryDay(b, new Rng(b.rng));
  const rec = (s: typeof a) => s.series.filter((x) => x.winner).map((x) => `${x.id}:${x.winner}:${x.sa}-${x.sb}`).join("|");
  assert.equal(rec(a), rec(b), "같은 시드면 경기 결과가 같음");
  assert.equal(a.eco.cash, b.eco.cash);
  publishMatchdayNews(a, 0);
  const n1 = a.news.filter((n) => n.seriesId).length;
  publishMatchdayNews(a, 0);
  const n2 = a.news.filter((n) => n.seriesId).length;
  assert.equal(n1, n2, "같은 시리즈 소식을 중복 생성하지 않음");
}

console.log("OK news feed: story/history and roster results accumulate, other league games included, unread/home todos, cap, fan opinion display-only, no duplicate series news");
