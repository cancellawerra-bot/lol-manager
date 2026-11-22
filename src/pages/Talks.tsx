import { useState } from "react";
import { PL, POS_KO } from "../data";
import { useSave, talkToPlayer, delegateTalksToCoach } from "../store";
import { Card } from "../ui";
import { trainingPerson, trainingDate } from "../game/trainingRuntime";
import { TOPIC_LABEL, TOPIC_HINT, TONE_LABEL, TRAIT_LABEL, TALK_COOLDOWN_DAYS, MORALE_BASE, TRUST_BASE, traitOf, moraleLabel, trustLabel, type Topic, type Tone, type TalkResult } from "../game/talks";

const sign = (n: number): string => (n >= 0 ? "+" : "") + n;
const dayOf = (d: string): number => Math.floor(Date.parse(d + "T00:00:00Z") / 86400000);

/** 선수 면담: 주제 → 말투 → 결과. 사기는 경기 보정에, 신뢰는 면담 효과에 반영됩니다(게임 내 장치). */
export function TalkControls() {
  const s = useSave()!;
  const [open, setOpen] = useState<string>(""), [topic, setTopic] = useState<Topic>("praise"), [tone, setTone] = useState<Tone>("soft");
  const [res, setRes] = useState<TalkResult | null>(null), [msg, setMsg] = useState("");
  if (s.mode !== "story" || !s.story) return null;
  const locked = !!s.session || !!s.story.ended, now = trainingDate(s);
  const rows = s.story.contracts.filter((c) => c.years > 0 && PL[c.key]);
  const start = (key: string): void => {
    const r = talkToPlayer(key, topic, tone);
    if (typeof r === "string") { setMsg(r); setRes(null); } else { setMsg(""); setRes(r); }
  };
  return <Card title="선수 면담" right={<button className="btn sm" data-testid="talk-delegate" disabled={locked} onClick={() => { const n = delegateTalksToCoach(); setRes(null); setMsg(n ? `수석코치가 ${n}명과 대신 면담했습니다(효과 절반).` : "수석코치가 면담할 선수가 없습니다(사기 75 이상이거나 최근에 면담함)."); }}>수석코치에게 맡기기</button>}>
    <p className="sm">선수마다 <b>사기</b>(경기 보정 최대 ±1%)와 <b>감독 신뢰</b>, <b>성향</b>이 있습니다. 같은 말도 성향에 따라 받아들이는 게 다릅니다. 선수와는 일주일에 한 번 면담할 수 있고, 사기는 주마다 평소(60)로 조금씩 돌아옵니다.</p>
    <details className="note-fold" data-testid="talk-rules"><summary>면담 규칙 자세히 보기</summary>
      <p className="muted sm">칭찬은 대체로 사기를 올리지만 단호한 말투는 효과가 작습니다. 비판은 부드럽게 하면 신뢰를 쌓을 수 있지만 단호하면 사기가 크게 떨어집니다. 재계약 논의는 선수의 재계약 의사(높음·보통·낮음)를 알려 주고, 단호하게 밀어붙이면 신뢰를 잃습니다. 감독 신뢰가 70 이상이면 효과가 +1, 30 이하이면 −1입니다. 출전 약속을 지키면 사기·신뢰 +3, 어기면 −5입니다. 실제 선수의 성격이 아닌 게임 내 장치이며, 수석코치가 대신하면 효과가 절반입니다.</p>
    </details>
    {msg && <p className="sm" role="status" data-testid="talk-msg">{msg}</p>}
    <div className="card-grid" data-testid="talk-roster">{rows.map((c) => {
      const person = trainingPerson(s, c.key) ?? c.key, m = s.talks?.players[person];
      const morale = m?.morale ?? MORALE_BASE, trust = m?.trust ?? TRUST_BASE, trait = traitOf(person);
      const wait = m?.lastTalk ? TALK_COOLDOWN_DAYS - (dayOf(now) - dayOf(m.lastTalk)) : 0;
      const isOpen = open === c.key;
      return <div className="card-tile" key={c.key} data-testid={`talk-${person}`}>
        <b>{PL[c.key].name}</b><span className="tag">{POS_KO[PL[c.key].pos]} · {(s.starters[s.team] ?? []).includes(c.key) ? "선발" : "벤치"}</span>
        <p className="sm">사기 <b>{moraleLabel(morale)}</b> ({morale}) · 신뢰 <b>{trustLabel(trust)}</b> ({trust})<br />성향 {TRAIT_LABEL[trait]}{m?.lastTalk ? ` · 마지막 면담 ${m.lastTalk}` : ""}</p>
        <button className="btn sm" data-testid={`talk-open-${person}`} disabled={locked || wait > 0} onClick={() => { setOpen(isOpen ? "" : c.key); setRes(null); setMsg(""); }}>{wait > 0 ? `면담 ${wait}일 뒤 가능` : isOpen ? "닫기" : "면담하기"}</button>
        {isOpen && <div className="talk-box" data-testid={`talk-box-${person}`}>
          <p className="muted xs">무슨 이야기를 할까요?</p>
          <div className="row gap wrap">{(Object.keys(TOPIC_LABEL) as Topic[]).map((t) => <button key={t} className={"btn sm" + (topic === t ? " primary" : "")} title={TOPIC_HINT[t]} onClick={() => setTopic(t)}>{TOPIC_LABEL[t]}</button>)}</div>
          <p className="muted xs">{TOPIC_HINT[topic]} 어떻게 말할까요?</p>
          <div className="row gap wrap">{(Object.keys(TONE_LABEL) as Tone[]).map((t) => <button key={t} className={"btn sm" + (tone === t ? " primary" : "")} onClick={() => setTone(t)}>{TONE_LABEL[t]}</button>)}</div>
          <button className="btn primary sm" data-testid={`talk-go-${person}`} onClick={() => start(c.key)}>면담 시작</button>
        </div>}
        {res && res.person === person && <p className="sm talk-res" data-testid={`talk-result-${person}`}>“{res.reply}”<br />사기 {sign(res.dMorale)} · 신뢰 {sign(res.dTrust)} → 사기 {res.morale} · 신뢰 {res.trust}</p>}
      </div>;
    })}</div>
    {!!s.talks?.log.length && <details data-testid="talk-log"><summary>최근 면담 {s.talks.log.length}건</summary>{s.talks.log.slice(0, 12).map((h, i) => <p className="sm" key={i}>{h.date} · {h.name} · {TOPIC_LABEL[h.topic]}({TONE_LABEL[h.tone]}){h.coach ? " · 수석코치" : ""} · 사기 {sign(h.dMorale)} · 신뢰 {sign(h.dTrust)}</p>)}</details>}
  </Card>;
}
