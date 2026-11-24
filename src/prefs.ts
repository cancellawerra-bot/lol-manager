// 화면 환경설정: 이 브라우저에만 저장(커리어 세이브와 별개). 표시·속도만 바꾸고 경기 결과에는 영향 없음.
import { useSyncExternalStore } from "react";

export interface Prefs { speed: "slow" | "normal" | "fast" | "turbo"; map: boolean; intro: boolean; sound: boolean; watchMode: "full" | "highlight" | "result" }
export const SPEED_MS: Record<Prefs["speed"], number> = { slow: 1800, normal: 1100, fast: 550, turbo: 250 };
export const SPEED_KO: Record<Prefs["speed"], string> = { slow: "느리게", normal: "보통", fast: "빠르게", turbo: "아주 빠르게" };
const KEY = "lolm.prefs";
const DEF: Prefs = { speed: "normal", map: true, intro: true, sound: true, watchMode: "full" };
let cur: Prefs = load();
const subs = new Set<() => void>();

function load(): Prefs {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Partial<Prefs>;
    const watchMode = o.watchMode === "highlight" || o.watchMode === "result" || o.watchMode === "full" ? o.watchMode : DEF.watchMode;
    return { speed: o.speed && o.speed in SPEED_MS ? o.speed : DEF.speed, map: o.map !== false, intro: o.intro !== false, sound: o.sound !== false, watchMode };
  } catch { return { ...DEF }; }
}
export function setPrefs(p: Partial<Prefs>): void {
  cur = { ...cur, ...p };
  try { localStorage.setItem(KEY, JSON.stringify(cur)); } catch { /* 저장 불가여도 이번 접속에서는 적용 */ }
  subs.forEach((f) => f());
}
export function usePrefs(): Prefs {
  return useSyncExternalStore((f) => { subs.add(f); return () => subs.delete(f); }, () => cur);
}
