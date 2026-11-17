"""LOL Manager 정적 데이터 생성 (읽기 전용).
입력:
  - LeagueLab DB  /workspace/leaguelab-collector/data/live.sqlite (mode=ro)
  - LeagueLab 확정 지표 /workspace/leaguelab-metrics/outputs/lck2026-*.locked.json
  - 랭크 경기 cancellawerra-bot/lol-banpick-lab source 브랜치 data/matches.jsonl (읽기 전용 사본)
  - Data Dragon 16.22.1 champion.json (ko_KR, en_US), 밴픽 사이트 champs.json(챔피언 특성)
출력: public/data/{core,champs,ranked}.json
규칙: 지어낸 숫자 없음. 표본 수를 함께 저장. 30판 미만 랭크 상성/시너지는 저장하지 않음.
"""
import json, math, sqlite3, statistics, time, re, sys
from collections import defaultdict, Counter
from pathlib import Path

HERE = Path(__file__).resolve().parent
OUT = HERE.parent / 'public' / 'data'
DB = '/workspace/leaguelab-collector/data/live.sqlite'
MET = Path('/workspace/leaguelab-metrics/outputs')
RANKED = Path(sys.argv[1] if len(sys.argv) > 1 else '/workspace/lolmanager-research/banpick-source/data/matches.jsonl')
POS = ['TOP', 'JNG', 'MID', 'BOT', 'SUP']
RK_POS = {'T': 0, 'J': 1, 'M': 2, 'A': 3, 'S': 4}
MIN_RANKED = 30
SHRINK_K = 8          # 경험적 베이즈 보정: 포지션 평균 쪽으로 8경기만큼 당김
SMALL_PLAYER = 20     # 선수 2026 LCK 경기 수가 이보다 적으면 '표본 부족'

con = sqlite3.connect(f'file:{DB}?mode=ro', uri=True)
q = lambda s, a=(): con.execute(s, a).fetchall()

ko = json.load(open(HERE / 'ddragon_ko.json'))['data']
en = json.load(open(HERE / 'ddragon_en.json'))['data']
meta = json.load(open(HERE / 'champs_meta.json'))
norm = lambda s: re.sub(r'[^a-z0-9]', '', s.lower())
name2id = {}
for cid, v in en.items():
    name2id[norm(v['name'])] = cid
    name2id[norm(cid)] = cid
key2id = {int(v['key']): cid for cid, v in en.items()}

def cid_of(name):
    if not name:
        return None
    return name2id.get(norm(name))

# ---------- 팀 ----------
TEAM_INFO = {  # 약칭(경기 데이터의 Riot ID 접두어 기준), 한글 이름, 색상 칩(로고 대신 쓰는 단색, 게임 디자인 값)
    10: ('GEN', '젠지', '#C9A227'), 6: ('T1', 'T1', '#E2012D'), 8: ('HLE', '한화생명e스포츠', '#F37321'),
    4: ('DK', '디플러스 기아', '#1DB9A6'), 9: ('KT', 'kt 롤스터', '#D7263D'), 1: ('BFX', 'BNK 피어엑스', '#F2C230'),
    5: ('NS', '농심 레드포스', '#DE2027'), 3: ('DNS', 'DN 수퍼스', '#5B8DEF'), 11: ('BRO', '한진 브리온', '#2E7D4F'),
    12: ('KRX', '키움 DRX', '#4A6CF7'),
}
team_rows = {r[0]: r[1] for r in q('select id,name from teams')}

games = q('''select g.id,g.public_id,g.riot_match_id,g.blue_team_id,g.red_team_id,g.winner_side,g.played_at,g.patch,s.stage,s.id
             from games g join series s on s.id=g.series_id where s.tournament_id=1 order by g.played_at''')
assert len(games) == 502, len(games)
teams_used = sorted({g[3] for g in games} | {g[4] for g in games})
assert set(teams_used) == set(TEAM_INFO), teams_used  # CJ Entus/Samsung(기록 없음) 제외, BRION/DRX 는 이미 HANJIN BRION/Kiwoom DRX 로 병합된 id

