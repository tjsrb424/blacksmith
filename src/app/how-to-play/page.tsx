import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "플레이 방법 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이의 플레이 방법과 강화, 판매, 제련, 초월, 랭킹 시스템을 안내합니다.",
};

export default function HowToPlayPage() {
  return (
    <PublicPageLayout
      eyebrow="Guide"
      title="플레이 방법"
      description="기본 흐름은 무기를 구매하고 강화한 뒤, 가치가 오른 무기를 판매하여 더 높은 등급의 무기에 도전하는 방식입니다."
    >
      <PublicSection title="1. 무기 구매와 장착">
        <p>
          무기상점에서 무기를 구매하고 장착합니다. 장착한 무기는 대장간 화면에서
          강화하거나 초월할 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="2. 강화">
        <p>
          제련의 불씨를 사용해 무기를 강화합니다. 강화 단계가 오를수록 무기
          가치가 상승하지만, 실패 위험도 커집니다.
        </p>
        <p>
          +8 강화 이후에는 실패 시 내구도가 감소할 수 있으며, 내구도가 0이 되면
          무기가 파괴됩니다.
        </p>
      </PublicSection>
      <PublicSection title="3. 파괴와 보상">
        <p>
          파괴된 무기는 사라지지만 일부 골드, 제련의 불씨, 초월석 보상을 받을 수
          있습니다. 위험 구간에서는 다음 강화를 신중하게 선택해야 합니다.
        </p>
      </PublicSection>
      <PublicSection title="4. 판매">
        <p>
          가치가 오른 무기는 판매할 수 있습니다. 보유 무기가 1개뿐인 경우 마지막
          무기는 판매할 수 없으며, 먼저 다른 무기를 구매한 뒤 판매해야 합니다.
        </p>
      </PublicSection>
      <PublicSection title="5. 제련로">
        <p>
          제련로는 시간이 지나면 제련의 불씨를 생산합니다. 수령하지 않은 불씨는
          보관 한도까지 쌓이며, 제련로를 업그레이드하면 생산량과 보관량이
          좋아집니다.
        </p>
      </PublicSection>
      <PublicSection title="6. 초월">
        <p>
          +15 강화 이후에는 초월에 도전할 수 있습니다. 초월은 무기의 가치를 크게
          올리지만 실패 위험도 함께 존재합니다.
        </p>
      </PublicSection>
      <PublicSection title="7. 주간 랭킹과 월드레코드">
        <p>
          로그인한 사용자는 서버에 기록을 저장하고 주간 랭킹, 월드레코드 경쟁에
          참여할 수 있습니다. 비정상 기록은 운영 정책에 따라 수정 또는 삭제될 수
          있습니다.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
