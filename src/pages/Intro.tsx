import { useEffect, useRef, useState } from "react";
import { TM } from "../data";
import { setPrefs, usePrefs } from "../prefs";

export interface IntroInfo { team: string; manager: string; season: string; goal: string; cash: string; tier: string }

// 새 커리어 첫 화면의 부임 발표(약 5초). 절제된 방송 오프닝 느낌: 빛줄기가 화면을 열고 → 팀 약칭이 떠오르고 → 문장이 그려지고
// → 감독 이름이 한 글자씩 올라오고 → 정보 판이 들어옵니다. 팀 약칭으로 문장 모양·빛 연출·한 줄 문구가 정해져 팀마다 다릅니다.
// 아무 곳이나 누르거나 Esc/Enter/Space/F로 넘깁니다.

const CRESTS = [
  "M100 6 L186 55 L186 145 L100 194 L14 145 L14 55 Z",                                              // 육각
  "M100 6 L194 100 L100 194 L6 100 Z",                                                               // 마름모
  "M100 8 L182 40 L182 110 Q182 160 100 194 Q18 160 18 110 L18 40 Z",                                // 방패
  "M62 8 L138 8 L192 62 L192 138 L138 192 L62 192 L8 138 L8 62 Z",                                   // 팔각
];
// 실제 구단 로고는 쓰지 않습니다. 팀 이름·분위기에서 떠올린 일반적인 그림(왕관·불꽃·로켓·여우·방패…)을 직접 그린 선 그림입니다.
const SYMBOLS: Record<string, string> = {
  GEN: "M100 36 L160 56 V112 L100 170 L40 112 V56 Z M100 48 L148 64 V108 L100 156 L52 108 V64 Z M76 78 L96 78 L96 87 L78 87 L78 105 L88 105 L88 99 L82 99 L82 91 L96 91 L96 114 L76 114 L68 106 L68 86 Z M112 78 L132 78 L132 87 L114 87 L114 105 L124 105 L124 99 L118 99 L118 91 L132 91 L132 114 L112 114 L104 106 L104 86 Z",
  T1: "M94 130 L66 126 L40 112 L24 90 L40 90 L22 66 L40 66 L28 44 L46 48 L38 28 L62 46 L70 26 L88 58 L94 92 Z M106 130 L134 126 L160 112 L176 90 L160 90 L178 66 L160 66 L172 44 L154 48 L162 28 L138 46 L130 26 L112 58 L106 92 Z M100 96 L112 118 L100 148 L88 118 Z",
  HLE: "M90 84 L52 52 L24 44 L40 70 L22 82 L42 98 L30 116 L54 114 L50 138 L78 122 L90 116 Z M110 84 L148 52 L176 44 L160 70 L178 82 L158 98 L170 116 L146 114 L150 138 L122 122 L110 116 Z M94 66 L106 66 L108 78 L112 110 L100 146 L88 110 L92 78 Z M88 128 L80 166 L100 158 L120 166 L112 128 Z M89 58 A11 11 0 1 1 111 58 A11 11 0 1 1 89 58 Z M94 64 L106 64 L100 80 Z",
  DK: "M100 34 C104 80 120 96 166 100 C120 104 104 120 100 166 C96 120 80 104 34 100 C80 96 96 80 100 34 Z M150 36 C151 50 154 53 168 54 C154 55 151 58 150 72 C149 58 146 55 132 54 C146 53 149 50 150 36 Z",
  KT: "M100 32 C130 56 136 98 126 132 L74 132 C64 98 70 56 100 32 Z M88 78 A12 12 0 1 1 112 78 A12 12 0 1 1 88 78 Z M74 104 L46 144 L74 136 Z M126 104 L154 144 L126 136 Z M88 138 C92 152 96 160 100 170 C104 160 108 152 112 138 Z",
  BFX: "M38 38 L78 70 C92 66 108 66 122 70 L162 38 L156 100 C150 136 124 160 100 168 C76 160 50 136 44 100 Z M62 112 C78 120 90 138 100 156 C110 138 122 120 138 112 C124 104 112 104 100 108 C88 104 76 104 62 112 Z M70 90 L90 98 L72 103 Z M130 90 L110 98 L128 103 Z M94 148 H106 L100 158 Z",
  NS: "M44 44 H156 V108 C156 140 130 160 100 172 C70 160 44 140 44 108 Z M58 58 H142 V106 C142 132 122 148 100 158 C78 148 58 132 58 106 Z M70 86 L100 110 L130 86 L130 102 L100 126 L70 102 Z",
  DNS: "M100 32 L120 84 L168 88 L131 119 L143 168 L100 141 L57 168 L69 119 L32 88 L80 84 Z M100 72 L108 94 L132 96 L113 111 L119 134 L100 121 L81 134 L87 111 L68 96 L92 94 Z",
  BRO: "M100 30 L116 52 L112 118 H88 L84 52 Z M100 58 V108 M62 118 H138 V130 H62 Z M94 130 H106 V156 H94 Z M91 165 A9 9 0 1 1 109 165 A9 9 0 1 1 91 165 Z",
  KRX: "M60 60 H140 L168 96 L100 170 L32 96 Z M32 96 H168 M60 60 L80 96 L100 60 L120 96 L140 60 M80 96 L100 170 L120 96",
};
const SYM_FALLBACK = [
  "M44 100 A56 56 0 1 1 156 100 A56 56 0 1 1 44 100 Z M76 100 A24 24 0 1 1 124 100 A24 24 0 1 1 76 100 Z M93 100 A7 7 0 1 1 107 100 A7 7 0 1 1 93 100 Z",
  "M100 40 L164 156 H36 Z M100 78 L134 138 H66 Z",
  "M100 40 L160 100 L100 160 L40 100 Z M100 70 L130 100 L100 130 L70 100 Z M100 90 L110 100 L100 110 L90 100 Z",
  "M44 150 V122 H66 V150 Z M82 150 V92 H104 V150 Z M120 150 V62 H142 V150 Z",
  "M50 40 H150 L112 100 L150 160 H50 L88 100 Z",
];
// 팀별 엠블럼 그림(public/emblems/<약칭>.svg, AI로 새로 만든 벡터 그림). 파일이 없는 구단은 아래 선 그림 상징을 씁니다.
const EMBLEMS = new Set(["T1", "GEN", "HLE", "KT", "BFX", "NS", "DK", "DNS", "BRO", "KRX"]);
const MOTTOS = [
  "첫 경기가 시즌의 방향을 정합니다", "이 팀의 새 이야기가 시작됩니다", "모두가 당신의 첫 선택을 지켜봅니다", "결과로 증명할 시간입니다",
  "한 시즌, 한 번의 도전", "우승은 준비한 팀의 몫입니다", "여기서부터 시작입니다", "팬들이 이 순간을 기다려 왔습니다",
];
const hashOf = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

