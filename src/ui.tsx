import { ReactNode, useEffect } from "react";
import { CH, TM, PL } from "./data";
import type { Player } from "./types";
import { ratingOf, ratingColor } from "./rating";

export function ChampIcon({ id, size = 36, dim, title, ring }: { id: string; size?: number; dim?: boolean; title?: string; ring?: string }) {
  const c = CH[id];
  return (
    <img className={"cicon" + (dim ? " dim" : "")} src={`./champ/icon/${id}.webp`} width={size} height={size} loading="lazy" decoding="async"
      alt={c?.ko ?? id} title={title ?? c?.ko ?? id} style={ring ? { boxShadow: `0 0 0 2px ${ring}` } : undefined} />
  );
}
export function TeamChip({ t, size = "md", full }: { t: string; size?: "sm" | "md" | "lg"; full?: boolean }) {
  const tm = TM[t];
  return (
    <span className={`tchip ${size}`}>
      <span className="tdot" style={{ background: tm?.color ?? "#64748b" }}>{t}</span>
      {full && <span className="tname">{tm?.ko ?? t}</span>}
    </span>
  );
}
export function Sample({ n, min, unit = "경기" }: { n: number; min: number; unit?: string }) {
  return n < min ? <span className="tag warn" title={`${min}${unit} 미만`}>표본 부족 · {n}{unit}</span> : <span className="tag">{n}{unit}</span>;
}
export function Bar({ v, max = 100, color }: { v: number; max?: number; color?: string }) {
  return <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></span>;
}
/** 화면 능력치 (55~99). 선수 객체 또는 이미 계산한 값 */
export function Ovr({ p, v }: { p?: Player | null; v?: number | null }) {
  const r = v ?? ratingOf(p);
  if (r == null) return <b className="pctv muted">–</b>;
  return <b className="pctv" style={{ color: ratingColor(r) }} title="능력치 (실제 기록 + 국제대회 성적)">{r}</b>;
}
export function Pct({ v }: { v: number }) {
  const c = v >= 80 ? "var(--good)" : v >= 55 ? "var(--teal)" : v >= 30 ? "var(--warn)" : "var(--bad)";
  return <b className="pctv" style={{ color: c }}>{v}</b>;
}
export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent): void => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className={"modal" + (wide ? " wide" : "")} role="dialog" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="modal-h"><h3>{title}</h3><button className="btn ghost sm" onClick={onClose} aria-label="닫기">닫기 ✕</button></div>
        <div className="modal-b">{children}</div>
      </div>
    </div>
  );
}
export function PName({ k, link = true }: { k: string; link?: boolean }) {
  const p = PL[k];
  if (!p) return <span>{k}</span>;
  const label = p.label ?? p.name;
  return link ? <a className="pname" href={`#/player/${k}`}>{label}</a> : <span className="pname">{label}</span>;
}
export function Card({ title, right, children, className }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={"card " + (className ?? "")}>
      {(title || right) && <div className="card-h"><h2>{title}</h2>{right}</div>}
      {children}
    </section>
  );
}
export function FanNotice() {
  return (
    <footer className="fan">
      <p>LOL Manager isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
      <p>LOL Manager was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.</p>
      <p>LOL Manager는 Riot Games의 보증을 받지 않은 무료 비상업 팬 프로젝트이며, LCK 및 각 구단과 관련이 없습니다. 팀 로고와 선수 사진은 쓰지 않습니다. 챔피언 이미지는 Riot Games Data Dragon 16.22.1 자료입니다.</p>
      <p className="links"><a href="./terms.html">이용약관</a><a href="./privacy.html">개인정보처리방침</a><a href="#/method">데이터 출처·방법</a><a href="#/patch">패치 노트</a></p>
    </footer>
  );
}
export const form5 = (last: string[]) => (
  <span className="form5">{last.map((x, i) => <i key={i} className={x === "W" ? "w" : "l"}>{x === "W" ? "승" : "패"}</i>)}</span>
);

/** 선수 프로필용 가상의 남자 캐릭터 (v2.28.0). 실제 선수 얼굴·챔피언 그림이 아니라 직접 그린 일러스트이며,
 *  선수 키로 정해져서 같은 선수는 늘 같은 얼굴입니다. */
