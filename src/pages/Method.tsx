import { CORE, POS_KO, fmt } from "../data";
import { COEF } from "../game/sim";
import { Card } from "../ui";

const G: Record<string, string> = { lane: "라인전", fight: "교전", farm: "성장", vision: "시야", pool: "챔피언 폭" };
const M: Record<string, string> = { gd: "15분 골드 차", csd: "15분 CS 차", xpd: "15분 경험치 차", kda: "KDA(로그)", kp: "킬 관여율", dsh: "팀 피해 비중", gpm: "분당 골드", cspm: "분당 CS", vspm: "분당 시야 점수", wk: "분당 와드 제거" };
export default function Method() {
  const m = CORE.meta;
  return (
    <div className="grid method">
      <Card title="데이터 출처·방법" className="span2">
        <p>LOL Manager의 숫자는 아래 실제 데이터에서 계산합니다. 지어낸 숫자는 넣지 않고, 시뮬레이션 안에서 쓰는 계수와 난수는 <b>게임 규칙</b>으로 따로 밝힙니다. 데이터 생성: {m.builtAt.slice(0, 10)}.</p>
        <h3>1. 출처</h3>
        <ul>
          <li><b>프로 경기</b>: LeagueLab DB의 LCK 2026 {m.games}경기({m.period[0]} ~ {m.period[1]}, 컵·정규·플레이-인·플레이오프 포함). 경기마다 Riot MATCH-V5 형식 경기·타임라인 기록(Leaguepedia 제공)과 밴픽 기록을 씁니다.</li>
          <li><b>확정 지표</b>: LeagueLab 확정본 — 전체 계산 {m.fullCompute}(확정 {m.fullComputeLocked?.slice(0, 10)}), 팀 라인전 {m.laningSource}, 챔피언 티어(보정 승률 {m.tierPolicy}).</li>
          <li><b>랭크 상성·시너지</b>: Riot Games API(MATCH-V5)로 모은 한국 서버 솔로 랭크 {fmt(CORE.meta.rankedGames)}판(lol-banpick-lab 저장소 source 브랜치, 패치 26.21~26.22, 마스터+ 비중 높음). 챔피언·포지션 단위 집계만 쓰고, 소환사 정보는 쓰지 않습니다.</li>
          <li><b>챔피언 이미지·이름</b>: Riot Games Data Dragon 16.22.1. 챔피언 특성(피해 유형, 내구 등)은 밴픽 시뮬레이터와 같은 데이터입니다.</li>
        </ul>
        <h3>2. 팀·선수 정리</h3>
        <ul>
          <li>2026 LCK 경기가 없는 로스터 행(Team CJ Entus Rolster, Team Samsung Telecom)은 뺐습니다.</li>
          <li>이름이 바뀐 팀은 합쳤습니다: BRION → HANJIN BRION, DRX → Kiwoom DRX.</li>
          <li>선수는 경기 기록의 Riot ID(팀 약칭 뒤 이름)로 묶고, <b>마지막으로 뛴 팀</b>에 배정했습니다. 시즌 중 팀을 옮긴 선수는 선수 카드에 팀별 경기 수가 나옵니다.</li>
          <li>포지션은 경기 기록의 참가자 순서(탑·정글·미드·원딜·서폿)로 정하고, 가장 많이 뛴 포지션의 기록만 능력치에 씁니다.</li>
          <li>AI 팀의 기본 주전은 포지션별 2026 LCK 출전 수가 가장 많은 선수입니다.</li>
        </ul>
        <h3>3. 선수 능력치</h3>
        <ol>
          <li>포지션별로 지표의 경기당 평균을 구합니다: {Object.entries(m.groups).map(([g, ms]) => `${G[g]}(${ms.map((x) => M[x]).join(", ")})`).join(" · ")} · 챔피언 폭(사용 챔피언 수).</li>
          <li><b>표본 보정(경험적 베이즈)</b>: 보정값 = (경기 수 × 선수 평균 + {m.shrinkK} × 포지션 평균) ÷ (경기 수 + {m.shrinkK}). 경기가 적은 선수는 포지션 평균 쪽으로 당겨집니다.</li>
          <li>보정값을 같은 포지션 안에서 표준화(z 점수, 경기 수 가중)하고, 묶음마다 평균을 냅니다.</li>
          <li><b>종합</b> = 묶음 z 점수의 가중 평균. 가중치(게임 설계 값):
            <div className="tbl-wrap"><table className="tbl compact"><thead><tr><th>포지션</th>{Object.keys(G).map((g) => <th key={g} className="r">{G[g]}</th>)}</tr></thead>
              <tbody>{[0, 1, 2, 3, 4].map((p) => <tr key={p}><td>{POS_KO[p]}</td>{Object.keys(G).map((g) => <td key={g} className="r">{Math.round((m.weights[String(p)][g] ?? 0) * 100)}%</td>)}</tr>)}</tbody></table></div>
          </li>
          <li>화면의 숫자는 같은 포지션 선수 사이의 <b>백분위</b>(0~100)입니다. 2026 LCK {m.games}경기 기록 {m.players}명 기준.</li>
          <li>2026 LCK {m.small}경기 미만인 선수는 <b>'표본 부족'</b>으로 표시합니다. 기록이 없는 지표는 0으로 채우지 않고 빼고 계산합니다.</li>
        </ol>
        <h3>4. AI 밴픽</h3>
        <ul>
          <li>순서: 2026 대회 20단계(밴 6 → 픽 6 → 밴 4 → 픽 4). <b>첫 번째 선택권</b>: 선택권 팀이 진영 또는 순서 중 하나를 고르고 상대가 나머지를 고릅니다. 1세트 선택권은 정규 시즌은 무작위, 플레이오프는 상위 시드. 2세트부터는 직전 세트 패배 팀.</li>
          <li><b>피어리스</b>: 같은 시리즈 앞 세트에서 양 팀이 픽한 챔피언은 다시 쓸 수 없습니다(밴은 해당 없음).</li>
          <li>후보 점수 = LCK 2026 챔피언 지표 + 선수의 2026 LCK 해당 챔피언 경기 수 + 팀의 실제 2026 픽·밴 횟수 + 랭크 맞상대·시너지(30판 이상, 보정 승률 (승+100)/(판+200)) + 조합 보정. 근거 문장은 밴픽 기록에 그대로 남습니다.</li>
          <li>AI는 상위 4개 후보 중 점수에 비례한 확률(소프트맥스, 온도 0.45)로 고릅니다(게임 규칙). AI 선택권 팀은 60% 선픽, 40% 블루 진영을 고릅니다(게임 규칙, 실제 선택 기록은 데이터에 없음).</li>
        </ul>
        <h3>5. 경기 시뮬레이션 (게임 규칙)</h3>
        <p>경기 전 블루 승리 확률 = 시그모이드(요인 합). 요인과 계수:</p>
        <ul>
          <li>선수 지표: {COEF.skill} × (블루 5명 종합 z 평균 − 레드 평균)</li>
          <li>팀 세트 승률: {COEF.org} × (로짓 보정 승률 차), 보정 승률 = (세트 승 + 10) ÷ (세트 수 + 20), 2026 LCK 전체 경기</li>
          <li>챔피언 숙련도: 2026 LCK 5경기 이상 +{COEF.comfortHi} + 경기당 {COEF.comfortStep}(15경기까지), 기록 없음 {COEF.comfortNone}</li>
          <li>랭크 상성: 포지션별 (보정 승률 − 0.5) × {COEF.mu}, 시너지: 같은 팀 쌍 (보정 승률 − 0.5) × {COEF.syn}. 30판 미만은 0</li>
          <li>LCK 챔피언 지표: (보정 승률 − 0.5) × {COEF.meta}, 픽 3회 미만은 0</li>
          <li>조합: 앞라인 없음 {COEF.noFront}, 한 피해 유형 4명 이상 {COEF.oneDmg}</li>
          <li>진영: ln(블루 승 {m.blueWins} ÷ 레드 승 {m.redWins}) = {Math.log(m.blueWins / m.redWins).toFixed(3)}</li>
          <li>폼: {COEF.form} × (최근 3경기 평점 기반 폼 평균 차)</li>
        </ul>
        <p>경기 중에는 포지션별 라인전 골드 차(선수 라인전 z 차 + 랭크 맞상대 + 경기 전 확률 반영 + 정규분포 난수), 오브젝트·한타 결과(현재 골드 차와 경기 전 확률로 정한 확률), 승자(시그모이드({COEF.endL0} × 요인 합 + 골드 차 ÷ {fmtN(COEF.endGold)}))를 차례로 뽑습니다. 킬 배분과 평점은 결과에 맞춰 나눈 게임 값이며 실제 기록이 아닙니다.</p>
        <h3>6. 한계</h3>
        <ul>
          <li>능력치는 2026 LCK 기록만 씁니다. 2024·2025 시즌과 국제대회 기록은 v1에 들어 있지 않습니다.</li>
          <li>랭크 데이터는 솔로 랭크라 프로 경기와 다를 수 있어 상성 반영 폭을 작게 두었습니다.</li>
          <li>이적, 재정, 컵·국제대회는 다음 버전 범위입니다.</li>
        </ul>
      </Card>
    </div>
  );
}
const fmtN = (n: number): string => n.toLocaleString("ko-KR");
