import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "게임 소개 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이의 게임 개요, 강화 리스크, 판매 성장, 랭킹 경쟁, 베타 테스트 상태를 소개합니다.",
};

export default function AboutPage() {
  return (
    <PublicPageLayout
      eyebrow="About"
      title="게임 소개"
      description="세계 최강의 대장장이는 무기 강화와 판매, 제련, 초월, 랭킹 경쟁을 중심으로 한 웹 기반 캐주얼 강화 게임입니다."
    >
      <PublicSection title="게임 개요">
        <p>
          플레이어는 대장장이가 되어 무기를 구매하고 강화합니다. 강화에 성공하면
          무기의 가치가 오르고, 판매 수익으로 더 좋은 무기에 도전할 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="핵심 재미">
        <p>
          짧은 조작으로 강화 결과를 확인하고, 성공과 실패 사이에서 다음 선택을
          결정하는 긴장감이 핵심입니다. 높은 단계의 무기는 큰 보상을 주지만,
          실패 위험도 함께 커집니다.
        </p>
      </PublicSection>
      <PublicSection title="강화와 파괴">
        <p>
          +8 강화 이후에는 실패 시 내구도가 감소할 수 있습니다. 내구도가 0이 된
          무기는 파괴되며, 일부 잔해 보상을 받을 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="판매와 성장">
        <p>
          가치가 오른 무기를 판매하면 골드를 획득합니다. 골드는 다음 무기를
          구매하거나 성장 루프를 이어가는 데 사용됩니다.
        </p>
      </PublicSection>
      <PublicSection title="랭킹과 월드레코드">
        <p>
          Google 로그인 사용자는 서버 저장과 랭킹 참여가 가능합니다. 최고 가치
          무기, 초월 기록, 판매 기록 등은 주간 랭킹과 월드레코드 경쟁으로
          이어집니다.
        </p>
      </PublicSection>
      <PublicSection title="베타 테스트 안내">
        <p>
          현재 서비스는 public beta 준비 단계입니다. 밸런스, UI, 기능은 테스트
          결과에 따라 변경될 수 있으며, 일부 광고 보상 기능은 승인 이후
          활성화될 예정입니다.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
