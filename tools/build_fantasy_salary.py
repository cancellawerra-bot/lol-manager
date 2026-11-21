#!/usr/bin/env python3
"""판타지 드래프트 전용 시장 연봉(fantasySalary)과 판타지 능력치(fantasyRating)를 cards.json에 씁니다.

    python3 tools/build_fantasy_salary.py      # build_cards.py → apply_honors.py 다음에 실행 (멱등)

v2.17: 능력치 곡선 + 2024–26 보도 추정치. v2.18.0(2026-11-22, Grok, 오너 지시): 연도별 보정(옛 시즌 연봉 크게·능력치 소폭 하향),
어린 선수(만 22세 이하) 성장 곡선, 페이커 2022–25 25억 고정, 같은 시즌 페이커 초과 금지. 공식은 tools/market_salaries.json "yearAdjust".
스토리·창단 모드가 쓰는 salary·composite·percentile은 건드리지 않습니다.
"""
import json, math, re
from datetime import date
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
M = json.loads((ROOT / "tools" / "market_salaries.json").read_text("utf-8"))
CF = ROOT / "public" / "data" / "cards.json"
cf = json.loads(CF.read_text("utf-8"))
A = M["curve"]["anchors"]
Y0, Y1 = M["rules"]["years"]
PREM = M["rules"]["starPremium"]
UMAX = M["rules"]["unreportedMax2024to2026"]
YA = M["yearAdjust"]
SF = YA["salaryYearFactor"]
YOUTH = YA["youth"]
RD = YA["ratingYearDrop"]
FC = YA["fakerCap"]

# 검증된 생년월일 (src/game/playerBirthdates.ts)
BIRTH = {k: v for k, v in re.findall(r'"([^"]+)":\s*(?:lp|bio)\("(\d{4}-\d\d-\d\d)"', (ROOT / "src/game/playerBirthdates.ts").read_text("utf-8"))}


def age_in(pkey: str, year: int):
    b = BIRTH.get(pkey)
    if not b:
        return None
    y, m, d = map(int, b.split("-"))
    return year - y - (1 if (m, d) > (7, 1) else 0)


def year_factor(y: int) -> float:
    if str(y) in SF:
        return float(SF[str(y)])
    if y > 2026:
        return 1.0
    return float(SF["2022"]) * 0.9 ** (2022 - y)


def rating_drop(y: int) -> float:
    return RD["perYear2022to2025"] * (2026 - max(min(y, 2026), 2022)) + RD["perYearBefore2022"] * max(0, 2022 - y)


def rnd(v: float) -> float:
    if v < 1:
        return round(v, 2)
    if v < 10:
        return round(v, 1)
    return math.floor(v * 2 + 0.5) / 2


def curve(c) -> float:
    r = 85 + 4 * c["composite"]
    if r <= A[0][0]:
        return A[0][1]
    if r >= A[-1][0]:
        return A[-1][1]
    for (r0, s0), (r1, s1) in zip(A, A[1:]):
        if r0 <= r <= r1:
            return math.exp(math.log(s0) + (math.log(s1) - math.log(s0)) * (r - r0) / (r1 - r0))
    return A[-1][1]


ov = {}
for o in M["overrides"]:
    for y in o["years"]:
        ov.setdefault((o["pkey"], y), []).append(o)

