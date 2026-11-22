// 선수 면담(스토리·역사 모드): 사기·감독 신뢰·성향을 두고 칭찬·비판·재계약 논의를 말투와 함께 고릅니다.
// 사기는 경기 보정(최대 ±1%)에 반영되고, 감독 신뢰가 높으면 면담 효과가 조금 커집니다. 선수의 실제 성격이 아닌 게임 내 장치입니다.
import { PL } from "../data";
import { addNews, type Save } from "./season";
import { trainingDate, trainingPerson } from "./trainingRuntime";

export type Trait = "proud" | "diligent" | "sensitive" | "cheerful";
export type Topic = "praise" | "criticize" | "contract";
export type Tone = "soft" | "plain" | "firm";
export const TRAIT_LABEL: Record<Trait, string> = { proud: "자존심 강함", diligent: "성실함", sensitive: "예민함", cheerful: "낙천적" };
export const TOPIC_LABEL: Record<Topic, string> = { praise: "칭찬한다", criticize: "비판한다", contract: "재계약 의사를 묻는다" };
export const TOPIC_HINT: Record<Topic, string> = { praise: "최근 활약을 짚어 줍니다.", criticize: "부족한 부분을 지적합니다.", contract: "계약 연장 마음을 확인합니다." };
export const TONE_LABEL: Record<Tone, string> = { soft: "부드럽게", plain: "담담히", firm: "단호하게" };
export const MORALE_BASE = 60, TRUST_BASE = 50, TALK_COOLDOWN_DAYS = 7, MORALE_EDGE = 0.01;

export interface PlayerMood { morale: number; trust: number; at: string; lastTalk?: string; talks: number }
export interface TalkRecord { date: string; person: string; name: string; topic: Topic; tone: Tone; reply: string; dMorale: number; dTrust: number; coach?: boolean; will?: string }
export interface TalkState { version: 1; players: Record<string, PlayerMood>; log: TalkRecord[]; set?: { series: string; game: number; edge: Record<string, number> } }
export interface TalkResult extends TalkRecord { morale: number; trust: number }

const active = (s: Save): boolean => !!s.story && s.story.phase !== undefined && !s.story.ended;
const clamp = (n: number, lo = 0, hi = 100): number => Math.max(lo, Math.min(hi, Math.round(n)));
const dayOf = (d: string): number => Math.floor(Date.parse(d + "T00:00:00Z") / 86400000);
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); h ^= h >>> 15; h = Math.imul(h, 2246822509); h ^= h >>> 13; return h >>> 0; }
export function traitOf(person: string): Trait { return (["proud", "diligent", "sensitive", "cheerful"] as Trait[])[hash(person) % 4]; }
export const moraleLabel = (n: number): string => n >= 75 ? "좋음" : n >= 45 ? "보통" : "나쁨";
export const trustLabel = (n: number): string => n >= 70 ? "높음" : n >= 35 ? "보통" : "낮음";

export function initializeTalks(s: Save): TalkState | undefined {
  if (!active(s)) return;
  return s.talks ??= { version: 1, players: {}, log: [] };
}
/** 읽을 때마다 주 단위로 사기를 기본값(60)으로 1씩 되돌립니다(오래 방치하면 평온해짐). */
export function moodOf(s: Save, person: string): PlayerMood {
  const st = initializeTalks(s); const now = trainingDate(s);
  const m = st?.players[person] ?? { morale: MORALE_BASE, trust: TRUST_BASE, at: now, talks: 0 };
  const weeks = Math.max(0, Math.floor((dayOf(now) - dayOf(m.at)) / 7));
  if (weeks > 0) { m.morale = m.morale > MORALE_BASE ? Math.max(MORALE_BASE, m.morale - weeks) : Math.min(MORALE_BASE, m.morale + weeks); m.at = now; }
  if (st) st.players[person] = m;
  return m;
}
/** 경기 보정: 사기 60 기준 ±40이면 ±1%. 훈련 피로 보정에서 빼서 반영합니다(양수면 유리). */
export function moraleEdge(s: Save, key: string): number {
  const person = trainingPerson(s, key); const m = person ? s.talks?.players[person] : undefined;
  const set = s.talks?.set, ss = s.session;
  const one = person && set && ss && set.series === ss.seriesId && set.game === ss.gameIdx ? set.edge[person] ?? 0 : 0;   // 라커룸 한마디는 바로 다음 세트에만 적용
  return (m ? Math.max(-1, Math.min(1, (m.morale - MORALE_BASE) / 40)) * MORALE_EDGE : 0) + one;
}

