#!/usr/bin/env python3
"""LeagueLab 확정 티어·경기 수를 읽기만 해서 public/data/yearMeta.json 표시용 파일을 만듭니다.
LeagueLab 원본은 수정·삭제하지 않습니다. 경기 판정 공식에는 쓰지 않습니다."""
from __future__ import annotations
import json, sqlite3, time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "public/data/yearMeta.json"
CHAMPS = ROOT / "public/data/champs.json"
CORE = ROOT / "public/data/core.json"
METRICS = Path("/workspace/leaguelab-metrics/outputs")
DB = Path("/workspace/leaguelab-collector/data/live.sqlite")

ALIAS = {
    "K'Sante": "KSante", "Twisted Fate": "TwistedFate", "Tahm Kench": "TahmKench",
    "LeBlanc": "Leblanc", "Kha'Zix": "Khazix", "Wukong": "MonkeyKing",
    "Aurelion Sol": "AurelionSol", "Rek'Sai": "RekSai", "Renata Glasc": "Renata",
    "Jarvan IV": "JarvanIV", "Lee Sin": "LeeSin", "Xin Zhao": "XinZhao",
    "Miss Fortune": "MissFortune", "Kai'Sa": "Kaisa", "Bel'Veth": "Belveth",
    "Kog'Maw": "KogMaw", "Cho'Gath": "Chogath", "Dr. Mundo": "DrMundo",
    "Nunu & Willump": "Nunu", "Nunu and Willump": "Nunu",
}

def cid(name: str, ids: set[str]) -> str | None:
    if not name or name == "None":
        return None
    if name in ids:
        return name
    a = ALIAS.get(name)
    return a if a in ids else None

def period_from_db() -> dict[int, list[str]]:
    if not DB.is_file():
        return {}
    con = sqlite3.connect(f"file:{DB}?mode=ro", uri=True)
    con.execute("PRAGMA query_only=ON")
    rows = list(con.execute(
        """SELECT t.year, MIN(g.played_at), MAX(g.played_at),
                  SUM(CASE WHEN g.winner_side='blue' THEN 1 ELSE 0 END),
                  SUM(CASE WHEN g.winner_side='red' THEN 1 ELSE 0 END),
                  COUNT(*)
           FROM games g
           JOIN series s ON s.id=g.series_id
           JOIN tournaments t ON t.id=s.tournament_id
           WHERE t.league='LCK'
           GROUP BY 1"""
    ))
    con.close()
    out = {}
    for y, lo, hi, bw, rw, n in rows:
        out[int(y)] = {
            "period": [str(lo)[:10], str(hi)[:10]],
            "blueWins": int(bw), "redWins": int(rw), "games": int(n),
        }
    return out

def main() -> None:
    ids = {c["id"] for c in json.loads(CHAMPS.read_text())}
    core = json.loads(CORE.read_text())
    sides = period_from_db()
    seasons = {}
    for year in (2024, 2025, 2026):
        path = METRICS / f"lck{year}-champion-tier.locked.json"
        if not path.is_file():
            raise SystemExit(f"missing {path} (read-only source)")
        doc = json.loads(path.read_text())
        champs = {}
        for it in doc["items"]:
            ident = cid(it.get("champion") or "", ids)
            if not ident:
                continue
            ok = bool(it.get("sampleOk"))
            champs[ident] = {
                "p": int(it["picks"]), "b": int(it["bans"]), "w": int(it["wins"]),
                "eb": round(float(it["ebWR"]), 4) if it.get("ebWR") is not None else None,
                "pr": round(float(it["presence"]), 4) if it.get("presence") is not None else None,
                "tier": int(it["tier"]) if ok and it.get("tier") else None,
                "ok": ok,
            }
        side = sides.get(year, {})
        games = side.get("games") or doc.get("scope", {}).get("games")
        seasons[str(year)] = {
            "year": year,
            "games": games,
            "blueWins": side.get("blueWins"),
            "redWins": side.get("redWins"),
            "period": side.get("period"),
            "source": path.name,
            "champs": champs,
        }
    # 2026 화면은 기존 저장소 core/champs와 같게 맞춤(이미 게임에 있는 값)
    c2026 = {}
    for c in json.loads(CHAMPS.read_text()):
        if c.get("pro"):
            c2026[c["id"]] = {k: c["pro"][k] for k in ("p", "b", "w", "eb", "pr", "tier", "ok") if k in c["pro"]}
    seasons["2026"] = {
        "year": 2026,
        "games": core["meta"]["games"],
        "blueWins": core["meta"]["blueWins"],
        "redWins": core["meta"]["redWins"],
        "period": list(core["meta"]["period"]),
        "source": "public/data/core.json + champs.json",
        "champs": c2026,
    }
    out = {
        "meta": {
            "builtAt": time.strftime("%Y-%m-%dT%H:%M:%S+09:00"),
            "note": "표시 전용. 경기 판정·난이도 계산에는 쓰지 않습니다. LeagueLab은 읽기만 했습니다.",
            "years": [2024, 2025, 2026],
            "missing": "2012–2023 및 그 외 연도는 저장소·LeagueLab에 LCK 챔피언 메타·진영 승률이 없어 기록 없음으로 표시합니다.",
        },
        "seasons": seasons,
    }
    OUT.write_text(json.dumps(out, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, "bytes", OUT.stat().st_size, "years", list(seasons), "champs", {y: len(seasons[y]["champs"]) for y in seasons})

if __name__ == "__main__":
    main()
