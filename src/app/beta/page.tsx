import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "서비스 안내 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이의 주요 기능, 업데이트 방향, 데이터 운영 기준을 안내합니다.",
};

export default function ServiceInfoPage() {
  return (
    <PublicPageLayout
      eyebrow="Guide"
      title="서비스 안내"
      description="세계 최강의 대장장이는 무기 강화, 제련, 초월, 랭킹 경쟁을 중심으로 한 캐주얼 웹게임입니다."
    >
      <PublicSection title="현재 가능한 기능">
        <ul className="list-disc space-y-1 pl-5">
          <li>무기 구매, 강화, 판매</li>
          <li>제련로 생산, 수령, 업그레이드</li>
          <li>+15 이후 초월</li>
          <li>주간 랭킹과 월드레코드</li>
          <li>닉네임 기반 즉시 시작</li>
          <li>Google 계정 연동</li>
        </ul>
      </PublicSection>

      <PublicSection title="업데이트 안내">
        <p>
          게임 밸런스, UI, 일부 기능은 더 나은 플레이 경험을 위해 조정될 수
          있습니다.
        </p>
      </PublicSection>

      <PublicSection title="데이터 안내">
        <p>
          비정상적인 기록이나 오류로 생성된 데이터는 운영 기준에 따라 조정될 수
          있습니다.
        </p>
      </PublicSection>

      <PublicSection title="피드백">
        <p>
          불편한 점, 버그, 밸런스 의견은 문의 페이지를 통해 보내주세요.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
