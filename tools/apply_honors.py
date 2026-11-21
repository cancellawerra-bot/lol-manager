"""국제대회(월즈·MSI) 성적 보정 — build_cards.py / build_data.py 다음에 실행합니다 (2026-11-21 오너 요청).

    py -3 -X utf8 tools/apply_honors.py

- 자료: tools/international_results.json (LCK 팀 4강 이상 성적, 위키백과 출처).
- 그해 그 팀 카드의 종합 z(composite)에 성적 보너스를 더하고, 직전 시즌 보너스의 일부(carry_next_season)를 다음 시즌 카드에 더합니다.
- 보정된 선수만 그해·포지션 안에서 원래 카드들의 (종합 z → 퍼센타일) 관계로 퍼센타일을 다시 정하고 연봉 공식을 다시 적용합니다.
  다른 선수의 기록·퍼센타일은 바꾸지 않습니다. 경기 기록 숫자(KDA·GD 등)는 손대지 않습니다.
- 여러 번 실행해도 같은 결과가 되도록 원래 값을 compositeBase / percentileBase / salaryBase 로 보관합니다.
- core.json(2026 한 시즌 모드)도 같은 방식으로 2026 성적 + 2025 이월 보너스를 z.ovr·pct.ovr에 반영합니다.
"""
import json
from bisect import bisect_left
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HON = json.loads((ROOT / "tools" / "international_results.json").read_text("utf-8"))
BONUS, CARRY, LABEL = HON["bonus_z"], HON["carry_next_season"], HON["label"]


def salary(pct: float) -> int:
    return round(3 + 47 * (pct / 100) ** 2.5)


def interp_pct(z: float, pairs: list[tuple[float, float]]) -> float:
    """원래 카드들의 (z, 퍼센타일) 관계에서 z에 해당하는 퍼센타일 (선형 보간, 0~100)."""
    pairs = sorted(pairs)
    zs = [a for a, _ in pairs]
    i = bisect_left(zs, z)
    if i <= 0:
        return pairs[0][1]
    if i >= len(pairs):
        return 100.0
    (z0, p0), (z1, p1) = pairs[i - 1], pairs[i]
    return p0 if z1 == z0 else p0 + (p1 - p0) * (z - z0) / (z1 - z0)


# ---------- 시즌 카드 ----------
cf_path = ROOT / "public" / "data" / "cards.json"
cf = json.loads(cf_path.read_text("utf-8"))
cards = cf["cards"]
for c in cards:
    c.setdefault("compositeBase", c["composite"])
    c.setdefault("percentileBase", c["percentile"])
    c.setdefault("salaryBase", c["salary"])

by_team = defaultdict(list)  # (year, team) -> places
for r in HON["results"]:
    by_team[(r["year"], r["team"])].append(r["place"])

own = {}  # card id -> (bonus, labels)
for c in cards:
    places = by_team.get((c["year"], c["team"]), [])
    own[c["id"]] = (sum(BONUS[p] for p in places), [f"{c['year']} {LABEL[p]}" for p in places])
own_by_person = defaultdict(float)  # (pkey, year) -> 그해 받은 보너스(여러 카드면 큰 값)
for c in cards:
    k = (c["pkey"], c["year"])
    own_by_person[k] = max(own_by_person[k], own[c["id"]][0])

groups = defaultdict(list)
for c in cards:
    groups[(c["year"], c["posIdx"])].append(c)

changed = 0
for (year, pos), grp in groups.items():
    base_pairs = [(c["compositeBase"], c["percentileBase"]) for c in grp]
    for c in grp:
        b, labels = own[c["id"]]
        carry = CARRY * own_by_person.get((c["pkey"], year - 1), 0.0)
        add = b + carry
        c["honors"] = labels + ([f"{year - 1} 국제대회 성적 이월"] if carry > 0 else [])
        c["honorBonus"] = round(add, 3)
        if add > 0:
            c["composite"] = round(c["compositeBase"] + add, 4)
            others = [(z, p) for (z, p), o in zip(base_pairs, grp) if o is not c]
            c["percentile"] = round(min(100.0, max(c["percentileBase"], interp_pct(c["composite"], others))), 1)
            c["salary"] = salary(c["percentile"])
            changed += 1
        else:
            c["composite"], c["percentile"], c["salary"] = c["compositeBase"], c["percentileBase"], c["salaryBase"]
    # 순위(10경기 이상 카드끼리) 다시 매기기
    elig = sorted([c for c in grp if c["games"] >= 10], key=lambda c: -c["percentile"])
    for i, c in enumerate(elig, 1):
        c["rank"] = i

