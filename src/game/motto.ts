// 팀 이름으로 한 줄 문구를 만듭니다(서버·AI 없이 브라우저에서 규칙으로 계산, 같은 이름이면 항상 같은 문구).
// 이름 속 단어(동물·자연·물건·성격 등, 한글/영어)를 찾아 어울리는 문구를 고르고, 아무 단어도 없으면 이름을 넣은 일반 문구를 씁니다.

interface Theme { re: RegExp; lines: string[] }

const THEMES: Theme[] = [
  { re: /호랑|타이거|tiger/i, lines: ["발톱을 숨긴 호랑이, 때를 기다립니다", "산을 울리는 포효로 시작합니다"] },
  { re: /독수리|이글|eagle|호크|hawk|(?<![가-힣])매(?![가-힣])|falcon|팰컨/i, lines: ["높이 날아올라 먼저 내려다봅니다", "날개를 펴고, 더 높은 곳으로"] },
  { re: /늑대|울프|wolf|wolves/i, lines: ["무리를 이끌고 달려 나갑니다", "함께 달리는 무리는 지치지 않습니다"] },
  { re: /(?<![가-힣])용(?![가-힣])|드래곤|dragon|drake|룡/i, lines: ["잠든 용이 눈을 뜹니다", "하늘을 가르는 불꽃의 숨결로"] },
  { re: /사자|라이언|lion|킹스|kings?\b/i, lines: ["왕좌를 향한 첫걸음입니다", "당당한 포효로 시즌을 엽니다"] },
  { re: /여우|폭스|fox/i, lines: ["영리하게 파고들어 기회를 낚아챕니다", "빈틈을 놓치지 않는 눈으로"] },
  { re: /(?<![가-힣])곰(?![가-힣])|베어|bear/i, lines: ["묵직한 한 방을 준비합니다", "느리지만 쓰러지지 않는 팀입니다"] },
  { re: /상어|샤크|shark/i, lines: ["피 냄새를 맡은 사냥꾼처럼", "멈추지 않고 파고듭니다"] },
  { re: /뱀|스네이크|snake|코브라|cobra|바이퍼|viper/i, lines: ["소리 없이 다가가 결정적으로 뭅니다", "조용히, 그러나 치명적으로"] },
  { re: /피닉스|불사조|phoenix/i, lines: ["쓰러져도 다시 타오릅니다", "재 속에서 더 높이 날아오릅니다"] },
  { re: /불|화염|파이어|fire|flame|inferno|블레이즈|blaze|버닝|burn/i, lines: ["뜨겁게 타오를 시간입니다", "작은 불꽃이 시즌을 태웁니다"] },
  { re: /번개|썬더|thunder|라이트닝|lightning|전기|스파크|spark|볼트|volt/i, lines: ["번개처럼 빠르게, 한 번에 내리꽂습니다", "순식간에 판을 뒤집습니다"] },
  { re: /폭풍|스톰|storm|태풍|허리케인|hurricane|사이클론/i, lines: ["폭풍은 이제 막 시작입니다", "몰아치는 기세로 쓸어 갑니다"] },
  { re: /얼음|아이스|ice|프로스트|frost|프리즈|freeze|(?<![가-힣])눈(?![가-힣])|스노우|snow/i, lines: ["차갑게 식지 않는 집중력으로", "냉정하게, 끝까지 얼려 놓습니다"] },
  { re: /별|스타|star|스텔라|nova|노바|galaxy|갤럭시|은하|코스모|cosmo/i, lines: ["가장 밝은 별이 되어 봅니다", "밤하늘의 주인공을 향해"] },
  { re: /(?<![가-힣])해(?![가-힣])|태양|(?<![가-힣])썬(?![가-힣])|sun|솔라|solar|선라이즈|sunrise|새벽|dawn/i, lines: ["새로운 해가 떠오릅니다", "가장 밝은 아침을 열어 갑니다"] },
  { re: /(?<![가-힣])달(?![가-힣])|(?<![가-힣])문(?![가-힣])|moon|루나|luna|나이트|night|밤/i, lines: ["어둠 속에서 더 빛납니다", "고요한 밤, 승부는 조용히 갈립니다"] },
  { re: /바다|오션|ocean|sea|웨이브|wave|파도|마린|marine|블루(?![가-힣])/i, lines: ["거센 파도를 타고 나아갑니다", "깊은 바다처럼 흔들리지 않습니다"] },
  { re: /(?<![가-힣])산(?![가-힣])|마운틴|mountain|(?<![가-힣])록(?![가-힣])|rock|스톤|stone|아이언|iron|강철|스틸|steel/i, lines: ["흔들리지 않는 단단함으로", "한 걸음씩, 산처럼 묵직하게"] },
  { re: /철벽|방패|실드|shield|가디언|guardian|수호|guard|fortress|요새|캐슬|castle|(?<![가-힣])성(?![가-힣])/i, lines: ["가장 든든한 방패로 시작합니다", "뚫리지 않는 수비, 흔들리지 않는 팀"] },
  { re: /(?<![가-힣])검(?![가-힣])|소드|sword|블레이드|blade|나이트(?![가-힣])|knight|기사|사무라이|samurai|무사/i, lines: ["검을 뽑을 시간입니다", "날카로운 한 수로 승부를 가릅니다"] },
  { re: /로켓|rocket|제트|jet|스피드|speed|터보|turbo|부스터|booster|우주|space/i, lines: ["목표를 향해, 발사 준비 완료", "멈추지 않는 가속으로"] },
  { re: /왕|(?<![가-힣])킹(?![가-힣])|king|퀸|queen|로열|royal|crown|크라운|엠퍼러|emperor|제국|empire/i, lines: ["왕관의 무게를 즐길 시간입니다", "정상에 서는 순간을 향해"] },
  { re: /레전드|legend|용사|히어로|hero|챔피언|champion|위너|winner|승리|victory|글로리|glory|영광/i, lines: ["이름 그대로, 결과로 보여 줍니다", "전설은 지금부터 쓰입니다"] },
  { re: /다이아|diamond|보석|젬|gem|크리스탈|crystal|골드|gold|실버|silver/i, lines: ["다듬을수록 빛나는 원석처럼", "깨지지 않는 빛으로 승부합니다"] },
  { re: /고스트|ghost|섀도|shadow|그림자|어쌔신|assassin|닌자|ninja|데몬|demon|악마|dark|다크|블랙|black/i, lines: ["그림자 속에서 조용히 노립니다", "보이지 않는 곳에서 판을 만듭니다"] },
  { re: /레이서|racer|레이싱|racing|드라이브|drive|라이더|rider|러너|runner/i, lines: ["출발선에서 이미 한 발 앞서 갑니다", "속도로 승부를 냅니다"] },
  { re: /유나이티드|united|연합|패밀리|family|크루|crew|팀워크|하나|(?<![가-힣])원(?![가-힣])/i, lines: ["하나로 뭉친 힘을 보여 줍니다", "함께라서 더 강한 팀입니다"] },
  { re: /드림|dream|꿈|희망|hope|비전|vision|미래|future|넥스트|next|(?<![가-힣])뉴(?![가-힣])|new/i, lines: ["꿈꾸던 무대의 첫 장입니다", "오늘의 도전이 내일의 역사가 됩니다"] },
  { re: /e스포츠|esports|게이밍|gaming|게임|game/i, lines: ["한 판 한 판이 곧 이야기입니다", "게임으로 증명하는 시즌입니다"] },
];

// 아무 단어도 못 찾았을 때: 이름을 넣어 쓰는 문구(조사 문제가 없도록 이름 뒤에는 '의'·쉼표만 사용)
const NAME_LINES: ((n: string) => string)[] = [
  (n) => `${n}의 첫 장이 열립니다`,
  (n) => `모두가 ${n}의 이름을 기억하게 될 겁니다`,
  (n) => `${n}, 이제 증명할 시간입니다`,
  (n) => `${n}의 이야기는 지금부터입니다`,
  (n) => `${n}, 첫 경기가 시즌의 방향을 정합니다`,
  (n) => `팬들이 ${n}의 첫 선택을 지켜봅니다`,
];

const hash = (s: string): number => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h; };

/** 팀 이름(한글·영문 이름을 공백으로 이어 넣어도 됨)으로 문구를 만듭니다. */
export function teamMotto(names: string, display: string): string {
  const text = names.trim();
  const h = hash(text || display);
  for (const t of THEMES) if (t.re.test(text)) return t.lines[(h >>> 3) % t.lines.length];
  const n = (display || text).trim().slice(0, 18);
  return NAME_LINES[(h >>> 3) % NAME_LINES.length](n);
}