function sound(): void {
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ac = new AC(); const t = ac.currentTime;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.9);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.05); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 1.3);
    setTimeout(() => { void ac.close(); }, 1600);
  } catch { /* 소리를 못 내도 연출은 계속 */ }
}

// 은은하게 떠오르는 빛 알갱이 (팀 색)
function Motes({ color }: { color: string }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current; if (!cv) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = cv.getContext("2d"); if (!ctx) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const fit = (): void => { cv.width = innerWidth * dpr; cv.height = innerHeight * dpr; };
    fit(); addEventListener("resize", fit);
    type P = { x: number; y: number; v: number; life: number; max: number; s: number };
    const ps: P[] = []; const t0 = performance.now(); let raf = 0;
    const rnd = (a: number, b: number): number => a + Math.random() * (b - a);
    const frame = (now: number): void => {
      const t = (now - t0) / 1000, W = cv.width, H = cv.height;
      if (t > 0.8 && Math.random() < 0.35) ps.push({ x: rnd(0, W), y: H + 8, v: rnd(0.5, 1.6) * dpr, life: 0, max: rnd(4, 8), s: rnd(0.8, 2) * dpr });
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = "lighter";
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i]; p.life += 1 / 60; if (p.life > p.max) { ps.splice(i, 1); continue; }
        p.y -= p.v; p.x += Math.sin(p.life * 1.3 + i) * 0.25 * dpr;
        const k = Math.sin((p.life / p.max) * Math.PI); ctx.globalAlpha = k * 0.8;
        ctx.fillStyle = color; ctx.shadowColor = color; ctx.shadowBlur = 8 * dpr;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.s, 0, Math.PI * 2); ctx.fill();
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => { cancelAnimationFrame(raf); removeEventListener("resize", fit); };
  }, [color]);
  return <canvas ref={ref} className="in-canvas" />;
}

