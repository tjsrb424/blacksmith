import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "문의 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이 문의, 버그 제보, 지원 이메일 안내입니다.",
};

export default function ContactPage() {
  return (
    <PublicPageLayout
      eyebrow="Contact"
      title="문의 및 지원"
      description="불편한 점이나 문의가 있다면 아래 이메일로 보내주세요."
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

      <PublicSection title="문의 안내">
        <p>
          빠른 확인을 위해 닉네임, 접속 기기, 브라우저, 발생 화면, 어떤 행동을
          했는지, 오류 메시지, 가능하다면 스크린샷을 함께 적어주세요.
        </p>
      </PublicSection>

      <PublicSection title="피드백">
        <p>
          밸런스 의견, 불편한 흐름, 개선 아이디어도 환영합니다. 보내주신 의견은
          더 나은 플레이 경험을 만드는 데 참고합니다.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
