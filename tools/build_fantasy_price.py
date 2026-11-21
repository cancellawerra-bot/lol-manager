#!/usr/bin/env python3
"""v2.22.0 판타지 드래프트 연봉 = 기본 5억 + 그 시즌 능력치 가산 + 작은 성적 보너스 (교수님 결정 2026-11-22, 실제 시장 공식 폐기).

실행 순서: … → build_four_stats.py → build_recent_cards.py → build_fantasy_price.py (멱등, 모든 연도 카드)
- 가산 add(R): 73→0 … 80→0.7 선형, 80 이상은 앵커 사이 로그-선형 (85→3, 88→7, 90→12, 95→30, 99→48). R = 판타지 능력치(정수).
- 성적 보너스(그 시즌만, 이월 제외): 월즈 우승 3 · 준우승 1.5 · 4강 0.75, MSI 우승 2 · 준우승 1 · 4강 0.5, LCK 포지션 1위(그 시즌·포지션 판타지 능력치 최고, 10경기 이상) 1.
  단, 능력치 단조성이 우선: 보너스를 더해도 능력치 1 높은 카드의 기본 가격보다 한 칸 낮게 제한.
- 연도 할인 없음. 예외: 2026 페이커 50억(교수님 지정) 유지, 2026은 다른 카드가 페이커보다 낮게(49.5억 이하). 다른 연도는 가산 방식 그대로.
- 다른 교수님 지정 연봉(제우스·구마유시·케리아·스카웃·페이커 2022–25 등)은 새 방식 값으로 바꾸고 meta.fantasyPrice.ownerChanges에 원래 값과 새 값을 남김.
스토리·창단 모드 salary는 건드리지 않습니다.
"""
from __future__ import annotations

import json
import math
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CARDS = ROOT / "public/data/cards.json"
M = json.loads((ROOT / "tools/market_salaries.json").read_text("utf-8"))
BASE = 5.0
ANCH = [(80, 0.7), (85, 3.0), (88, 7.0), (90, 12.0), (95, 30.0), (99, 48.0)]
HONOR = {"월즈 우승": 3.0, "월즈 준우승": 1.5, "월즈 4강": 0.75, "MSI 우승": 2.0, "MSI 준우승": 1.0, "MSI 4강": 0.5}
LCK_TOP = 1.0
FAKER_2026 = 50.0


def add(r: float) -> float:
    if r <= 73:
        return 0.0
    if r <= 80:
        return 0.7 * (r - 73) / 7
    if r >= ANCH[-1][0]:
        return ANCH[-1][1]
    for (r0, s0), (r1, s1) in zip(ANCH, ANCH[1:]):
        if r0 <= r <= r1:
            return math.exp(math.log(s0) + (math.log(s1) - math.log(s0)) * (r - r0) / (r1 - r0))
    return ANCH[-1][1]


def rnd(v: float) -> float:
    return round(v, 1) if v < 10 else math.floor(v * 2 + 0.5) / 2


def step(v: float) -> float:
    return 0.5 if v >= 10 else 0.1


def base_price(r: int) -> float:
    return rnd(BASE + add(r))


def main() -> None:
    data = json.loads(CARDS.read_text("utf-8"))
    cards = data["cards"]
    old = {c["id"]: c.get("fantasySalary") for c in cards}
    top = defaultdict(int)
    for c in cards:
        if (c.get("games") or 0) >= 10:
            top[(c["year"], c["pos"])] = max(top[(c["year"], c["pos"])], c["fantasyRating"])
    for c in cards:
        r = int(c["fantasyRating"])
        b = BASE + add(r)
        bonus = sum(HONOR.get(h.split(" ", 1)[1], 0) for h in (c.get("honors") or []) if h.startswith(f"{c['year']} "))
        if (c.get("games") or 0) >= 10 and r == top[(c["year"], c["pos"])]:
            bonus += LCK_TOP
        nxt = base_price(r + 1)
        v = min(rnd(b + bonus), nxt - step(nxt)) if bonus else rnd(b)
        v = max(v, base_price(r))
        c["fantasyBonus"] = round(v - base_price(r), 2) or None
        if c["fantasyBonus"] is None:
            c.pop("fantasyBonus")
        if c["year"] == 2026:
            v = FAKER_2026 if c["pkey"] == "faker" else min(v, FAKER_2026 - 0.5)
        c["fantasySalary"] = v
        c.pop("market", None)
        c.pop("marketNote", None)
        if c["year"] == 2026 and c["pkey"] == "faker":
            c["market"] = True
            c["marketNote"] = "교수님 지정 50억"
    owner_changes = []
    for o in M["overrides"]:
        if o["kind"] != "owner":
            continue
        for y in o["years"]:
            c = next((x for x in cards if x["id"] == f"{o['pkey']}-{y}"), None)
            if c and c["fantasySalary"] != o["value"]:
                owner_changes.append({"id": c["id"], "rating": c["fantasyRating"], "owner": o["value"], "new": c["fantasySalary"]})
    # 단조성 검사 (2026 페이커 지정값 제외)
    rest = [c for c in cards if not (c["year"] == 2026 and c["pkey"] == "faker")]
    byr = defaultdict(list)
    for c in rest:
        byr[c["fantasyRating"]].append(c["fantasySalary"])
    rs = sorted(byr)
    for a, b2 in zip(rs, rs[1:]):
        assert max(byr[a]) < min(byr[b2]), ("단조성", a, max(byr[a]), b2, min(byr[b2]))
    assert all(c["fantasySalary"] < FAKER_2026 for c in cards if c["year"] == 2026 and c["pkey"] != "faker")
    table = {r: base_price(r) for r in (75, 78, 80, 82, 85, 88, 90, 92, 95, 97, 99)}
    data["meta"]["fantasySalary"] = {
        "version": "2.22.0",
        "source": "tools/build_fantasy_price.py",
        "note": "판타지 드래프트 연봉 = 기본 5억 + 그 시즌 능력치 가산 + 작은 성적 보너스(게임용 가상 금액). 교수님 결정(2026-11-22)으로 실제 시장 추정 공식 폐기. 연도 할인 없음. 2026 페이커 50억만 지정값. 스토리·창단 모드는 salary를 씁니다.",
        "base": BASE, "addAnchors": ANCH, "honorBonus": HONOR, "lckPositionTop": LCK_TOP,
        "table": table, "ownerChanges": owner_changes,
    }
    CARDS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("table", table)
    print("owner changes", owner_changes)
    ch = sorted(cards, key=lambda c: -c["fantasySalary"])[:12]
    print("top", [(c["id"], c["fantasyRating"], c["fantasySalary"]) for c in ch])
    for cid in ["chovy-2024", "chovy-2025", "chovy-2026"]:
        c = next(x for x in cards if x["id"] == cid)
        print(cid, c["fantasyRating"], c["four"], old[cid], "→", c["fantasySalary"], "bonus", c.get("fantasyBonus"), c.get("honors"))
    import statistics as st
    print("median", st.median(c["fantasySalary"] for c in cards), "min", min(c["fantasySalary"] for c in cards))


if __name__ == "__main__":
    main()
