import { useEffect, useMemo } from "react";
import { useSave, mutate } from "../store";
import { dateKo, standings } from "../game/season";
import { NEWS_KIND, teamKo } from "../game/newsFeed";
import { Card, TeamChip } from "../ui";
import { go } from "../nav";

function markRead(id: number): void { mutate((s) => { const n = s.news.find((x) => x.id === id); if (n) n.read = true; }); }
function markAllRead(): void { mutate((s) => { s.news.forEach((n) => { n.read = true; }); }); }

export default function NewsPage({ id }: { id?: string }) {
  const s = useSave()!;
  const selected = useMemo(() => {
    if (!id) return undefined;
    const n = Number(id);
    return s.news.find((x) => x.id === n);
  }, [s.news, id]);

  useEffect(() => {
    if (selected && !selected.read) markRead(selected.id);
  }, [selected]);

  if (selected) {
    const d = selected.detail;
    const rows = d?.standings ?? standings(s).map((r, i) => ({ t: r.t, w: r.w, l: r.l, gw: r.gw, gl: r.gl, rank: i + 1 }));
    return (
      <div data-testid="news-detail">
        <p className="muted sm"><a href="#/news">← 소식 목록</a></p>
        <Card title={selected.title} right={<span className={`tag k-${selected.kind}`}>{NEWS_KIND[selected.kind] ?? selected.kind}</span>}>
          <div className="news-meta"><small className="muted">{dateKo(selected.date)}</small>{selected.team && <TeamChip t={selected.team} size="sm" />}</div>
          <p className="news-body">{selected.body}</p>
          <p className="muted xs">이 커리어에서 실제로 일어난 결과와 결정만 적습니다. 선수·구단 관계자의 발언은 지어내지 않습니다.</p>
        </Card>
        <Card title={d ? "당시 순위표" : "현재 순위표"}>
          <p className="muted xs">{d ? "이 소식이 생긴 시점의 정규 시즌 순위입니다." : "옛 저장에는 당시 순위 스냅샷이 없어, 지금 순위표를 보여 줍니다."}</p>
          <div className="tbl-wrap"><table className="tbl">
            <thead><tr><th>순위</th><th>팀</th><th>승</th><th>패</th><th>세트</th></tr></thead>
            <tbody>{rows.map((r) => (
              <tr key={r.t} className={r.t === s.team ? "me" : ""}><td>{r.rank}</td><td><TeamChip t={r.t} size="sm" full /></td><td className="r">{r.w}</td><td className="r">{r.l}</td><td className="r">{r.gw - r.gl >= 0 ? "+" : ""}{r.gw - r.gl}</td></tr>
            ))}</tbody>
          </table></div>
          {!d && <p className="muted sm">옛 저장 소식이라 지금 순위입니다. <a href="#/standings">전체 순위표 ›</a></p>}
        </Card>
        <Card title={d ? "당시 남은 일정" : "남은 일정"}>
          {d && d.upcoming.length ? (
            <ul className="news-upcoming">{d.upcoming.map((x, i) => (
              <li key={i}><small>{x.date ? dateKo(x.date) : ""} · {x.stage}</small><b>{teamKo(s, x.a)} vs {teamKo(s, x.b)}</b></li>
            ))}</ul>
          ) : <p className="muted sm">{d ? "이 시점 기준으로 남은 일정이 없었습니다." : <a href="#/schedule">전체 일정 ›</a>}</p>}
        </Card>
      </div>
    );
  }

  const unread = s.news.filter((n) => !n.read).length;
  return (
    <Card title="소식" right={<div className="row gap wrap">
      <div className="seg"><a className="on" href="#/news">전체</a></div>
      {unread > 0 && <button className="btn sm" data-testid="news-read-all" onClick={markAllRead}>모두 읽음 ({unread})</button>}
    </div>}>
      <p className="muted sm">경기 결과(우리·리그 다른 경기), 연승/연패, 순위 변동, 플레이오프 확정/탈락, 이적·계약, 스폰서, 기자회견 어조처럼 이 커리어에서 실제로 일어난 일만 모읍니다. 지어낸 인터뷰는 없습니다.</p>
      <ul className="news-list" data-testid="news-list">
        {s.news.map((n) => (
          <li key={n.id} className={n.read ? "" : "unread"}>
            <a href={`#/news/${n.id}`} className="news-link" data-testid={`news-item-${n.id}`} onClick={() => { /* 상세에서 읽음 처리 */ }}>
              <div className="news-meta"><span className={`tag k-${n.kind}`}>{NEWS_KIND[n.kind] ?? n.kind}</span><small className="muted">{dateKo(n.date)}</small>{n.team && <TeamChip t={n.team} size="sm" />}</div>
              <b>{n.title}</b><p>{n.body}</p>
            </a>
          </li>
        ))}
        {!s.news.length && <li className="muted">아직 소식이 없습니다.</li>}
      </ul>
    </Card>
  );
}

void go;
void markRead;