cf["meta"]["honors"] = {"source": "tools/international_results.json", "bonus_z": BONUS, "carry_next_season": CARRY, "cards_adjusted": changed}
cf_path.write_text(json.dumps(cf, ensure_ascii=False, separators=(",", ":")), "utf-8")
print(f"cards: {changed}장 보정")

# ---------- 2026 코어 ----------
core_path = ROOT / "public" / "data" / "core.json"
core = json.loads(core_path.read_text("utf-8"))
short_of = {t["id"]: t["short"] for t in core["teams"]}
place26 = defaultdict(list)
for r in HON["results"]:
    if r["year"] == 2026 and r.get("short"):
        place26[r["short"]].append(r["place"])
for p in core["players"]:
    p.setdefault("zOvrBase", p["z"]["ovr"])
    p.setdefault("pctOvrBase", p["pct"]["ovr"])
cn = 0
for pos in range(5):
    grp = [p for p in core["players"] if p["pos"] == pos]
    base_pairs = [(p["zOvrBase"], p["pctOvrBase"]) for p in grp]
    for p in grp:
        places = place26.get(short_of.get(p["team"]), [])
        b = sum(BONUS[x] for x in places)
        carry = CARRY * own_by_person.get((p["key"], 2025), 0.0)
        add = b + carry
        p["honors"] = [f"2026 {LABEL[x]}" for x in places] + (["2025 국제대회 성적 이월"] if carry > 0 else [])
        if add > 0:
            p["z"]["ovr"] = round(p["zOvrBase"] + add, 3)
            others = [(z, q) for (z, q), o in zip(base_pairs, grp) if o is not p]
            p["pct"]["ovr"] = round(min(100.0, max(p["pctOvrBase"], interp_pct(p["z"]["ovr"], others))))
            cn += 1
        else:
            p["z"]["ovr"], p["pct"]["ovr"] = p["zOvrBase"], p["pctOvrBase"]
core.setdefault("meta", {})["honors"] = {"source": "tools/international_results.json", "players_adjusted": cn}
print(f"core: {cn}명 보정")

# ---------- 교수님(오너) 평가 ----------
# 화면 능력치 = RATING_BASE + RATING_PER_Z × z (src/rating.ts와 같은 값). 평가가 있는 선수는 z를 평가에 맞춰 되돌려 넣고
# 같은 포지션 안 퍼센타일·연봉도 다시 정합니다. 다른 선수는 그대로입니다.
RATING_BASE, RATING_PER_Z = 85, 4
OWN = json.loads((ROOT / "tools" / "owner_ratings.json").read_text("utf-8"))
oy, orat = OWN["year"], OWN["ratings"]
zr = lambda r: round((r - RATING_BASE) / RATING_PER_Z, 4)
for c in cards:
    c.pop("ownerRating", None)
oc = 0
for (year, pos), grp in groups.items():
    if year != oy:
        continue
    base_pairs = [(c["compositeBase"], c["percentileBase"]) for c in grp]
    for c in grp:
        r = orat.get(c["pkey"])
        if r is None:
            continue
        c["ownerRating"] = r
        c["composite"] = zr(r)
        others = [(z, p) for (z, p), o in zip(base_pairs, grp) if o is not c]
        c["percentile"] = round(min(100.0, interp_pct(c["composite"], others)), 1)
        c["salary"] = salary(c["percentile"])
        oc += 1
    elig = sorted([c for c in grp if c["games"] >= 10], key=lambda c: -c["percentile"])
    for i, c in enumerate(elig, 1):
        c["rank"] = i
for p in core["players"]:
    p.pop("ownerRating", None)
pc = 0
for pos in range(5):
    grp = [p for p in core["players"] if p["pos"] == pos]
    base_pairs = [(p["zOvrBase"], p["pctOvrBase"]) for p in grp]
    for p in grp:
        r = orat.get(p["key"])
        if r is None:
            continue
        p["ownerRating"] = r
        p["z"]["ovr"] = zr(r)
        others = [(z, q) for (z, q), o in zip(base_pairs, grp) if o is not p]
        p["pct"]["ovr"] = round(min(100.0, interp_pct(p["z"]["ovr"], others)))
        pc += 1
cf["meta"]["ownerRatings"] = {"source": "tools/owner_ratings.json", "year": oy, "cards": oc}
core["meta"]["ownerRatings"] = {"source": "tools/owner_ratings.json", "players": pc}
cf_path.write_text(json.dumps(cf, ensure_ascii=False, separators=(",", ":")), "utf-8")
core_path.write_text(json.dumps(core, ensure_ascii=False, separators=(",", ":")), "utf-8")
print(f"교수님 평가: 카드 {oc}장, 2026 선수 {pc}명")