cards = cf["cards"]
pre = {}
no_age = set()
for c in cards:
    for k in ("fantasySalary", "fantasyRating", "market", "marketNote"):
        c.pop(k, None)
    y = c["year"]
    v = curve(c)
    recent = Y0 <= y <= Y1
    if recent and c["pkey"] in PREM["players"]:
        v *= PREM["factor"]
    os_ = ov.get((c["pkey"], y), [])
    owner = [o for o in os_ if o["kind"] == "owner"]
    est = [o for o in os_ if o["kind"] == "estimate"]
    if recent and not est and not owner:
        v = min(v, UMAX)
    for o in os_:
        if o["kind"] == "min":
            v = max(v, o["value"])
    if est:
        v = est[0]["value"]
    v *= year_factor(y)
    a = age_in(c["pkey"], y)
    if a is None:
        no_age.add(c["pkey"])
    under = max(0, YOUTH["ageMax"] - a) if a is not None else 0
    v *= 1 - YOUTH["salaryPerYearUnder"] * under
    r = 85 + 4 * c["composite"] - rating_drop(y) - YOUTH["ratingPerYearUnder"] * under
    c["fantasyRating"] = int(max(60, min(99, math.floor(r + 0.5))))
    if owner:
        v = float(owner[0]["value"])
        c["market"] = True
        c["marketNote"] = owner[0]["label"]
    elif est or any(o["kind"] == "min" for o in os_):
        c["market"] = True
        c["marketNote"] = (est or os_)[0]["label"]
    pre[c["id"]] = (v, bool(owner))

# 같은 시즌 페이커 기준
def gap(F: float) -> float:
    return FC["step"] if F >= 10 else 0.1 if F >= 1 else 0.01


faker = {}
for c in cards:
    if c["pkey"] == "faker":
        faker[c["year"]] = max(faker.get(c["year"], 0), pre[c["id"]][0])
# 2022 이전: 페이커 카드를 그 시즌 다른 카드 최고가 + 간격으로 (다른 카드는 그대로)
for y in [y for y in faker if y < 2022]:
    others = max([pre[c["id"]][0] for c in cards if c["year"] == y and c["pkey"] != "faker"] + [0])
    if faker[y] <= others:
        faker[y] = rnd(others) + 2 * gap(others)
        for c in cards:
            if c["pkey"] == "faker" and c["year"] == y:
                pre[c["id"]] = (faker[y], pre[c["id"]][1])
for c in cards:
    v, is_owner = pre[c["id"]]
    F = faker.get(c["year"])
    if F and c["year"] >= 2022 and c["pkey"] != "faker" and not is_owner:
        k, top = FC["knee"] * F, F - gap(F)
        if v > k and top > k:
            v = k + (top - k) * (1 - math.exp(-(v - k) / (top - k)))
    floor = 0.6 if c["year"] >= 2021 else 0.2
    c["fantasySalary"] = rnd(max(floor, v))

# 검사: 같은 시즌 페이커 초과 금지, 지정값 유지
fy = {}
for c in cards:
    if c["pkey"] == "faker":
        fy[c["year"]] = max(fy.get(c["year"], 0), c["fantasySalary"])
over = [(c["id"], c["fantasySalary"], fy[c["year"]]) for c in cards if c["pkey"] != "faker" and c["year"] in fy and c["fantasySalary"] >= fy[c["year"]]]
assert not over, f"같은 시즌 페이커 이상: {over[:10]}"
by = {c["id"]: c for c in cards}
for o in M["overrides"]:
    if o["kind"] == "owner":
        for y in o["years"]:
            cid = f"{o['pkey']}-{y}"
            if cid in by:
                assert by[cid]["fantasySalary"] == o["value"], (cid, by[cid]["fantasySalary"], o["value"])

cf["meta"]["fantasySalary"] = {
    "source": "tools/market_salaries.json",
    "note": "판타지 드래프트 전용 시장 추정 연봉·능력치(게임용 가상 금액). 연도별 보정·어린 선수 성장 곡선·페이커 기준 포함(v2.18.0). 스토리·창단 모드는 salary·cardRating을 씁니다.",
    "noAge": sorted(no_age),
}
CF.write_text(json.dumps(cf, ensure_ascii=False, separators=(",", ":")), "utf-8")
print("no age:", sorted(no_age))
for y in range(2012, 2027):
    cs = sorted([c for c in cards if c["year"] == y], key=lambda c: -c["fantasySalary"])
    print(y, "faker", fy.get(y), "top", [(c["id"], c["fantasySalary"]) for c in cs[:3]], "med", cs[len(cs) // 2]["fantasySalary"])
