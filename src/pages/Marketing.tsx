import { useState } from "react";
import { PL, POS_KO } from "../data";
import { useSave, orderGoodsNow, holdFanMeet } from "../store";
import { Card } from "../ui";
import { fmtMoney } from "../game/money";
import { ratingOf } from "../rating";
import { goodsPreview, goodsDemand, seasonForm, formFactor, meetPreview, meetRange, modelPower, GOODS_LABEL, QTY_LABEL, MAX_MODELS, VENUE, type GoodsKind, type Qty, type Venue } from "../game/marketing";

const pct = (n: number): string => Math.round(n * 100) + "%";
const sgn = (n: number): string => (n >= 0 ? "+" : "−") + fmtMoney(Math.abs(n));

/** 마케팅: 굿즈(시즌 유니폼·자켓)와 팬미팅. 제작·행사 비용은 바로 나가고 굿즈 판매는 시즌 말에 정산됩니다(게임용 가상 금액). */
export function MarketingCard() {
  const s = useSave()!;
  const [kind, setKind] = useState<GoodsKind>("uniform"), [qty, setQty] = useState<Qty>("m"), [models, setModels] = useState<string[]>([]), [venue, setVenue] = useState<Venue>("small"), [msg, setMsg] = useState("");
  if (s.mode !== "story" || !s.story) return null;
  const mk = s.marketing && s.marketing.year === s.story.year ? s.marketing : undefined;
  const locked = !!s.session || !!s.story.ended;
  const starters = s.starters[s.team] ?? [];
  const pre = goodsPreview(s, kind, models), meets = meetPreview(s), [lo, hi] = meetRange(s);
  const made = mk?.goods[kind], formNow = seasonForm(s);
  const toggle = (k: string): void => setModels(models.includes(k) ? models.filter((x) => x !== k) : models.length >= MAX_MODELS ? models : [...models, k]);
  return <Card title="마케팅" right={<span className="muted sm">{s.story.year} · 팬심 {s.eco.fans}</span>}>
    <p className="sm">굿즈는 <b>제작비가 바로 나가고</b>, 판매 수입은 <b>시즌 말</b>에 성적에 따라 정산됩니다. 팬미팅은 열리는 날 바로 손익이 정해집니다. 모든 금액은 게임용 가상 금액입니다.</p>
    <details className="note-fold" data-testid="mk-rules"><summary>규칙 자세히 보기</summary>
      <p className="muted sm">팔릴 수 있는 금액은 (0.5 + 팬심/100) × 광고 모델 보정 × 성적 계수입니다. 성적 계수는 순위(1위 ×1.4, 3위 이내 ×1.2, 6위 이내 ×1, 그 아래 ×0.8) × 승률(50% = 1, 75% = 1.2, 25% = 0.8) × 우승(×1.15)이라 하위권 부진이면 0.64배, 우승권이면 약 1.9배까지 움직입니다. 시즌 말 정산 때의 성적이 적용되므로 잘 풀리는 시즌에 많이 팔립니다. 자켓은 유니폼의 0.6배만 팔립니다. 매진되면 제작비의 1.2배가 들어오고, 남은 재고는 제작비의 20%만 돌려받으니 <b>제작비의 80% 이상 팔려야 본전</b>입니다. 광고 모델(선발 선수 최대 3명)은 종합 능력치가 높을수록 판매가 늘며, 시즌 말에 벤치로 밀려 있으면 효과가 없습니다. 상품마다 시즌에 한 번 정할 수 있습니다.</p>
      <p className="muted sm">팬미팅은 시즌에 한 번, 장소를 고릅니다. 관객 수는 팬심과 지금 성적(좋을수록 늘어남)으로 정해지는 범위(지금 {lo.toLocaleString("ko-KR")}~{hi.toLocaleString("ko-KR")}명) 안에서 결정되므로 성적이 좋을 때 여는 게 유리하고, 좌석이 가득 차면 대관비의 2배가 들어옵니다. 좌석의 80% 이상 차면 팬심 +3, 50% 이상 +2, 그 아래는 +1입니다. 빈자리는 손해입니다.</p>
    </details>
    {msg && <p className="sm" role="status" data-testid="mk-msg">{msg}</p>}

    <h3>굿즈</h3>
    <div className="row gap wrap">{(Object.keys(GOODS_LABEL) as GoodsKind[]).map((g) => <button key={g} className={"btn sm" + (kind === g ? " primary" : "")} data-testid={`mk-kind-${g}`} onClick={() => setKind(g)}>{GOODS_LABEL[g]}{mk?.goods[g] ? " ✓" : ""}</button>)}</div>
    {made ? <p className="sm" data-testid="mk-made">{GOODS_LABEL[kind]}: {QTY_LABEL[made.qty]} 제작{made.cost > 0 ? `(제작비 ${fmtMoney(made.cost)})` : ""}{made.settled ? ` · 판매 ${pct(made.sold ?? 0)} · 손익 ${sgn(made.net ?? 0)}` : " · 판매 정산은 시즌 말"}</p> : <>
      <p className="muted xs">광고 모델(선발 선수 최대 {MAX_MODELS}명 · 인기 보정 +{(modelPower(s, models) * 100).toFixed(1)}%)</p>
      <div className="row gap wrap">{starters.filter((k) => PL[k]).map((k) => <button key={k} className={"btn sm" + (models.includes(k) ? " primary" : "")} data-testid={`mk-model-${k}`} onClick={() => toggle(k)}>{PL[k].name} <small>{POS_KO[PL[k].pos]} · {ratingOf(PL[k]) ?? "–"}</small></button>)}</div>
      <div className="tbl-wrap"><table className="tbl" data-testid="mk-goods-table">
        <thead><tr><th>제작량</th><th>제작비</th><th>예상 판매</th><th>예상 손익</th></tr></thead>
        <tbody>{pre.map((p) => <tr key={p.qty} className={qty === p.qty ? "me" : ""} onClick={() => setQty(p.qty)} style={{ cursor: "pointer" }}>
          <td><button className={"btn sm" + (qty === p.qty ? " primary" : "")} data-testid={`mk-qty-${p.qty}`}>{QTY_LABEL[p.qty]}</button></td>
          <td>{p.cost > 0 ? fmtMoney(p.cost) : "–"}</td>
          <td>{p.cost > 0 ? `${pct(p.soldLow)}~${pct(p.soldHigh)}` : "–"}</td>
          <td>{p.cost > 0 ? `${sgn(p.netLow)} ~ ${sgn(p.netHigh)}` : "0"}</td>
        </tr>)}</tbody>
      </table></div>
      <p className="muted xs">예상은 하위권(낮은 쪽)부터 우승권(높은 쪽)까지입니다. 지금 성적({formNow.rank ? `${formNow.rank}위` : "순위 미정"}{formNow.wr !== undefined ? ` · 승률 ${pct(formNow.wr)}` : ""}) 기준 팔릴 금액 {fmtMoney(goodsDemand(s, kind, models, formNow))}(성적 계수 ×{formFactor(formNow).toFixed(2)}).</p>
      <button className="btn primary sm" data-testid="mk-order" disabled={locked} onClick={() => setMsg(orderGoodsNow(kind, qty, models))}>{QTY_LABEL[qty]}으로 정하기</button>
    </>}

    <h3>팬미팅</h3>
    {mk?.meet ? <p className="sm" data-testid="mk-meet-done">{VENUE[mk.meet.venue].label}에서 열었습니다 · 관객 {mk.meet.attendance.toLocaleString("ko-KR")}명({pct(mk.meet.fill)}) · 손익 {sgn(mk.meet.net)} · 팬심 +{mk.meet.fansGain}</p> : <>
      <div className="tbl-wrap"><table className="tbl" data-testid="mk-meet-table">
        <thead><tr><th>장소</th><th>좌석</th><th>대관·제작비</th><th>예상 좌석 점유</th><th>예상 손익</th></tr></thead>
        <tbody>{meets.map((m) => <tr key={m.venue} className={venue === m.venue ? "me" : ""} onClick={() => setVenue(m.venue)} style={{ cursor: "pointer" }}>
          <td><button className={"btn sm" + (venue === m.venue ? " primary" : "")} data-testid={`mk-venue-${m.venue}`}>{m.label}</button></td>
          <td>{m.seats.toLocaleString("ko-KR")}석</td><td>{fmtMoney(m.cost)}</td>
          <td>{pct(m.fillLow)}~{pct(m.fillHigh)}</td><td>{sgn(m.netLow)} ~ {sgn(m.netHigh)}</td>
        </tr>)}</tbody>
      </table></div>
      <button className="btn primary sm" data-testid="mk-meet-go" disabled={locked} onClick={() => setMsg(holdFanMeet(venue))}>{VENUE[venue].label}에서 팬미팅 열기</button>
    </>}
    {!!mk?.history.length && <details data-testid="mk-log"><summary>최근 마케팅 기록 {mk.history.length}건</summary>{mk.history.slice(0, 10).map((h, i) => <p className="sm" key={i}>{h}</p>)}</details>}
  </Card>;
}