const AV_SKIN = ["#f8dcc4", "#f5d3b8", "#f2cbac", "#efc5a3"];
const AV_HAIR = ["#1c1815", "#26201b", "#2b3342", "#33271f", "#1f2937"];
const AV_SHIRT = ["#2dd4bf", "#60a5fa", "#f59e0b", "#a78bfa", "#f472b6", "#4ade80", "#fb7185", "#94a3b8"];
const AV_BG = [["#27425f", "#16233a"], ["#2f3f66", "#1a2142"], ["#2a4b4f", "#16292f"], ["#4a3a5e", "#251c33"], ["#4f4330", "#2b2318"]];
function avHash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
export function PlayerAvatar({ seed, size = 48, color }: { seed: string; size?: number; color?: string }) {
  const h = avHash(seed || "x");
  const pick = <T,>(a: T[], shift: number): T => a[(h >>> shift) % a.length];
  const skin = pick(AV_SKIN, 0), hair = pick(AV_HAIR, 3), shirt = color ?? pick(AV_SHIRT, 6), bg = pick(AV_BG, 9);
  const style = (h >>> 12) % 5, glasses = ((h >>> 15) & 3) === 0, headset = ((h >>> 17) & 3) === 1;
  const id = "av" + h.toString(36);
  return (
    <svg className="cicon pavatar" width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="선수 캐릭터">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor={bg[0]} /><stop offset="1" stopColor={bg[1]} /></linearGradient></defs>
      <rect width="64" height="64" fill={`url(#${id})`} />
      <path d="M8 64c0-13 10-19 24-19s24 6 24 19z" fill={shirt} />
      <path d="M26 45l6 7 6-7" fill="none" stroke="rgba(0,0,0,.25)" strokeWidth="2" strokeLinejoin="round" />
      <rect x="27" y="36" width="10" height="11" rx="4" fill={skin} />
      <ellipse cx="32" cy="27" rx="12" ry="13.5" fill={skin} />
      <ellipse cx="20.3" cy="28" rx="2.2" ry="3.2" fill={skin} /><ellipse cx="43.7" cy="28" rx="2.2" ry="3.2" fill={skin} />
      {style === 0 && <path d="M19.5 25c-1-11 7-16 13-16 8 0 14 5 12.5 16-2-5-5-8-9-8.5-5 1-12 .5-16.5 8.5z" fill={hair} />}
      {style === 1 && <path d="M19 26c-2-12 6-17 14-17 7 0 13 5 12 17-1-6-4-9-8-10-5 4-12 5-18 10z" fill={hair} />}
      {style === 2 && <path d="M20 22c1-8 6-12 12-12s11 4 12 12c-4-4-8-5-12-5s-8 1-12 5z" fill={hair} />}
      {style === 3 && <path d="M19 27c-3-6-1-11 3-14 2-4 8-6 12-4 5 0 10 4 10 10 0 3-1 6-2 8-1-5-4-8-9-8-6 0-11 2-14 8z" fill={hair} />}
      {style === 4 && <path d="M20 21l3-6 4 4 4-7 4 7 4-4 3 6c1 2 1 4 1 6-3-4-7-6-12-6s-9 2-12 6c0-2 0-4 1-6z" fill={hair} />}
      <ellipse cx="26.8" cy="28.5" rx="1.6" ry="2" fill="#1b1f2a" /><ellipse cx="37.2" cy="28.5" rx="1.6" ry="2" fill="#1b1f2a" />
      <path d="M24.5 24.6q2.3-1.6 4.6-.4M34.9 24.2q2.3-1.2 4.6.4" fill="none" stroke={hair} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M28.5 35q3.5 2.6 7 0" fill="none" stroke="#7a3f2e" strokeWidth="1.7" strokeLinecap="round" />
      {glasses && <g fill="rgba(255,255,255,.12)" stroke="#e5e7eb" strokeWidth="1.3"><rect x="22" y="25.5" width="9.6" height="7" rx="3" /><rect x="32.4" y="25.5" width="9.6" height="7" rx="3" /><path d="M31.6 28.5h.8" /></g>}
      {headset && <g fill="none" stroke="#e5e7eb" strokeWidth="2.2" strokeLinecap="round"><path d="M19.5 28c-1-11 5-17 12.5-17s13.5 6 12.5 17" /><rect x="16.3" y="26" width="4" height="8" rx="2" fill="#e5e7eb" /><rect x="43.7" y="26" width="4" height="8" rx="2" fill="#e5e7eb" /></g>}
    </svg>
  );
}
