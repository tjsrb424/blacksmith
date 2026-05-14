import "server-only";

import { getNicknameSearchKey } from "@/lib/player/nickname";

const RESERVED_NICKNAMES = [
  "gm",
  "admin",
  "administrator",
  "official",
  "moderator",
  "운영자",
  "관리자",
  "공식",
  "세계최강의대장장이",
] as const;

const PROFANITY_PATTERNS = [
  "badwordtest",
  "욕설테스트",
  "비하테스트",
] as const;

const reservedKeys = new Set(RESERVED_NICKNAMES.map(getNicknameSearchKey));
const profanityKeys = PROFANITY_PATTERNS.map(getNicknameSearchKey);

export function isNicknameReserved(input: string): boolean {
  return reservedKeys.has(getNicknameSearchKey(input));
}

export function isNicknameProfane(input: string): boolean {
  const searchKey = getNicknameSearchKey(input);
  return profanityKeys.some((blocked) => blocked && searchKey.includes(blocked));
}
