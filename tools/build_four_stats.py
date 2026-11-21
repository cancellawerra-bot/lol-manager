#!/usr/bin/env python3
"""v2.19+ 판타지 카드 4대 능력치(피지컬: 교전·압박 / 뇌지컬: 판단·운영) 계산.

실행 순서: build_cards.py → apply_honors.py → build_fantasy_salary.py → build_four_stats.py
원자료(읽기만): /workspace/lolmanager-research/seasons (Leaguepedia 2012–14, OE 2015, ChainCC(OE) 2016–26).
- 실제 경기 기록만 씁니다. 없는 값은 0으로 채우지 않고 그 재료를 빼고 계산합니다(가중치 재정규화).
- 재료가 하나도 없으면 null(화면 '기록 없음').
- 재료마다 같은 시즌·같은 포지션 카드끼리 z-score(경기 수 수축 n/(n+8)), 낮을수록 좋은 재료는 부호 반대.
- 4대 값 = clamp(판타지 능력치 R + 8·(z_i − z̄), 60, 99). z̄ = 그 카드의 (있는) 4대 z 평균.
  → 4대 평균 ≈ 판타지 종합 능력치(반올림·60/99 자르기만 차이). 종합·연봉·예산·AI는 그대로.
"""
from __future__ import annotations

import json
import math
import re
from collections import defaultdict
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
SEASONS = Path("/workspace/lolmanager-research/seasons")
CARDS = ROOT / "public/data/cards.json"
POS_MAP = {"top": "TOP", "jungle": "JNG", "jng": "JNG", "mid": "MID", "bot": "BOT", "adc": "BOT", "support": "SUP", "sup": "SUP"}
SHRINK_K = 8
SCALE = 8.0  # 4대 사이 차이가 보이도록 (편차 표준편차 약 3점)

# 재료: (이름, 높을수록 좋음?)
ING = {
    # 피지컬 = 아는 것을 손으로 정확·빠르게 실행 (메카닉·반응속도는 직접 기록이 없어 아래 기록으로 대리)
    "fight": [("dpm", True), ("dmgshare", True), ("kda", True), ("deathshare", False)],          # 교전: 한타 실행력
    "press": [("cspm", True), ("gd15", True), ("xpd15", True), ("csd15", True), ("ka15", True), ("solo", True)],  # 압박: 라인전 손기술
    # 뇌지컬 = 언제·어디서·무엇을 할지 고르는 능력
    "judge": [("kp", True), ("dpmin", False), ("fbpart", True), ("d15", False)],                  # 판단: 싸울지 뺄지, 데스 관리
    "ops": [("vspm", True), ("wcpm", True), ("gpm", True), ("towerpm", True), ("cspm", True), ("objp", True)],  # 운영: 시야·오브젝트·라인 관리
}
# 포지션별 가중치 (재료 순서는 ING와 같음). v2.21.0 재검토: 압박에 CS(막타)·솔로킬, 운영은 오브젝트 관여 추가·CS는 흐름 지표로 작게.
W = {
    "fight": {"TOP": [.40, .20, .25, .15], "JNG": [.30, .15, .30, .25], "MID": [.40, .20, .25, .15], "BOT": [.45, .20, .20, .15], "SUP": [.25, .10, .35, .30]},
    "press": {"TOP": [.15, .25, .15, .20, .05, .20], "JNG": [.10, .30, .20, .05, .25, .10], "MID": [.15, .25, .15, .20, .10, .15], "BOT": [.20, .25, .10, .25, .05, .15], "SUP": [.00, .35, .30, .00, .25, .10]},
    "judge": {"TOP": [.30, .35, .15, .20], "JNG": [.35, .25, .25, .15], "MID": [.35, .30, .15, .20], "BOT": [.30, .35, .15, .20], "SUP": [.35, .25, .25, .15]},
    "ops": {"TOP": [.10, .05, .25, .25, .10, .25], "JNG": [.20, .15, .15, .05, .10, .35], "MID": [.15, .10, .25, .15, .10, .25], "BOT": [.10, .05, .30, .20, .10, .25], "SUP": [.40, .25, .05, .00, .00, .30]},
}
LABEL = {"dpm": "DPM", "dmgshare": "딜 비중", "kda": "KDA", "deathshare": "팀 데스 중 내 데스 비율(한타 생존, 낮을수록 좋음)",
         "gd15": "GD@15", "xpd15": "XPD@15", "csd15": "CSD@15", "ka15": "15분 킬+어시",
         "kp": "킬 관여율", "dpmin": "분당 데스(낮을수록 좋음)", "fbpart": "퍼스트 블러드 관여율", "d15": "15분 데스(낮을수록 좋음)",
         "solo": "경기당 솔로킬", "objp": "오브젝트 관여율(용·전령·바론)", "vspm": "분당 시야 점수", "wcpm": "분당 와드 제거", "gpm": "분당 골드", "towerpm": "분당 포탑 피해", "cspm": "분당 CS(막타)"}