const BASE: Record<Topic, Record<Tone, [number, number]>> = {
  praise: { soft: [3, 1], plain: [2, 1], firm: [1, 0] },
  criticize: { soft: [0, 1], plain: [-1, 1], firm: [-3, 0] },
  contract: { soft: [1, 1], plain: [0, 1], firm: [-1, -1] },
};
/** 성향·신뢰를 반영한 사기·신뢰 변화량 */
export function talkEffect(trait: Trait, topic: Topic, tone: Tone, trust: number): [number, number] {
  let [dm, dt] = BASE[topic][tone];
  if (trait === "proud") { if (topic === "praise" && tone !== "firm") dm += 1; if (topic === "criticize") { dm -= 2; if (tone === "firm") dt -= 1; } if (topic === "contract" && tone === "firm") dt -= 2; }
  if (trait === "diligent") { if (topic === "praise") dt += 1; if (topic === "criticize" && tone !== "soft") dt += 1; }
  if (trait === "sensitive") { if (topic === "praise" && tone === "soft") dm += 1; if (topic === "criticize") { dm += tone === "soft" ? 1 : -2; if (tone === "firm") dt -= 1; } if (topic === "contract" && tone === "firm") dm -= 2; }
  if (trait === "cheerful" && topic === "criticize") dm += 1;
  if (topic !== "contract") dm += trust >= 70 ? 1 : trust <= 30 ? -1 : 0;
  return [dm, dt];
}
const LINES: Record<Trait, [string, string, string]> = {
  proud: ["알아봐 주시니 좋네요. 더 보여드리겠습니다.", "네, 알겠습니다. …저도 생각이 있습니다.", "그렇게까지 말씀하실 일입니까. 솔직히 기분이 좋지 않습니다."],
  diligent: ["감사합니다. 더 꾸준히 하겠습니다.", "네, 말씀하신 부분 노트에 적어 두겠습니다.", "…열심히 하고 있다고 생각했는데, 더 노력하겠습니다."],
  sensitive: ["그렇게 봐 주셨다니 힘이 납니다.", "…네. 알겠습니다.", "그 말은 좀 아팠습니다. 한동안 생각이 많을 것 같아요."],
  cheerful: ["오, 감사합니다! 오늘 컨디션 좋은데요.", "하하, 알겠습니다. 다음엔 더 잘해 볼게요.", "음…네, 다음 경기에서 보여드릴게요."],
};
function willOf(s: Save, person: string, m: PlayerMood): string {
  const c = s.story?.contracts.find((x) => x.person === person);
  const score = m.morale * 0.5 + m.trust * 0.5 + (c && c.years <= 1 ? 0 : 5);
  return score >= 62 ? "높음" : score >= 48 ? "보통" : "낮음";
}
export function talkError(s: Save, key: string, topic?: Topic): string | undefined {
  if (!active(s)) return "면담은 스토리·역사 모드에서만 할 수 있습니다.";
  if (s.session) return "경기 진행 중에는 면담할 수 없습니다.";
  const person = trainingPerson(s, key);
  if (!person || !s.story!.contracts.some((c) => c.key === key && c.years > 0)) return "계약 중인 선수만 면담할 수 있습니다.";
  const m = moodOf(s, person);
  if (m.lastTalk && dayOf(trainingDate(s)) - dayOf(m.lastTalk) < TALK_COOLDOWN_DAYS) return `${PL[key]?.name ?? person} 선수와는 일주일에 한 번만 면담할 수 있습니다. (다음 면담: ${TALK_COOLDOWN_DAYS - (dayOf(trainingDate(s)) - dayOf(m.lastTalk))}일 뒤)`;
  if (topic && !(topic in TOPIC_LABEL)) return "알 수 없는 주제입니다.";
}
export function talkTo(s: Save, key: string, topic: Topic, tone: Tone, coach = false): TalkResult | string {
  const err = talkError(s, key, topic); if (err) return err;
  if (!(tone in TONE_LABEL)) return "알 수 없는 말투입니다.";
  const person = trainingPerson(s, key)!, st = initializeTalks(s)!, m = moodOf(s, person), name = PL[key]?.name ?? person;
  let [dm, dt] = talkEffect(traitOf(person), topic, tone, m.trust);
  if (coach) { dm = Math.trunc(dm / 2) || (dm > 0 ? 1 : 0); dt = Math.trunc(dt / 2); }   // 수석코치가 대신하면 효과는 절반
  const before = { m: m.morale, t: m.trust };
  m.morale = clamp(m.morale + dm); m.trust = clamp(m.trust + dt); m.at = trainingDate(s); m.lastTalk = trainingDate(s); m.talks++;
  const dM = m.morale - before.m, dT = m.trust - before.t;
  const pick = LINES[traitOf(person)][dM >= 1 ? 0 : dM === 0 ? 1 : 2];
  const will = topic === "contract" ? willOf(s, person, m) : undefined;
  const reply = will ? `${pick} (재계약 의사: ${will})` : pick;
  const rec: TalkRecord = { date: trainingDate(s), person, name, topic, tone, reply, dMorale: dM, dTrust: dT, coach: coach || undefined, will };
  st.log.unshift(rec); st.log.length = Math.min(60, st.log.length);
  return { ...rec, morale: m.morale, trust: m.trust };
}
/** 수석코치에게 맡기기: 면담 가능한 선수 중 사기가 75 미만인 선수에게 가장 효과가 큰 칭찬 말투로 대신 면담합니다. 효과는 절반입니다. */
export function delegateTalks(s: Save): number {
  if (!active(s) || s.session) return 0;
  let n = 0;
  for (const c of s.story!.contracts) {
    if (c.years <= 0 || talkError(s, c.key)) continue;
    const person = trainingPerson(s, c.key)!, m = moodOf(s, person);
    if (m.morale >= 75) continue;
    const tones = (["soft", "plain", "firm"] as Tone[]).map((t) => ({ t, v: talkEffect(traitOf(person), "praise", t, m.trust).reduce((a, b) => a + b, 0) })).sort((a, b) => b.v - a.v);
    if (typeof talkTo(s, c.key, "praise", tones[0].t, true) !== "string") n++;
  }
  if (n) addNews(s, "season", "수석코치 선수 면담", `수석코치가 선수 ${n}명과 대신 면담했습니다. 효과는 감독이 직접 할 때의 절반입니다.`, s.team);
  return n;
}
/** 출전 약속 평가 결과를 사기·신뢰에 반영합니다. */
export function promiseMood(s: Save, person: string, outcome: "fulfilled" | "missed" | "cancelled"): void {
  if (!initializeTalks(s)) return;
  const m = moodOf(s, person), d = outcome === "fulfilled" ? [3, 3] : outcome === "missed" ? [-5, -5] : [-3, -3];
  m.morale = clamp(m.morale + d[0]); m.trust = clamp(m.trust + d[1]);
}

