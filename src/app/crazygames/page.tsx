import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { GameRoot } from "@/components/GameRoot";

export const metadata: Metadata = {
  title: "CrazyGames | World's Greatest Blacksmith",
  description:
    "A CrazyGames-ready launch path without external login popups or external ads.",
};

export default function CrazyGamesPage() {
  return (
    <AuthGate isCrazyGamesMode>
      <GameRoot isCrazyGamesMode />
    </AuthGate>
  );
}
