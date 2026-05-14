import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "게임 소개 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이의 강화, 판매, 제련, 초월, 랭킹 경쟁을 소개합니다.",
};

export default function AboutPage() {
  return (
    <PublicPageLayout
      eyebrow="About"
      title="게임 소개"
      description="세계 최강의 대장장이는 무기 강화와 판매, 제련, 초월, 랭킹 경쟁을 중심으로 한 웹 기반 캐주얼 강화 게임입니다."
    >
      <PublicSection title="강화와 성장">
        <p>
          플레이어는 대장장이가 되어 무기를 구매하고 강화합니다. 강화에
          성공하면 무기의 가치가 오르고, 판매 수익으로 더 높은 단계에 도전할
          수 있습니다.
        </p>
        <p>
          짧은 조작으로 강화 결과를 확인하고, 성공과 실패 사이에서 다음 선택을
          결정하는 긴장감이 핵심입니다.
        </p>
      </PublicSection>

      <PublicSection title="내구도와 파괴">
        <p>
          +8 강화 이후에는 실패 시 내구도가 감소할 수 있습니다. 내구도가 0이 된
          무기는 파괴되며, 일부 보상을 받을 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="초월">
        <p>
          +15 이후에는 초월에 도전할 수 있습니다. 초월은 더 높은 기록과 랭킹
          경쟁으로 이어집니다.
        </p>
      </PublicSection>

      <PublicSection title="시작과 계정 연동">
        <p>
          닉네임으로 바로 시작할 수 있으며, Google 계정 연동을 통해 진행 정보를
          이어서 이용할 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="랭킹과 월드레코드">
        <p>
          최고 가치 무기, 초월 기록, 판매 기록은 랭킹과 월드레코드 경쟁으로
          이어집니다.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
