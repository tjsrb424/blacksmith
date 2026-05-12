import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { GameRoot } from "@/components/GameRoot";

export const metadata: Metadata = {
  title: "게임 플레이 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이에서 무기를 구매하고 강화하며 제련, 초월, 랭킹 경쟁을 플레이합니다.",
};

export default function PlayPage() {
  return (
    <AuthGate>
      <GameRoot />
    </AuthGate>
  );
}
