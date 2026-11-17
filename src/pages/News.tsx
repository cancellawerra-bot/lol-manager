import { useEffect, useState } from "react";
import { useSave, mutate } from "../store";
import { dateKo } from "../game/season";
import { Card, TeamChip } from "../ui";

const KIND: Record<string, string> = { result: "경기 결과", upset: "이변", streak: "연승", leader: "선두", season: "시즌", welcome: "구단", mvp: "MVP", playoff: "플레이오프" };
export default function NewsPage() {
  const s = useSave()!;
  const [f, setF] = useState<"all" | "mine">("all");
  useEffect(() => { const t = setTimeout(() => mutate((x) => { x.news.forEach((n) => { n.read = true; }); }), 1200); return () => clearTimeout(t); }, []);
  const list = s.news.filter((n) => f === "all" || n.team === s.team);
  return (
    <Card title="소식" right={<div className="seg"><button className={f === "all" ? "on" : ""} onClick={() => setF("all")}>전체</button><button className={f === "mine" ? "on" : ""} onClick={() => setF("mine")}>우리 팀</button></div>}>
      <p className="muted sm">모든 소식은 이 커리어에서 실제로 일어난 경기 결과로만 만들어집니다. 지어낸 인터뷰나 발언은 없습니다.</p>
      <ul className="news-list">
        {list.map((n) => (
          <li key={n.id} className={n.read ? "" : "unread"}>
            <div className="news-meta"><span className={`tag k-${n.kind}`}>{KIND[n.kind]}</span><small className="muted">{dateKo(n.date)}</small>{n.team && <TeamChip t={n.team} size="sm" />}</div>
            <b>{n.title}</b><p>{n.body}</p>
          </li>
        ))}
        {!list.length && <li className="muted">아직 소식이 없습니다.</li>}
      </ul>
    </Card>
  );
}