payload = {r[0]: json.loads(r[1]) for r in q("select external_id,payload from raw_payloads where entity='match'")}
fc = json.load(open(MET / 'lck2026-full-compute.locked.json'))
fc_by = {g['rpgid']: g for g in fc['games']}
tier = json.load(open(MET / 'lck2026-champion-tier.locked.json'))
laning_team = json.load(open(MET / 'lck2026-team-laning.locked.json'))

# 역할 기준 확인용 로스터 (영문 원래 표기)
roster_full = {}
for tname, ign, role in q('''select tm.name,p.ign,r.role from rosters r join teams tm on tm.id=r.team_id join players p on p.id=r.player_id
                              where r.tournament_id=1'''):
    base = ign.split(' (')[0].strip()
    roster_full.setdefault(base.lower(), ign)

# ---------- 선수 경기별 지표 ----------
pg = defaultdict(list)   # player key -> list of per-game dicts
pinfo = {}
champ_pos = defaultdict(Counter)  # 프로 픽 포지션
side_w = Counter()
for gid, gpub, rid, blue, red, wside, played, patch, stage, sid in games:
    side_w[wside] += 1
    p = payload[rid]; f = fc_by[rid]
    lan = {x['participantId']: x for x in f['laning']}
    com = {x['participantId']: x for x in f['combat']}
    eco = {x['participantId']: x for x in f['economy']}
    vis = {x['participantId']: x for x in f['vision']}
    dur = p['gameDuration'] / 60
    for i, pp in enumerate(p['participants']):
        pid = pp['participantId']; slot = i % 5
        team = blue if pp['teamId'] == 100 else red
        nm = pp['riotIdGameName'].split(' ', 1)[1].strip() if ' ' in pp['riotIdGameName'] else pp['riotIdGameName']
        key = nm.lower()
        ch = cid_of(pp['championName']) or pp['championName']
        champ_pos[ch][slot] += 1
        L, C, E, V = lan[pid], com[pid], eco[pid], vis[pid]
        pg[key].append(dict(
            t=team, pos=slot, win=bool(pp['win']), ch=ch, at=played, dur=dur,
            gd=L['gdLane'] if L.get('computable') else None, csd=L['csdLane'] if L.get('computable') else None, xpd=L['xpdLane'] if L.get('computable') else None,
            k=C['kills'], d=C['deaths'], a=C['assists'], kp=C['kp'], dpm=C['dpm'], dsh=C['damageShare'],
            gpm=E['gpm'], cspm=E['cspm'], vspm=V['vspm'], wk=V['wardsKilled'] / dur,
        ))
        pinfo.setdefault(key, nm)

def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None

players = []
for key, rows in pg.items():
    last = max(rows, key=lambda r: r['at'])
    posc = Counter(r['pos'] for r in rows)
    pos = posc.most_common(1)[0][0]
    rows_pos = [r for r in rows if r['pos'] == pos]
    k = sum(r['k'] for r in rows_pos); d = sum(r['d'] for r in rows_pos); a = sum(r['a'] for r in rows_pos)
    champs = Counter(r['ch'] for r in rows_pos); cw = Counter(r['ch'] for r in rows_pos if r['win'])
    teams = Counter(r['t'] for r in rows)
    players.append(dict(
        key=key, name=pinfo[key], full=roster_full.get(key, pinfo[key]), team=last['t'], pos=pos,
        games=len(rows), gamesPos=len(rows_pos), wins=sum(r['win'] for r in rows),
        teamsPlayed={TEAM_INFO[t][0]: n for t, n in teams.items()}, lastAt=last['at'][:10],
        m=dict(gd=mean([r['gd'] for r in rows_pos]), csd=mean([r['csd'] for r in rows_pos]), xpd=mean([r['xpd'] for r in rows_pos]),
               kda=(k + a) / max(1, d), kp=mean([r['kp'] for r in rows_pos]), dpm=mean([r['dpm'] for r in rows_pos]),
               dsh=mean([r['dsh'] for r in rows_pos]), gpm=mean([r['gpm'] for r in rows_pos]), cspm=mean([r['cspm'] for r in rows_pos]),
               vspm=mean([r['vspm'] for r in rows_pos]), wk=mean([r['wk'] for r in rows_pos])),
        kdaRaw=[k, d, a],
        pool=[[c, n, cw[c]] for c, n in champs.most_common()],
    ))

