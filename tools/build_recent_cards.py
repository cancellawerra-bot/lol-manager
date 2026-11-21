#!/usr/bin/env python3
"""v2.22.0 (2026-11-22, Grok) — 2024·2025·2026 LCK 판타지 카드 재검수: 능력치·4대·연봉을 '그 시즌 실제 경기력'으로.

실행 순서: build_cards.py → apply_honors.py → build_fantasy_salary.py → build_four_stats.py → build_recent_cards.py → build_fantasy_price.py (멱등)

교수님 지적(2026-11-22): "지표가 24가 더 높은데 연봉이 더 높아야지", "판단도 더 높아야 하는 거 아냐? 저 지표면?",
"지표가 나와 있는 선수들 다시 검수해라. 전부 하는 건 빡세니까 평균치 낼 수 있는 3개년도 정도만".
원칙: 같은 선수라면 지표가 좋은 시즌이 능력치·연봉 모두 높다. 연도 보정은 옛 시장이 작았다는 점을 연봉에만 작게 반영.

1) 재료 z = 2024–26 세 시즌을 합친 같은 포지션 카드끼리 z-score × n/(n+8) (해마다 따로가 아니라 3개년 평균 기준 → 시즌끼리 바로 비교 가능).
2) 판단 = KDA(데스 관리)·분당 데스(−)·킬 관여·승률(승리 기여). 퍼스트 블러드 관여·15분 데스는 뺌(표본이 작고 라인 성향에 크게 좌우).
3) 4대 값 = A + B·z (절대 척도), 종합 = 4대 평균(반올림). A·B는 이전 2024–26 판타지 능력치의 평균·표준편차에 맞춤(예산 분포 유지).
   연도 하향·나이 하향 보정 없음. 교수님 평가(owner_ratings.json, 2026)가 있는 카드는 종합을 그 값으로 두고 4대는 종합 + B·(z − z평균).
4) 연봉은 여기서 바꾸지 않음 → tools/build_fantasy_price.py (교수님 결정 2026-11-22: 기본 5억 + 그 시즌 능력치 가산).
"""
from __future__ import annotations

import json
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import build_four_stats as B4  # noqa: E402

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / "public/data/cards.json"
OWN = json.loads((ROOT / "tools/owner_ratings.json").read_text("utf-8"))
YEARS = (2024, 2025, 2026)
SHRINK_K = 8

ING = dict(B4.ING)
ING["judge"] = [("kda", True), ("dpmin", False), ("kp", True), ("wr", True)]
W = dict(B4.W)
W["judge"] = {"TOP": [.35, .20, .20, .25], "JNG": [.30, .20, .25, .25], "MID": [.35, .20, .20, .25], "BOT": [.35, .20, .20, .25], "SUP": [.30, .15, .30, .25]}
LABEL = dict(B4.LABEL, wr="승률(승리 기여)")
PERF = ("kda", "wr", "gd15", "dpm", "kp")
VOLUME = ("dpm", "gpm", "cspm", "vspm", "wcpm", "towerpm", "solo", "ka15")
VOLUME_CARD = ("dpm",)
# 메타 보정(그해 포지션 평균 대비 비율)은 시험해 봤으나 교수님 기준(원 지표 그대로 비교)과 어긋나 역전이 늘어 끔(역전 13 → 21). META_ADJ=1로 재현.
META_ADJ = __import__("os").environ.get("META_ADJ", "0") == "1"
PERF_W = 0.6  # 종합 z = 0.4·4대 z 평均 + 0.6·실적 z (역전 최소: 0.5→20건, 0.6→15건, 0.7→16건)


