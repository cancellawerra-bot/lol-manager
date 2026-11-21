// 판타지 드래프트 팀 필터용 구단 계보 (Grok 2026-11-22, v2.19.0).
// 지금 LCK 구단 이름으로 고르면 같은 계보의 옛 이름 카드도 함께 보입니다. 게임 표시용이며 공식 자료가 아닙니다.
export const TEAM_LINEAGE: { key: string; label: string; teams: string[] }[] = [
  { key: "Gen.G", label: "Gen.G (Samsung 포함)", teams: ["Gen.G", "KSV eSports", "Samsung Galaxy", "Samsung Blue", "Samsung Ozone", "MVP Ozone", "MVP Blue"] },
  { key: "T1", label: "T1 (SK Telecom T1 포함)", teams: ["T1", "SK Telecom T1", "SK Telecom T1 1", "SK Telecom T1 2", "SK Telecom T1 K", "SK Telecom T1 S"] },
  { key: "Hanwha Life Esports", label: "한화생명 (ROX 포함)", teams: ["Hanwha Life Esports", "ROX Tigers"] },
  { key: "KT Rolster", label: "KT Rolster", teams: ["KT Rolster", "KT Rolster A", "KT Rolster B", "KT Rolster Arrows", "KT Rolster Bullets"] },
  { key: "Dplus Kia", label: "Dplus KIA", teams: ["Dplus Kia"] },
  { key: "DRX", label: "DRX (킹존·롱주 포함)", teams: ["DRX", "Kiwoom DRX", "Kingzone DragonX", "Longzhu Gaming", "Incredible Miracle", "Incredible Miracle 1", "Incredible Miracle 2"] },
  { key: "DN SOOPers", label: "DN SOOPers", teams: ["DN SOOPers", "Rebels Anarchy"] },
  { key: "Nongshim RedForce", label: "농심 레드포스", teams: ["Nongshim RedForce", "Team Dynamics"] },
  { key: "BNK FEARX", label: "BNK FEARX (샌드박스 포함)", teams: ["BNK FEARX", "Liiv SANDBOX"] },
  { key: "HANJIN BRION", label: "HANJIN BRION", teams: ["HANJIN BRION"] },
];
const BY_KEY: Record<string, string[]> = Object.fromEntries(TEAM_LINEAGE.map((l) => [l.key, l.teams]));
/** team 필터 값: "all" | "g:<계보 key>" | "t:<카드 팀 이름>" */
export function teamMatch(filter: string | undefined, team: string): boolean {
  if (!filter || filter === "all") return true;
  if (filter.startsWith("g:")) return (BY_KEY[filter.slice(2)] ?? []).includes(team);
  return filter.slice(2) === team;
}
export const LINEAGE_TEAMS = new Set(TEAM_LINEAGE.flatMap((l) => l.teams));
