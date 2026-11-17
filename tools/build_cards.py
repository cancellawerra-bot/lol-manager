#!/usr/bin/env python3
"""Build public/data/cards.json from the researched per-season LCK stats.
Source CSV is copied beside this script after generation, but the live numbers
come from /workspace/lolmanager-research/seasons/derived/all_player_seasons.csv.
Does not touch LeagueLab files."""
from __future__ import annotations

import csv
import json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = Path("/workspace/lolmanager-research/seasons/derived/all_player_seasons.csv")
OUT = ROOT / "public/data/cards.json"
POS = {"TOP": 0, "JNG": 1, "MID": 2, "BOT": 3, "SUP": 4}


def num(v: str) -> float | None:
    if v is None:
        return None
    s = str(v).strip()
    if s == "":
        return None
    try:
        return float(s)
    except ValueError:
        return None


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"missing source CSV: {SRC}")
    rows = list(csv.DictReader(SRC.open(encoding="utf-8")))
    cands = [r for r in rows if int(float(r["games"])) >= 10 and r["percentile"].strip()!=""]
    # ranks among 10+ game cards in the same year+pos
    pool: dict[tuple[int, str], list] = defaultdict(list)
    for r in cands:
        g = int(float(r["games"]))
        if g >= 10:
            pool[(int(r["year"]), r["pos"])].append(r)
    rank_of: dict[tuple[str, str, str], tuple[int, int]] = {}
    for key, grp in pool.items():
        grp = sorted(grp, key=lambda x: -float(x["percentile"]))
        n = len(grp)
        for i, r in enumerate(grp, 1):
            rank_of[(r["year"], r["pkey"], r["pos"])] = (i, n)

    cards = []
    for r in cands:
        year = int(r["year"])
        games = int(float(r["games"]))
        pos = r["pos"]
        pkey = r["pkey"]
        gd15, dpm, cspm, kp = num(r["gd15"]), num(r["dpm"]), num(r["cspm"]), num(r["kp"])
        kda, wr = num(r["kda"]), num(r["wr"])
        small = r["small_sample"] == "True" or games < 10 or (year == 2012 and games < 15)
        limited = year <= 2014
        rk = rank_of.get((r["year"], pkey, pos))
        cid = f"{pkey}-{year}"
        cards.append(
            {
                "id": cid,
                "pkey": pkey,
                "name": r["player"],
                "year": year,
                "pos": pos,
                "posIdx": POS[pos],
                "team": r["team"],
                "games": games,
                "kills": num(r["kills_sum"]),
                "deaths": num(r["deaths_sum"]),
                "assists": num(r["assists_sum"]),
                "kda": None if kda is None else round(kda, 2),
                "wr": None if wr is None else round(wr, 4),
                "kp": None if kp is None else round(kp, 3),
                "gd15": None if gd15 is None else round(gd15, 1),
                "dpm": None if dpm is None else round(dpm, 1),
                "cspm": None if cspm is None else round(cspm, 2),
                "percentile": round(float(r["percentile"]), 1),
                "rank": rk[0] if rk else None,
                "pool": rk[1] if rk else None,
                "salary": int(float(r["salary_eok"])),
                "composite": round(float(r["composite"]), 4),
                "small": small,
                "limited": limited,
                "source": r["source"],
                "metrics": [x for x in r["metrics_used"].split(",") if x],
                "eligible": games >= 10 and r["eligible_card"] == "True",
            }
        )
    cards.sort(key=lambda c: (-c["year"], c["posIdx"], -c["percentile"], c["name"]))
    n10 = sum(1 for c in cards if c["eligible"])
    meta = {
        "builtAt": "2026-11-17T16:00:00+09:00",
        "years": [2012, 2026],
        "cards": len(cards),
        "eligible": n10,
        "minGames": 8,
        "eligibleMinGames": 10,
        "formula": "round(3 + 47 * (p/100)^2.5)",
        "salaryNote": "게임용 가상 금액(억 원). 실제 LCK 계약과 무관합니다.",
        "sources": [
            "Oracle's Elixir (Tim Sevenhuysen)",
            "Leaguepedia/LoL Esports Wiki Cargo",
            "ChainCC (OE 재정리, CC BY 4.0)",
        ],
        "rule": "그해+포지션 안에서만 정규화. 없는 지표는 기록 없음이며 0으로 채우지 않습니다.",
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"meta": meta, "cards": cards}, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT} cards={len(cards)} eligible10={n10} bytes={OUT.stat().st_size}")


if __name__ == "__main__":
    main()
