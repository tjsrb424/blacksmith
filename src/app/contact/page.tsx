import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "문의 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이 베타 서비스 문의, 버그 제보, 지원 이메일 안내입니다.",
};

export default function ContactPage() {
  return (
    <PublicPageLayout
      eyebrow="Contact"
      title="문의 및 지원"
      description="버그 제보나 문의가 있다면 아래 이메일로 보내주세요."
    >
      <PublicSection title="지원 이메일">
        <p>
          <a
            className="text-lg font-bold text-amber-200 underline underline-offset-4"
            href="mailto:tjsrb424@gmail.com"
          >
            tjsrb424@gmail.com
          </a>
        </p>
      </PublicSection>
      <PublicSection title="버그 제보 안내">
        <p>
          빠른 확인을 위해 닉네임, 접속 기기, 브라우저, 발생 화면, 어떤 행동을
          했는지, 오류 메시지, 대략적인 발생 시간, 가능하면 스크린샷을 함께
          적어주시면 도움이 됩니다.
        </p>
      </PublicSection>
      <PublicSection title="베타 서비스 안내">
        <p>
          현재 서비스는 베타 단계입니다. 밸런스, UI, 서버 저장, 랭킹 정책은
          테스트 결과에 따라 변경될 수 있습니다.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
