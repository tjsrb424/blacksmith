import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "개인정보처리방침 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이 서비스 이용과 관련해 처리되는 정보와 이용 목적을 안내합니다.",
};

export default function PrivacyPage() {
  return (
    <PublicPageLayout
      eyebrow="Privacy"
      title="개인정보처리방침"
      description="본 문서는 세계 최강의 대장장이 서비스 이용과 관련해 처리되는 정보와 이용 목적을 안내합니다."
    >
      <PublicSection title="수집하는 정보">
        <p>서비스 이용 과정에서 다음 정보가 저장될 수 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>닉네임</li>
          <li>게스트 식별자</li>
          <li>계정 연동 시 제공되는 기본 계정 식별 정보</li>
          <li>게임 진행 정보</li>
          <li>보유 무기, 강화 수치, 내구도, 보유 재화</li>
          <li>제련로 상태</li>
          <li>랭킹 및 월드레코드 기록</li>
          <li>오류 확인과 서비스 개선을 위한 최소한의 이용 기록</li>
        </ul>
      </PublicSection>

      <PublicSection title="수집하지 않는 정보">
        <p>
          서비스는 Google 비밀번호, 개인 메일, 연락처, 결제 정보, 주민등록번호
          등 민감한 정보를 수집하지 않습니다.
        </p>
      </PublicSection>

      <PublicSection title="정보 이용 목적">
        <p>수집된 정보는 다음 목적으로 사용됩니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>게임 진행 저장</li>
          <li>계정 연동 및 이어하기 제공</li>
          <li>랭킹 및 월드레코드 표시</li>
          <li>부정 이용 방지</li>
          <li>오류 확인과 서비스 개선</li>
          <li>문의 대응</li>
        </ul>
        <p>
          닉네임은 랭킹 등 게임 내 표시 목적으로 사용될 수 있으며, 부적절한
          닉네임은 제한될 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="게스트 플레이 정보">
        <p>
          계정 없이 플레이할 수 있도록 게스트 식별자와 게임 진행 정보가 저장될
          수 있습니다.
        </p>
        <p>
          계정 연동 시 게스트 진행 정보가 Google 계정과 연결될 수 있습니다.
          이미 저장된 계정 기록이 있는 경우 사용자가 선택한 기록을 기준으로
          이어서 플레이할 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="기록 초기화와 삭제">
        <p>
          사용자는 서비스 내 기능 또는 문의를 통해 게스트 기록 초기화나 계정
          데이터 삭제를 요청할 수 있습니다. 계정 데이터 삭제는 Google 계정 자체
          삭제가 아니라, 이 게임에 저장된 진행 정보 삭제를 의미합니다.
        </p>
        <p>
          부정 이용 방지와 서비스 안정성을 위해 필요한 최소한의 기록은 일정 기간
          보관될 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="외부 서비스 이용">
        <p>
          서비스 운영을 위해 외부 인증, 호스팅, 데이터 저장, 광고 또는 분석
          서비스가 사용될 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="보관 기간">
        <p>
          정보는 서비스 제공과 운영에 필요한 기간 동안 보관될 수 있습니다. 삭제
          요청이나 문의는 문의 페이지 또는 이메일을 통해 접수할 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="문의">
        <p>
          개인정보 관련 문의는{" "}
          <a className="text-amber-200 underline" href="/contact">
            문의 페이지
          </a>
          또는 tjsrb424@gmail.com 으로 보내주세요.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
