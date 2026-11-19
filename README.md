# LOL Manager

감독 홈 개편(v2.12.0): 다음 경기와 현재 선발5명, 실제로 확인할 일을 중심으로 PC·휴대폰 화면을 정리했습니다. 경기·경제 규칙은 그대로입니다. 상세는 [HOME_DESIGN.md](docs/HOME_DESIGN.md).

구단 연표(v2.11.0): 프랜차이즈 구단 화면에서 연도별 성적·당시 선수단·우리 경기와 주요 사건을 보관합니다. 시즌/선수 갱신 후에도 유지되며 이전 저장의 없는 과거는 기록 없음으로 둡니다. 자세한 규칙은 [CLUB_TIMELINE.md](docs/CLUB_TIMELINE.md)를 읽으세요.

실제 LCK 시즌 카드(2012–2026)와 2026 기록으로 움직이는 무료 비상업 e스포츠 구단 운영 게임 (브라우저, 한국어). v2부터는 프랜차이즈 스토리(2018 2부→2027 월즈)가 기본 모드입니다. 설계는 docs/STORY_MODE.md. 감독 이름은 계약서에 직접 씁니다.

- 플레이: https://cancellawerra-bot.github.io/lol-manager/
- 운영: 홍승표 (신구대학교 e스포츠과) · 교육용 팬 프로젝트
- 이어서 작업할 때는 [docs/HANDOFF.md](docs/HANDOFF.md)의 최신 변경 기록을 가장 먼저 읽습니다.

프랜차이즈 정규 시즌에는 주간 FA·구단 이적 협상·도착한 매각 제안을 처리할 수 있습니다. 이적료와 남은 연봉, 다음 해 계약·가입금 유보, 선수 동의와 명단을 지키며 성장·피로를 유지합니다. 모든 금액과 이적 기간은 게임 설정입니다. [시즌 중 이적 설계](docs/IN_SEASON_TRANSFERS.md).

홈과 밴픽 후 미팅에서 운영·지원 작전을 정하면 실제 경기 단계에 반영됩니다. 초반/후반과 지원 자원의 대가가 있으며, 실제 목표 달성·판정별 보정·관측 결과를 저장해 복기합니다. [전술 설계·기록 해석](docs/TACTICS.md).

선수단에서 주전·로테이션·육성 출전을 약속하고 실제 정규 시리즈 첫 선발로 평가합니다. 수석코치가 보유 선수의 피로·기량·약속 기한을 비교해 로테이션하며 세트별 경기 피로·출전·약속 결과를 저장합니다. [출전 약속 설계](docs/PLAYING_TIME.md).

창단·시즌 중·트라이아웃·FA에서 현재까지 확인된 기록과 예산으로 스카우팅 추천을 봅니다. 보유 벤치·연봉/이적료·기존 계약/입찰/가입금 유보·표본 한계를 비교하고 기존 협상 폼으로 이어갑니다. 관심 선수 20명은 개인별로 저장합니다. [스카우팅 설계](docs/SCOUTING.md).

## 구성
- `src/` Vite + React + TypeScript. 해시 라우팅, 화면별 코드 분할.
  - `pages/Setup.tsx` 새 게임: 창단 / 실제 로스터 2026 / 판타지 드래프트, 감독 계약서, 목표·스폰서
  - `pages/Market.tsx` / `pages/InSeasonMarket.tsx` 시즌 카드·프랜차이즈 주간 이적 시장
  - `game/inSeason.ts` 시즌 중 협상·정산·자동 보강, `game/negotiation.ts` 공통 선수 선택
  - `game/draft.ts` 밴픽 엔진(2026 첫 번째 선택권, 20단계 순서, 하드 피어리스, 팀 성향 AI)
  - `game/sim.ts` 경기 시뮬과 요인별 설명
  - `game/season.ts` 일정(정규 18라운드 Bo3 + 6강 플레이오프 Bo5), 순위, 구단주 평가
  - `game/cards.ts` 시즌 카드 → 선수, 연봉·예산, 창단 구단 주입
  - `store.ts` localStorage 자동 저장(슬롯 3개), JSON 내보내기/불러오기 (세이브 버전 2)
- `public/data/core.json` 등 (`tools/build_data.py`가 생성, 손으로 고치지 말 것)
- `public/data/cards.json` 시즌 카드 1,011장 (`tools/build_cards.py`, 연구 CSV는 읽기만)
- `public/champ/icon` Riot Data Dragon 16.22.1 챔피언 아이콘

## 데이터 갱신
```
python3 tools/build_data.py [랭크 matches.jsonl 경로]
npm run build
```
입력: LeagueLab DB(읽기 전용), LeagueLab 확정 지표(`lck2026-*.locked.json`), lol-banpick-lab `source` 브랜치 `data/matches.jsonl`.
계산 방법은 게임 안 "데이터 출처·방법" 페이지에 있습니다.

## 배포
저장소 루트에서 **`tools/deploy.sh`**로 빌드하고 `gh-pages`에 배포합니다(GitHub Pages). 먼저 HANDOFF의 기능 검사·같은 40시드 밸런스·PC 1280/휴대폰 390 실제 화면과 콘솔 오류 0 기준을 확인합니다. 공개 사이트도 같은 방식으로 검수한 뒤 변경 기록을 남깁니다.

## 고지
LOL Manager isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games, and all associated properties are trademarks or registered trademarks of Riot Games, Inc.
LOL Manager was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project.
팀 로고와 선수 사진은 쓰지 않습니다. LCK 및 각 구단과 관련이 없습니다.