# ---------- 능력치 (포지션 내 비교, 경험적 베이즈 보정 후 z 점수 → 백분위) ----------
GROUPS = {
    'lane': ['gd', 'csd', 'xpd'],
    'fight': ['kda', 'kp', 'dsh'],
    'farm': ['gpm', 'cspm'],
    'vision': ['vspm', 'wk'],
}
LOGM = {'kda'}
WEIGHTS = {  # 종합(OVR) 가중치: 포지션별 (게임 설계 값, 데이터 출처·방법 페이지에 공개)
    0: dict(lane=.35, fight=.30, farm=.20, vision=.05, pool=.10),
    1: dict(lane=.25, fight=.35, farm=.10, vision=.20, pool=.10),
    2: dict(lane=.30, fight=.30, farm=.25, vision=.05, pool=.10),
    3: dict(lane=.30, fight=.30, farm=.30, vision=.00, pool=.10),
    4: dict(lane=.20, fight=.35, farm=.00, vision=.35, pool=.10),
}
def val(p, m):
    v = p['m'][m]
    if v is None: return None
    return math.log(v + 0.5) if m in LOGM else v

for pos in range(5):
    grp = [p for p in players if p['pos'] == pos]
    for g, ms in list(GROUPS.items()) + [('pool', ['pool'])]:
        zs = {}
        for m in ms:
            if m == 'pool':
                for p in grp: p['m']['pool'] = len(p['pool'])
            vals = [(val(p, m), p['gamesPos']) for p in grp if val(p, m) is not None]
            tot = sum(n for _, n in vals)
            mu = sum(v * n for v, n in vals) / tot
            sd = math.sqrt(sum(n * (v - mu) ** 2 for v, n in vals) / tot) or 1
            for p in grp:
                v = val(p, m)
                if v is None: continue
                n = p['gamesPos']
                if m == 'pool':   # 챔피언 폭은 경기 수에 비례하므로 경기당 비율로 보정하지 않고 판수만 보정
                    shr = (n * v + SHRINK_K * mu) / (n + SHRINK_K)
                else:
                    shr = (n * v + SHRINK_K * mu) / (n + SHRINK_K)
                zs.setdefault(p['key'], []).append((shr - mu) / sd)
        for p in grp:
            z = sum(zs[p['key']]) / len(zs[p['key']]) if p['key'] in zs else 0.0
            p.setdefault('z', {})[g] = round(z, 3)
    for p in grp:
        w = WEIGHTS[pos]
        p['z']['ovr'] = round(sum(w[g] * p['z'][g] for g in w), 3)
    # 백분위: 같은 포지션 선수 중 이 값보다 낮은 비율 (0~100)
    for g in list(GROUPS) + ['pool', 'ovr']:
        zs = sorted(p['z'][g] for p in grp)
        for p in grp:
            below = sum(1 for z in zs if z < p['z'][g]); eq = sum(1 for z in zs if z == p['z'][g])
            p.setdefault('pct', {})[g] = round(100 * (below + 0.5 * (eq - 1)) / max(1, len(zs) - 1)) if len(zs) > 1 else 50
for p in players:
    p['small'] = p['games'] < SMALL_PLAYER
    for k2, v in list(p['m'].items()):
        if isinstance(v, float): p['m'][k2] = round(v, 3)

# 로스터: 마지막 경기 팀 기준. 팀마다 포지션별 경기 수 많은 선수를 주전으로.
team_players = defaultdict(list)
for p in players: team_players[p['team']].append(p)
teams = []
for tid in TEAM_INFO:
    ps = team_players[tid]
    starters = {}
    for pos in range(5):
        cand = sorted([p for p in ps if p['pos'] == pos], key=lambda p: (-p['games'], p['name']))
        if cand: starters[pos] = cand[0]['key']
    assert len(starters) == 5, (tid, starters)
    teams.append(dict(id=tid, short=TEAM_INFO[tid][0], name=team_rows[tid], ko=TEAM_INFO[tid][1], color=TEAM_INFO[tid][2],
                      starters=[starters[i] for i in range(5)], players=sorted(p['key'] for p in ps)))

