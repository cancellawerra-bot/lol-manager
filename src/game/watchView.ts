// 관전 화면용 표시 헬퍼. 승부·이벤트 배열은 바꾸지 않고, 이미 시뮬된 기록만 보여 줍니다.
import type { Side } from "./draft";
import type { GameResult, GEvent } from "./sim";

export type WatchMode = "full" | "highlight" | "result";
export const WATCH_MODES: WatchMode[] = ["full", "highlight", "result"];
export const WATCH_MODE_KO: Record<WatchMode, string> = {
  full: "전체 장면",
  highlight: "주요 장면",
  result: "결과만",
};

const HIGHLIGHT_KIND = new Set<GEvent["kind"]>(["kill", "tower", "herald", "baron", "fight", "lane", "end"]);

export function isHighlight(e: GEvent, all: GEvent[], index: number): boolean {
  if (HIGHLIGHT_KIND.has(e.kind)) return true;
  if (e.kind === "drake") {
    const n = all.slice(0, index + 1).filter((x) => x.kind === "drake").length;
    return n === 1 || /영혼|첫 |네 번째/.test(e.text);
  }
  return false;
}

/** 현재까지 보여 준 장면 수(step)에서 다음으로 이동할 step. 이벤트 내용은 바꾸지 않습니다. */
export function nextWatchStep(events: GEvent[], step: number, mode: WatchMode): number {
  const n = events.length;
  if (mode === "result") return n;
  if (step >= n) return n;
  if (mode === "full") return Math.min(n, step + 1);
  let i = step + 1;
  while (i < n && !isHighlight(events[i - 1], events, i - 1)) i++;
  return i;
}

/** 하이라이트 모드로 바꿀 때, 지금 장면이 주요 장면이 아니면 다음 주요 장면으로 맞춥니다. */
export function snapWatchStep(events: GEvent[], step: number, mode: WatchMode): number {
  if (mode === "result") return events.length;
  if (mode === "full" || step <= 0 || step > events.length) return step;
  if (isHighlight(events[step - 1], events, step - 1)) return step;
  return nextWatchStep(events, step, "highlight");
}

export interface LeadPt { t: number; v: number; kind?: GEvent["kind"]; side?: Side }

/** 기록된 lead만 사용하고, lead가 없는 장면은 직전 기록값을 유지합니다(새 골드 값을 만들지 않음). */
export function leadPoints(r: GameResult, upto: number): LeadPt[] {
  const ev = r.events.slice(0, Math.max(0, upto));
  const pts: LeadPt[] = [{ t: 0, v: 0 }];
  let last = 0;
  for (const e of ev) {
    if (e.lead != null) last = e.lead;
    pts.push({ t: e.t, v: last, kind: e.kind, side: e.side });
  }
  if (upto >= r.events.length && ev.length) {
    const lastPt = pts[pts.length - 1];
    if (lastPt.t !== r.dur || lastPt.v !== r.leadEnd) pts.push({ t: r.dur, v: r.leadEnd, kind: "end" });
  }
  return pts;
}

export const OBJ_TL_KINDS = new Set<GEvent["kind"]>(["drake", "grub", "herald", "baron", "tower"]);
export function objectiveMoments(events: GEvent[], upto: number): GEvent[] {
  return events.slice(0, Math.max(0, upto)).filter((e) => OBJ_TL_KINDS.has(e.kind));
}

const fmt = (n: number): string => Math.round(n).toLocaleString("ko-KR");

export function coachTalk(
  ev: GEvent | undefined,
  ctx: { teams: Record<Side, string>; me: Side; seen: GEvent[]; leadEnd?: number },
): { body: string } {
  if (!ev) {
    return { body: "아직 기록된 장면이 없습니다. 장면이 진행되면 이 경기에서 실제로 일어난 일만 짚겠습니다." };
  }
  const team = ev.side ? ctx.teams[ev.side] : "";
  const ours = ev.side != null && ev.side === ctx.me;
  const whose = ev.side == null ? "" : ours ? `우리 팀(${team})` : team;
  const lastLead = [...ctx.seen].reverse().find((e) => e.lead != null)?.lead;
  const gold = lastLead == null
    ? ""
    : ` 기록된 골드 차는 ${lastLead >= 0 ? ctx.teams.B : ctx.teams.R} +${fmt(Math.abs(lastLead))}입니다.`;
  const cnt = (kind: GEvent["kind"], side?: Side): number =>
    ctx.seen.filter((e) => e.kind === kind && (side == null || e.side === side)).length;

  switch (ev.kind) {
    case "kill":
      return { body: `${ev.t}분, 킬이 기록됐습니다. ${ev.text}.${whose ? ` ${whose} 쪽 기록입니다.` : ""}${gold}` };
    case "drake": {
      const b = cnt("drake", "B"), r = cnt("drake", "R");
      return { body: `${ev.t}분, 드래곤 기록입니다. ${ev.text}. 지금까지 드래곤 ${ctx.teams.B} ${b} : ${ctx.teams.R} ${r}.${gold}` };
    }
    case "grub":
      return { body: `${ev.t}분, 공허 유충 기록입니다. ${ev.text}.${gold}` };
    case "herald":
      return { body: `${ev.t}분, 협곡의 전령 기록입니다. ${ev.text}.${whose ? ` 가져간 팀은 ${whose}입니다.` : ""}${gold}` };
    case "tower":
      return { body: `${ev.t}분, 포탑 기록입니다. ${ev.text}.${whose ? ` ${whose} 쪽입니다.` : ""}${gold}` };
    case "baron":
      return { body: `${ev.t}분, 내셔 남작 기록입니다. ${ev.text}.${whose ? ` 가져간 팀은 ${whose}입니다.` : ""}${gold}` };
    case "fight":
      return { body: `${ev.t}분, 한타 기록입니다. ${ev.text}.${gold}` };
    case "lane":
      return { body: `${ev.t}분, 라인전 종료 기록입니다. ${ev.text}.` };
    case "end": {
      const endGold = ctx.leadEnd ?? lastLead;
      const g = endGold == null ? "" : ` 최종 골드 차는 ${endGold >= 0 ? ctx.teams.B : ctx.teams.R} +${fmt(Math.abs(endGold))}입니다.`;
      return { body: `경기 종료 기록입니다. ${ev.text}.${g}` };
    }
    default:
      return { body: `${ev.t}분 기록: ${ev.text}.${gold}` };
  }
}
