import { useEffect, useLayoutEffect, useRef, useState } from "react";

interface Step { sel?: string[]; title: string; text: string }
interface Box { top: number; left: number; width: number; height: number }

// 첫 플레이 안내(수석코치 투어): 화면의 실제 칸을 하나씩 밝히고 설명합니다.
// 칸을 못 찾으면(좁은 화면에서 숨겨진 칸 등) 그 설명은 화면 가운데 카드로만 보여 줍니다.
const stepsFor = (story: boolean): Step[] => [
  { title: "수석코치입니다", text: "첫 경기까지 꼭 알아야 할 곳을 하나씩 짚어 드릴게요. 1분이면 끝나고, 언제든 건너뛸 수 있습니다. 설정에서 다시 볼 수도 있어요." },
  { sel: ['[data-testid="home-match-hero"]'], title: "① 다음 경기", text: "상대 팀과 날짜가 여기 나옵니다. 경기가 있는 날에는 이 카드의 버튼으로 기자회견 → 라인업 → 밴픽 → 경기 순서로 들어갑니다." },
  { sel: ['[data-testid="home-attention"]'], title: "② 오늘 할 일", text: "세이브 상태로 만든 할 일 목록입니다. 일정·소식·면담처럼 지금 확인할 일이 뜨고, 완료/전체로 진척이 보입니다. 비어 있으면 급한 일이 없다는 뜻이에요. 면담·주간 일정·마케팅은 위쪽 바로가기로도 갈 수 있습니다." },
  { sel: ['.side nav a[href="#/squad"]', '.bnav a[href="#/squad"]'], title: "③ 선수단 일정", text: "경기를 진행하려면 한 주 일정을 먼저 채워야 합니다. 스토리 모드는 피지컬·스크림·챔피언·휴식 중에서 고르고, 맨 위 「전원」 줄로 요일마다 전원을 한 번에 바꿀 수 있어요. 어렵다면 「수석코치에게 맡기기」를 누르세요." },
  { sel: [".mh-squad"], title: "④ 우리의 선발 5명", text: "다음 경기에 나설 선수들입니다. 이름을 누르면 선수 카드가 열리고, 챔피언별 숙련 단계(입문·숙련·전문·장인)도 볼 수 있어요." },
  { sel: [".chips", ".top-date"], title: "⑤ 돈과 신뢰", text: story
      ? "자금과 구단주 신뢰는 위쪽에 있습니다. 영입·계약을 정하기 전에는 구단 화면의 「예상 장부」로 다음 시즌 잔고를 미리 계산해 보세요. 적자가 쌓이면 구단주가 경고합니다."
      : "자금과 구단주 신뢰는 위쪽에 있습니다. 구단 화면의 「시즌 목표」 표에서 목표를 이루면 얻는 것과 놓치면 잃는 것을 볼 수 있어요." },
  { sel: ['[data-testid="advance"]'], title: "⑥ 진행하기", text: "준비가 끝나면 이 버튼으로 일주일씩 넘깁니다. 우리 경기가 있는 날에는 경기 화면으로 이어져요. 선수단 일정이 비어 있으면 버튼이 「일정 먼저 정하기」로 바뀌고, 일정 화면으로 안내합니다." },
  { title: "그럼, 시작해 볼까요?", text: "막히면 아래 메뉴의 「기록·도움말」을 보세요. 이 안내는 설정의 「첫 플레이 안내 다시 보기」에서 또 볼 수 있습니다. 좋은 시즌 보내세요, 감독님!" },
];

// 화면 옆으로 접혀 있는 메뉴(좁은 화면의 사이드 메뉴)는 크기는 있어도 보이지 않으므로 가로로 화면 안에 있는 칸만 대상으로 삼습니다.
const visible = (el: Element): boolean => { const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.right > 4 && r.left < innerWidth - 4; };
const findTarget = (sel?: string[]): HTMLElement | null => {
  for (const q of sel ?? []) {
    const hit = [...document.querySelectorAll<HTMLElement>(q)].find(visible);
    if (hit) return hit;
  }
  return null;
};

