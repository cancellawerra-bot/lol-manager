import type { Save } from "../game/season";
import { fanOpinion } from "../game/newsFeed";

// 홈 여론 카드: 실제 성적·연승/연패·기자회견 어조만으로 표시용 온도를 만듭니다.
// 가상의 익명 팬 글이며 실제 커뮤니티 이름을 쓰지 않고, 선수 개인 비난·관계자 발언을 지어내지 않습니다.
// eco.fans와 승부 계산은 바꾸지 않습니다.
export default function FanBuzz({ s }: { s: Save }) {
  const o = fanOpinion(s);
  return (
    <section className="mh-fans" aria-label="여론" data-testid="home-fan-buzz">
      <div className="mh-section-heading"><div><small>여론</small><h2>팬 반응</h2></div><span className={"mh-mood " + o.tone}>{o.label}</span></div>
      <div className="mh-gauge" data-testid="fan-gauge" role="img" aria-label={`여론 온도 ${o.score}점 (표시용)`}>
        <div className="mh-gauge-scale"><i style={{ width: `${o.score}%` }} /><em style={{ left: `${o.score}%` }} /></div>
        <div className="mh-gauge-meta"><span>차가움</span><b>{o.score}</b><span>뜨거움</span></div>
        <p className="mh-gauge-note">표시용 온도입니다. 자금·팬심 수치·승부에는 반영되지 않습니다.</p>
      </div>
      <p className="mh-fans-sub">{o.summary}{o.form.length > 0 && <span className="mh-form">{o.form.map((w, i) => <b key={i} className={w ? "w" : "l"}>{w ? "승" : "패"}</b>)}</span>}</p>
      <ul className="mh-fan-posts">{o.posts.map((p) => <li key={p.board + p.text}><small>{p.board}</small><b>{p.text}</b><span>♥ {p.likes} · 댓글 {p.replies}</span></li>)}</ul>
      <p className="mh-fans-note">가상의 익명 팬 글입니다. 실제 커뮤니티가 아니며, 경기 결과·연승/연패·기자회견 어조만 반영합니다. 선수 개인을 비난하지 않습니다.</p>
    </section>
  );
}
