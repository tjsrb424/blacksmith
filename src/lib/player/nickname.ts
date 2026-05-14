export type NicknameValidationReason =
  | "too_short"
  | "too_long"
  | "invalid_characters"
  | "profanity"
  | "reserved"
  | "duplicate"
  | "cooldown";

export type NicknameValidationResult =
  | {
      ok: true;
      nickname: string;
      normalizedNickname: string;
    }
  | {
      ok: false;
      reason: NicknameValidationReason;
      message: string;
    };

const INVISIBLE_CHARACTERS =
  /[\u0000-\u001f\u007f-\u009f\u00ad\u034f\u061c\u115f\u1160\u17b4\u17b5\u180e\u200b-\u200f\u2028-\u202f\u205f\u2060-\u206f\ufeff]/g;
const ALLOWED_NICKNAME_PATTERN = /^[\p{Script=Hangul}A-Za-z0-9 ._-]+$/u;
const SPECIAL_CHARACTER_PATTERN = /[._-]/g;
const EDGE_SPECIAL_PATTERN = /^[ ._-]|[ ._-]$/;
const REPEATED_SPECIAL_PATTERN = /[._-]{2,}/;

export const NICKNAME_MESSAGES: Record<NicknameValidationReason, string> = {
  too_short: "닉네임은 2자 이상 입력해 주세요.",
  too_long: "닉네임은 12자 이하로 입력해 주세요.",
  invalid_characters: "사용할 수 없는 문자가 포함되어 있습니다.",
  profanity: "사용할 수 없는 표현이 포함되어 있습니다.",
  reserved: "사용할 수 없는 닉네임입니다.",
  duplicate: "이미 사용 중인 닉네임입니다.",
  cooldown: "닉네임은 잠시 후 다시 변경할 수 있습니다.",
};

function toCodePointLength(value: string) {
  return Array.from(value).length;
}

export function normalizeNickname(input: string): string {
  return input
    .normalize("NFKC")
    .replace(INVISIBLE_CHARACTERS, "")
    .trim()
    .replace(/\s+/g, " ");
}

export function getNicknameSearchKey(input: string): string {
  return normalizeNickname(input)
    .toLocaleLowerCase("ko-KR")
    .replace(/[\s._-]+/g, "");
}

export function validateNicknameFormat(input: string): NicknameValidationResult {
  const nickname = normalizeNickname(input);
  const length = toCodePointLength(nickname);

  if (length < 2) {
    return {
      ok: false,
      reason: "too_short",
      message: NICKNAME_MESSAGES.too_short,
    };
  }

  if (length > 12) {
    return {
      ok: false,
      reason: "too_long",
      message: NICKNAME_MESSAGES.too_long,
    };
  }

  const specialCount = nickname.match(SPECIAL_CHARACTER_PATTERN)?.length ?? 0;
  if (
    !ALLOWED_NICKNAME_PATTERN.test(nickname) ||
    EDGE_SPECIAL_PATTERN.test(nickname) ||
    REPEATED_SPECIAL_PATTERN.test(nickname) ||
    specialCount > 2
  ) {
    return {
      ok: false,
      reason: "invalid_characters",
      message: NICKNAME_MESSAGES.invalid_characters,
    };
  }

  return {
    ok: true,
    nickname,
    normalizedNickname: getNicknameSearchKey(nickname),
  };
}

export function validateNickname(input: string): NicknameValidationResult {
  return validateNicknameFormat(input);
}

export function nicknameValidationMessage(reason: NicknameValidationReason) {
  return NICKNAME_MESSAGES[reason] ?? NICKNAME_MESSAGES.invalid_characters;
}
