import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "이용약관 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이 베타 서비스 이용 조건, 금지 행위, 랭킹, 광고 보상, 문의 안내입니다.",
};

export default function TermsPage() {
  return (
    <PublicPageLayout
      eyebrow="Terms"
      title="이용약관"
      description="세계 최강의 대장장이는 무기 강화, 판매, 제련, 랭킹 중심의 웹게임입니다."
    >
      <PublicSection title="서비스 개요">
        <p>
          본 서비스는 무기 구매, 강화, 판매, 제련, 초월, 랭킹 경쟁을 제공하는 웹
          기반 캐주얼 게임입니다.
        </p>
      </PublicSection>
      <PublicSection title="베타 테스트 안내">
        <p>
          현재 베타 서비스이며 데이터 초기화, 밸런스 변경, 기능 변경, 오류가
          발생할 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="계정 및 닉네임">
        <p>
          Google 로그인을 사용할 수 있으며 닉네임은 랭킹에 표시될 수 있습니다.
          부적절한 닉네임은 제한될 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="금지 행위">
        <ul className="list-disc space-y-1 pl-5">
          <li>조작, 해킹, 비정상 요청</li>
          <li>랭킹 조작, 자동화, 매크로</li>
          <li>광고 보상 악용</li>
          <li>다른 유저 또는 서비스 운영 방해</li>
          <li>서버 API를 의도와 다르게 직접 호출하는 행위</li>
        </ul>
      </PublicSection>
      <PublicSection title="랭킹과 기록">
        <p>
          서버 기준 데이터만 유효합니다. 비정상 기록은 수정 또는 삭제될 수
          있으며, 베타 중 랭킹이 초기화될 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="광고 보상">
        <p>
          광고 보상은 선택형입니다. 광고가 준비되지 않은 경우 제공되지 않을 수
          있고, 광고 시청이 완료되지 않으면 보상이 지급되지 않습니다. 현재 public
          beta에서는 광고 보상이 비활성화되어 있을 수 있습니다.
        </p>
      </PublicSection>
      <PublicSection title="면책 및 문의">
        <p>
          베타 중 오류, 점검, 데이터 변경이 발생할 수 있으며 서비스는 예고 없이
          변경되거나 일시 중단될 수 있습니다. 문의는{" "}
          <a className="text-amber-200 underline" href="/contact">문의 페이지</a> 또는
          tjsrb424@gmail.com 으로 보내주세요.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
