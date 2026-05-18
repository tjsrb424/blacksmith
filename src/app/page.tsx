import type { Metadata } from "next";
import { AuthGate } from "@/components/auth/AuthGate";
import { GameRoot } from "@/components/GameRoot";
import { isCrazyGamesBuild } from "@/lib/distribution";

export const metadata: Metadata = isCrazyGamesBuild()
  ? {
      title: "World's Greatest Blacksmith",
      description:
        "Start instantly and forge the strongest weapon in this casual enhancement game.",
    }
  : {
      title: "세계 최강의 대장장이",
      description:
        "닉네임만 입력하면 바로 시작할 수 있는 캐주얼 대장장이 강화 게임입니다.",
    };

export default function Home() {
  return (
    <AuthGate>
      <GameRoot />
    </AuthGate>
  );
}