def main() -> None:
    data = json.loads(CARDS.read_text("utf-8"))
    cards = data["cards"]
    recent = [c for c in cards if c["year"] in YEARS]
    agg = B4.aggregate(cards)
    for c in recent:
        if c.get("wr") is not None and c.get("games"):
            agg.setdefault((c["year"], c["pkey"]), {})["wr"] = (float(c["wr"]), int(c["games"]))
    # 0) (기본 꺼짐) 메타 보정: 양(量) 지표(분당 딜·골드·CS·시야 등)는 패치마다 평균이 크게 달라짐(MID 외 전체 DPM 평균 2024 445 → 2026 545).
    #    그해 같은 포지션 평균으로 나눈 비율로 바꿔 3개년을 비교(비율·차이 지표 KDA·KP·승률·GD@15 등은 그대로).
    if META_ADJ:
        for ing in VOLUME:
            for y in YEARS:
                for pos in ("TOP", "JNG", "MID", "BOT", "SUP"):
                    ks = [(c["year"], c["pkey"]) for c in recent if c["year"] == y and c["pos"] == pos]
                    xs = [agg[k][ing][0] for k in ks if k in agg and agg[k].get(ing, (None, 0))[0] is not None]
                    if len(xs) < 3:
                        continue
                    mu = sum(xs) / len(xs)
                    if mu <= 0:
                        continue
                    for k in ks:
                        v = agg.get(k, {}).get(ing)
                        if v and v[0] is not None:
                            agg[k][ing] = (v[0] / mu, v[1])
    cardval = {}
    for c in recent:
        for m in PERF:
            v = c.get(m)
            if v is not None and META_ADJ and m in VOLUME_CARD:
                xs = [x[m] for x in recent if x["year"] == c["year"] and x["pos"] == c["pos"] and x.get(m) is not None]
                v = v / (sum(xs) / len(xs))
            cardval[(c["id"], m)] = v
    # 1) 3개년 합친 포지션 풀 z
    zs: dict[str, dict[str, float]] = {c["id"]: {} for c in recent}
    allings = sorted({n for v in ING.values() for n, _ in v})
    for pos in ("TOP", "JNG", "MID", "BOT", "SUP"):
        cs = [c for c in recent if c["pos"] == pos]
        for ing in allings:
            vals = [(c, agg.get((c["year"], c["pkey"]), {}).get(ing, (None, 0))) for c in cs]
            xs = [v for _, (v, n) in vals if v is not None]
            if len(xs) < 3:
                continue
            mu = sum(xs) / len(xs)
            sd = (sum((x - mu) ** 2 for x in xs) / len(xs)) ** 0.5
            if sd == 0:
                continue
            for c, (v, n) in vals:
                if v is not None:
                    zs[c["id"]][ing] = (v - mu) / sd * (n / (n + SHRINK_K))
    z4s: dict[str, dict[str, float | None]] = {}
    for c in recent:
        z4 = {}
        for st, ings in ING.items():
            num = den = 0.0
            for (ing, good), wi in zip(ings, W[st][c["pos"]]):
                if wi <= 0 or ing not in zs[c["id"]]:
                    continue
                z = zs[c["id"]][ing]
                num += wi * (z if good else -z)
                den += wi
            z4[st] = num / den if den > 0 else None
        z4s[c["id"]] = z4
    # 종합 = 4대 z 평균과 시즌 실적 z(KDA·승률·GD@15·DPM·KP, 3개년 포지션 풀) 반반. 실적 차이는 4대에 똑같이 더해 4대 평균 = 종합 유지.
    perf: dict[str, float] = {}
    for pos in ("TOP", "JNG", "MID", "BOT", "SUP"):
        cs = [c for c in recent if c["pos"] == pos]
        acc = defaultdict(list)
        for m in PERF:
            xs = [cardval[(c["id"], m)] for c in cs if cardval[(c["id"], m)] is not None]
            if len(xs) < 3:
                continue
            mu = sum(xs) / len(xs)
            sd = (sum((x - mu) ** 2 for x in xs) / len(xs)) ** 0.5 or 1
            for c in cs:
                if cardval[(c["id"], m)] is not None:
                    n = c.get("games") or 0
                    acc[c["id"]].append((cardval[(c["id"], m)] - mu) / sd * n / (n + SHRINK_K))
        for cid, v in acc.items():
            perf[cid] = sum(v) / len(v)
    P = {}
    for cid, z4 in z4s.items():
        av = [v for v in z4.values() if v is not None]
        if not av:
            P[cid] = None
            continue
        zb = sum(av) / len(av)
        p = (1 - PERF_W) * zb + PERF_W * perf[cid] if cid in perf else zb
        P[cid] = p
        for st in z4:
            if z4[st] is not None:
                z4[st] += p - zb
    # 2) 척도: 이전 2024–26 판타지 능력치 평균·표준편차 (이전 값은 meta에 한 번 보관해 멱등)
    meta = data["meta"].get("recentCards") or {}
    prev = meta.get("prevRatingStats")
    if not prev:
        old = [c["fantasyRating"] for c in recent]
        mu = sum(old) / len(old)
        prev = {"mean": mu, "sd": (sum((x - mu) ** 2 for x in old) / len(old)) ** 0.5, "n": len(old)}
    ps = [p for p in P.values() if p is not None]
    pmu = sum(ps) / len(ps)
    psd = (sum((x - pmu) ** 2 for x in ps) / len(ps)) ** 0.5
    Bk = prev["sd"] / psd
    Ak = prev["mean"] - Bk * pmu
    orat = OWN["ratings"] if OWN["year"] in YEARS else {}
    clamp = lambda v: int(max(60, min(99, round(v))))
    for c in recent:
        z4, p = z4s[c["id"]], P[c["id"]]
        own = orat.get(c["pkey"]) if c["year"] == OWN["year"] else None
        if p is None:
            c["fantasyRating"] = int(own or c["fantasyRating"])
            c["four"] = {st: None for st in ING}
            continue
        if own is not None:
            c["fantasyRating"] = int(own)
            c["four"] = {st: (None if v is None else clamp(own + Bk * (v - p))) for st, v in z4.items()}
        else:
            four = {st: (None if v is None else clamp(Ak + Bk * v)) for st, v in z4.items()}
            av = [v for v in four.values() if v is not None]
            c["four"] = four
            c["fantasyRating"] = clamp(sum(av) / len(av))
        c["perfZ"] = round(p, 4)
    data["meta"]["recentCards"] = {
        "version": "2.22.0",
        "years": list(YEARS),
        "why": "교수님 지적(2026-11-22): 같은 선수라면 지표가 좋은 시즌이 능력치·연봉 모두 높아야 함. 3개년 평균 기준으로 다시 계산.",
        "prevRatingStats": prev,
        "scale": {"A": round(Ak, 3), "B": round(Bk, 3), "formula": "4대 = clamp(A + B·(z_4대 + 실적보정), 60, 99), 종합 = 4대 평균(반올림). z = 2024–26 합친 같은 포지션 풀 z-score × n/(n+8). 종합 z = ½·4대 z 평균 + ½·실적 z(KDA·승률·GD@15·DPM·KP 평균), 그 차이를 4대에 똑같이 더함"},
        "judge": {"ingredients": [LABEL[n] for n, _ in ING["judge"]], "weights": W["judge"], "removed": ["퍼스트 블러드 관여율", "15분 데스"]},
        "salary": "연봉은 tools/build_fantasy_price.py(기본 5억 + 능력치 가산, v2.22.0 교수님 결정)",
    }
    if "fourStats" in data["meta"]:
        data["meta"]["fourStats"]["recentOverride"] = "2024–2026 카드는 build_recent_cards.py(v2.22.0)가 3개년 기준으로 다시 계산"
    CARDS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("scale A", round(Ak, 2), "B", round(Bk, 2), "prev", prev)
    for cid in ["chovy-2024", "chovy-2025", "chovy-2026", "faker-2024", "faker-2025", "faker-2026", "zeus-2024", "zeus-2025", "zeus-2026", "keria-2024", "keria-2025", "keria-2026", "ruler-2024", "ruler-2025", "ruler-2026"]:
        c = next((x for x in recent if x["id"] == cid), None)
        if c:
            print(cid, c["fantasyRating"], c["four"], c["fantasySalary"], "kda", c["kda"], "wr", c["wr"], "gd", c["gd15"], "dpm", c["dpm"])


if __name__ == "__main__":
    main()
