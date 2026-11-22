"""운영자(오너)가 제외한 선수를 이미 만들어진 public/data/cards.json에서 뺍니다 (2026-11-22).

    py -3 -X utf8 tools/apply_exclusions.py

- 목록: tools/excluded_players.json (pkeys). build_cards.py도 같은 목록을 보고 처음부터 만들지 않으므로,
  카드 파이프라인을 처음부터 다시 돌릴 수 없는 환경(원본 CSV가 없는 PC)에서 이 도구로 빼면 됩니다. 여러 번 실행해도 안전합니다.
- 빼면 같은 해·포지션 묶음의 인원수(pool)와 순위(rank)가 달라지므로 그 묶음만 다시 정합니다
  (10경기 이상 카드끼리 퍼센타일 높은 순, 기존 build_cards.py·apply_honors.py와 같은 규칙).
- 남은 선수의 기록·퍼센타일·능력치·연봉은 바꾸지 않습니다.
- meta.cards / meta.eligible 개수를 맞춥니다. 화면의 "시즌 카드 N장"은 이 값을 읽습니다.
"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
EXC = set(json.loads((ROOT / "tools" / "excluded_players.json").read_text("utf-8"))["pkeys"])
path = ROOT / "public" / "data" / "cards.json"
cf = json.loads(path.read_text("utf-8"))
cards = cf["cards"]

gone = [c for c in cards if c["pkey"] in EXC]
if not gone:
    print("제외할 카드 없음 (이미 빠져 있음)")
else:
    groups = {(c["year"], c["pos"]) for c in gone}
    cards[:] = [c for c in cards if c["pkey"] not in EXC]
    for key in groups:
        grp = [c for c in cards if (c["year"], c["pos"]) == key and c["games"] >= 10]
        grp.sort(key=lambda c: -c["percentile"])
        for i, c in enumerate(grp, 1):
            c["rank"], c["pool"] = i, len(grp)
    print(f"카드 {len(gone)}장 제외: " + ", ".join(c["id"] for c in gone) + f" · 다시 정한 묶음 {len(groups)}개")

cf["meta"]["cards"] = len(cards)
cf["meta"]["eligible"] = sum(1 for c in cards if c.get("eligible", True))
cf["meta"]["excluded"] = {"source": "tools/excluded_players.json", "count": len(EXC)}  # 이름은 공개 자료에 싣지 않습니다
path.write_text(json.dumps(cf, ensure_ascii=False, separators=(",", ":")), "utf-8")
print(f"meta.cards={cf['meta']['cards']} meta.eligible={cf['meta']['eligible']}")