# 실제 2026 Rounds 1-2 시리즈 성적 (참고용)
real = defaultdict(lambda: [0, 0, 0, 0])
for a, b, sa, sb in q("select team_a_id,team_b_id,score_a,score_b from series where tournament_id=1 and stage='Rounds 1-2'"):
    wa = sa > sb
    real[a][0 if wa else 1] += 1; real[b][1 if wa else 0] += 1
    real[a][2] += sa; real[a][3] += sb; real[b][2] += sb; real[b][3] += sa
for t in teams: t['real'] = real[t['id']]
gwl = defaultdict(lambda: [0, 0])  # 2026 LCK 전체 경기(502) 팀별 세트 승패
for gid, gpub, rid, blue, red, wside, played, patch, stage, sid in games:
    gwl[blue][0 if wside == 'blue' else 1] += 1; gwl[red][0 if wside == 'red' else 1] += 1
for t in teams: t['gw'], t['gl'] = gwl[t['id']]

# ---------- 팀 밴픽 성향 (2026 LCK 전체 경기 밴픽) ----------
drafts = defaultdict(list)
for gid, side, action, oi, cname in q('''select d.game_id,d.side,d.action,d.order_index,d.champion_name from drafts d
                                         join games g on g.id=d.game_id join series s on s.id=g.series_id where s.tournament_id=1'''):
    drafts[gid].append((side, action, oi, cname))
style = {}
unmapped = Counter()
for tid in TEAM_INFO:
    style[tid] = dict(games=0, bans=Counter(), p1bans=Counter(), picks=Counter(), firstPos=Counter(), p1picks=Counter())
for gid, gpub, rid, blue, red, wside, played, patch, stage, sid in games:
    p = payload[rid]
    slot_of = {}
    for i, pp in enumerate(p['participants']):
        slot_of[(pp['teamId'], pp['championName'])] = i % 5
    for side, tid, tteam in (('blue', blue, 100), ('red', red, 200)):
        st = style[tid]; st['games'] += 1
        for s2, act, oi, cname in drafts[gid]:
            if s2 != side: continue
            cid = cid_of(cname)
            if not cid: unmapped[cname] += 1; continue
            if act == 'ban':
                st['bans'][cid] += 1
                if oi <= 3: st['p1bans'][cid] += 1
            else:
                st['picks'][cid] += 1
                if oi <= 3: st['p1picks'][cid] += 1
                if oi == 1 and (tteam, cid) in slot_of: st['firstPos'][slot_of[(tteam, cid)]] += 1
assert not unmapped, unmapped
styles = {}
for tid, st in style.items():
    styles[TEAM_INFO[tid][0]] = dict(games=st['games'], bans=st['bans'].most_common(40), p1bans=st['p1bans'].most_common(20),
                                     picks=st['picks'].most_common(60), p1picks=st['p1picks'].most_common(20),
                                     firstPos=[st['firstPos'][i] for i in range(5)])

# ---------- 팀 라인전 (확정본) ----------
lan_team = {}
for k2, v in laning_team['teams'].items():
    lan_team[TEAM_INFO[int(k2)][0]] = dict(games=v['games'], gd=v['teamGdLane'], csd=v['teamCsdLane'], xpd=v['teamXpdLane'])

# ---------- 챔피언 ----------
tier_by = {}
for it in tier['items']:
    cid = cid_of(it['champion'])
    assert cid, it['champion']
    tier_by[cid] = it
champs = []
for cid in sorted(ko, key=lambda c: ko[c]['name']):
    m = meta.get(cid, {})
    t = tier_by.get(cid)
    champs.append(dict(
        id=cid, ko=ko[cid]['name'], tags=m.get('tags', ''), pos=m.get('pos', []), dmg=m.get('dmg', 'P'), ranged=bool(m.get('ranged')),
        d=m.get('d', 2), u=m.get('u', 2), c=m.get('c', 2), mo=m.get('m', 2), ut=m.get('ut', 1), grp=m.get('groups', []),
        pro=dict(p=t['picks'], b=t['bans'], w=t['wins'], eb=round(t['ebWR'], 4) if t['ebWR'] is not None else None, pr=round(t['presence'], 4) if t['presence'] is not None else None, tier=t.get('tier'), ok=t['sampleOk']) if t else None,
        proPos=[champ_pos[cid][i] for i in range(5)],
    ))

