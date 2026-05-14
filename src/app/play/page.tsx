import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { GameRoot } from "@/components/GameRoot";

export const metadata: Metadata = {
  title: "게임 플레이 | 세계 최강의 대장장이",
  description:
    "닉네임만 입력하면 바로 시작할 수 있는 캐주얼 대장장이 강화 게임입니다.",
};

export default function PlayPage() {
  return (
    <AuthGate>
      <GameRoot />
    </AuthGate>
  );
}
