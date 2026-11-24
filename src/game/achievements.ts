// 도전 성과·진열장: 이번 커리어에서 실제로 남은 기록만 읽습니다. 현실 구단의 우승 역사를 넣지 않고, 없는 데이터는 미달성입니다.
import { PL } from "../data";
import { fmtMoney } from "./money";
import { addNews, standings, type Save, type SeriesRec } from "./season";
import { trainedRatingOf } from "./trainingRuntime";

export interface Achievement { id: string; label: string; done: boolean; detail: string }
export interface HonorStamp { detail: string; count?: number; when?: string[] }
export interface HonorsState { version: 1; announced?: string[]; earned?: Record<string, HonorStamp> }
export type HonorKind = "trophy" | "feat";
export interface HonorItem {
  id: string; kind: HonorKind; label: string; done: boolean; detail: string;
  count?: number; when?: string[]; icon: "cup" | "shield" | "medal" | "star" | "banner" | "gem";
}

const PO_STAGES = ["PO1", "SF", "F"];
const SPLIT_KO = { spring: "스프링", summer: "서머" } as const;
const EMPTY = "아직 이 커리어에서 거둔 기록이 없습니다";
export const HONOR_NEWS = "구단 기록 · ";

export function challengeLog(s: Save): Achievement[] | undefined {
  const st = s.story; if (!st) return;
  const splits = (s.clubTimeline?.splits ?? []).filter((x) => x.tier === "LCK" && x.complete);
  const when = (x: { year: number; split: "spring" | "summer" }): string => `${x.year} ${SPLIT_KO[x.split]}`;
  const first = <T,>(f: (x: (typeof splits)[number]) => T | false): { r: T; at: string } | undefined => { for (const x of splits) { const r = f(x); if (r) return { r: r as T, at: when(x) }; } return undefined; };
  const top = first((x) => x.rank === 1 && x.rank);
  const po = first((x) => x.matches.some((m) => PO_STAGES.includes(m.stage)));
  const fin = first((x) => x.matches.some((m) => m.stage === "F"));
  const best = splits.length ? Math.min(...splits.map((x) => x.rank)) : undefined;
  const rows = standings(s), me = rows.findIndex((r) => r.t === s.team) + 1;
  const livePo = s.series.some((x) => PO_STAGES.includes(x.stage) && (x.a === s.team || x.b === s.team));
  const liveFin = s.series.some((x) => x.stage === "F" && (x.a === s.team || x.b === s.team));
  const out: Achievement[] = [
    { id: "top6", label: "플레이오프 진출", done: !!po || livePo, detail: po ? `${po.at}` : livePo ? "이번 스플릿" : "정규 시즌 상위권(6위 이내)을 노려 보세요" },
    { id: "rank1", label: "정규 시즌 1위", done: !!top || (me === 1 && st.tier === "LCK" && rows[0]?.w + rows[0]?.l > 0 && s.phase !== "regular"), detail: top ? top.at : best != null ? `최고 ${best}위` : "아직 완료한 스플릿이 없습니다" },
    { id: "final", label: "LCK 결승 진출", done: !!fin || liveFin, detail: fin ? fin.at : liveFin ? "이번 스플릿" : "플레이오프에서 결승까지" },
    { id: "lck", label: "LCK 우승", done: st.trophies.lck > 0, detail: st.trophies.lck > 0 ? `${st.trophies.lck}회` : "결승 승리" },
    { id: "msi", label: "MSI 우승", done: st.trophies.msi > 0, detail: st.trophies.msi > 0 ? `${st.trophies.msi}회` : "LCK 1시드로 출전" },
    { id: "worlds", label: "월즈 우승 (최종 목표)", done: st.trophies.worlds > 0, detail: st.trophies.worlds > 0 ? `${st.trophies.worlds}회` : "2027까지 도전" },
  ];
  return out;
}

type Memo = { id: string; date: string; stage: string; won: boolean; scored: number; conceded: number; year?: number; split?: string; tier?: "CK" | "LCK"; intl?: "msi" | "worlds" | "promo" | "rtm" | "league" };