export default function Tour({ story, onDone }: { story: boolean; onDone: () => void }) {
  const steps = stepsFor(story);
  const [i, setI] = useState(0);
  const [box, setBox] = useState<Box | null>(null);
  const [vp, setVp] = useState({ w: innerWidth, h: innerHeight });
  const cardRef = useRef<HTMLDivElement>(null);
  const step = steps[i], last = i === steps.length - 1;

  // 단계가 바뀌면 칸을 화면 안으로 가져옵니다.
  useLayoutEffect(() => {
    const t = findTarget(step.sel);
    if (t) t.scrollIntoView({ block: innerWidth < 640 ? "start" : "center", behavior: "smooth" });
  }, [i]);

  // 칸 위치를 계속 따라갑니다(스크롤·크기 변화·애니메이션 대응).
  useEffect(() => {
    let raf = 0;
    const measure = (): void => {
      const t = findTarget(step.sel);
      const b = t ? t.getBoundingClientRect() : null;
      setBox((p) => {
        const n = b ? { top: b.top, left: b.left, width: b.width, height: b.height } : null;
        if (!n && !p) return p;
        if (n && p && Math.abs(n.top - p.top) < 0.5 && Math.abs(n.left - p.left) < 0.5 && Math.abs(n.width - p.width) < 0.5 && Math.abs(n.height - p.height) < 0.5) return p;
        return n;
      });
      setVp((p) => (p.w === innerWidth && p.h === innerHeight ? p : { w: innerWidth, h: innerHeight }));
    };
    const tick = (): void => { measure(); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    const timer = setInterval(measure, 150);   // 화면 갱신이 멈춘 상태(숨겨진 탭 등)에서도 위치를 따라갑니다
    return () => { cancelAnimationFrame(raf); clearInterval(timer); };
  }, [i]);

  const next = (): void => { if (last) onDone(); else setI(i + 1); };
  const prev = (): void => setI(Math.max(0, i - 1));
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === "Escape") onDone();
      else if (e.key === "Enter" || e.key === "ArrowRight") { e.preventDefault(); if (last) onDone(); else setI((x) => x + 1); }
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
  }, [last, onDone]);

  // 설명 카드 위치: 좁은 화면은 위/아래 가장자리, 넓은 화면은 칸 근처
  const narrow = vp.w < 640;
  const pad = 8;
  let cardStyle: React.CSSProperties;
  if (narrow) {
    const targetLow = box ? box.top + box.height / 2 > vp.h * 0.5 : false;
    cardStyle = targetLow ? { top: 64, left: 12, right: 12 } : { bottom: 76, left: 12, right: 12 };
  } else if (box) {
    const cardW = 380, cardH = 210;
    const below = box.top + box.height + pad + 14 + cardH < vp.h;
    const left = Math.max(12, Math.min(box.left, vp.w - cardW - 12));
    cardStyle = below ? { top: box.top + box.height + pad + 14, left, width: cardW } : box.top - pad - 14 - cardH > 8 ? { top: box.top - pad - 14 - cardH, left, width: cardW } : { top: Math.max(12, vp.h - cardH - 20), left: Math.min(vp.w - cardW - 20, box.left + box.width + 20), width: cardW };
  } else {
    cardStyle = { top: "50%", left: "50%", transform: "translate(-50%,-50%)", width: Math.min(420, vp.w - 24) };
  }
  if (narrow && !box) cardStyle = { top: "50%", left: 12, right: 12, transform: "translateY(-50%)" };

  return (
    <div className="tour" role="dialog" aria-label="수석코치 첫 플레이 안내" data-testid="tour">
      <div className="tour-block" onClick={(e) => e.stopPropagation()} />
      {box ? <div className="tour-hole" style={{ top: box.top - pad, left: box.left - pad, width: box.width + pad * 2, height: box.height + pad * 2 }} /> : <div className="tour-dim" />}
      <div className="tour-card" ref={cardRef} style={cardStyle} key={i}>
        <div className="tour-top"><span className="tour-n">{i + 1} / {steps.length}</span><button className="tour-skip" onClick={onDone} data-testid="tour-skip">건너뛰기</button></div>
        <h3>{step.title}</h3>
        <p>{step.text}</p>
        <div className="tour-btns">
          <button className="btn ghost" onClick={prev} disabled={i === 0}>이전</button>
          <button className="btn primary" onClick={next} data-testid="tour-next">{last ? "시작하기" : i === 0 ? "안내 시작" : "다음"}</button>
        </div>
      </div>
    </div>
  );
}