# ---------- 랭크 상성/시너지 ----------
rows = list({r['id']: r for r in (json.loads(x) for x in open(RANKED, encoding='utf-8'))}.values())
lane_n = defaultdict(lambda: [0, 0]); mu_ = defaultdict(lambda: [0, 0]); sy = defaultdict(lambda: [0, 0])
tiers = Counter(r['t'] for r in rows); vers = Counter(r['v'] for r in rows)
for r in rows:
    side = defaultdict(dict); team = defaultdict(list)
    for pp in r['p']:
        tm, ps, ch, win = pp[0], RK_POS[pp[1]], cid_of(pp[2]) or pp[2], pp[3]
        side[ps][tm] = (ch, win); team[tm].append((ps, ch, win))
        lane_n[(ps, ch)][0] += win; lane_n[(ps, ch)][1] += 1
    for ps, t in side.items():
        if 100 in t and 200 in t:
            (a, wa), (b, wb) = t[100], t[200]
            key = (ps, a, b) if a < b else (ps, b, a)
            wfirst = wa if a < b else wb
            mu_[key][0] += wfirst; mu_[key][1] += 1
    for tm, lst in team.items():
        lst.sort()
        for i in range(len(lst)):
            for j in range(i + 1, len(lst)):
                (pa, ca, w), (pb, cb, _) = lst[i], lst[j]
                sy[(pa, ca, pb, cb)][0] += w; sy[(pa, ca, pb, cb)][1] += 1
ranked = dict(
    meta=dict(games=len(rows), tiers=dict(tiers), versions=dict(vers), min=MIN_RANKED, source='Riot Games API MATCH-V5, KR 솔로 랭크 (lol-banpick-lab source 브랜치 data/matches.jsonl)'),
    lane={f'{ps}|{ch}': [w, n] for (ps, ch), (w, n) in lane_n.items() if n >= MIN_RANKED},
    mu={f'{ps}|{a}|{b}': [w, n] for (ps, a, b), (w, n) in mu_.items() if n >= MIN_RANKED},
    syn={f'{pa}|{ca}|{pb}|{cb}': [w, n] for (pa, ca, pb, cb), (w, n) in sy.items() if n >= MIN_RANKED},
)

core = dict(
    meta=dict(builtAt=time.strftime('%Y-%m-%dT%H:%M:%S+09:00'), season='LCK 2026', games=len(games), players=len(players), rankedGames=len(rows), rankedMin=MIN_RANKED,
              blueWins=side_w['blue'], redWins=side_w['red'], shrinkK=SHRINK_K, small=SMALL_PLAYER, weights=WEIGHTS,
              groups=GROUPS, tierPolicy=tier['policy'].get('ebFormula'), laningSource=laning_team['version'],
              fullCompute=fc['version'], fullComputeLocked=fc.get('lockedAtKst'), period=[games[0][6][:10], games[-1][6][:10]],
              rounds12=[r[0][:10] for r in q("select min(started_at) from series where tournament_id=1 and stage='Rounds 1-2' group by round order by 1")]),
    teams=teams,
    players=[{k2: v for k2, v in p.items() if k2 not in ('lastAt',)} for p in players],
    styles=styles, laning=lan_team,
)
OUT.mkdir(parents=True, exist_ok=True)
for name, obj in (('core', core), ('champs', champs), ('ranked', ranked)):
    path = OUT / f'{name}.json'
    path.write_text(json.dumps(obj, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
    print(name, path.stat().st_size // 1024, 'KB')
print('players', len(players), 'teams', len(teams), 'ranked games', len(rows), 'mu', len(ranked['mu']), 'syn', len(ranked['syn']), 'lane', len(ranked['lane']))
print('blue/red', side_w)
