import { CARDS, CH, CORE, PL, POS_KO, TM, fmt, pctTxt, recTxt } from "../data";
import { useSave } from "../store";
import { formVal } from "../game/season";
import { Bar, Card, ChampIcon, Ovr, Pct, Sample, TeamChip } from "../ui";
import { ratingOf } from "../rating";
import { playerTraining } from "../game/trainingRuntime";
import { comfort } from "../game/draft";
import { TIERS, masteryOf, masterySummary } from "../game/mastery";
import { careerYear, hasYearPlayerPools, lckYearName, NO_RECORD } from "../game/yearRecords";

const GROUP_KO: Record<string, string> = { lane: "라인전", fight: "교전", farm: "성장", vision: "시야", pool: "챔피언 폭" };
const sign = (v: number | null, d = 0): string => (v == null ? "–" : `${v >= 0 ? "+" : ""}${fmt(v, d)}`);

export default function PlayerPage({ k }: { k: string }) {
  const s = useSave()!;
  const year = careerYear(s);
  const p = PL[k];
  if (!p) return <Card title="선수"><p>선수를 찾지 못했습니다.</p></Card>;
  const contract = s.story?.contracts.find(c => c.key === k), card = CARDS[k] ?? (contract ? CARDS[contract.cardId] : undefined);
  if (card) {
    const stats = [["KDA", recTxt(card.kda, n => n.toFixed(2))], ["승률", recTxt(card.wr, n => `${(n * 100).toFixed(1)}%`)], ["킬 관여율", recTxt(card.kp, n => `${(n * 100).toFixed(1)}%`)], ["GD@15", recTxt(card.gd15, n => `${n >= 0 ? "+" : ""}${n.toFixed(0)}`)], ["DPM", recTxt(card.dpm, n => n.toFixed(0))], ["분당 CS", recTxt(card.cspm, n => n.toFixed(2))]];
    const career = s.pstats[k];
    return <div className="grid" data-testid="season-player-profile">
      <Card className="span2" title={`${card.name} · ${card.year} 시즌 기록`}><div className="row wrap gap"><span className="tag">{POS_KO[card.posIdx]}</span><span className="tag">당시 {card.team}</span>{s.story?.contracts.some(c => c.person === card.pkey) && <span className="tag good">우리 구단 보유</span>}{card.small && <span className="tag warn">표본 부족</span>}{card.limited && <span className="tag">지표 제한</span>}{p.label?.includes("추정") && <span className="tag warn">과거 기록 기반 추정</span>}</div>
        <p>근거 {card.year}년 · {card.games > 0 ? `${card.games}경기` : "경기 기록 없음"}. 현재 게임 능력치 <Ovr p={p} />.{card.honors?.length ? <> 국제대회: {card.honors.join(", ")}.</> : null}</p><p className="muted sm">아래는 확인된 시즌 기록입니다. 없는 지표는 기록 없음으로 표시합니다. 게임 종합에는 현재 커리어의 기존 추정 규칙이 적용될 수 있습니다.</p>
        <div className="facts">{stats.map(([label, value]) => <li key={label}><b>{value}</b><span>{label}</span></li>)}</div><p className="muted sm">챔피언별 사용 기록은 이 시즌 카드에 포함되어 있지 않습니다.</p>
      </Card>
      {(() => {
        const tr = playerTraining(s, k), list = Object.entries(tr?.champs ?? {}).filter(([, n]) => n > 0).sort((x, y) => y[1] - x[1]);
        return list.length ? <Card title="챔피언 연습" data-testid="champ-practice">
          <p className="muted sm">일정표의 「챔피언」 훈련으로 쌓은 연습입니다. 연습 2일이 1경기 상당으로 경기의 챔피언 숙련도 보정에 반영됩니다.</p>
          <div className="pool">{list.map(([c, n]) => { const cf = comfort(p, c, n); return <div key={c} className="pool-i"><ChampIcon id={c} size={40} /><div><b>{CH[c]?.ko ?? c}</b><small>연습 {n}일 · {cf.bonus}경기 상당</small><span className="pool-tags"><span className={"mst t-" + masteryOf(cf.n).id}>{masteryOf(cf.n).ko}</span></span></div></div>; })}</div>
        </Card> : null;
      })()}
      <Card title="이번 커리어 경기 기록">{career?.g ? <p>{career.g}경기 {career.w}승 · 평균 평점 {(career.rsum / career.g).toFixed(2)} · MVP {career.mvp}회</p> : <p className="muted">이번 커리어 출전 기록 없음</p>}<p className="muted xs">실제 시즌 통계와 게임 안 경기 기록을 구분합니다.</p></Card>
      <Card title="선수단 관리"><p>선발·로테이션·훈련·출전 약속은 선수단에서 관리합니다.</p><div className="row wrap gap"><a className="btn" href="#/squad">선수단으로</a><a className="btn" href="#/home">감독 홈으로</a></div></Card>
    </div>;
  }
  const t = CORE.teams.find((x) => x.id === p.team)!;
  if (!t) return <Card title={p.name}><p>공식 개인 시즌 기록 없음 · 현재 게임 능력치 <Ovr p={p} />.</p><a className="btn" href="#/squad">선수단으로</a></Card>;
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
          <div className="pc-ovr"><small>종합</small><b>{ratingOf(p)}</b><small>{POS_KO[p.pos]} 백분위 {p.pct.ovr}</small></div>
          <div className="pc-id">
            <h1>{p.name}</h1>
            <div className="row gap wrap"><TeamChip t={t.short} full /><span className="tag">{POS_KO[p.pos]}</span>{starter && <span className="tag good">{starter[0]} 주전</span>}<Sample n={p.games} min={CORE.meta.small} /></div>
            <p className="muted sm">{hasYearPlayerPools(year) ? <>{lckYearName(year)} {p.games}경기 {p.wins}승 ({pctTxt(p.wins, p.games)}){Object.keys(p.teamsPlayed).length > 1 ? ` · 소속 기록 ${Object.entries(p.teamsPlayed).map(([a, b]) => `${a} ${b}경기`).join(", ")}` : ""}</> : <>{lckYearName(year)} 상세 출전 기록 {NO_RECORD}</>}</p>
          </div>
          <div className="pc-form">{st ? <><small>이번 커리어</small><b>{st.g}경기 {st.w}승</b><small>평점 {(st.rsum / st.g).toFixed(2)} · MVP {st.mvp} · 폼 {formVal(s, k) >= 0 ? "+" : ""}{formVal(s, k).toFixed(2)}</small></> : <small className="muted">이번 커리어 출전 기록 없음</small>}</div>
        </div>
        <div className="pc-attrs">
          {(["lane", "fight", "farm", "vision", "pool"] as const).map((g) => (
            <div key={g} className="attr">
              <div className="row between nowrap-row"><b>{GROUP_KO[g]}</b><span><Pct v={p.pct[g]} /> <small className="muted">가중치 {Math.round((w[g] ?? 0) * 100)}%</small></span></div>
              <Bar v={p.pct[g]} />
              <ul>{raw[g].map((x) => <li key={x}>{x}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className="muted sm">{hasYearPlayerPools(year) ? <>백분위는 {lckYearName(year)} 같은 포지션 선수 {CORE.players.filter((x) => x.pos === p.pos).length}명과 비교한 값입니다(0 = 가장 낮음, 100 = 가장 높음). 경기 수가 적으면 포지션 평균 쪽으로 {CORE.meta.shrinkK}경기만큼 당겨 계산합니다.</> : <>백분위는 이 시즌 상세 표본이 없어 {NO_RECORD}으로 표시하지 않고, 게임 능력치만 보여 줍니다.</>} <a href="#/method">계산 방법 ›</a></p>
      </Card>
      <Card title={`챔피언 폭 · ${POS_KO[p.pos]} (${hasYearPlayerPools(year) ? lckYearName(year) : `${lckYearName(year)} ${NO_RECORD}`})`} className="span2">
        <div className="mst-sum" data-testid="mastery-summary">
          {TIERS.slice().reverse().map((t) => <span key={t.id} className={"mst t-" + t.id} title={t.desc}>{t.ko} {masterySummary(p.pool)[t.id]}</span>)}
          <small className="muted">{hasYearPlayerPools(year) ? `${lckYearName(year)} 경기 수 기준 · 장인 12+ · 전문 7+ · 숙련 3+ · 입문 1+` : `${lckYearName(year)} 챔피언별 출전 ${NO_RECORD}`}</small>
        </div>
        <div className="pool">
          {hasYearPlayerPools(year) ? p.pool.map(([c, n, wv]) => (
            <div key={c} className="pool-i"><ChampIcon id={c} size={40} /><div><b>{CH[c]?.ko ?? c}</b><small>{n}경기 {wv}승 · {pctTxt(wv, n, 0)}</small><span className="pool-tags"><span className={"mst t-" + masteryOf(n).id}>{masteryOf(n).ko}</span>{n < 5 && <span className="tag warn xs">표본 부족</span>}</span></div></div>
          )) : <p className="muted sm">{lckYearName(year)} 챔피언별 출전 {NO_RECORD}. 다른 연도 경기 수로 채우지 않습니다.</p>}
        </div>
      </Card>
      <Card title="팀 내 같은 포지션">
        <ul className="plist">{(TM[t.short]?.players ?? []).map((x) => PL[x]).filter((x) => x?.pos === p.pos).map((x) => <li key={x.key}><a href={`#/player/${x.key}`}>{x.name}</a> <Ovr p={x} /> <span className="muted sm">{x.games}경기</span></li>)}</ul>
      </Card>
    </div>
  );
}
