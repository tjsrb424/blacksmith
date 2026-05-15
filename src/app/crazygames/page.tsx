import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { GameRoot } from "@/components/GameRoot";

export const metadata: Metadata = {
  title: "CrazyGames | 세계 최강의 대장장이",
  description:
    "CrazyGames 제출용으로 외부 로그인과 AdFit 광고를 제외한 게임 실행 경로입니다.",
};

export default function CrazyGamesPage() {
  return (
    <AuthGate isCrazyGamesMode>
      <GameRoot isCrazyGamesMode />
    </AuthGate>
  );
}
