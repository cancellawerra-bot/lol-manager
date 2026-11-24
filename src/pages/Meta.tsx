import { useMemo, useState, useEffect } from "react";
import { CHAMPS, CORE, RANKED, POS_KO, fmt, loadRanked } from "../data";
import { Card, ChampIcon } from "../ui";
import { posWeight } from "../game/draft";
import { useSave } from "../store";
import { careerYear, champProForYear, hasYearMeta, lckYearName, NO_RECORD, yearSeason } from "../game/yearRecords";

const TIER_KO = ["", "1티어", "2티어", "3티어", "4티어", "5티어"];
export default function Meta() {
  const s = useSave();
  const year = careerYear(s);
  const season = yearSeason(year);
  const [pos, setPos] = useState<number | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"tier" | "pick" | "ban" | "wr">("tier");
  const [, setR] = useState(0);
  useEffect(() => { loadRanked().then(() => setR(1)); }, []);
  const list = useMemo(() => CHAMPS.filter((c) => (!q || c.ko.includes(q)) && (pos == null || posWeight(c)[pos] >= 0.15)).sort((a, b) => {
    const pa = champProForYear(year, a.id), pb = champProForYear(year, b.id);
    if (sort === "pick") return (pb?.p ?? -1) - (pa?.p ?? -1);
    if (sort === "ban") return (pb?.b ?? -1) - (pa?.b ?? -1);
    if (sort === "wr") return (pb?.eb ?? -1) - (pa?.eb ?? -1);
    return (pa?.tier ?? 9) - (pb?.tier ?? 9) || (pb?.pr ?? 0) - (pa?.pr ?? 0);
  }), [pos, q, sort, RANKED, year]);
  const title = hasYearMeta(year) ? `${lckYearName(year)} 확정 티어 + 한국 랭크` : `${lckYearName(year)} 챔피언 메타 ${NO_RECORD}`;
  return (
    <Card title={<>챔피언 메타 <span className="muted">· {title}</span></>} data-testid="meta-page">
      {!hasYearMeta(year) && <p className="note" data-testid="meta-missing">{lckYearName(year)} 챔피언 티어·픽밴 승률 기록이 저장소와 LeagueLab에 없습니다. 다른 연도 값으로 대체하지 않고 {NO_RECORD}으로 표시합니다.</p>}
      <div className="row gap wrap filters">
        <div className="seg">{[null, 0, 1, 2, 3, 4].map((p) => <button key={String(p)} className={pos === p ? "on" : ""} onClick={() => setPos(p)}>{p == null ? "전체" : POS_KO[p]}</button>)}</div>
        <input placeholder="챔피언 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <select value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}><option value="tier">티어순</option><option value="pick">픽 많은 순</option><option value="ban">밴 많은 순</option><option value="wr">보정 승률순</option></select>
      </div>
      <div className="tbl-wrap"><table className="tbl meta">
        <thead><tr><th>챔피언</th><th>LCK 티어</th><th className="r">픽</th><th className="r">밴</th><th className="r">승</th><th className="r">보정 승률</th><th className="r hide-s">등장률</th>{pos != null && <th className="r">랭크 {POS_KO[pos]} 승률</th>}</tr></thead>
        <tbody>{list.map((c) => {
          const l = pos != null && RANKED ? RANKED.lane[`${pos}|${c.id}`] : undefined;
          const pro = champProForYear(year, c.id);
          return (
            <tr key={c.id}>
              <td><span className="row gap"><ChampIcon id={c.id} size={30} /><b>{c.ko}</b></span></td>
              <td>{pro?.tier ? <span className={`tier t${pro.tier}`}>{TIER_KO[pro.tier]}</span> : <span className="tag warn xs">{pro ? "표본 부족" : NO_RECORD}</span>}</td>
              <td className="r">{pro ? pro.p : NO_RECORD}</td><td className="r">{pro ? pro.b : NO_RECORD}</td><td className="r">{pro ? pro.w : NO_RECORD}</td>
              <td className="r">{pro?.eb != null ? `${(pro.eb * 100).toFixed(1)}%` : NO_RECORD}</td>
              <td className="r hide-s">{pro?.pr != null ? `${(pro.pr * 100).toFixed(0)}%` : NO_RECORD}</td>
              {pos != null && <td className="r">{l ? <>{((l[0] / l[1]) * 100).toFixed(1)}% <small className="muted">{fmt(l[1])}판</small></> : <span className="muted sm">30판 미만</span>}</td>}
            </tr>
          );
        })}</tbody>
      </table></div>
      <p className="muted sm">{hasYearMeta(year) && season
        ? <>LCK 티어: {lckYearName(year)} {season.games}경기{season.period ? ` (${season.period[0]} ~ ${season.period[1]})` : ""} 확정본, 보정 승률 (승+100)/(픽+200)과 등장률로 5단계, 픽 3회 미만은 표본 부족. 없는 챔피언은 {NO_RECORD}이며 0으로 채우지 않습니다.</>
        : <>이 시즌 LCK 챔피언 메타는 {NO_RECORD}입니다.</>} 랭크 승률: 한국 솔로 랭크 {fmt(CORE.meta.rankedGames)}판 중 해당 포지션 30판 이상(연도별 LCK 기록이 아니라 별도 표본입니다).</p>
    </Card>
  );
}
