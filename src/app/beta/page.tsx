import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "베타 안내 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이 베타 테스트의 현재 기능, 준비 중인 기능, 데이터 안내를 확인할 수 있습니다.",
};

export default function BetaPage() {
  return (
    <PublicPageLayout
      eyebrow="Beta"
      title="베타 테스트 안내"
      description="현재 베타 테스트 중이며 밸런스, 기능, UI는 변경될 수 있습니다."
    >
      <PublicSection title="현재 상태">
        <p>
          세계 최강의 대장장이는 Vercel public beta 준비 중입니다. 테스트 중
          오류가 발생할 수 있으며, 플레이 데이터와 랭킹 정책은 조정될 수
          있습니다.
        </p>
      </PublicSection>
      <PublicSection title="현재 가능한 기능">
        <ul className="list-disc space-y-1 pl-5">
          <li>무기 구매, 강화, 판매</li>
          <li>제련로 생산, 수령, 업그레이드</li>
          <li>+15 이후 초월</li>
          <li>주간 랭킹과 월드레코드</li>
          <li>Google 로그인 기반 서버 저장</li>
        </ul>
      </PublicSection>
      <PublicSection title="아직 준비 중인 기능">
        <ul className="list-disc space-y-1 pl-5">
          <li>실제 광고 보상</li>
          <li>H5 Games Ads 승인 후 선택형 보상 광고</li>
          <li>앱 패키징</li>
          <li>추가 밸런스 조정과 신규 콘텐츠</li>
        </ul>
      </PublicSection>
      <PublicSection title="데이터 안내">
        <p>
          베타 중 데이터 초기화가 발생할 수 있습니다. 랭킹과 기록은 변경 또는
          초기화될 수 있으며, 비정상 기록은 수정 또는 삭제될 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="광고 보상 안내">
        <p>
          현재 public beta에서는 광고 보상이 비활성화되어 있을 수 있습니다. H5
          Games Ads 검토가 완료되면 선택형 보상 광고를 활성화할 예정입니다.
        </p>
      </PublicSection>
      <PublicSection title="피드백 요청">
        <p>
          불편한 점, 버그, 밸런스 의견, 모바일/PC 플레이 경험은 문의 페이지를
          통해 보내주세요.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