function intlOf(id: string): Memo["intl"] {
  if (id.startsWith("MSI-")) return "msi";
  if (id.startsWith("W-")) return "worlds";
  if (id.startsWith("PR-")) return "promo";
  if (id.startsWith("RTM-")) return "rtm";
  return "league";
}

function collected(s: Save): Memo[] {
  const out: Memo[] = [], seen = new Set<string>();
  for (const sp of s.clubTimeline?.splits ?? []) {
    for (const m of sp.matches) {
      seen.add(m.id);
      out.push({ id: m.id, date: m.date, stage: m.stage, won: m.won, scored: m.scored, conceded: m.conceded, year: sp.year, split: sp.split, tier: sp.tier, intl: intlOf(m.id) });
    }
  }
  for (const x of s.series) {
    if (!x.winner || (x.a !== s.team && x.b !== s.team) || seen.has(x.id)) continue;
    out.push({
      id: x.id, date: s.days[x.day]?.date ?? "", stage: x.stage, won: x.winner === s.team,
      scored: x.a === s.team ? x.sa : x.sb, conceded: x.a === s.team ? x.sb : x.sa,
      year: s.story?.year, split: s.story?.split, tier: s.story?.tier, intl: intlOf(x.id),
    });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
}

const labelWhen = (m: { year?: number; split?: string }): string | undefined => {
  if (!m.year) return;
  const sp = m.split && (m.split === "spring" || m.split === "summer") ? SPLIT_KO[m.split] : undefined;
  return sp ? `${m.year} ${sp}` : String(m.year);
};

function uniq(xs: (string | undefined)[]): string[] {
  return [...new Set(xs.filter((x): x is string => !!x))];
}

function ourGames(s: Save): { series: SeriesRec; goldUs: number; won: boolean; mvpOurs: boolean }[] {
  const out: { series: SeriesRec; goldUs: number; won: boolean; mvpOurs: boolean }[] = [];
  for (const sr of s.series) {
    if (sr.a !== s.team && sr.b !== s.team) continue;
    for (const g of sr.games) {
      if (!g.winner) continue;
      const side = g.blue === s.team ? "B" as const : "R" as const;
      const mvpOurs = g.winner === s.team && (g.lineup[side] ?? []).includes(g.mvp);
      if (g.gold15 == null || !Number.isFinite(g.gold15)) {
        if (mvpOurs) out.push({ series: sr, goldUs: NaN, won: true, mvpOurs: true });
        continue;
      }
      const goldUs = g.blue === s.team ? g.gold15 : -g.gold15;
      out.push({ series: sr, goldUs, won: g.winner === s.team, mvpOurs });
    }
  }
  return out;
}

function cashAtOurTitle(s: Save): number | undefined {
  const ev = (s.clubTimeline?.events ?? []).filter((e) => e.cash != null && e.source === "live" && /우승/.test(e.title) && (e.title.startsWith(`${s.team},`) || (s.club && e.title.includes(s.club.name))));
  return ev.length ? ev[ev.length - 1]!.cash : undefined;
}

export function careerHonors(s: Save): { trophies: HonorItem[]; feats: HonorItem[] } {
  const st = s.story, memo = collected(s), games = ourGames(s);
  const splits = (s.clubTimeline?.splits ?? []).filter((x) => x.complete);
  const ckWhen = uniq([
    ...memo.filter((m) => m.won && m.stage === "F" && m.intl === "league" && m.tier === "CK").map(labelWhen),
    ...splits.filter((x) => x.tier === "CK" && x.champion === s.team).map((x) => `${x.year} ${SPLIT_KO[x.split]}`),
  ]);
  const lckWinWhen = uniq([
    ...memo.filter((m) => m.won && m.stage === "F" && m.intl === "league" && m.tier === "LCK").map(labelWhen),
    ...splits.filter((x) => x.tier === "LCK" && x.champion === s.team).map((x) => `${x.year} ${SPLIT_KO[x.split]}`),
  ]);
  const lckLossWhen = uniq(memo.filter((m) => !m.won && m.stage === "F" && m.intl === "league" && m.tier === "LCK").map(labelWhen));
  const msiDone = (!!st && st.trophies.msi > 0) || memo.some((m) => m.won && m.stage === "F" && m.intl === "msi");
  const worldsDone = (!!st && st.trophies.worlds > 0) || memo.some((m) => m.won && m.stage === "F" && m.intl === "worlds");
  const worldsPlayed = worldsDone || memo.some((m) => m.intl === "worlds");
  const po = memo.some((m) => PO_STAGES.includes(m.stage)) || s.series.some((x) => PO_STAGES.includes(x.stage) && (x.a === s.team || x.b === s.team));
  const rank1Splits = splits.filter((x) => x.rank === 1);
  const liveRank1 = !!st && st.tier === "LCK" && s.phase !== "regular" && (() => {
    const rows = standings(s), me = rows.findIndex((r) => r.t === s.team) + 1;
    return me === 1 && (rows[0]?.w ?? 0) + (rows[0]?.l ?? 0) > 0;
  })();
  const promoText = (t: string) => /우리 구단이 LCK로 올라갔습니다/.test(t);
  const promo = (s.clubTimeline?.events ?? []).some((e) => promoText(`${e.title} ${e.body}`))
    || (s.news ?? []).some((n) => promoText(`${n.title} ${n.body ?? ""}`))
    || ((s.clubTimeline?.splits ?? []).some((x) => x.tier === "CK") && (s.clubTimeline?.splits ?? []).some((x) => x.tier === "LCK"));
  const seasonCup = !st && s.champion === s.team;

  const item = (id: string, kind: HonorKind, label: string, done: boolean, detail: string, icon: HonorItem["icon"], count?: number, when?: string[]): HonorItem =>
    ({ id, kind, label, done, detail: done ? detail : EMPTY, icon, count: done ? count : undefined, when: done ? when : undefined });

  const trophies: HonorItem[] = [
    item("ck", "trophy", "2부 우승", ckWhen.length > 0, ckWhen.join(", "), "shield", ckWhen.length, ckWhen),
    item("lck", "trophy", "LCK 우승", lckWinWhen.length > 0, lckWinWhen.join(", "), "cup", lckWinWhen.length, lckWinWhen),
    item("lck-silver", "trophy", "LCK 준우승", lckLossWhen.length > 0, lckLossWhen.join(", "), "medal", lckLossWhen.length, lckLossWhen),
    item("rank1", "trophy", "정규 시즌 1위", rank1Splits.length > 0 || !!liveRank1, rank1Splits.length ? rank1Splits.map((x) => `${x.year} ${SPLIT_KO[x.split]}`).join(", ") : "이번 스플릿", "banner", rank1Splits.length || (liveRank1 ? 1 : undefined), rank1Splits.map((x) => `${x.year} ${SPLIT_KO[x.split]}`)),
    item("po", "trophy", "플레이오프 진출", po, "이 커리어에서 플레이오프 무대를 밟았습니다", "star"),
    item("msi", "trophy", "MSI 우승", msiDone, st && st.trophies.msi > 0 ? `${st.trophies.msi}회` : "이번 커리어에서 MSI를 우승했습니다", "cup", st?.trophies.msi || (msiDone ? 1 : undefined)),
    item("worlds", "trophy", "월즈 우승", worldsDone, st && st.trophies.worlds > 0 ? `${st.trophies.worlds}회` : "이번 커리어에서 월즈를 우승했습니다", "cup", st?.trophies.worlds || (worldsDone ? 1 : undefined)),
    item("worlds-run", "trophy", "월즈 출전", worldsPlayed, "이 커리어에서 월즈에 나갔습니다", "banner"),
    item("promo", "trophy", "1부 승격", promo, "2부에서 LCK로 올라간 기록이 있습니다", "gem"),
    item("season-cup", "trophy", "시즌 우승", seasonCup, "이번 시즌 결승을 이겼습니다", "cup", seasonCup ? 1 : undefined),
  ];

  let bestStreak = 0, run = 0;
  for (const m of memo) { if (m.won) { run += 1; if (run > bestStreak) bestStreak = run; } else run = 0; }
  const firstWin = memo.find((m) => m.won);
  const comebacks = games.filter((g) => g.won && Number.isFinite(g.goldUs) && g.goldUs <= -2000);
  const bestComeback = comebacks.reduce((n, g) => Math.min(n, g.goldUs), 0);
  const pog = games.some((g) => g.mvpOurs);
  const grown = [...(st?.contracts.map((c) => c.key) ?? []), ...(s.starters[s.team] ?? []), ...s.cards]
    .filter((k, i, a) => k && a.indexOf(k) === i)
    .map((k) => ({ k, r: trainedRatingOf(s, k)?.overall, name: PL[k]?.name ?? k }))
    .filter((x) => x.r != null && x.r >= 100);
  const titleCash = cashAtOurTitle(s);
  const budgetWin = titleCash != null && titleCash >= 0 && (lckWinWhen.length > 0 || ckWhen.length > 0 || msiDone || worldsDone || seasonCup);

  const feats: HonorItem[] = [
    item("first-win", "feat", "첫 시리즈 승리", !!firstWin, firstWin ? `${firstWin.date || labelWhen(firstWin) || "기록된 경기"} · ${firstWin.scored}:${firstWin.conceded}` : EMPTY, "medal"),
    item("streak3", "feat", "3연승", bestStreak >= 3, `이 커리어 최장 ${bestStreak}연승`, "star"),
    item("streak5", "feat", "5연승", bestStreak >= 5, `이 커리어 최장 ${bestStreak}연승`, "star"),
    item("streak8", "feat", "8연승", bestStreak >= 8, `이 커리어 최장 ${bestStreak}연승`, "star"),
    item("comeback", "feat", "15분 열세 역전", comebacks.length > 0, `15분 골드 ${Math.round(bestComeback).toLocaleString("ko-KR")}에서 뒤진 세트를 뒤집었습니다`, "shield"),
    item("pog", "feat", "POG 수상", pog, "우리 선수가 승리한 세트에서 POG를 받았습니다", "star"),
    item("prospect100", "feat", "성장 상한 도달", grown.length > 0, grown.length ? `${grown.map((x) => x.name).join(", ")} 능력치 100` : EMPTY, "gem"),
    item("budget-title", "feat", "흑자 우승", budgetWin, budgetWin ? `우승 시점 잔고 ${fmtMoney(titleCash!)}(당시 기록)` : EMPTY, "banner"),
  ];

  const earned = s.honors?.earned ?? {};
  const keep = (items: HonorItem[]): HonorItem[] => items.map((it) => {
    if (it.done) return it;
    const prev = earned[it.id];
    if (!prev) return it;
    return { ...it, done: true, detail: prev.detail || it.detail, count: prev.count ?? it.count, when: prev.when ?? it.when };
  });
  return { trophies: keep(trophies), feats: keep(feats) };
}

export const allHonorItems = (s: Save): HonorItem[] => {
  const h = careerHonors(s);
  return [...h.trophies, ...h.feats];
};

export function unreadHonorNews(s: Save): number {
  return (s.news ?? []).filter((n) => !n.read && n.title.startsWith(HONOR_NEWS)).length;
}

export function syncHonors(s: Save): void {
  const done = allHonorItems(s).filter((x) => x.done);
  const earned: Record<string, HonorStamp> = { ...(s.honors?.earned ?? {}) };
  for (const it of done) {
    earned[it.id] = { detail: it.detail, ...(it.count != null ? { count: it.count } : {}), ...(it.when?.length ? { when: it.when } : {}) };
  }
  if (!s.honors) {
    s.honors = { version: 1, announced: done.map((x) => x.id), earned };
    return;
  }
  const announced = new Set((s.honors.announced ?? []).filter((id) => typeof id === "string"));
  for (const it of done.filter((x) => !announced.has(x.id))) {
    addNews(s, "season", `${HONOR_NEWS}${it.label}`, `${it.detail}. 구단 진열장에서 확인할 수 있습니다. 이 기록은 표시만이며 자금·팬심·승부에는 영향이 없습니다.`, s.team);
    announced.add(it.id);
  }
  s.honors = { version: 1, announced: [...announced], earned };
}

export const emptyHonors = (): HonorsState => ({ version: 1, announced: [], earned: {} });
