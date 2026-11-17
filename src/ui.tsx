import { ReactNode, useEffect } from "react";
import { CH, TM, PL } from "./data";

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
      {full && <span className="tname">{tm?.ko}</span>}
    </span>
  );
}
export function Sample({ n, min, unit = "경기" }: { n: number; min: number; unit?: string }) {
  return n < min ? <span className="tag warn" title={`${min}${unit} 미만`}>표본 부족 · {n}{unit}</span> : <span className="tag">{n}{unit}</span>;
}
export function Bar({ v, max = 100, color }: { v: number; max?: number; color?: string }) {
  return <span className="bar"><i style={{ width: `${Math.max(0, Math.min(100, (v / max) * 100))}%`, background: color }} /></span>;
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
  return link ? <a className="pname" href={`#/player/${k}`}>{p.name}</a> : <span className="pname">{p.name}</span>;
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
