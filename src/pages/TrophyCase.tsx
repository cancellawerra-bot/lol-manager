import { useEffect } from "react";
import { Card } from "../ui";
import type { HonorItem } from "../game/achievements";
import { careerHonors } from "../game/achievements";
import type { Save } from "../game/season";

function HonorMark({ icon, done, color }: { icon: HonorItem["icon"]; done: boolean; color?: string }) {
  const stroke = done ? (color || "var(--gold)") : "var(--dim)";
  const fill = done ? "rgba(233,196,106,.22)" : "transparent";
  const common = { fill, stroke, strokeWidth: 2, strokeLinejoin: "round" as const, strokeLinecap: "round" as const };
  return (
    <svg className="honor-mark" viewBox="0 0 48 48" aria-hidden="true">
      {icon === "cup" && (
        <>
          <path d="M14 10h20v8c0 7-4.2 12-10 12S14 25 14 18V10z" {...common} />
          <path d="M14 14h-6c0 6 3 9 8 10M34 14h6c0 6-3 9-8 10" fill="none" stroke={stroke} strokeWidth={2} />
          <path d="M24 30v6M16 38h16" fill="none" stroke={stroke} strokeWidth={2} />
        </>
      )}
      {icon === "shield" && <path d="M24 6l16 6v12c0 10-7 16-16 20C15 40 8 34 8 24V12l16-6z" {...common} />}
      {icon === "medal" && (
        <>
          <circle cx="24" cy="26" r="12" {...common} />
          <path d="M16 6l8 10L32 6" fill="none" stroke={stroke} strokeWidth={2} />
        </>
      )}
      {icon === "star" && <path d="M24 6l4.4 10.2L40 17.2l-8 7.4L34.8 36 24 30.2 13.2 36 16 24.6l-8-7.4 11.6-1L24 6z" {...common} />}
      {icon === "banner" && <path d="M8 8h32v24l-16-8-16 8V8z" {...common} />}
      {icon === "gem" && <path d="M24 6l14 12-14 24L10 18 24 6z" {...common} />}
    </svg>
  );
}

export default function TrophyCase({ s }: { s: Save }) {
  const { trophies, feats } = careerHonors(s);
  const shownTrophies = trophies.filter((t) => t.id !== "season-cup" || t.done || !s.story);
  const doneN = [...shownTrophies, ...feats].filter((x) => x.done).length;
  const total = shownTrophies.length + feats.length;
  const accent = s.club?.color;
  useEffect(() => {
    const sub = location.hash.replace(/^#\/?/, "").split("/")[1];
    if (sub !== "office") return;
    const el = document.getElementById("club-office");
    const t = window.setTimeout(() => el?.scrollIntoView({ behavior: "smooth", block: "start" }), 50);
    return () => clearTimeout(t);
  }, [location.hash]);
  return (
    <div id="club-office">
      <Card title="트로피 진열장" right={<span className="muted sm">{doneN} / {total}</span>}>
        <p className="muted sm">이번 커리어에서 실제로 남은 기록만 모았습니다. 현실 구단의 우승 역사는 넣지 않으며, 표시만으로 자금·팬심·승부에는 영향이 없습니다. 표식은 자체 도형입니다.</p>
        <ul className="trophy-case" data-testid="trophy-case">
          {shownTrophies.map((t) => (
            <li key={t.id} className={t.done ? "earned" : "empty"} data-testid={`trophy-${t.id}`} data-earned={t.done ? "1" : "0"}>
              <HonorMark icon={t.icon} done={t.done} color={t.done ? accent : undefined} />
              <b>{t.label}</b>
              {t.done && t.count != null && t.count > 1 && <span className="trophy-count">{t.count}회</span>}
              <span className="muted xs">{t.detail}</span>
            </li>
          ))}
        </ul>
        {!shownTrophies.some((t) => t.done) && !feats.some((f) => f.done) && (
          <p className="muted sm" data-testid="trophy-empty">아직 이 커리어에서 거둔 기록이 없습니다.</p>
        )}
      </Card>
      <Card title="업적" right={<span className="muted sm">{feats.filter((x) => x.done).length} / {feats.length}</span>}>
        <p className="muted sm">경기·시즌에서 실제로 일어난 일만 달성으로 표시합니다. 데이터가 없으면 미달성으로 둡니다.</p>
        <ul className="honor-feats" data-testid="honor-feats">
          {feats.map((f) => (
            <li key={f.id} className={f.done ? "earned" : "empty"} data-testid={`feat-${f.id}`} data-earned={f.done ? "1" : "0"}>
              <HonorMark icon={f.icon} done={f.done} color={f.done ? accent : undefined} />
              <div>
                <b>{f.label}</b>
                <span className="muted xs">{f.detail}</span>
              </div>
            </li>
          ))}
        </ul>
      </Card>
    </div>
  );
}
