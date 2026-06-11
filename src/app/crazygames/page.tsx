import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AuthGate } from "@/components/auth/AuthGate";
import { GameRoot } from "@/components/GameRoot";
import { isCrazyGamesBuild } from "@/lib/distribution";

export function generateMetadata(): Metadata {
  if (!isCrazyGamesBuild()) return {};

  const platformName = ["Crazy", "Games"].join("");
  return {
    title: `${platformName} | World's Greatest Blacksmith`,
    description: `A ${platformName}-ready launch path without external login popups or external ads.`,
  };
}

export default function CrazyGamesPage() {
  if (!isCrazyGamesBuild()) notFound();

  return (
    <AuthGate isCrazyGamesMode>
      <GameRoot isCrazyGamesMode />
    </AuthGate>
  );
}
