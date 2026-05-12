import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter } from "@/components/public/PublicFooter";
import { BACKGROUND_ASSETS } from "@/data/assets";

export const metadata: Metadata = {
  title: "세계 최강의 대장장이",
  description:
    "세계 최강의 대장장이는 무기 강화, 판매, 제련, 초월, 랭킹 경쟁을 즐기는 웹 기반 캐주얼 강화 게임입니다.",
};

const FEATURES = [
  "무기 구매",
  "무기 강화",
  "내구도와 파괴",
  "판매 수익",
  "제련로 생산",
  "초월",
  "주간 랭킹",
  "월드레코드",
] as const;

export default function Home() {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#070708] text-zinc-100">
      <section className="relative min-h-[calc(100dvh-88px)] px-4 pb-10 pt-5">
        <div className="absolute inset-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={BACKGROUND_ASSETS.forge}
            alt=""
            className="h-full w-full object-cover opacity-42"
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,5,6,0.62),rgba(5,5,6,0.78)_45%,#070708_100%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_28%,rgba(245,158,11,0.18),transparent_36%)]" />
        </div>

        <div className="relative z-10 mx-auto flex min-h-[calc(100dvh-128px)] w-full min-w-0 max-w-5xl flex-col">
          <header className="flex min-w-0 flex-col gap-3 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="font-bold text-amber-100">세계 최강의 대장장이</div>
            <nav className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-300">
              <Link href="/about" className="rounded px-2 py-1 hover:text-amber-200">
                소개
              </Link>
              <Link
                href="/how-to-play"
                className="rounded px-2 py-1 hover:text-amber-200"
              >
                플레이 방법
              </Link>
              <Link
                href="/play"
                className="rounded border border-amber-600/45 bg-amber-500/18 px-3 py-1.5 font-semibold text-amber-100"
              >
                게임 시작
              </Link>
            </nav>
          </header>

          <div className="flex flex-1 items-center py-12">
            <div className="max-w-3xl">
              <p className="text-xs font-bold uppercase tracking-[0.28em] text-amber-400/90">
                Web Casual Forge Game
              </p>
              <h1 className="mt-4 text-4xl font-black leading-tight text-amber-50 sm:text-6xl">
                세계 최강의 대장장이
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-zinc-200 sm:text-lg">
                무기를 구매하고, 강화하고, 판매하며 더 높은 가치를 노리는 웹
                기반 캐주얼 강화 게임입니다.
              </p>
              <p className="mt-3 max-w-2xl text-sm leading-7 text-zinc-400 sm:text-base">
                +15 강화 이후에는 초월에 도전할 수 있으며, 최고 가치 무기로
                주간 랭킹과 월드레코드 경쟁에 참여할 수 있습니다.
              </p>
              <div className="mt-7 flex flex-wrap gap-3">
                <Link
                  href="/play"
                  className="rounded-lg bg-amber-500 px-5 py-3 text-sm font-black text-zinc-950 shadow-[0_12px_34px_rgba(245,158,11,0.25)]"
                >
                  게임 시작하기
                </Link>
                <Link
                  href="/beta"
                  className="rounded-lg border border-amber-700/45 bg-black/35 px-5 py-3 text-sm font-bold text-amber-100"
                >
                  베타 안내 보기
                </Link>
              </div>
              <p className="mt-4 text-xs leading-6 text-zinc-500">
                로그인 없이 공개 페이지를 둘러볼 수 있습니다. Google 로그인 시
                진행 상황 저장, 랭킹 등록, 월드레코드 기록이 가능합니다.
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-5xl gap-4 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
        {FEATURES.map((feature) => (
          <div
            key={feature}
            className="rounded-lg border border-amber-900/35 bg-black/42 p-4 text-sm font-semibold text-zinc-200 ring-1 ring-amber-700/10"
          >
            {feature}
          </div>
        ))}
      </section>

      <section className="mx-auto max-w-5xl px-4 pb-12">
        <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-5 text-sm leading-7 text-zinc-300 sm:p-7">
          <h2 className="text-xl font-bold text-amber-100">현재 베타 테스트 중</h2>
          <p className="mt-3">
            밸런스, 기능, UI는 계속 조정될 수 있습니다. public beta에서는 광고
            보상이 비활성화되어 있을 수 있으며, 선택형 보상 광고는 H5 Games Ads
            검토 이후 별도 단계로 활성화할 예정입니다.
          </p>
        </div>
      </section>

      <PublicFooter />
    </main>
  );
}
