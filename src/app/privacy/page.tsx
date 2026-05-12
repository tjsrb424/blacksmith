import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이 베타 서비스의 개인정보 수집, 이용, 보관, 제3자 서비스 이용 안내입니다.",
};

export default function PrivacyPage() {
  return (
    <PublicPageLayout
      eyebrow="Privacy"
      title="개인정보처리방침"
      description="본 문서는 베타 서비스용 초안이며 정식 출시 전 보완될 수 있습니다."
    >
      <PublicSection title="수집하는 정보">
        <p>
          Google 로그인으로부터 제공되는 기본 계정 식별 정보, Supabase Auth
          사용자 ID, 닉네임, 게임 진행 데이터, 보유 무기, 강화 수치, 내구도,
          보유 재화, 제련로 상태, 랭킹 기록, 월드레코드 기록, 광고 보상
          요청/완료 로그를 저장할 수 있습니다.
        </p>
        <p>
          접속 오류 확인과 성능 진단을 위해 최소한의 이벤트 로그가 사용될 수
          있습니다.
        </p>
      </PublicSection>
      <PublicSection title="수집하지 않는 정보">
        <p>
          현재 결제 정보, 주민등록번호 등 민감한 개인정보, Google 비밀번호,
          개인 Google Drive, Gmail, 연락처 정보는 수집하지 않습니다.
        </p>
      </PublicSection>
      <PublicSection title="정보 이용 목적">
        <p>
          수집한 정보는 로그인 및 계정 식별, 게임 진행 저장, 랭킹/월드레코드
          표시, 부정 이용과 중복 보상 방지, 서비스 개선과 오류 확인, 베타 테스트
          품질 개선에 사용됩니다.
        </p>
      </PublicSection>
      <PublicSection title="제3자 서비스">
        <p>
          본 서비스는 Supabase, Vercel, Google OAuth, Google AdSense를 사용할 수
          있으며, 향후 H5 Games Ads 또는 기타 광고 서비스가 추가될 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="보관 기간">
        <p>
          정보는 베타 테스트 기간 동안 보관될 수 있습니다. 유저 요청 시 삭제를
          검토할 수 있으며, 운영 정책에 따라 보관 기준은 변경될 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="문의">
        <p>
          개인정보 관련 문의는 <a className="text-amber-200 underline" href="/contact">문의 페이지</a> 또는
          tjsrb424@gmail.com 으로 보내주세요.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
