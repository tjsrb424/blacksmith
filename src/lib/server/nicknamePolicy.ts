import "server-only";

import {
  nicknameValidationMessage,
  validateNicknameFormat,
  type NicknameValidationResult,
} from "@/lib/player/nickname";
import {
  isNicknameProfane,
  isNicknameReserved,
} from "@/lib/server/nicknameBlocklist";

export function validateNicknamePolicy(input: string): NicknameValidationResult {
  const format = validateNicknameFormat(input);
  if (!format.ok) return format;

  if (isNicknameProfane(format.nickname)) {
    return {
      ok: false,
      reason: "profanity",
      message: nicknameValidationMessage("profanity"),
    };
  }

  if (isNicknameReserved(format.nickname)) {
    return {
      ok: false,
      reason: "reserved",
      message: nicknameValidationMessage("reserved"),
    };
  }

  return format;
}
