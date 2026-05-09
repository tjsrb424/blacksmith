import { AuthGate } from "@/components/auth/AuthGate";
import { GameRoot } from "@/components/GameRoot";

export default function Home() {
  return (
    <AuthGate>
      <GameRoot />
    </AuthGate>
  );
}
