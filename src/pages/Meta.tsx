import { useMemo, useState } from "react";
import { CHAMPS, CORE, RANKED, POS_KO, fmt, loadRanked } from "../data";
import { Card, ChampIcon } from "../ui";
import { posWeight } from "../game/draft";
import { useEffect } from "react";

const TIER_KO = ["", "1티어", "2티어", "3티어", "4티어", "5티어"];
export default function Meta() {
  const [pos, setPos] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"tier" | "pick" | "ban" | "wr">("tier");
  const [, setR] = useState(0);
  useEffect(() => { loadRanked().then(() => setR(1)); }, []);
  const list = useMemo(() => CHAMPS.filter((c) => (!q || c.ko.includes(q)) && (pos == null || posWeight(c)[pos] >= 0.15)).sort((a, b) => {
    const pa = a.pro, pb = b.pro;
    if (sort === "pick") return (pb?.p ?? 0) - (pa?.p ?? 0);
    if (sort === "ban") return (pb?.b ?? 0) - (pa?.b ?? 0);
    if (sort === "wr") return (pb?.eb ?? 0) - (pa?.eb ?? 0);
    return (pa?.tier ?? 9) - (pb?.tier ?? 9) || (pb?.pr ?? 0) - (pa?.pr ?? 0);
  }), [pos, q, sort, RANKED]);
  return (
    <Card title={<>챔피언 메타 <span className="muted">· LCK 2026 확정 티어 + 한국 랭크</span></>}>
      <div className="row gap wrap filters">
        <div className="seg">{[null, 0, 1, 2, 3, 4].map((p) => <button key={String(p)} className={pos === p ? "on" : ""} onClick={() => setPos(p)}>{p == null ? "전체" : POS_KO[p]}</button>)}</div>
        <input placeholder="챔피언 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="tier">티어순</option><option value="pick">픽 많은 순</option><option value="ban">밴 많은 순</option><option value="wr">보정 승률순</option></select>
      </div>
      <div className="tbl-wrap"><table className="tbl meta">
        <thead><tr><th>챔피언</th><th>LCK 티어</th><th className="r">픽</th><th className="r">밴</th><th className="r">승</th><th className="r">보정 승률</th><th className="r hide-s">등장률</th>{pos != null && <th className="r">랭크 {POS_KO[pos]} 승률</th>}</tr></thead>
        <tbody>{list.map((c) => {
          const l = pos != null && RANKED ? RANKED.lane[`${pos}|${c.id}`] : undefined;
          return (
            <tr key={c.id}>
              <td><span className="row gap"><ChampIcon id={c.id} size={30} /><b>{c.ko}</b></span></td>
              <td>{c.pro?.tier ? <span className={`tier t${c.pro.tier}`}>{TIER_KO[c.pro.tier]}</span> : <span className="tag warn xs">{c.pro ? "표본 부족" : "기록 없음"}</span>}</td>
              <td className="r">{c.pro?.p ?? 0}</td><td className="r">{c.pro?.b ?? 0}</td><td className="r">{c.pro?.w ?? 0}</td>
              <td className="r">{c.pro?.eb != null ? `${(c.pro.eb * 100).toFixed(1)}%` : "–"}</td>
              <td className="r hide-s">{c.pro?.pr != null ? `${(c.pro.pr * 100).toFixed(0)}%` : "–"}</td>
              {pos != null && <td className="r">{l ? <>{((l[0] / l[1]) * 100).toFixed(1)}% <small className="muted">{fmt(l[1])}판</small></> : <span className="muted sm">30판 미만</span>}</td>}
            </tr>
          );
        })}</tbody>
      </table></div>
      <p className="muted sm">LCK 티어: LeagueLab 확정본(2026 LCK 502경기, 보정 승률 (승+100)/(픽+200)과 등장률로 5단계, 픽 3회 미만은 표본 부족). 랭크 승률: 한국 솔로 랭크 {fmt(CORE.meta.rankedGames)}판 중 해당 포지션 30판 이상.</p>
    </Card>
  );
}
