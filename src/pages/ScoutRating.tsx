import type { Player, SeasonCard } from "../types";
import { useSave, mutate } from "../store";
import { Ovr } from "../ui";
import { ratingOf } from "../rating";
import { MAX_SCOUT_REPORTS, addScoutReport, isOurPlayer, personId, scoutReports } from "../game/scouting";
import { estimateOvr, potentialNote, type StarEstimate } from "../game/scoutEstimate";

export function ScoutStars({ person, value, card, player, compact }: { person: string; value?: number | null; card?: SeasonCard | null; player?: Player | null; compact?: boolean }) {
  const s = useSave();
  const est = estimateOvr(s, person, value ?? (player ? ratingOf(player) : null), card, player);
  if (est.kind === "none") return <span className="scout-est" data-testid="scout-stars" data-kind="none" title={est.reason}>기록 없음</span>;
  if (est.kind === "exact") return compact ? <Ovr p={player} v={est.value} /> : <span className="scout-est exact" data-testid="scout-stars" data-kind="exact" title={est.reason}><b>{est.value}</b><small>능력치</small></span>;
  return <span className="scout-est" data-testid="scout-stars" data-kind="range" data-lo={est.lo} data-hi={est.hi} title={est.reason}><b className="scout-stars">{est.text}</b>{!compact && <small>능력치 추정</small>}</span>;
}

export function ScoutObserve({ person, onStatus }: { person: string; onStatus?: (msg: string) => void }) {
  const s = useSave();
  if (!s) return null;
  const id = personId(s, person);
  if (isOurPlayer(s, id)) return null;
  const est: StarEstimate = estimateOvr(s, id);
  if (est.kind === "none") return null;
  const n = scoutReports(s, id);
  const done = n >= MAX_SCOUT_REPORTS || est.kind === "exact";
  return <button type="button" className="btn sm" data-testid={`scout-observe-${id}`} disabled={done} onClick={e => {
    e.preventDefault(); e.stopPropagation();
    mutate(x => { const msg = addScoutReport(x, id); onStatus?.(msg ?? (n + 1 >= MAX_SCOUT_REPORTS ? "관찰을 마쳐 능력치를 확인했습니다." : "관찰 리포트를 추가해 추정 구간을 좁혔습니다.")); });
  }}>{done ? "관찰 완료" : n === 0 ? "관찰 리포트 작성" : `추가 관찰 (${n}/${MAX_SCOUT_REPORTS})`}</button>;
}

export function ScoutPotential({ person, value, card, player }: { person: string; value?: number | null; card?: SeasonCard | null; player?: Player | null }) {
  const s = useSave();
  const est = estimateOvr(s, person, value, card, player);
  return <p className="muted xs" data-testid="scout-potential">{potentialNote(est)}</p>;
}
