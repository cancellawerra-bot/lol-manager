import type { VerifiedBirth } from "./training";
const checkedAt = "2026-11-18";
const bio = (date: string, sourceUrl: string): VerifiedBirth => ({ date, sourceUrl, checkedAt });
const gwr = "https://www.guinnessworldrecords.com/world-records/729977-oldest-player-to-win-the-league-of-legends-world-championship";
/** 직접 확인한 공개 생년만 등록합니다. 누락 선수는 나이를 추정하지 않습니다. */
export const PLAYER_BIRTHDATES: Readonly<Record<string, VerifiedBirth>> = {
  faker: bio("1996-05-07", gwr),
  deft: bio("1996-10-23", gwr),
  chovy: bio("2001-03-03", "https://liquipedia.net/leagueoflegends/Chovy"),
  canyon: bio("2001-06-18", "https://liquipedia.net/leagueoflegends/Canyon"),
  keria: bio("2002-10-14", "https://liquipedia.net/leagueoflegends/Keria"),
  ruler: bio("1998-12-29", "https://liquipedia.net/leagueoflegends/Ruler"),
  peanut: bio("1998-02-03", "https://liquipedia.net/leagueoflegends/Peanut"),
  gumayusi: bio("2002-02-06", "https://liquipedia.net/esports/Esports_World_Cup/2025/Player_List"),
  bdd: bio("1999-03-01", "https://liquipedia.net/leagueoflegends/Bdd"),
  oner: bio("2002-12-24", "https://liquipedia.net/leagueoflegends/Oner"),
  zeus: bio("2004-01-31", "https://liquipedia.net/leagueoflegends/Zeus"),
};
