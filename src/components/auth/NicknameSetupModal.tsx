"use client";

import { FormEvent, useState } from "react";
import { FantasyButton } from "@/components/ui/FantasyButton";
import { useLocale } from "@/lib/i18n/useLocale";
import {
  validateNickname,
  type NicknameValidationReason,
} from "@/lib/player/nickname";
import type { NicknameUpdateResponse } from "@/types/server";

type NicknameSetupModalProps = {
  onSaved: (response: NicknameUpdateResponse) => void;
};

function isErrorBody(
  body: unknown,
): body is { error?: string; reason?: NicknameValidationReason } {
  return Boolean(body && typeof body === "object" && "error" in body);
}

function nicknameReasonKey(reason?: string) {
  return reason ? `nickname.${reason}` : "error.nicknameSaveFailed";
}

export function NicknameSetupModal({ onSaved }: NicknameSetupModalProps) {
  const { t } = useLocale();
  const [nickname, setNickname] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const validation = validateNickname(nickname);
    if (!validation.ok) {
      setError(t(nicknameReasonKey(validation.reason)));
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
        | { error?: string; reason?: NicknameValidationReason };

      if (!response.ok || isErrorBody(body)) {
        throw new Error(
          isErrorBody(body)
            ? t(nicknameReasonKey(body.reason)) || body.error || t("error.nicknameSaveFailed")
            : t("error.nicknameSaveFailed"),
        );
      }

      onSaved(body);
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : t("error.nicknameSaveFailed"),
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/72 px-4 backdrop-blur-sm">
      <section className="w-full max-w-sm rounded-xl border border-violet-700/45 bg-zinc-950 p-5 shadow-2xl ring-1 ring-violet-500/20">
        <div className="space-y-1">
          <h2 className="text-lg font-bold text-violet-100">
            {t("account.nicknameSetup")}
          </h2>
          <p className="text-sm text-zinc-400">
            {t("account.nicknameSetupDescription")}
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
            placeholder={t("account.nicknamePlaceholder")}
          />

          <FantasyButton
            type="submit"
            variant="accent"
            className="w-full"
            disabled={saving}
          >
            {saving ? t("common.saving") : t("common.save")}
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
