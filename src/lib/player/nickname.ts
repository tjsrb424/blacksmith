const NICKNAME_PATTERN = /^[가-힣a-zA-Z0-9]+$/;

export function normalizeNickname(input: string): string {
  return input.trim();
}

export function validateNickname(input: string):
  | { ok: true; nickname: string }
  | { ok: false; message: string } {
  const nickname = normalizeNickname(input);

  if (nickname.length < 2 || nickname.length > 12) {
    return { ok: false, message: "닉네임은 2~12자로 입력해주세요." };
  }

  if (!NICKNAME_PATTERN.test(nickname)) {
    return {
      ok: false,
      message: "닉네임은 한글, 영문, 숫자만 사용할 수 있습니다.",
    };
  }

  return { ok: true, nickname };
}