// "3.95억" 같은 금액이 0에서 올라가는 효과
function CountUp({ text, delay }: { text: string; delay: number }) {
  const m = /^(\d+(?:[.,]\d+)?)(.*)$/.exec(text);
  const [v, setV] = useState(m ? 0 : 1);
  useEffect(() => {
    if (!m) return;
    const to = parseFloat(m[1].replace(/,/g, ""));
    let raf = 0; const t0 = performance.now() + delay * 1000;
    const f = (now: number): void => { const k = Math.max(0, Math.min(1, (now - t0) / 1300)); setV(to * (1 - Math.pow(1 - k, 3))); if (k < 1) raf = requestAnimationFrame(f); };
    raf = requestAnimationFrame(f);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay]);
  if (!m) return <>{text}</>;
  const dec = (m[1].split(".")[1] ?? "").length;
  return <>{v.toLocaleString("ko-KR", { minimumFractionDigits: dec, maximumFractionDigits: dec })}{m[2]}</>;
}

export default function Intro({ info, onDone }: { info: IntroInfo; onDone: () => void }) {
  const pf = usePrefs();
  useEffect(() => {
    const k = (e: KeyboardEvent): void => { if (["Escape", "Enter", " ", "f", "F"].includes(e.key)) onDone(); };
    window.addEventListener("keydown", k);
    const id = pf.sound ? setTimeout(sound, 900) : 0;
    return () => { window.removeEventListener("keydown", k); clearTimeout(id); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onDone]);
  const color = TM[info.team]?.color ?? "#2DD4BF";
  const h = hashOf(info.team);
  const v = h % 4;                         // 빛 연출 + 문장 모양
  const symbol = SYMBOLS[info.team] ?? SYM_FALLBACK[(h >> 5) % SYM_FALLBACK.length];
  const motto = MOTTOS[(h >> 3) % MOTTOS.length];
  const chars = Array.from(`${info.manager} 감독`);
  return (
    <div className={`intro v${v}`} style={{ ["--tc" as string]: color }} role="dialog" aria-label="부임 발표" onClick={onDone} data-testid="intro">
      <div className="in-world">
        <div className="in-glow" />
        <div className="in-flare" /><div className="in-flare b" /><div className="in-beam" />
        <div className="in-floor" />
        <Motes color={color} />
        <div className="in-ring" />
        <div className="in-stage">
          <div className="in-kicker">OFFICIAL ANNOUNCEMENT</div>
          <div className={"in-hero" + (EMBLEMS.has(info.team) ? " emb" : "")}>
            <svg className="in-crest" viewBox="0 0 200 200" aria-hidden="true">
              <path d={CRESTS[v]} className="h1" pathLength="1" /><path d={CRESTS[v]} className="h2" pathLength="1" />
            </svg>
            {EMBLEMS.has(info.team) ? <img className="in-emb" src={`./emblems/${info.team}.svg`} alt="" /> : <svg className="in-sym" viewBox="30 30 140 140" aria-hidden="true"><path d={symbol} pathLength="1" /></svg>}
            <div className="in-code" aria-label={info.team}>{info.team}</div>
          </div>
          <div className="in-club">{TM[info.team]?.ko ?? info.team}</div>
          <div className="in-welcome"><i />새 사령탑 부임<i /></div>
          <h1 className="in-name" aria-label={`${info.manager} 감독`}>{chars.map((c, i) => <span key={i} style={{ animationDelay: `${2.5 + i * 0.09}s` }}>{c === " " ? " " : c}</span>)}</h1>
          <div className="in-line" />
          <div className="in-motto">{motto}</div>
          <div className="in-plates">
            <div style={{ animationDelay: "3.6s" }}><small>시즌</small><b>{info.season}</b><em>{info.tier}</em></div>
            <div style={{ animationDelay: "3.8s" }}><small>구단주 목표</small><b>{info.goal}</b></div>
            <div style={{ animationDelay: "4.0s" }}><small>창단 자금</small><b><CountUp text={info.cash} delay={4.0} /></b></div>
          </div>
          <div className="in-cta">화면을 누르면 시작합니다 · Enter · F</div>
          <button className="btn ghost in-off" onClick={(e) => { e.stopPropagation(); setPrefs({ intro: false }); onDone(); }}>다음부터 보지 않기</button>
        </div>
      </div>
      <div className="in-bar top" /><div className="in-bar bot" />
      <div className="in-vig" />
    </div>
  );
}
