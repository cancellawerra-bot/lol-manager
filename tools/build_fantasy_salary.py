#!/usr/bin/env python3
"""판타지 드래프트 전용 시장 연봉(fantasySalary)을 cards.json에 씁니다 (2026-11-22, Grok).

    python3 tools/build_fantasy_salary.py      # build_cards.py → apply_honors.py 다음에 실행

- 기본값: tools/market_salaries.json의 능력치 곡선(화면 능력치 기준, 2024–26 시장 앵커).
- 2024–2026 카드: 보도된 시장 추정치가 있으면 그 값(estimate) 또는 하한(min)을 적용하고 market=true로 표시.
- 스토리·창단 모드가 쓰는 salary 필드는 건드리지 않습니다. 여러 번 실행해도 결과가 같습니다.
"""
import json, math
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
M = json.loads((ROOT / "tools" / "market_salaries.json").read_text("utf-8"))
CF = ROOT / "public" / "data" / "cards.json"
cf = json.loads(CF.read_text("utf-8"))
A = M["curve"]["anchors"]
Y0, Y1 = M["rules"]["years"]
PREM = M["rules"]["starPremium"]
UMAX = M["rules"]["unreportedMax2024to2026"]


def rnd(v: float) -> float:
    return round(v, 1) if v < 10 else float(round(v))


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

n_market = 0
for c in cf["cards"]:
    for k in ("fantasySalary", "market", "marketNote"):
        c.pop(k, None)
    v = curve(c)
    recent = Y0 <= c["year"] <= Y1
    if recent and c["pkey"] in PREM["players"]:
        v *= PREM["factor"]
    os_ = ov.get((c["pkey"], c["year"]), []) if recent else []
    est = sorted([o for o in os_ if o["kind"] in ("owner", "estimate")], key=lambda o: o["kind"] != "owner")
    if recent and not est:
        v = min(v, UMAX)
    for o in os_:
        if o["kind"] == "min":
            v = max(v, o["value"])
    if est:
        v = est[0]["value"]
    if os_:
        bound = bool(est) or any(abs(v - o["value"]) < 1e-9 for o in os_ if o["kind"] == "min")
        if bound:
            c["market"] = True
            n_market += 1
        src = M["sources"][(est or os_)[0]["source"]]
        c["marketNote"] = f"{(est or os_)[0]['label']} · {src['date']}"
    c["fantasySalary"] = rnd(v)

cf["meta"]["fantasySalary"] = {
    "source": "tools/market_salaries.json",
    "note": "판타지 드래프트 전용 시장 추정 연봉(게임용 가상 금액). 2024–26 보도 추정치 우선, 나머지는 능력치 곡선. 스토리·창단 모드는 salary를 씁니다.",
    "marketCards": n_market,
}
CF.write_text(json.dumps(cf, ensure_ascii=False, separators=(",", ":")), "utf-8")
fmax = max(c["fantasySalary"] for c in cf["cards"] if c["pkey"] == "faker")
over = [c["id"] for c in cf["cards"] if c["pkey"] != "faker" and c["fantasySalary"] >= fmax]
assert not over, f"페이커({fmax})보다 비싸거나 같은 카드: {over}"
top = sorted(cf["cards"], key=lambda c: -c["fantasySalary"])[:12]
print("market cards", n_market, "top:", [(c["id"], c["fantasySalary"]) for c in top])
