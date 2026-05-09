"use client";

import { FormEvent, useState } from "react";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { validateNickname } from "@/lib/player/nickname";
import type { NicknameUpdateResponse } from "@/types/server";

type NicknameSetupModalProps = {
  onSaved: (response: NicknameUpdateResponse) => void;
};

function isErrorBody(body: unknown): body is { error?: string } {
  return Boolean(body && typeof body === "object" && "error" in body);
}

export function NicknameSetupModal({ onSaved }: NicknameSetupModalProps) {
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validateNickname(nickname);
    if (!validation.ok) {
      setError(validation.message);
      return;
    }

    setSaving(true);
    try {
      const response = await fetch("/api/player/nickname", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ nickname: validation.nickname }),
      });
      const body = (await response.json()) as
        | NicknameUpdateResponse
        | { error?: string };

      if (!response.ok || isErrorBody(body)) {
        throw new Error(
          isErrorBody(body) && body.error
            ? body.error
            : "닉네임 저장에 실패했습니다.",
        );
      }

      onSaved(body);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : "닉네임 저장에 실패했습니다.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-xl border border-violet-700/45 bg-zinc-950 p-5 shadow-2xl ring-1 ring-violet-500/20">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-violet-100">닉네임 설정</h2>
          <p className="text-sm text-zinc-400">
            랭킹에 표시될 이름을 입력해주세요.
          </p>
        </div>

        <form className="mt-5 space-y-4" onSubmit={onSubmit}>
          <input
            type="text"
            value={nickname}
            minLength={2}
            maxLength={12}
            autoFocus
            onChange={(event) => setNickname(event.target.value)}
            className="w-full rounded-lg border border-zinc-800 bg-zinc-900 px-3 py-3 text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-500/70 focus:ring-2 focus:ring-violet-500/20"
            placeholder="2~12자"
          />

          <FantasyButton
            type="submit"
            variant="accent"
            className="w-full"
            disabled={saving}
          >
            {saving ? "저장 중..." : "저장"}
          </FantasyButton>
        </form>

        {error ? (
          <p className="mt-3 rounded-lg border border-red-800/60 bg-red-950/35 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        ) : null}
      </section>
    </div>
  );
}
