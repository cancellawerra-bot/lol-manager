import { CH, CORE, PL, POS_KO, TM, fmt, pctTxt } from "../data";
import { useSave } from "../store";
import { formVal } from "../game/season";
import { Bar, Card, ChampIcon, Pct, Sample, TeamChip } from "../ui";

const GROUP_KO: Record<string, string> = { lane: "라인전", fight: "교전", farm: "성장", vision: "시야", pool: "챔피언 폭" };
const sign = (v: number | null, d = 0): string => (v == null ? "–" : `${v >= 0 ? "+" : ""}${fmt(v, d)}`);

export default function PlayerPage({ k }: { k: string }) {
  const s = useSave()!;
  const p = PL[k];
  if (!p) return <Card title="선수"><p>선수를 찾지 못했습니다.</p></Card>;
  const t = CORE.teams.find((x) => x.id === p.team)!;
  const st = s.pstats[k];
  const w = CORE.meta.weights[String(p.pos)];
  const raw: Record<string, string[]> = {
    lane: [`15분 골드 차 ${sign(p.m.gd)}`, `15분 CS 차 ${sign(p.m.csd, 1)}`, `15분 경험치 차 ${sign(p.m.xpd)}`],
    fight: [`KDA ${p.m.kda.toFixed(2)} (${p.kdaRaw.join("/")})`, `킬 관여 ${(p.m.kp * 100).toFixed(1)}%`, `팀 피해 비중 ${(p.m.dsh * 100).toFixed(1)}% · 분당 피해 ${fmt(p.m.dpm)}`],
    farm: [`분당 골드 ${fmt(p.m.gpm)}`, `분당 CS ${p.m.cspm.toFixed(2)}`],
    vision: [`분당 시야 점수 ${p.m.vspm.toFixed(2)}`, `분당 와드 제거 ${p.m.wk.toFixed(2)}`],
    pool: [`사용 챔피언 ${p.m.pool}개`],
  };
  const starter = Object.entries(s.starters).find(([, ks]) => ks.includes(k));
  return (
    <div className="grid">
      <Card className="span2 pcard" title={null}>
        <div className="pc-head" style={{ ["--tc" as string]: t.color }}>
          <div className="pc-ovr"><small>종합</small><b>{p.pct.ovr}</b><small>{POS_KO[p.pos]} 백분위</small></div>
          <div className="pc-id">
            <h1>{p.name}</h1>
            <div className="row gap wrap"><TeamChip t={t.short} full /><span className="tag">{POS_KO[p.pos]}</span>{starter && <span className="tag good">{starter[0]} 주전</span>}<Sample n={p.games} min={CORE.meta.small} /></div>
            <p className="muted sm">2026 LCK {p.games}경기 {p.wins}승 ({pctTxt(p.wins, p.games)}){Object.keys(p.teamsPlayed).length > 1 ? ` · 소속 기록 ${Object.entries(p.teamsPlayed).map(([a, b]) => `${a} ${b}경기`).join(", ")}` : ""}</p>
          </div>
          <div className="pc-form">{st ? <><small>이번 커리어</small><b>{st.g}경기 {st.w}승</b><small>평점 {(st.rsum / st.g).toFixed(2)} · MVP {st.mvp} · 폼 {formVal(s, k) >= 0 ? "+" : ""}{formVal(s, k).toFixed(2)}</small></> : <small className="muted">이번 커리어 출전 기록 없음</small>}</div>
        </div>
        <div className="pc-attrs">
          {(["lane", "fight", "farm", "vision", "pool"] as const).map((g) => (
            <div key={g} className="attr">
              <div className="row between"><b>{GROUP_KO[g]}</b><span><Pct v={p.pct[g]} /> <small className="muted">가중치 {Math.round((w[g] ?? 0) * 100)}%</small></span></div>
              <Bar v={p.pct[g]} />
              <ul>{raw[g].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="muted sm">백분위는 2026 LCK 같은 포지션 선수 {CORE.players.filter((x) => x.pos === p.pos).length}명과 비교한 값입니다(0 = 가장 낮음, 100 = 가장 높음). 경기 수가 적으면 포지션 평균 쪽으로 {CORE.meta.shrinkK}경기만큼 당겨 계산합니다. <a href="#/method">계산 방법 ›</a></p>
      </Card>
      <Card title={`챔피언 폭 · ${POS_KO[p.pos]} (2026 LCK)`} className="span2">
        <div className="pool">
          {p.pool.map(([c, n, wv]) => (
            <div key={c} className="pool-i"><ChampIcon id={c} size={40} /><div><b>{CH[c]?.ko ?? c}</b><small>{n}경기 {wv}승 · {pctTxt(wv, n, 0)}</small></div>{n < 5 && <span className="tag warn xs">표본 부족</span>}</div>
          ))}
        </div>
      </Card>
      <Card title="팀 내 같은 포지션">
        <ul className="plist">{TM[t.short].players.map((x) => PL[x]).filter((x) => x.pos === p.pos).map((x) => <li key={x.key}><a href={`#/player/${x.key}`}>{x.name}</a> <Pct v={x.pct.ovr} /> <span className="muted sm">{x.games}경기</span></li>)}</ul>
      </Card>
    </div>
  );
}