def key(name: str) -> str:
    return re.sub(r"\s+", " ", str(name)).strip().casefold()


def f(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return None if math.isnan(x) else x


def games_rows() -> list[dict]:
    rows: list[dict] = []
    # 2012–2014 Leaguepedia
    sp = pd.read_csv(SEASONS / "leaguepedia/scoreboard_2012_2015_main.csv", dtype=str).fillna("")
    sg = pd.read_csv(SEASONS / "leaguepedia/scoreboardgames_2012_2015_main.csv", dtype=str).fillna("")
    sp = sp[sp["YearAssigned"].isin(["2012", "2013", "2014"])]

    def plen(s):
        s = str(s).strip()
        if not s:
            return None
        p = s.split(":")
        try:
            return int(p[0]) + int(p[1]) / 60 if len(p) >= 2 else float(s)
        except ValueError:
            return None
    gl = {r["GameId"]: plen(r.get("Gamelength")) for _, r in sg.iterrows()}
    for _, r in sp.iterrows():
        pos = POS_MAP.get(r["Role"].strip().lower())
        if not pos:
            continue
        L = gl.get(r["GameId"])
        rows.append({"year": int(r["YearAssigned"]), "pkey": key(r["Link"]), "game": r["GameId"], "team": r["Team"].strip(),
                     "k": f(r["Kills"]), "d": f(r["Deaths"]), "a": f(r["Assists"]), "tk": f(r["TeamKills"]), "len": L,
                     "gold": f(r["Gold"]), "cs": f(r["CS"]), "dmg": f(r["DamageToChampions"]), "vs": f(r["VisionScore"]) or None})
    # 2015 OE, 2016–2026 ChainCC(OE)
    def oe(df, year, gcol, pcol, tcol, cscol, gpmcol):
        for _, r in df.iterrows():
            pos = POS_MAP.get(str(r["position"]).strip().lower())
            name = str(r[pcol]).strip()
            if not pos or not name or name.lower() in {"nan", "unknown", "unknown player"}:
                continue
            L = f(r["gamelength"]); L = L / 60 if L and L > 90 else L
            fb = f(r.get("firstblood"))
            if "firstbloodassist" in r.index:
                fb = 1.0 if (f(r["firstbloodkill"]) or 0) + (f(r["firstbloodassist"]) or 0) > 0 else 0.0
            elif fb is None:
                fb = None
            else:
                fb = 1.0 if str(r["firstblood"]).strip().lower() in ("true", "1", "1.0") else 0.0
            vs = f(r.get("visionscore"))
            rows.append({"year": year, "pkey": key(name), "game": str(r[gcol]), "team": str(r[tcol]),
                         "k": f(r["kills"]), "d": f(r["deaths"]), "a": f(r["assists"]), "tk": f(r.get("teamkills")), "td": f(r.get("teamdeaths")),
                         "len": L, "gold": f(r.get("earnedgold")), "egpm": f(r.get(gpmcol)), "cs": f(r.get(cscol)), "dmg": f(r.get("damagetochampions")),
                         "dmgshare": f(r.get("damageshare")), "gd15": f(r.get("golddiffat15")), "xpd15": f(r.get("xpdiffat15")), "csd15": f(r.get("csdiffat15")),
                         "k15": f(r.get("killsat15")), "a15": f(r.get("assistsat15")), "d15": f(r.get("deathsat15")), "fb": fb,
                         "vs": vs if vs else None, "wk": f(r.get("wardskilled")), "tower": f(r.get("damagetotowers"))})
    d15 = pd.read_csv(SEASONS / "oe/lck_2015.csv", low_memory=False)
    d15 = d15[d15["position"].astype(str).str.lower() != "team"].copy()
    d15["date"] = pd.to_datetime(d15["date"])
    promo = ((d15["date"] >= "2015-05-15") & (d15["date"] < "2015-05-20")) | (d15["league"].astype(str) == "LCK")
    oe(d15[~promo], 2015, "gameid", "playername", "teamname", "total cs", "earned gpm")
    for y in range(2016, 2027):
        df = pd.read_csv(SEASONS / f"chaincc/lck_{y}.csv", low_memory=False)
        oe(df[df["league"].astype(str) == "LCK"], y, "game_id", "playername", "team_name", "total_cs", "earned_gpm")
    return rows


LIVE = Path("/workspace/leaguelab-collector/data/live.sqlite")


def riot_extras(cards: list[dict]) -> dict[tuple[int, str], dict[str, tuple[float, int]]]:
    """LeagueLab live.sqlite(읽기 전용)의 Riot 경기 기록(LCK 2024–2026): 솔로킬, 용·전령·바론 관여율."""
    import sqlite3
    if not LIVE.exists():
        return {}
    con = sqlite3.connect(f"file:{LIVE}?mode=ro", uri=True)
    q = """select g.played_at, p.payload from games g join series s on g.series_id = s.id join tournaments t on s.tournament_id = t.id
           join raw_payloads p on p.entity = 'match' and p.external_id = g.riot_match_id where t.league = 'LCK'"""
    byname = defaultdict(list)
    for c in cards:
        byname[(c["year"], c["name"].casefold())].append(c["pkey"])
        byname[(c["year"], c["pkey"].split(" (")[0])].append(c["pkey"])
    acc = defaultdict(lambda: defaultdict(list))
    unmatched = set()
    for played, payload in con.execute(q):
        year = int(str(played)[:4])
        m = json.loads(payload); info = m.get("info", m)
        team_obj = {t["teamId"]: sum(t["objectives"][k]["kills"] for k in ("dragon", "baron", "riftHerald")) for t in info["teams"]}
        for pt in info["participants"]:
            ign = str(pt.get("riotIdGameName") or "").strip()
            name = ign.split(" ", 1)[1] if " " in ign else ign
            cand = sorted(set(byname.get((year, name.casefold()), [])))
            if len(cand) != 1:
                unmatched.add((year, ign)); continue
            ch = pt.get("challenges") or {}
            a = acc[(year, cand[0])]
            if ch.get("soloKills") is not None:
                a["solo"].append(float(ch["soloKills"]))
            tot = team_obj.get(pt["teamId"], 0)
            if tot > 0:
                a["objp"].append(sum(float(ch.get(k) or 0) for k in ("dragonTakedowns", "baronTakedowns", "riftHeraldTakedowns")) / tot)
    con.close()
    print("riot extras: matched", len(acc), "player-seasons; unmatched names", len(unmatched))
    return {k: {n: (sum(v) / len(v), len(v)) for n, v in d.items() if v} for k, d in acc.items()}


def aggregate(cards: list[dict]) -> dict[tuple[int, str], dict]:
    """선수·시즌별 재료값과 재료별 경기 수: {(year, pkey): {재료: (값, n)}}"""
    rows = games_rows()
    # 팀 데스가 없으면 같은 경기·같은 팀 5명 데스 합
    # 팀 킬도 없으면 같은 경기·같은 팀 5명 킬 합 (compute_cards.py와 같은 방식)
    td = defaultdict(float); tdn = defaultdict(int); tk = defaultdict(float); tkn = defaultdict(int)
    for r in rows:
        g = (r["game"], r["team"])
        if r["d"] is not None:
            td[g] += r["d"]; tdn[g] += 1
        if r["k"] is not None:
            tk[g] += r["k"]; tkn[g] += 1
    for r in rows:
        g = (r["game"], r["team"])
        if r.get("td") is None and tdn[g] >= 5:
            r["td"] = td[g]
        if not r.get("tk") and tkn[g] >= 5 and tk[g] > 0:
            r["tk"] = tk[g]
    # 해마다 거의 전부 0인 열(미기록)은 그해 없음 처리
    by_year = defaultdict(list)
    for r in rows:
        by_year[r["year"]].append(r)
    for y, rs in by_year.items():
        for c in ("tower", "wk", "dmg", "gold", "cs"):
            vals = [r.get(c) for r in rs if r.get(c) is not None]
            if vals and sum(1 for v in vals if v == 0) / len(vals) > 0.95:
                for r in rs:
                    r[c] = None
    # 선수·시즌 집계: 재료값과 재료별 경기 수
    agg: dict[tuple[int, str], dict] = {}
    grp = defaultdict(list)
    for r in rows:
        grp[(r["year"], r["pkey"])].append(r)

    def mean(xs):
        xs = [x for x in xs if x is not None]
        return (sum(xs) / len(xs), len(xs)) if xs else (None, 0)
    for k_, g in grp.items():
        L = lambda r: r["len"] if r["len"] and r["len"] > 0 else None
        m = {}
        m["dpm"] = mean([r["dmg"] / L(r) if r.get("dmg") is not None and L(r) else None for r in g])
        m["dmgshare"] = mean([r.get("dmgshare") for r in g])
        ks = [r for r in g if None not in (r["k"], r["d"], r["a"])]
        m["kda"] = ((sum(r["k"] + r["a"] for r in ks) / max(1, sum(r["d"] for r in ks))), len(ks)) if ks else (None, 0)
        m["deathshare"] = mean([r["d"] / r["td"] if r["d"] is not None and r.get("td") else None for r in g])
        m["gd15"] = mean([r.get("gd15") for r in g]); m["xpd15"] = mean([r.get("xpd15") for r in g]); m["csd15"] = mean([r.get("csd15") for r in g])
        m["ka15"] = mean([r["k15"] + r["a15"] if r.get("k15") is not None and r.get("a15") is not None else None for r in g])
        m["kp"] = mean([(r["k"] + r["a"]) / r["tk"] if r["k"] is not None and r["a"] is not None and r.get("tk") else None for r in g])
        m["dpmin"] = mean([r["d"] / L(r) if r["d"] is not None and L(r) else None for r in g])
        m["fbpart"] = mean([r.get("fb") for r in g])
        m["d15"] = mean([r.get("d15") for r in g])
        m["vspm"] = mean([r["vs"] / L(r) if r.get("vs") and L(r) else None for r in g])
        m["wcpm"] = mean([r["wk"] / L(r) if r.get("wk") is not None and r.get("vs") is not None and L(r) else (r["wk"] / L(r) if r.get("wk") is not None and r["year"] == 2015 and L(r) else None) for r in g])
        m["gpm"] = mean([r["egpm"] if r.get("egpm") is not None else (r["gold"] / L(r) if r.get("gold") is not None and L(r) else None) for r in g])
        m["towerpm"] = mean([r["tower"] / L(r) if r.get("tower") is not None and L(r) else None for r in g])
        m["cspm"] = mean([r["cs"] / L(r) if r.get("cs") is not None and L(r) else None for r in g])
        agg[k_] = m
    for k_, ex in riot_extras(cards).items():
        agg.setdefault(k_, {}).update(ex)
    return agg


def main() -> None:
    data = json.loads(CARDS.read_text(encoding="utf-8"))
    cards = data["cards"]
    agg = aggregate(cards)
    # 재료 z (같은 시즌·포지션 카드끼리)
    zs: dict[str, dict[str, float]] = {c["id"]: {} for c in cards}
    pools = defaultdict(list)
    for c in cards:
        pools[(c["year"], c["pos"])].append(c)
    allings = sorted({n for v in ING.values() for n, _ in v})
    for (y, p), cs in pools.items():
        for ing in allings:
            vals = [(c, agg.get((c["year"], c["pkey"]), {}).get(ing, (None, 0))) for c in cs]
            xs = [v for _, (v, n) in vals if v is not None]
            if len(xs) < 3:
                continue
            mu = sum(xs) / len(xs); sd = (sum((x - mu) ** 2 for x in xs) / len(xs)) ** 0.5
            if sd == 0:
                continue
            for c, (v, n) in vals:
                if v is not None:
                    zs[c["id"]][ing] = (v - mu) / sd * (n / (n + SHRINK_K))
    cover = defaultdict(lambda: defaultdict(int)); per_year = defaultdict(int)
    missing_any = 0
    for c in cards:
        R = c.get("fantasyRating") or 85
        z4 = {}
        for st, ings in ING.items():
            w = W[st][c["pos"]]
            num_ = den = 0.0
            for (ing, good), wi in zip(ings, w):
                if wi <= 0 or ing not in zs[c["id"]]:
                    continue
                z = zs[c["id"]][ing]
                num_ += wi * (z if good else -z); den += wi
            z4[st] = num_ / den if den > 0 else None
        av = [v for v in z4.values() if v is not None]
        zbar = sum(av) / len(av) if av else 0.0
        four = {st: (None if v is None else int(max(60, min(99, round(R + SCALE * (v - zbar)))))) for st, v in z4.items()}
        c["four"] = four
        per_year[c["year"]] += 1
        for st, v in four.items():
            if v is not None:
                cover[c["year"]][st] += 1
        if any(v is None for v in four.values()):
            missing_any += 1
    ingcov = {}
    for y in sorted(per_year):
        ys = [c for c in cards if c["year"] == y]
        ingcov[str(y)] = {LABEL[i].split("(")[0]: round(100 * sum(1 for c in ys if i in zs[c["id"]]) / len(ys)) for i in allings}
    cov = {str(y): {st: f"{cover[y][st]}/{per_year[y]}" for st in ING} for y in sorted(per_year)}
    data["meta"]["fourStats"] = {
        "version": "2.21.0",
        "groups": {"피지컬": ["fight(교전)", "press(압박)"], "뇌지컬": ["judge(판단)", "ops(운영)"]},
        "ingredients": {st: [LABEL[n] for n, _ in v] for st, v in ING.items()},
        "weights": W,
        "formula": "재료 z = 같은 시즌·포지션 카드 내 z-score × n/(n+8) (낮을수록 좋은 재료는 −z). 4대 z = 포지션 가중 평균(없는 재료는 빼고 가중치 재정규화). 4대 값 = clamp(fantasyRating + 8·(z − 카드의 4대 z 평균), 60, 99). 재료가 없으면 null('기록 없음').",
        "notInData": "솔로킬·용/전령/바론 관여는 LCK 2024–2026 Riot 경기 기록(LeagueLab live.sqlite, 읽기 전용)에만 있어 그 시즌에만 반영. 2012–2023은 선수별 값이 없어 제외(가중치 재정규화). 메카닉·반응속도 직접 기록 없음.",
        "coverage": cov,
        "ingredientCoveragePct": ingcov,
    }
    CARDS.write_text(json.dumps(data, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("coverage", json.dumps(cov, ensure_ascii=False))
    print("ingredients", json.dumps(ingcov, ensure_ascii=False))
    print("cards with any 기록 없음:", missing_any)
    for cid in ["chovy-2025", "keria-2025", "faker-2026", "zeus-2026", "gumayusi-2025", "canyon-2025", "faker-2013", "faker-2016", "peyz-2024"]:
        c = next((x for x in cards if x["id"] == cid), None)
        if c:
            fr = c["four"]; av = [v for v in fr.values() if v is not None]
            print(cid, c["fantasyRating"], fr, "avg", round(sum(av) / len(av), 1) if av else None)


if __name__ == "__main__":
    main()
