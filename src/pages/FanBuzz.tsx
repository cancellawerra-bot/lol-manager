import { TM } from "../data";
import type { Save } from "../game/season";
import { standings } from "../game/season";

// 홈 "팬 반응" 카드 (v2.29.0): 지금 성적(최근 결과·순위)만 읽어 분위기를 보여 주는 읽기 전용 화면입니다.
// 글은 가상의 팬 게시판이며 실제 사람·커뮤니티가 아니고, 선수 개인을 깎아내리는 글은 쓰지 않습니다. 계산·저장에는 영향이 없습니다.
const hash = (s: string): number => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
type Mood = "hot" | "up" | "calm" | "down" | "cold";
const MOOD: Record<Mood, { label: string; tone: string }> = {
  hot: { label: "들끓는 중", tone: "good" }, up: { label: "기대감 상승", tone: "good" }, calm: { label: "차분함", tone: "neutral" },
  down: { label: "걱정스러움", tone: "warn" }, cold: { label: "싸늘함", tone: "warn" },
};
const BOARDS = ["응원 게시판", "팬 라운지", "경기 후기방", "구단 팬카페", "분석 토론장"];
const POSTS: Record<Mood, string[]> = {
  hot: ["이 기세면 우승도 노려볼 만하다", "{t} 요즘 경기 보는 맛이 있네", "연승 중인데 한타가 깔끔해졌다", "{t} 팬 된 게 제일 잘한 일"],
  up: ["{t} 최근 경기 괜찮았다", "이번 시즌 기대해도 되겠는데?", "밴픽이 한결 안정됐다", "다음 경기 미리 보기 같이 해요"],
  calm: ["{t} 이번 주 일정 정리해 봤습니다", "아직은 지켜보는 단계", "중반 운영만 다듬으면 될 듯", "오늘 라인업 예상해 보기"],
  down: ["최근 흐름이 아쉽다… 다음 경기가 중요", "{t} 밴픽 방향 이야기해 봐요", "한타 타이밍이 자꾸 늦네", "반등 포인트가 어디일까"],
  cold: ["{t} 이대로는 힘들다 진지하게 이야기해 보자", "연패 끊을 방법 없나", "감독님 이번 경기는 꼭 이겨주세요", "그래도 끝까지 응원합니다"],
};
export default function FanBuzz({ s }: { s: Save }) {
  const rows = standings(s);
  const rank = rows.findIndex((r) => r.t === s.team) + 1, n = rows.length || 10;
  const mine = s.series.filter((r) => r.winner && (r.a === s.team || r.b === s.team)).sort((a, b) => b.day - a.day);
  const form = mine.slice(0, 5).map((r) => r.winner === s.team);
  const wins = form.filter(Boolean).length, losses = form.length - wins;
  let mood: Mood = "calm";
  let score = 50 + (wins - losses) * 9 + (rank > 0 ? Math.round(((n + 1) / 2 - rank) * 2.2) : 0);
  score = Math.max(5, Math.min(95, score));
  if (form.length === 0) { mood = "calm"; score = 50; }
  else if (score >= 78) mood = "hot"; else if (score >= 60) mood = "up"; else if (score >= 42) mood = "calm"; else if (score >= 26) mood = "down"; else mood = "cold";
  const name = TM[s.team]?.ko ?? s.team;
  const seed = hash(`${s.team}|${mine.length}|${form.map(Number).join("")}`);
  const list = POSTS[mood];
  const posts = [0, 1, 2].map((i) => {
    const text = list[(seed + i * 7) % list.length].replace("{t}", name);
    const base = (hash(`${seed}|${i}`) % 180) + 12;
    return { board: BOARDS[(seed + i * 3) % BOARDS.length], text, likes: mood === "hot" || mood === "up" ? base + 60 : base, replies: hash(`r${seed}${i}`) % 60 + 2 };
  });
  return (
    <section className="mh-fans" aria-label="팬 반응" data-testid="home-fan-buzz">
      <div className="mh-section-heading"><div><small>FAN BUZZ</small><h2>팬 반응</h2></div><span className={"mh-mood " + MOOD[mood].tone}>{MOOD[mood].label}</span></div>
      <div className="mh-mood-bar" aria-hidden="true"><i style={{ width: `${score}%` }} /></div>
      <p className="mh-fans-sub">{form.length ? <>최근 {form.length}경기 {wins}승 {losses}패{rank > 0 ? ` · 현재 ${rank}위` : ""}</> : "아직 치른 경기가 없어 팬들이 개막을 기다리고 있습니다."}{form.length > 0 && <span className="mh-form">{form.map((w, i) => <b key={i} className={w ? "w" : "l"}>{w ? "승" : "패"}</b>)}</span>}</p>
      <ul className="mh-fan-posts">{posts.map((p) => <li key={p.text}><small>{p.board}</small><b>{p.text}</b><span>♥ {p.likes} · 댓글 {p.replies}</span></li>)}</ul>
      <p className="mh-fans-note">가상의 팬 게시판입니다. 실제 커뮤니티가 아니며 최근 성적과 순위만 반영합니다.</p>
    </section>
  );
}
