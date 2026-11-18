# 훈련용 공개 생년 자료 · 2026-11-18 확인

v2.6.1에서 전체 게임 명단을 조사했습니다. 시즌 카드 **392개 선수 식별자 중 386개**, 카드 없이 2026 코어에만 있는 **5개 식별자 전부**를 확인했습니다. 전체 **391/397개 식별자**, 실제 정규 프로필 기준 **372/378명**에 전체 생년월일이 있습니다. 과거 활동명별 식별자가 있으므로 식별자 수를 실제 사람 수로 읽지 마세요. 이 작업은 생년 연결만 보강하며 기존 선수/시즌 카드 식별자를 합치지 않습니다.

## 수집·대조 기준

- [Leaguepedia 공개 Cargo API](https://lol.fandom.com/api.php?action=help&modules=cargoquery)에서 현재 닉네임·정규 프로필·본명·생년월일을 조회했습니다. 날짜 정밀도가 일 단위인 값만 채택하고 실제 달력 날짜를 검사했습니다. 홈페이지 일부의 직접 열람 제한과 별개로 공개 API는 정상 HTTP 200 응답입니다. 로그인·접근 제한 우회는 하지 않았습니다.
- 닉네임 변경은 PlayerRedirects와 실제 프로필의 별칭으로 확인했습니다. 닉네임이 같은 선수는 본명·활동 연도·소속·포지션으로 구분했습니다. Calix는 선현빈(2007), Smash는 신금재(2006), Clear는 송현민(2002)입니다. 과거 원딜 Clear(김재열)와 섞지 않습니다.
- Promise(천민기)는 Leaguepedia에 생일이 없지만 [2012년 나진 구단 명단 발표 기사](https://www.inven.co.kr/webzine/news/?news=79465)에서 1992.1.16을 확인했습니다. 나이 숫자만으로 날짜를 역산하지 않습니다.
- Homme는 과거 팬 게시물의 12월 2일과 다르지만 현재 Leaguepedia 원문/API 및 Liquipedia에 명시된 **1985-01-01**을 채택했습니다. Hipo는 일부 과거 검색 표의 값 대신 현재 정규 프로필 원문/API와 DPM에 일치하는 **1998-02-02**를 사용합니다. 1월 1일을 임의 기본값으로 만든 것이 아닙니다.
- 이전 11명의 출처와 날짜는 보존했습니다. 전체 원본 응답과 신원 대조 자료는 저장소 밖 인계 보관본에, 게임에 연결한 값·누락 사유·조회 URL·확인일은 [검증 명세 JSON](player_birthdates_verified.json)에 보관합니다.
- Leaguepedia 공개 자료는 [CC BY-SA 3.0](https://creativecommons.org/licenses/by-sa/3.0/) 고지를 따릅니다. 이름과 생년 사실을 기존 게임 ID에 대응시켰으며 선수 사진·구단 로고는 복사하지 않았습니다.

## 전체 생일을 확인하지 못한 6명

| 선수 | 본명 | 처리·근거 |
|---|---|---|
| ashart | Kim Sung-hoon | **생년 정보 없음·중립 1배**. 정규 프로필과 추가 검색에서 전체 생년월일을 확인하지 못함. [정규 프로필](https://lol.fandom.com/wiki/Ashart) |
| Clear (Kim Jae-yeol) | Kim Jae-yeol | **생년 정보 없음·중립 1배**. 정규 프로필과 추가 검색에서 전체 생년월일을 확인하지 못함. [정규 프로필](https://lol.fandom.com/wiki/Clear_(Kim_Jae-yeol)) |
| nolja | Lee Hyun-jin | **생년 정보 없음·중립 1배**. 정규 프로필에는 1987년만 있고 팬 게시물은 1985-10-31로 달라 전체 생년월일을 채택하지 않음. [정규 프로필](https://lol.fandom.com/wiki/Nolja) |
| NonameD | Jeon Ju-hwan | **생년 정보 없음·중립 1배**. 정규 프로필과 추가 검색에서 전체 생년월일을 확인하지 못함. [정규 프로필](https://lol.fandom.com/wiki/NonameD) |
| Raccoon (Hwang Won-jun) | Hwang Won-jun | **생년 정보 없음·중립 1배**. 정규 프로필과 추가 검색에서 전체 생년월일을 확인하지 못함. [정규 프로필](https://lol.fandom.com/wiki/Raccoon_(Hwang_Won-jun)) |
| Vin (Shin Min-jae) | Shin Min-jae | **생년 정보 없음·중립 1배**. 정규 프로필과 추가 검색에서 전체 생년월일을 확인하지 못함. [정규 프로필](https://lol.fandom.com/wiki/Vin_(Shin_Min-jae)) |

이 목록은 임의 생년·1월 1일·0세로 채우지 않습니다. 기존 게임 진행도의 XP·피로는 계속 저장되며, 나이 효율만 중립입니다. 추가로 신뢰할 수 있는 전체 날짜를 확인하면 출처를 붙여 보강할 수 있습니다.

## 시즌 카드 선수의 확인 생년월일

| 선수 ID | 본명 | 생년월일 | 출처 |
|---|---|---|---|
| 5kid | Park Jeong-hyeon | 1999-11-28 | [프로필·기사](https://lol.fandom.com/wiki/5kid) |
| a Lilac | Jeon Ho-jin | 1992-02-17 | [프로필·기사](https://lol.fandom.com/wiki/Lilac_(Jeon_Ho-jin)) |
| a Wolf | Lee Jae-wan | 1996-09-09 | [프로필·기사](https://lol.fandom.com/wiki/Wolf_(Lee_Jae-wan)) |
| Ace | Kim Ji-hoon | 1995-04-24 | [프로필·기사](https://lol.fandom.com/wiki/Ace_(Kim_Ji-hoon)) |
| Acorn | Choi Cheon-ju | 1990-07-13 | [프로필·기사](https://lol.fandom.com/wiki/Acorn) |
| ActScene | Yeon Hyeong-mo | 1991-12-12 | [프로필·기사](https://lol.fandom.com/wiki/Sin_(Yeon_Hyeong-mo)) |
| ADD | Kang Geon-mo | 1998-10-17 | [프로필·기사](https://lol.fandom.com/wiki/ADD) |
| Aiming | Kim Ha-ram | 2000-07-20 | [프로필·기사](https://lol.fandom.com/wiki/Aiming) |
| Ambition | Kang Chan-yong | 1992-10-27 | [프로필·기사](https://lol.fandom.com/wiki/Ambition) |
| Andil | Moon Gwan-bin | 2002-10-05 | [프로필·기사](https://lol.fandom.com/wiki/Andil) |
| Apple | Jeong Cheol-woo | 1993-09-23 | [프로필·기사](https://lol.fandom.com/wiki/Apple) |
| Ares | Kim Min-kwon | 1995-12-11 | [프로필·기사](https://lol.fandom.com/wiki/Ares_(Kim_Min-kwon)) |
| Aria | Lee Ga-eul | 2000-10-14 | [프로필·기사](https://lol.fandom.com/wiki/Aria_(Lee_Ga-eul)) |
| Arrow | Noh Dong-hyeon | 1994-07-20 | [프로필·기사](https://lol.fandom.com/wiki/Arrow) |
| Bang | Bae Jun-sik | 1996-05-18 | [프로필·기사](https://lol.fandom.com/wiki/Bang) |
| BAO | Jeong Hyeon-woo | 2001-09-20 | [프로필·기사](https://lol.fandom.com/wiki/BAO_(Jeong_Hyeon-woo)) |
| Bay | Park Jun-byeong | 2002-02-19 | [프로필·기사](https://lol.fandom.com/wiki/Bay) |
| BBuing | Lee In-yong | 1995-05-31 | [프로필·기사](https://lol.fandom.com/wiki/BBuing) |
| Bdd | Gwak Bo-seong | 1999-03-01 | [프로필·기사](https://liquipedia.net/leagueoflegends/Bdd) |
| Beelzehan | Cho Jae-hwan | 1996-09-21 | [프로필·기사](https://lol.fandom.com/wiki/H0R0) |
| Ben | Nam Dong-hyun | 1995-04-24 | [프로필·기사](https://lol.fandom.com/wiki/Ben) |
| bengi | Bae Seong-woong | 1993-11-21 | [프로필·기사](https://lol.fandom.com/wiki/Bengi) |
| Berserker | Kim Min-cheol | 2003-05-25 | [프로필·기사](https://lol.fandom.com/wiki/Berserker_(Kim_Min-cheol)) |
| BeryL | Cho Geon-hee | 1997-04-01 | [프로필·기사](https://lol.fandom.com/wiki/BeryL) |
| BetKyo | Lee Seung-min | 1996-02-13 | [프로필·기사](https://lol.fandom.com/wiki/BetKyo) |
| Beyond | Kim Kyu-seok | 1997-08-18 | [프로필·기사](https://lol.fandom.com/wiki/Beyond_(Kim_Kyu-seok)) |
| Bible | Yoon Seol | 1999-11-24 | [프로필·기사](https://lol.fandom.com/wiki/Bible) |
| Bigfatlp | Michael Tang | 1990-06-06 | [프로필·기사](https://lol.fandom.com/wiki/Bigfatlp) |
| Blank | Kang Sun-gu | 1998-04-30 | [프로필·기사](https://lol.fandom.com/wiki/Blank_(Kang_Sun-gu)) |
| Bless | Choi Hyeon-woong | 1996-10-23 | [프로필·기사](https://lol.fandom.com/wiki/Bless_(Choi_Hyeon-woong)) |
| BlisS | Park Jong-won | 1994-02-03 | [프로필·기사](https://lol.fandom.com/wiki/BlisS) |
| Blossom | Park Beom-chan | 1999-10-12 | [프로필·기사](https://lol.fandom.com/wiki/Blossom_(Park_Beom-chan)) |
| bon0 | Kim Gi-beom | 1995-02-27 | [프로필·기사](https://lol.fandom.com/wiki/Bon0) |
| Bubbling | Park Jun-hyeong | 1993-04-13 | [프로필·기사](https://lol.fandom.com/wiki/Bubbling) |
| Bull | Song Seon-gyu | 2003-05-16 | [프로필·기사](https://lol.fandom.com/wiki/Bull) |
| BuLLDoG | Lee Tae-young | 2005-04-15 | [프로필·기사](https://lol.fandom.com/wiki/BuLLDoG_(Lee_Tae-young)) |
| Burdol | Noh Tae-yoon | 2003-12-25 | [프로필·기사](https://lol.fandom.com/wiki/Burdol) |
| CaD | Cho Seong-yong | 2002-02-20 | [프로필·기사](https://lol.fandom.com/wiki/CaD) |
| Cain | Jang Nu-ri | 1987-02-06 | [프로필·기사](https://lol.fandom.com/wiki/Cain) |
| Calix | Syun Hyun-bin | 2007-03-22 | [프로필·기사](https://lol.fandom.com/wiki/Calix_(Syun_Hyun-bin)) |
| Callme | Oh Ji-hoon | 2003-05-30 | [프로필·기사](https://lol.fandom.com/wiki/Callme) |
| Candy | Kim Seung-ju | 1996-01-21 | [프로필·기사](https://lol.fandom.com/wiki/Candy_(Kim_Seung-ju)) |
| Canna | Kim Chang-dong | 2000-02-11 | [프로필·기사](https://lol.fandom.com/wiki/Canna) |
| Canyon | Kim Geon-bu | 2001-06-18 | [프로필·기사](https://liquipedia.net/leagueoflegends/Canyon) |
| CaptainJack | Kang Hyung-woo | 1993-01-04 | [프로필·기사](https://lol.fandom.com/wiki/Cpt_Jack) |
| Career | Oh Hyeong-seok | 2004-08-29 | [프로필·기사](https://lol.fandom.com/wiki/Career) |
| Casting | Shin Min-je | 2003-10-30 | [프로필·기사](https://lol.fandom.com/wiki/Casting) |
| Catch | Yun Sang-ho | 1997-04-03 | [프로필·기사](https://lol.fandom.com/wiki/Catch_(Yun_Sang-ho)) |
| Cepted | Park Wi-rim | 1997-08-26 | [프로필·기사](https://lol.fandom.com/wiki/Cepted) |
| Chaser | Lee Sang-hyun | 1995-08-01 | [프로필·기사](https://lol.fandom.com/wiki/Chaser) |
| Chauster | Steve Chau | 1989-02-13 | [프로필·기사](https://lol.fandom.com/wiki/Chauster) |
| Chei | Choi Sun-ho | 1996-06-30 | [프로필·기사](https://lol.fandom.com/wiki/Chei) |
| CheonGo | Choi Hyeon-woo | 1999-03-10 | [프로필·기사](https://lol.fandom.com/wiki/CheonGo) |
| Cheoni | Jo Seung-mo | 2001-02-02 | [프로필·기사](https://lol.fandom.com/wiki/Cheoni) |
| Cheonju | Choi Cheon-ju | 1990-07-13 | [프로필·기사](https://lol.fandom.com/wiki/Acorn) |
| Chovy | Jeong Ji-hoon | 2001-03-03 | [프로필·기사](https://liquipedia.net/leagueoflegends/Chovy) |
| ChuNyang | Yi Gwan-hyung | 1988-12-13 | [프로필·기사](https://lol.fandom.com/wiki/Heart) |
| Clear | Song Hyeon-min | 2002-12-19 | [프로필·기사](https://lol.fandom.com/wiki/Clear_(Song_Hyeon-min)) |
| Clid | Kim Tae-min | 1999-07-07 | [프로필·기사](https://lol.fandom.com/wiki/Clid) |
| CloudTemplar | Lee Hyun-woo | 1988-11-09 | [프로필·기사](https://lol.fandom.com/wiki/CloudTemplar) |
| Clozer | Lee Ju-hyeon | 2003-07-27 | [프로필·기사](https://lol.fandom.com/wiki/Clozer) |
| Coco | Shin Jin-yeong | 1994-03-14 | [프로필·기사](https://lol.fandom.com/wiki/Coco) |
| CoreJJ | Jo Yong-in | 1994-06-22 | [프로필·기사](https://lol.fandom.com/wiki/CoreJJ) |
| Cornsalad | Lee Sang-jung | 1989-02-07 | [프로필·기사](https://lol.fandom.com/wiki/Cornsalad) |
| Cover | Kim Joo-eon | 1999-05-29 | [프로필·기사](https://lol.fandom.com/wiki/Cover) |
| Cpt Jack | Kang Hyung-woo | 1993-01-04 | [프로필·기사](https://lol.fandom.com/wiki/Cpt_Jack) |
| Crash | Lee Dong-woo | 1997-01-05 | [프로필·기사](https://lol.fandom.com/wiki/Crash) |
| Crazy | Kim Jae-hee | 1996-09-20 | [프로필·기사](https://lol.fandom.com/wiki/Crazy_(Kim_Jae-hee)) |
| Croco | Kim Dong-beom | 2000-02-23 | [프로필·기사](https://lol.fandom.com/wiki/Croco) |
| Crown | Lee Min-ho | 1995-02-28 | [프로필·기사](https://lol.fandom.com/wiki/Crown) |
| Crush | Kim Jun-seo | 1998-01-03 | [프로필·기사](https://lol.fandom.com/wiki/Crush) |
| CuVee | Lee Seong-jin | 1996-09-27 | [프로필·기사](https://lol.fandom.com/wiki/CuVee) |
| Cuzz | Moon Woo-chan | 1999-10-30 | [프로필·기사](https://lol.fandom.com/wiki/Cuzz) |
| dade | Bae Eo-jin | 1994-11-08 | [프로필·기사](https://lol.fandom.com/wiki/Dade) |
| DanDy | Choi In-kyu | 1994-01-03 | [프로필·기사](https://lol.fandom.com/wiki/DanDy) |
| DayDream | Kang Kyung-min | 1995-06-19 | [프로필·기사](https://lol.fandom.com/wiki/DayDream) |
| Daystar | Yoo Ji-myeong | 2003-09-23 | [프로필·기사](https://lol.fandom.com/wiki/Daystar) |
| DDoiV | Bang Moon-yeong | 2003-10-21 | [프로필·기사](https://lol.fandom.com/wiki/DDoiV) |
| Deft | Kim Hyuk-kyu | 1996-10-23 | [프로필·기사](https://www.guinnessworldrecords.com/world-records/729977-oldest-player-to-win-the-league-of-legends-world-championship) |
| Delight | Yoo Hwan-joong | 2002-09-12 | [프로필·기사](https://lol.fandom.com/wiki/Delight) |
| deokdam | Seo Dae-gil | 2000-02-25 | [프로필·기사](https://lol.fandom.com/wiki/Deokdam) |
| DeuL | Kim Deul | 1994-09-25 | [프로필·기사](https://lol.fandom.com/wiki/DeuL) |
| Diable | Nam Dae-geun | 2007-10-17 | [프로필·기사](https://lol.fandom.com/wiki/Diable) |
| DnDn | Park Geun-woo | 2003-05-18 | [프로필·기사](https://lol.fandom.com/wiki/DnDn) |
| Doran | Choi Hyeon-jun | 2000-07-22 | [프로필·기사](https://lol.fandom.com/wiki/Doran_(Choi_Hyeon-jun)) |
| Doublelift | Yiliang&nbsp;"Peter" Peng | 1993-07-19 | [프로필·기사](https://lol.fandom.com/wiki/Doublelift) |
| Dove | Kim Jae-yeon | 1998-07-25 | [프로필·기사](https://lol.fandom.com/wiki/Dove) |
| Dread | Lee Jin-hyeok | 2000-06-07 | [프로필·기사](https://lol.fandom.com/wiki/Dread_(Lee_Jin-hyeok)) |
| DuDu | Lee Dong-ju | 2001-03-08 | [프로필·기사](https://lol.fandom.com/wiki/DuDu_(Lee_Dong-ju)) |
| Duke | Lee Ho-seong | 1994-12-19 | [프로필·기사](https://lol.fandom.com/wiki/Duke_(Lee_Ho-seong)) |
| Duke (Lee Ho-seong) | Lee Ho-seong | 1994-12-19 | [프로필·기사](https://lol.fandom.com/wiki/Duke_(Lee_Ho-seong)) |
| Duro | Joo Min-kyu | 2002-02-04 | [프로필·기사](https://lol.fandom.com/wiki/Duro) |
| Easyhoon | Lee Ji-hoon | 1992-11-23 | [프로필·기사](https://lol.fandom.com/wiki/Easyhoon) |
| Edge | Lee Ho-sung | 1997-12-03 | [프로필·기사](https://lol.fandom.com/wiki/Edge) |
| Effort | Lee Sang-ho | 2000-11-23 | [프로필·기사](https://lol.fandom.com/wiki/Effort) |
| Ella | Kwak Na-hoon | 1995-02-05 | [프로필·기사](https://lol.fandom.com/wiki/Ella) |
| Ellim | Choi El-lim | 2000-05-25 | [프로필·기사](https://lol.fandom.com/wiki/Ellim) |
| Emperor (Kim Jin-hyun) | Kim Jin-hyun | 1993-06-07 | [프로필·기사](https://lol.fandom.com/wiki/Emperor_(Kim_Jin-hyun)) |
| Envyy | Lee Myeong-joon | 2000-04-07 | [프로필·기사](https://lol.fandom.com/wiki/Envyy) |
| Eve | Seo Jun-cheol | 1997-05-08 | [프로필·기사](https://lol.fandom.com/wiki/Eve) |
| Execute | Lee Jeong-hoon | 2000-02-22 | [프로필·기사](https://lol.fandom.com/wiki/Execute) |
| Expession | Koo Bon-taek | 1992-09-16 | [프로필·기사](https://lol.fandom.com/wiki/Expession) |
| Faker | Lee Sang-hyeok | 1996-05-07 | [프로필·기사](https://www.guinnessworldrecords.com/world-records/729977-oldest-player-to-win-the-league-of-legends-world-championship) |
| FantasyStar (Bok Han-gyu) | Bok Han-gyu | 1992-01-30 | [프로필·기사](https://lol.fandom.com/wiki/Reapered) |
| FATE | Yoo Su-hyeok | 2000-08-22 | [프로필·기사](https://lol.fandom.com/wiki/FATE_(Yoo_Su-hyeok)) |
| FenRir | Park Kang-jun | 2006-06-24 | [프로필·기사](https://lol.fandom.com/wiki/FenRir_(Park_Kang-jun)) |
| FIESTA | An Hyeon-seo | 2003-05-04 | [프로필·기사](https://lol.fandom.com/wiki/FIESTA_(An_Hyeon-seo)) |
| Fisher | Lee Jeong-tae | 2004-07-05 | [프로필·기사](https://lol.fandom.com/wiki/Fisher_(Lee_Jeong-tae)) |
| Fixer | Jeong Jae-woo | 1995-04-12 | [프로필·기사](https://lol.fandom.com/wiki/Fixer) |
| FLahm | Kim Joo-ho | 1993-02-03 | [프로필·기사](https://lol.fandom.com/wiki/FLahm) |
| Flame | Lee Ho-jong | 1992-08-13 | [프로필·기사](https://lol.fandom.com/wiki/Flame) |
| Flawless | Sung Yeon-jun | 1998-07-26 | [프로필·기사](https://lol.fandom.com/wiki/Flawless) |
| Fly | Song Yong-jun | 1996-02-25 | [프로필·기사](https://lol.fandom.com/wiki/Fly_(Song_Yong-jun)) |
| Frog | Lee Min-hoi | 2005-06-30 | [프로필·기사](https://lol.fandom.com/wiki/Frog_(Lee_Min-hoi)) |
| Froggen | Henrik Hansen | 1994-02-21 | [프로필·기사](https://lol.fandom.com/wiki/Froggen) |
| Frozen | Kim Tae-il | 1994-11-04 | [프로필·기사](https://lol.fandom.com/wiki/Frozen_(Kim_Tae-il)) |
| Fury | Lee Jin-yong | 1995-11-11 | [프로필·기사](https://lol.fandom.com/wiki/Fury_(Lee_Jin-yong)) |
| Gango | Byun Se-hoon | 1997-05-16 | [프로필·기사](https://lol.fandom.com/wiki/Gango) |
| Ganked by mom | Lee Chang-seok | 1994-06-23 | [프로필·기사](https://lol.fandom.com/wiki/GBM) |
| GBM | Lee Chang-seok | 1994-06-23 | [프로필·기사](https://lol.fandom.com/wiki/GBM) |
| Ggoong | Yu Byeong-jun | 1993-06-26 | [프로필·기사](https://lol.fandom.com/wiki/Ggoong) |
| Ghost | Jang Yong-jun | 1999-03-18 | [프로필·기사](https://lol.fandom.com/wiki/Ghost_(Jang_Yong-jun)) |
| GIDEON | Kim Min-seong | 2003-08-14 | [프로필·기사](https://lol.fandom.com/wiki/GIDEON) |
| GimGoon | Kim Han-saem | 1995-12-31 | [프로필·기사](https://lol.fandom.com/wiki/GimGoon) |
| Gori | Kim Tae-woo | 2000-08-09 | [프로필·기사](https://lol.fandom.com/wiki/Gori) |
| GorillA | Kang Beom-hyun | 1994-11-18 | [프로필·기사](https://lol.fandom.com/wiki/GorillA) |
| Grizzly | Jo Seung-hoon | 2005-05-25 | [프로필·기사](https://lol.fandom.com/wiki/Grizzly) |
| GuGer | Kim Do-yeop | 1994-02-07 | [프로필·기사](https://lol.fandom.com/wiki/GuGer) |
| Gumayusi | Lee Min-hyeong | 2002-02-06 | [프로필·기사](https://liquipedia.net/esports/Esports_World_Cup/2025/Player_List) |
| H0R0 | Cho Jae-hwan | 1996-09-21 | [프로필·기사](https://lol.fandom.com/wiki/H0R0) |
| Hachani | Ha Seung-chan | 1994-12-24 | [프로필·기사](https://lol.fandom.com/wiki/Hachani) |
| HamBak | Ham Yoo-jin | 2002-08-28 | [프로필·기사](https://lol.fandom.com/wiki/HamBak) |
| Harp | Lee Ji-yoong | 2001-06-03 | [프로필·기사](https://lol.fandom.com/wiki/Harp) |
| Haru | Kang Min-seung | 1998-06-03 | [프로필·기사](https://lol.fandom.com/wiki/Haru) |
| Heart | Yi Gwan-hyung | 1988-12-13 | [프로필·기사](https://lol.fandom.com/wiki/Heart) |
| Helios (Shin Dong-jin) | Shin Dong-jin | 1993-06-20 | [프로필·기사](https://lol.fandom.com/wiki/Helios_(Shin_Dong-jin)) |
| Helper | Kwon Yeong-jae | 1995-03-24 | [프로필·기사](https://lol.fandom.com/wiki/Helper_(Kwon_Yeong-jae)) |
| Hena | Park Jeung-hwan | 1999-10-08 | [프로필·기사](https://lol.fandom.com/wiki/Hena) |
| Hermes (Kim Kang-hwan) | Kim Kang-hwan | 1992-10-21 | [프로필·기사](https://lol.fandom.com/wiki/Hermes_(Kim_Kang-hwan)) |
| Hipo | Suk Hyeon-jun | 1998-02-02 | [프로필·기사](https://lol.fandom.com/wiki/Hipo) |
| Hiro (Lee Woo-suk) | Lee Woo-suk | 1987-07-28 | [프로필·기사](https://lol.fandom.com/wiki/Hiro_(Lee_Woo-suk)) |
| Hoit | Ryu Ho-seong | 1999-07-06 | [프로필·기사](https://lol.fandom.com/wiki/Hoit) |
| Hojin | Lee Ho-jin | 1992-01-04 | [프로필·기사](https://lol.fandom.com/wiki/Hojin) |
| Homme | Yoon Sung-young | 1985-01-01 | [프로필·기사](https://lol.fandom.com/wiki/Homme) |
| HooN (Kim Nam-hoon) | Kim Nam-hoon | 1987-01-31 | [프로필·기사](https://lol.fandom.com/wiki/HooN_(Kim_Nam-hoon)) |
| HotshotGG | George Georgallidis | 1990-06-23 | [프로필·기사](https://lol.fandom.com/wiki/HotshotGG) |
| HOYA | Yoon Yong-ho | 2000-08-25 | [프로필·기사](https://lol.fandom.com/wiki/HOYA) |
| Huni | Heo Seung-hoon | 1997-12-25 | [프로필·기사](https://lol.fandom.com/wiki/Huni) |
| HyBriD | Lee Woo-jin | 1999-11-27 | [프로필·기사](https://lol.fandom.com/wiki/HyBriD_(Lee_Woo-jin)) |
| Hype | Byeon Jeong-hyeon | 2003-09-09 | [프로필·기사](https://lol.fandom.com/wiki/Hype_(Byeon_Jeong-hyeon)) |
| Ian | An Jun-hyeong | 1998-01-22 | [프로필·기사](https://lol.fandom.com/wiki/Ian) |
| Ice | Yoon Sang-hoon | 2001-04-09 | [프로필·기사](https://lol.fandom.com/wiki/Ice_(Yoon_Sang-hoon)) |
| Ignar | Lee Dong-geun | 1996-11-20 | [프로필·기사](https://lol.fandom.com/wiki/Ignar) |
| ikssu | Jeon Ik-soo | 1996-10-22 | [프로필·기사](https://lol.fandom.com/wiki/Ikssu) |
| imp | Gu Seung-bin | 1995-06-07 | [프로필·기사](https://lol.fandom.com/wiki/Imp) |
| Impact | Jeong Eon-young | 1995-03-07 | [프로필·기사](https://lol.fandom.com/wiki/Impact) |
| inSec | Choi In-seok | 1993-06-29 | [프로필·기사](https://lol.fandom.com/wiki/InSec) |
| Ivory | Jeong Ye-chan | 2003-10-12 | [프로필·기사](https://lol.fandom.com/wiki/Ivory) |
| Jelly | Son Ho-gyeong | 1997-10-18 | [프로필·기사](https://lol.fandom.com/wiki/Jelly_(Son_Ho-gyeong)) |
| Jett | Bae Ho-young | 2001-07-23 | [프로필·기사](https://lol.fandom.com/wiki/Jett) |
| Jisu | Park Jin-cheol | 1996-05-10 | [프로필·기사](https://lol.fandom.com/wiki/Jisu) |
| Jiwoo | Jung Ji-woo | 2004-03-20 | [프로필·기사](https://lol.fandom.com/wiki/Jiwoo) |
| Joker | Cho Jae-eup | 1991-12-11 | [프로필·기사](https://lol.fandom.com/wiki/Joker_(Cho_Jae-eup)) |
| Juhan | Lee Ju-han | 2001-08-31 | [프로필·기사](https://lol.fandom.com/wiki/Juhan) |
| Jun | Yoon Se-jun | 2000-08-02 | [프로필·기사](https://lol.fandom.com/wiki/Jun_(Yoon_Se-jun)) |
| Kael | Kim Jin-hong | 2004-02-11 | [프로필·기사](https://lol.fandom.com/wiki/Kael_(Kim_Jin-hong)) |
| KaKAO | Lee Byung-kwon | 1995-12-07 | [프로필·기사](https://lol.fandom.com/wiki/KaKAO) |
| Kanavi | Seo Jin-hyeok | 2000-11-02 | [프로필·기사](https://lol.fandom.com/wiki/Kanavi) |
| KangQui | Kang Seung-hyeon | 1988-10-30 | [프로필·기사](https://lol.fandom.com/wiki/KangQui) |
| Karis | Kim Hong-jo | 2003-05-21 | [프로필·기사](https://lol.fandom.com/wiki/Karis) |
| Keine | Kim Joon-cheol | 1999-11-08 | [프로필·기사](https://lol.fandom.com/wiki/Keine) |
| Kellin | Kim Hyeong-gyu | 2001-02-01 | [프로필·기사](https://lol.fandom.com/wiki/Kellin) |
| Keria | Ryu Min-seok | 2002-10-14 | [프로필·기사](https://liquipedia.net/leagueoflegends/Keria) |
| Key | Kim Han-gi | 1997-06-20 | [프로필·기사](https://lol.fandom.com/wiki/Key_(Kim_Han-gi)) |
| Khan | Kim Dong-ha | 1995-12-22 | [프로필·기사](https://lol.fandom.com/wiki/Khan) |
| Kiin | Kim Gi-in | 1999-05-28 | [프로필·기사](https://lol.fandom.com/wiki/Kiin) |
| Kingen | Hwang Seong-hoon | 2000-03-11 | [프로필·기사](https://lol.fandom.com/wiki/Kingen) |
| Kkinsh | Kim Beom-seok | 1991-08-14 | [프로필·기사](https://lol.fandom.com/wiki/Kish) |
| Kramer | Ha Jong-hun | 1996-03-09 | [프로필·기사](https://lol.fandom.com/wiki/Kramer) |
| Krepo | Mitch Voorspoels | 1990-05-08 | [프로필·기사](https://lol.fandom.com/wiki/Krepo) |
| KurO | Lee Seo-haeng | 1994-01-04 | [프로필·기사](https://lol.fandom.com/wiki/Kuro) |
| Kuzan | Lee Seong-hyeok | 1997-01-07 | [프로필·기사](https://lol.fandom.com/wiki/Kuzan) |
| kyeahoo | Kang Ye-hoo | 2005-08-13 | [프로필·기사](https://lol.fandom.com/wiki/Kyeahoo) |
| Lasha | Kwon Min-woo | 1994-03-22 | [프로필·기사](https://lol.fandom.com/wiki/Lasha) |
| Lava | Kim Tae-hoon | 1999-07-14 | [프로필·기사](https://lol.fandom.com/wiki/Lava) |
| LazyFeel | Trần Bảo Minh | 2007-03-19 | [프로필·기사](https://lol.fandom.com/wiki/LazyFeel) |
| Leaper | Choi Gi-myeong | 2000-05-18 | [프로필·기사](https://lol.fandom.com/wiki/Leaper) |
| Lee | Lee Ho-jin | 1992-01-04 | [프로필·기사](https://lol.fandom.com/wiki/Hojin) |
| Lehends | Son Si-woo | 1998-12-24 | [프로필·기사](https://lol.fandom.com/wiki/Lehends) |
| Leo | Han Gyeo-re | 2000-01-12 | [프로필·기사](https://lol.fandom.com/wiki/Leo_(Han_Gyeo-re)) |
| Leopard | Lee Ho-seong | 1994-12-19 | [프로필·기사](https://lol.fandom.com/wiki/Duke_(Lee_Ho-seong)) |
| Life | Kim Jeong-min | 2000-07-07 | [프로필·기사](https://lol.fandom.com/wiki/Life) |
| Light | Kwon Sun-ho | 1998-01-19 | [프로필·기사](https://lol.fandom.com/wiki/Light_(Kwon_Sun-ho)) |
| Lilac | Jeon Ho-jin | 1992-02-17 | [프로필·기사](https://lol.fandom.com/wiki/Lilac_(Jeon_Ho-jin)) |
| Lilac (Jeon Ho-jin) | Jeon Ho-jin | 1992-02-17 | [프로필·기사](https://lol.fandom.com/wiki/Lilac_(Jeon_Ho-jin)) |
| Limit (Ju Min-gyu) | Ju Min-gyu | 1993-05-07 | [프로필·기사](https://lol.fandom.com/wiki/Limit_(Ju_Min-gyu)) |
| Lindarang | Heo Man-heung | 1997-08-25 | [프로필·기사](https://lol.fandom.com/wiki/Lindarang) |
| Lira | Nam Tae-yoo | 1995-01-15 | [프로필·기사](https://lol.fandom.com/wiki/Lira) |
| Locodoco | Choi Yoon-seop | 1992-02-07 | [프로필·기사](https://lol.fandom.com/wiki/Locodoco) |
| LokeN | Lee Dong-wook | 1998-02-14 | [프로필·기사](https://lol.fandom.com/wiki/LokeN) |
| Loki | Lee Sang-min | 2005-03-26 | [프로필·기사](https://lol.fandom.com/wiki/Loki_(Lee_Sang-min)) |
| Lonely | Han Gyu-joon | 2000-08-29 | [프로필·기사](https://lol.fandom.com/wiki/Lonely_(Han_Gyu-joon)) |
| Longpanda | Kim Yoon-jae | 1991-01-02 | [프로필·기사](https://lol.fandom.com/wiki/LongPanda) |
| Looper | Jang Hyeong-seok | 1993-02-28 | [프로필·기사](https://lol.fandom.com/wiki/Looper) |
| Loray | Kwon Ji-min | 1995-09-28 | [프로필·기사](https://lol.fandom.com/wiki/Wraith) |
| Lucid | Choi Yong-hyeok | 2005-01-28 | [프로필·기사](https://lol.fandom.com/wiki/Lucid_(Choi_Yong-hyeok)) |
| Luna | Jang Kyung-ho | 1995-08-05 | [프로필·기사](https://lol.fandom.com/wiki/Luna_(Jang_Kyung-ho)) |
| Lustboy | Ham Jang-sik | 1994-02-18 | [프로필·기사](https://lol.fandom.com/wiki/Lustboy) |
| MadLife | Hong Min-gi | 1992-10-05 | [프로필·기사](https://lol.fandom.com/wiki/MadLife) |
| Mafa | Won Sang-yeon | 1992-10-30 | [프로필·기사](https://lol.fandom.com/wiki/Mafa) |
| MaHa | Oh Hyun-sik | 1995-11-07 | [프로필·기사](https://lol.fandom.com/wiki/MaHa) |
| MakNooN | Yoon Ha-woon | 1991-11-16 | [프로필·기사](https://lol.fandom.com/wiki/MakNooN) |
| Malrang | Kim Geun-seong | 2000-02-09 | [프로필·기사](https://lol.fandom.com/wiki/Malrang) |
| ManDu | Lee Jeong-hyeon | 1991-01-29 | [프로필·기사](https://lol.fandom.com/wiki/PoohManDu) |
| ManyReason | Kim Seung-min | 1991-02-03 | [프로필·기사](https://lol.fandom.com/wiki/ManyReason) |
| MaRin | Jang Gyeong-hwan | 1991-02-12 | [프로필·기사](https://lol.fandom.com/wiki/MaRin) |
| Mata | Cho Se-hyeong | 1994-02-27 | [프로필·기사](https://lol.fandom.com/wiki/Mata) |
| Max | Jeong Jong-bin | 1996-05-30 | [프로필·기사](https://lol.fandom.com/wiki/Max_(Jeong_Jong-bin)) |
| May (Kang Han-wool) | Kang Han-wool | 1992-11-07 | [프로필·기사](https://lol.fandom.com/wiki/May_(Kang_Han-wool)) |
| Me5 | Lee Han-kil | 1994-04-11 | [프로필·기사](https://lol.fandom.com/wiki/Bust_(Lee_Han-kil)) |
| Mia | Choi Sang-in | 1998-11-03 | [프로필·기사](https://lol.fandom.com/wiki/Mia) |
| Mickey | Son Young-min | 1997-07-15 | [프로필·기사](https://lol.fandom.com/wiki/Mickey_(Son_Young-min)) |
| MidKing | Park Yong-woo | 1992-06-15 | [프로필·기사](https://lol.fandom.com/wiki/MidKing) |
| Mightybear | Kim Min-su | 1995-09-06 | [프로필·기사](https://lol.fandom.com/wiki/Mightybear) |
| Mihile | Baek Sang-hwi | 2003-03-01 | [프로필·기사](https://lol.fandom.com/wiki/Mihile) |
| Mima | Jung Woo-gwang | 1991-03-12 | [프로필·기사](https://lol.fandom.com/wiki/Mima) |
| Mir | Park Mi-reu | 2000-05-24 | [프로필·기사](https://lol.fandom.com/wiki/Mir_(Park_Mi-reu)) |
| Mireu | Jeong Jo-bin | 2001-09-20 | [프로필·기사](https://lol.fandom.com/wiki/Mireu) |
| MiSo | Kim Jae-hun | 1995-12-07 | [프로필·기사](https://lol.fandom.com/wiki/Fenix) |
| Moham | Jeong Jae-hun | 2002-08-08 | [프로필·기사](https://lol.fandom.com/wiki/Moham) |
| MOKUZA | Kim Dae-woong | 1986-02-25 | [프로필·기사](https://lol.fandom.com/wiki/MOKUZA) |
| Morgan | Park Ru-han | 2001-09-26 | [프로필·기사](https://lol.fandom.com/wiki/Morgan) |
| Mowgli | Lee Jae-ha | 1998-04-14 | [프로필·기사](https://lol.fandom.com/wiki/Mowgli) |
| Muse | Kim Beom-seok | 1991-08-14 | [프로필·기사](https://lol.fandom.com/wiki/Kish) |
| Mystic | Jin Seong-jun | 1995-01-08 | [프로필·기사](https://lol.fandom.com/wiki/Mystic) |
| Naehyun | Yoo Nae-hyun | 1996-02-07 | [프로필·기사](https://lol.fandom.com/wiki/Naehyun) |
| Nagne | Kim Sang-moon | 1994-09-04 | [프로필·기사](https://lol.fandom.com/wiki/Nagne) |
| Namgung | Namgung Seong-hoon | 2003-10-04 | [프로필·기사](https://lol.fandom.com/wiki/Namgung) |
| Noah | Oh Hyeon-taek | 2001-10-04 | [프로필·기사](https://lol.fandom.com/wiki/Noah_(Oh_Hyeon-taek)) |
| NoFe | Jeong No-chul | 1988-08-11 | [프로필·기사](https://lol.fandom.com/wiki/NoFe) |
| Nova | Park Chan-ho | 1997-11-27 | [프로필·기사](https://lol.fandom.com/wiki/Nova_(Park_Chan-ho)) |
| Nuclear | Shin Jeong-hyeon | 1997-05-19 | [프로필·기사](https://lol.fandom.com/wiki/Nuclear) |
| Nuguri | Jang Ha-gwon | 1999-07-17 | [프로필·기사](https://lol.fandom.com/wiki/Nuguri) |
| ohq | Oh Gyu-min | 1996-09-05 | [프로필·기사](https://lol.fandom.com/wiki/Ohq) |
| Oner | Mun Hyeon-jun | 2002-12-24 | [프로필·기사](https://liquipedia.net/leagueoflegends/Oner) |
| OnFleek | Kim Jang-gyeom | 1997-12-20 | [프로필·기사](https://lol.fandom.com/wiki/OnFleek) |
| Paduck | Park Seok-hyeon | 2005-02-12 | [프로필·기사](https://lol.fandom.com/wiki/Paduck) |
| Paragon | Choi Hyun-il | 1995-07-27 | [프로필·기사](https://lol.fandom.com/wiki/Paragon) |
| PawN | Heo Won-seok | 1997-01-26 | [프로필·기사](https://lol.fandom.com/wiki/PawN) |
| Peanut | Han Wang-ho | 1998-02-03 | [프로필·기사](https://liquipedia.net/leagueoflegends/Peanut) |
| PerfecT | Lee Seung-min | 2004-05-17 | [프로필·기사](https://lol.fandom.com/wiki/PerfecT_(Lee_Seung-min)) |
| Peter | Jeong Yoon-su | 2003-04-28 | [프로필·기사](https://lol.fandom.com/wiki/Peter_(Jeong_Yoon-su)) |
| Peyz | Kim Su-hwan | 2005-12-05 | [프로필·기사](https://lol.fandom.com/wiki/Peyz) |
| Piccaboo | Lee Jong-beom | 1997-03-25 | [프로필·기사](https://lol.fandom.com/wiki/Piccaboo) |
| Piglet | Chae Gwang-jin | 1994-02-04 | [프로필·기사](https://lol.fandom.com/wiki/Piglet) |
| Pilot | Na Woo-hyung | 1995-12-04 | [프로필·기사](https://lol.fandom.com/wiki/Pilot_(Na_Woo-hyung)) |
| Pirean | Choi Jun-sik | 1998-04-09 | [프로필·기사](https://lol.fandom.com/wiki/Pirean) |
| Pleata | Son Min-woo | 2003-03-28 | [프로필·기사](https://lol.fandom.com/wiki/Pleata) |
| PLL | Park Jae-gwon | 1993-12-03 | [프로필·기사](https://lol.fandom.com/wiki/PLL) |
| Poby | Yoon Sung-won | 2006-02-07 | [프로필·기사](https://lol.fandom.com/wiki/Poby) |
| Pollu | Oh Dong-gyu | 2006-01-07 | [프로필·기사](https://lol.fandom.com/wiki/Pollu) |
| PoohManDu | Lee Jeong-hyeon | 1991-01-29 | [프로필·기사](https://lol.fandom.com/wiki/PoohManDu) |
| PraY | Kim Jong-in | 1994-01-06 | [프로필·기사](https://lol.fandom.com/wiki/PraY) |
| Prince | Lee Chae-hwan | 2000-04-05 | [프로필·기사](https://lol.fandom.com/wiki/Prince_(Lee_Chae-hwan)) |
| Promise (Cheon Min-ki) | Cheon Min-ki | 1992-01-16 | [프로필·기사](https://www.inven.co.kr/webzine/news/?news=79465) |
| Punch | Son Min-hyuk | 1998-06-06 | [프로필·기사](https://lol.fandom.com/wiki/Punch) |
| Pungyeon | Lee Jong-hyuk | 2004-06-22 | [프로필·기사](https://lol.fandom.com/wiki/Pungyeon) |
| Pure | Kim Jin-sun | 1995-12-29 | [프로필·기사](https://lol.fandom.com/wiki/Pure) |
| Pyosik | Hong Chang-hyeon | 2000-03-12 | [프로필·기사](https://lol.fandom.com/wiki/Pyosik) |
| Quad | Song Su-hyeong | 2002-08-25 | [프로필·기사](https://lol.fandom.com/wiki/Quad) |
| Quantum | Son Jeong-hwan | 2004-08-20 | [프로필·기사](https://lol.fandom.com/wiki/Quantum_(Son_Jeong-hwan)) |
| Ragan | Im Kyung-hyun | 1991-11-10 | [프로필·기사](https://lol.fandom.com/wiki/Ragan) |
| Raise | Oh Ji-hwan | 1997-10-18 | [프로필·기사](https://lol.fandom.com/wiki/Raise) |
| RapidStar | Jung Min-sung | 1993-05-05 | [프로필·기사](https://lol.fandom.com/wiki/RapidStar) |
| Raptor | Jeon Eo-jin | 2004-11-15 | [프로필·기사](https://lol.fandom.com/wiki/Raptor_(Jeon_Eo-jin)) |
| Rascal | Kim Kwang-hee | 1997-10-16 | [프로필·기사](https://lol.fandom.com/wiki/Rascal) |
| Rather | Shin Hyeong-seop | 1996-11-26 | [프로필·기사](https://lol.fandom.com/wiki/Rather) |
| Raven (Kim Ae-jun) | Kim Ae-jun | 1994-01-22 | [프로필·기사](https://lol.fandom.com/wiki/Raven_(Kim_Ae-jun)) |
| RealFoxy | Lee Sang-hyun | 1995-08-01 | [프로필·기사](https://lol.fandom.com/wiki/Chaser) |
| Reapered | Bok Han-gyu | 1992-01-30 | [프로필·기사](https://lol.fandom.com/wiki/Reapered) |
| Reign over | Kim Yeu-jin | 1995-07-04 | [프로필·기사](https://lol.fandom.com/wiki/Reignover) |
| ReSEt | Won Jun-ho | 1992-04-23 | [프로필·기사](https://lol.fandom.com/wiki/Scouter) |
| Rich | Lee Jae-won | 1998-02-16 | [프로필·기사](https://lol.fandom.com/wiki/Rich_(Lee_Jae-won)) |
| Ring Troll | Jeong Yoon-seong | 1991-10-10 | [프로필·기사](https://lol.fandom.com/wiki/Ring_Troll) |
| Riris | Baek Seung-min | 1994-12-25 | [프로필·기사](https://lol.fandom.com/wiki/Riris) |
| Roach | Kim Kang-hee | 1999-01-31 | [프로필·기사](https://lol.fandom.com/wiki/Roach) |
| Roamer | Jo Woo-jin | 2003-08-03 | [프로필·기사](https://lol.fandom.com/wiki/Roamer) |
| Roar | Oh Jang-won | 1995-08-16 | [프로필·기사](https://lol.fandom.com/wiki/Roar_(Oh_Jang-won)) |
| RooKie | Song Eui-jin | 1997-03-11 | [프로필·기사](https://lol.fandom.com/wiki/Rookie) |
| Route | Moon Geom-su | 1999-01-05 | [프로필·기사](https://lol.fandom.com/wiki/Route) |
| Ruler | Park Jae-hyuk | 1998-12-29 | [프로필·기사](https://liquipedia.net/leagueoflegends/Ruler) |
| Rush | Lee Yoon-jae | 1993-04-06 | [프로필·기사](https://lol.fandom.com/wiki/Rush) |
| Ryu | Ryu Sang-wook | 1994-01-28 | [프로필·기사](https://lol.fandom.com/wiki/Ryu) |
| SamD | Lee Jae-hoon | 2001-03-14 | [프로필·기사](https://lol.fandom.com/wiki/SamD) |
| Samver | Lee Seung-yong | 2001-11-07 | [프로필·기사](https://lol.fandom.com/wiki/Samver) |
| sanghyeon | Jeong Sang-hyeon | 2001-12-17 | [프로필·기사](https://lol.fandom.com/wiki/Sanghyeon) |
| Sangyoon | Gwon Sang-yun | 1995-12-20 | [프로필·기사](https://lol.fandom.com/wiki/Sangyoon) |
| SaSin | Oh Seung-ju | 1994-02-03 | [프로필·기사](https://lol.fandom.com/wiki/SaSin) |
| Save | Baek Young-jin | 1993-07-06 | [프로필·기사](https://lol.fandom.com/wiki/Save) |
| SBS | Bae Ji-hoon | 1992-07-02 | [프로필·기사](https://lol.fandom.com/wiki/SBs) |
| Score | Go Dong-bin | 1992-07-08 | [프로필·기사](https://lol.fandom.com/wiki/Score) |
| Scout | Lee Ye-chan | 1998-03-14 | [프로필·기사](https://lol.fandom.com/wiki/Scout) |
| Secret | Park Ki-sun | 1997-05-27 | [프로필·기사](https://lol.fandom.com/wiki/Secret_(Park_Ki-sun)) |
| Seize | Kim Chan-hee | 2000-12-07 | [프로필·기사](https://lol.fandom.com/wiki/Seize) |
| SeongHwan | Yoon Seong-hwan | 1997-12-11 | [프로필·기사](https://lol.fandom.com/wiki/SeongHwan) |
| SeTab | Song Kyeong-jin | 2004-10-13 | [프로필·기사](https://lol.fandom.com/wiki/SeTab) |
| Sharvel | Kim Dan-woo | 2007-08-26 | [프로필·기사](https://lol.fandom.com/wiki/Sharvel) |
| ShowMaker | Heo Su | 2000-07-22 | [프로필·기사](https://lol.fandom.com/wiki/ShowMaker) |
| Shy | Park Sang-myeon | 1991-07-19 | [프로필·기사](https://lol.fandom.com/wiki/Shy) |
| Siwoo | Jeon Si-woo | 2007-11-24 | [프로필·기사](https://lol.fandom.com/wiki/Siwoo) |
| Sky | Kim Ha-neul | 1998-07-17 | [프로필·기사](https://lol.fandom.com/wiki/Sky_(Kim_Ha-neul)) |
| Smash | Shin Geum-jae | 2006-07-20 | [프로필·기사](https://lol.fandom.com/wiki/Smash_(Shin_Geum-jae)) |
| Smeb | Song Kyung-ho | 1995-06-30 | [프로필·기사](https://lol.fandom.com/wiki/Smeb) |
| Snoopeh | Stephen Ellis | 1991-09-15 | [프로필·기사](https://lol.fandom.com/wiki/Snoopeh) |
| SnowFlower | No Hoi-jong | 1997-02-24 | [프로필·기사](https://lol.fandom.com/wiki/SnowFlower) |
| SoaR | Lee Gang-pyo | 1997-05-28 | [프로필·기사](https://lol.fandom.com/wiki/SoaR) |
| Soboro | Lim Seong-min | 2004-01-10 | [프로필·기사](https://lol.fandom.com/wiki/Soboro) |
| SoHwan | Kim Jun-yeong | 1996-10-24 | [프로필·기사](https://lol.fandom.com/wiki/SoHwan) |
| SoLo (Lee Gwan-hyung) | Yi Gwan-hyung | 1988-12-13 | [프로필·기사](https://lol.fandom.com/wiki/Heart) |
| Sonstar | Son Seung-ik | 1994-08-31 | [프로필·기사](https://lol.fandom.com/wiki/Sonstar) |
| Soul | Seo Hyeon-seok | 1994-11-16 | [프로필·기사](https://lol.fandom.com/wiki/Soul_(Seo_Hyeon-seok)) |
| Space | Seon Ho-san | 1993-09-05 | [프로필·기사](https://lol.fandom.com/wiki/Space_(Seon_Ho-san)) |
| Space (Seon Ho-san) | Seon Ho-san | 1993-09-05 | [프로필·기사](https://lol.fandom.com/wiki/Space_(Seon_Ho-san)) |
| Spirit | Lee Da-yoon | 1996-07-01 | [프로필·기사](https://lol.fandom.com/wiki/Spirit) |
| Sponge | Bae Young-jun | 2004-07-25 | [프로필·기사](https://lol.fandom.com/wiki/Sponge) |
| Ssol | Seo Jin-sol | 1998-03-04 | [프로필·기사](https://lol.fandom.com/wiki/Ssol) |
| SSONG | Kim Sang-soo | 1989-10-15 | [프로필·기사](https://lol.fandom.com/wiki/Ssong) |
| Ssumday | Kim Chan-ho | 1996-07-03 | [프로필·기사](https://lol.fandom.com/wiki/Ssumday) |
| SSUN | Kim Tae-yang | 1997-11-20 | [프로필·기사](https://lol.fandom.com/wiki/SSUN_(Kim_Tae-yang)) |
| StarLast | Han Jin-hui | 1991-06-19 | [프로필·기사](https://lol.fandom.com/wiki/StarLast) |
| Stitch | Lee Seung-ju | 1996-11-02 | [프로필·기사](https://lol.fandom.com/wiki/Stitch) |
| Summit | Park Woo-tae | 1998-12-08 | [프로필·기사](https://lol.fandom.com/wiki/Summit) |
| SunChip | Choi Seon-whi | 1990-01-03 | [프로필·기사](https://lol.fandom.com/wiki/SunChip) |
| SuNo | An Sun-ho | 1994-03-23 | [프로필·기사](https://lol.fandom.com/wiki/SuNo) |
| Sw0rd | Choi Sung-won | 1997-06-16 | [프로필·기사](https://lol.fandom.com/wiki/Sw0rd) |
| Sweet | Lee Eun-teak | 1995-07-11 | [프로필·기사](https://lol.fandom.com/wiki/Sweet_(Lee_Eun-teak)) |
| Swift | Baek Da-hoon | 1996-05-29 | [프로필·기사](https://lol.fandom.com/wiki/Swift) |
| Sylvie | Lee Seung-bok | 2002-12-04 | [프로필·기사](https://lol.fandom.com/wiki/Sylvie) |
| Taeyoon | Kim Tae-yoon | 2002-06-02 | [프로필·기사](https://lol.fandom.com/wiki/Taeyoon_(Kim_Tae-yoon)) |
| TaNa | Lee Sang-wook | 1999-12-11 | [프로필·기사](https://lol.fandom.com/wiki/TaNa) |
| Tank | Park Dan-won | 1995-11-18 | [프로필·기사](https://lol.fandom.com/wiki/Tank) |
| Tarzan | Lee Seung-yong | 1999-08-23 | [프로필·기사](https://lol.fandom.com/wiki/Tarzan_(Lee_Seung-yong)) |
| Teddy | Park Jin-seong | 1998-03-15 | [프로필·기사](https://lol.fandom.com/wiki/Teddy) |
| Tempt | Kang Myung-gu | 1998-05-13 | [프로필·기사](https://lol.fandom.com/wiki/Tempt) |
| Test Sup | Park Hee-seok | 2001-09-18 | [프로필·기사](https://lol.fandom.com/wiki/Test_Sup) |
| Thal | Park Kwon-hyuk | 1998-11-13 | [프로필·기사](https://lol.fandom.com/wiki/Thal) |
| Tom | Im Jae-hyeon | 1995-05-22 | [프로필·기사](https://lol.fandom.com/wiki/Tom_(Im_Jae-hyeon)) |
| Totoro | Eun Jong-seop | 1996-05-06 | [프로필·기사](https://lol.fandom.com/wiki/Totoro_(Eun_Jong-seop)) |
| TrAce | Yeo Chang-dong | 1989-11-02 | [프로필·기사](https://lol.fandom.com/wiki/TrAce) |
| Trick | Kim Gang-yun | 1995-07-11 | [프로필·기사](https://lol.fandom.com/wiki/Trick) |
| Trigger | Kim Eui-joo | 2000-10-10 | [프로필·기사](https://lol.fandom.com/wiki/Trigger_(Kim_Eui-joo)) |
| TusiN | Park Jong-ik | 1995-11-12 | [프로필·기사](https://lol.fandom.com/wiki/TusiN) |
| Ucal | Son Woo-hyeon | 2001-01-30 | [프로필·기사](https://lol.fandom.com/wiki/Ucal) |
| UmTi | Um Sung-hyeon | 1999-06-02 | [프로필·기사](https://lol.fandom.com/wiki/UmTi) |
| Untara | Park Ui-jin | 1996-12-31 | [프로필·기사](https://lol.fandom.com/wiki/Untara) |
| Veritas | Kim Kyoung-min | 1995-05-22 | [프로필·기사](https://lol.fandom.com/wiki/Veritas) |
| VicLa | Lee Dae-kwang | 2003-11-27 | [프로필·기사](https://lol.fandom.com/wiki/VicLa) |
| viNylCat | Chae Woo-cheol | 1985-07-30 | [프로필·기사](https://lol.fandom.com/wiki/ViNylCat) |
| Violet (Lim Doo-sung) | Lim Doo-seong | 1993-10-21 | [프로필·기사](https://lol.fandom.com/wiki/Violet_(Lim_Doo-sung)) |
| Viper | Park Do-hyeon | 2000-10-19 | [프로필·기사](https://lol.fandom.com/wiki/Viper_(Park_Do-hyeon)) |
| vital | Ha In-seong | 2002-09-16 | [프로필·기사](https://lol.fandom.com/wiki/Vital) |
| Vitamin | Lee Hyung-jun | 1987-02-19 | [프로필·기사](https://lol.fandom.com/wiki/Vitamin) |
| Vsta | Oh Hyo-seong | 2000-10-03 | [프로필·기사](https://lol.fandom.com/wiki/Vsta) |
| Wall (Son Chang-hoon) | Son Chang-hoon | 1993-01-28 | [프로필·기사](https://lol.fandom.com/wiki/Wall_(Son_Chang-hoon)) |
| Watch | Cho Jae-geol | 1992-01-02 | [프로필·기사](https://lol.fandom.com/wiki/Watch) |
| Way | Han Gil | 2002-06-29 | [프로필·기사](https://lol.fandom.com/wiki/Way_(Han_Gil)) |
| Wickd | Mike Petersen | 1994-04-29 | [프로필·기사](https://lol.fandom.com/wiki/Wickd) |
| Willer | Kim Jeong-hyeon | 2003-04-24 | [프로필·기사](https://lol.fandom.com/wiki/Willer) |
| Winged | Park Tae-jin | 1992-08-20 | [프로필·기사](https://lol.fandom.com/wiki/Winged) |
| Wisdom | Kim Tae-wan | 1995-12-23 | [프로필·기사](https://lol.fandom.com/wiki/Wisdom) |
| Wiz | Na Yoo-joon | 1998-04-23 | [프로필·기사](https://lol.fandom.com/wiki/Wiz) |
| Wolf | Lee Jae-wan | 1996-09-09 | [프로필·기사](https://lol.fandom.com/wiki/Wolf_(Lee_Jae-wan)) |
| Wolf (Lee Jae-wan) | Lee Jae-wan | 1996-09-09 | [프로필·기사](https://lol.fandom.com/wiki/Wolf_(Lee_Jae-wan)) |
| Woong (Jang Gun-woong) | Jang Gun-woong | 1990-02-27 | [프로필·기사](https://lol.fandom.com/wiki/Woong_(Jang_Gun-woong)) |
| Wraith | Kwon Ji-min | 1995-09-28 | [프로필·기사](https://lol.fandom.com/wiki/Wraith) |
| Yaharong | Lee Chan-ju | 2000-06-12 | [프로필·기사](https://lol.fandom.com/wiki/Yaharong) |
| Yellowpete | Peter Wüppen | 1989-10-05 | [프로필·기사](https://lol.fandom.com/wiki/Yellowpete) |
| Yohan | Kim Yo-han | 1999-12-17 | [프로필·기사](https://lol.fandom.com/wiki/Yohan) |
| YoungJae | Ko Yeong-jae | 2002-11-16 | [프로필·기사](https://lol.fandom.com/wiki/YoungJae) |
| Zefa | Lee Jae-min | 1988-02-04 | [프로필·기사](https://lol.fandom.com/wiki/Zefa) |
| Zeka | Kim Geon-woo | 2002-11-28 | [프로필·기사](https://lol.fandom.com/wiki/Zeka_(Kim_Geon-woo)) |
| Zenit | Jeon Tae-gwon | 2000-05-08 | [프로필·기사](https://lol.fandom.com/wiki/Zenit) |
| Zero (Yoon Kyung-sup) | Yoon Kyung-sup | 1994-07-16 | [프로필·기사](https://lol.fandom.com/wiki/Zero_(Yoon_Kyung-sup)) |
| Zet | Hae Sung-min | 1997-08-21 | [프로필·기사](https://lol.fandom.com/wiki/Zet) |
| Zeus | Choi Woo-je | 2004-01-31 | [프로필·기사](https://liquipedia.net/leagueoflegends/Zeus) |
| Zzus | Jang Joon-soo | 1998-08-30 | [프로필·기사](https://lol.fandom.com/wiki/Zzus) |

## 2026 코어 전용 선수

| 선수 ID | 본명 | 생년월일 | 출처 |
|---|---|---|---|
| Bluffing | Park Gyu-yong | 2008-12-07 | [프로필·기사](https://lol.fandom.com/wiki/Bluffing) |
| Enosh | Kwak Kyu-jun | 2004-10-01 | [프로필·기사](https://lol.fandom.com/wiki/Enosh) |
| Minous | Kang Min-woo | 2004-05-03 | [프로필·기사](https://lol.fandom.com/wiki/Minous) |
| Painter | Kim Eun-hoo | 2007-09-16 | [프로필·기사](https://lol.fandom.com/wiki/Painter) |
| Slayer | Kim Jin-young | 2003-04-15 | [프로필·기사](https://lol.fandom.com/wiki/Slayer_(Kim_Jin-young)) |

생년 사실과 별개로 훈련 효율·피로 곡선·성장 상한·경기 계수는 게임 규칙입니다. 실제 전성기의 실증 근거로 제시하지 않습니다.
