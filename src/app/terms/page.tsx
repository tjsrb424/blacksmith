import type { Metadata } from "next";
import { PublicPageLayout, PublicSection } from "@/components/public/PublicPageLayout";

export const metadata: Metadata = {
  title: "이용약관 | 세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이 서비스 이용 조건, 게임 데이터, 금지 행위, 문의 안내입니다.",
};

export default function TermsPage() {
  return (
    <PublicPageLayout
      eyebrow="Terms"
      title="이용약관"
      description="세계 최강의 대장장이는 무기 강화, 판매, 제련, 초월, 랭킹 경쟁을 제공하는 웹 기반 캐주얼 게임입니다."
    >
      <PublicSection title="서비스 이용">
        <p>
          사용자는 닉네임으로 게임을 시작할 수 있으며, Google 계정 연동을 통해
          진행 정보를 이어서 이용할 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="계정 및 닉네임">
        <p>
          닉네임은 게임 내 표시와 랭킹에 사용될 수 있습니다. 부적절한 닉네임,
          운영자 사칭, 타인에게 불쾌감을 줄 수 있는 표현은 제한될 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="게임 데이터">
        <p>
          게임 진행 정보, 랭킹, 기록은 서비스 운영 기준에 따라 저장되고
          표시됩니다. 오류 또는 비정상적인 방법으로 생성된 기록은 조정되거나
          삭제될 수 있습니다.
        </p>
        <p>
          계정 연동 또는 기록 선택 과정에서 선택되지 않은 기록은 보관,
          비활성화 또는 랭킹에서 제외될 수 있습니다. 비정상적인 기록이나 부정
          이용 기록은 삭제 요청 후에도 운영상 필요한 범위에서 확인될 수
          있습니다.
        </p>
      </PublicSection>

      <PublicSection title="금지 행위">
        <p>다음 행위는 제한될 수 있습니다.</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>조작, 해킹, 비정상적인 요청</li>
          <li>자동화, 매크로 사용</li>
          <li>랭킹 조작</li>
          <li>광고 또는 보상 시스템 악용</li>
          <li>다른 유저의 이용 방해</li>
          <li>서비스 운영을 방해하는 행위</li>
        </ul>
      </PublicSection>

      <PublicSection title="서비스 변경">
        <p>
          더 나은 플레이 경험을 위해 밸런스, UI, 기능은 조정될 수 있습니다.
          필요한 경우 점검이나 일시적인 서비스 중단이 발생할 수 있습니다.
        </p>
      </PublicSection>

      <PublicSection title="문의">
        <p>
          문의는{" "}
          <a className="text-amber-200 underline" href="/contact">
            문의 페이지
          </a>
          또는 tjsrb424@gmail.com 으로 보내주세요.
        </p>
      </PublicSection>
    </PublicPageLayout>
  );
}