// ---- 라커룸 한마디(세트 사이): 직전 세트 활약으로 선수 심리 상태를 읽고, 대상(팀 전체/개인) × 말투를 골라 다음 세트 집중(±0.6% 안)과 사기에 반영합니다 ----
export type Mind = "calm" | "confident" | "nervous" | "cocky";
export type LockerTone = "calm" | "firm" | "harsh";
export type LockerTarget = "team" | "one";
export const MIND_LABEL: Record<Mind, string> = { calm: "평범", confident: "자신감", nervous: "불안", cocky: "자만" };
export const LOCKER_TONE_LABEL: Record<LockerTone, string> = { calm: "침착", firm: "단호", harsh: "강하게" };
export const LOCKER_LINES: Record<LockerTone, string> = { calm: "침착하게 가자. 우리 플레이만 하면 된다.", firm: "정신 차리고 집중하자. 다음 세트가 중요하다.", harsh: "이게 최선이야? 똑바로 해!" };
const EDGE_UNIT = 0.001, EDGE_CAP = 0.006;
// [다음 세트 집중(0.1% 단위), 사기]
const LOCKER: Record<Mind, Record<LockerTone, [number, number]>> = {
  nervous: { calm: [5, 3], firm: [2, 1], harsh: [-4, -3] },
  cocky: { calm: [-1, 0], firm: [3, 0], harsh: [2, -1] },
  confident: { calm: [2, 1], firm: [3, 2], harsh: [-2, -1] },
  calm: { calm: [1, 1], firm: [2, 1], harsh: [-1, -1] },
};
export interface LockerMind { key: string; person: string; name: string; mind: Mind; rating: number; k: number; d: number; a: number; morale: number; trait: Trait }
function ourSide(s: Save): "B" | "R" | undefined { const d = s.session?.draft; return d ? (d.teams.B === s.team ? "B" : d.teams.R === s.team ? "R" : undefined) : undefined; }
/** 직전 세트의 우리 선발 5명의 심리 상태. 세트 결과가 있는 라커룸 단계에서만 만듭니다. */
export function lockerMinds(s: Save): LockerMind[] {
  const ss = s.session, side = ourSide(s); if (!ss?.result || !ss.draft || !side || !initializeTalks(s)) return [];
  const won = ss.result.winner === side;
  return ss.draft.lineup[side].map((key) => {
    const p = ss.result!.perf.find((x) => x.key === key && x.side === side);
    const person = trainingPerson(s, key) ?? key, morale = moodOf(s, person).morale, r = p?.rating ?? 6;
    const mind: Mind = r >= 8.5 && won && morale >= 70 ? "cocky" : r >= 7.2 && won ? "confident" : r <= 5 || (!won && r < 6) || morale <= 35 ? "nervous" : "calm";
    return { key, person, name: PL[key]?.name ?? person, mind, rating: r, k: p?.k ?? 0, d: p?.d ?? 0, a: p?.a ?? 0, morale, trait: traitOf(person) };
  });
}
/** 심리 상태·말투·성향에 따른 [다음 세트 집중, 사기] (개인 기준). 예민한 선수에게 강하게 말하면 더 크게 흔들립니다. */
export function lockerEffect(mind: Mind, tone: LockerTone, trait: Trait): [number, number] {
  let [e, m] = LOCKER[mind][tone];
  if (trait === "sensitive" && tone === "harsh") { e -= 2; m -= 2; }
  if (trait === "proud" && tone === "firm") e += 1;
  if (trait === "diligent" && tone === "calm") e += 1;
  if (trait === "cheerful") e += 1;
  return [e, m];
}
export function lockerError(s: Save): string | undefined {
  const ss = s.session; if (!ss || ss.stage !== "locker" || !ss.result) return "라커룸 단계가 아닙니다.";
  if (!s.story) return "라커룸 한마디는 스토리·역사 모드에서만 효과가 있습니다.";
  if (ss.locker) return "이번 휴식에는 이미 한마디 했습니다.";
}
/** 한마디를 적용합니다. 팀 전체는 선수마다 절반, 개인은 그 선수에게 두 배(감독 신뢰 +1). 결과는 바로 다음 세트에만 반영됩니다. */
export function lockerTalk(s: Save, target: LockerTarget, tone: LockerTone, key?: string, coach = false): string {
  const err = lockerError(s); if (err) return err;
  if (!(tone in LOCKER_TONE_LABEL)) return "알 수 없는 말투입니다.";
  const ss = s.session!, minds = lockerMinds(s); if (!minds.length) return "선수 상태를 읽을 수 없습니다.";
  const picks = target === "one" ? minds.filter((x) => x.key === key) : minds;
  if (!picks.length) return "대상 선수를 고르세요.";
  const st = initializeTalks(s)!, game = ss.gameIdx + 1, factor = target === "one" ? 2 : 0.5;
  st.set = { series: ss.seriesId, game, edge: {} };
  const parts: string[] = [];
  for (const p of picks) {
    const [e0, m0] = lockerEffect(p.mind, tone, p.trait);
    const e = Math.round(e0 * factor * (coach ? 0.5 : 1)), dm = Math.trunc(m0 * factor * (coach ? 0.5 : 1));
    st.set.edge[p.person] = Math.max(-EDGE_CAP, Math.min(EDGE_CAP, e * EDGE_UNIT));
    const m = moodOf(s, p.person); m.morale = clamp(m.morale + dm); if (target === "one") m.trust = clamp(m.trust + 1);
    parts.push(`${p.name}(${MIND_LABEL[p.mind]}) 집중 ${e >= 0 ? "+" : ""}${(e * EDGE_UNIT * 100).toFixed(1)}% · 사기 ${dm >= 0 ? "+" : ""}${dm}`);
  }
  ss.locker = { target, tone: tone === "calm" ? "calm" : tone === "firm" ? "firm" : "harsh", key: target === "one" ? key : undefined };
  ss.lockerNote = `${coach ? "수석코치" : "감독"}: “${LOCKER_LINES[tone]}” — ${target === "one" ? "" : "팀 전체 · "}${parts.join(" / ")}`;
  return ss.lockerNote;
}
/** 수석코치에게 맡기기: 팀 전체에 가장 효과가 큰 말투를 대신 고릅니다(효과 절반). */
export function lockerAuto(s: Save): string {
  const minds = lockerMinds(s); if (!minds.length) return "선수 상태를 읽을 수 없습니다.";
  const tones = (["calm", "firm", "harsh"] as LockerTone[]).map((t) => ({ t, v: minds.reduce((n, p) => n + lockerEffect(p.mind, t, p.trait)[0], 0) })).sort((a, b) => b.v - a.v);
  return lockerTalk(s, "team", tones[0].t, undefined, true);
}
