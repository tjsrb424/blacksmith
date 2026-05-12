import Link from "next/link";
import type { ReactNode } from "react";
import { PublicFooter } from "@/components/public/PublicFooter";

export function PublicPageLayout({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-dvh overflow-x-hidden bg-[#070708] text-zinc-100">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(245,158,11,0.12),transparent_34%),linear-gradient(180deg,#070708_0%,#0b0907_46%,#050505_100%)]" />
      <div className="relative z-10 mx-auto flex min-h-dvh w-full min-w-0 max-w-5xl flex-col px-4">
        <header className="flex min-w-0 flex-col gap-3 py-5 sm:flex-row sm:items-center sm:justify-between">
          <Link href="/" className="min-w-0 font-bold text-amber-100">
            세계 최강의 대장장이
          </Link>
          <nav className="flex min-w-0 flex-wrap items-center gap-2 text-xs text-zinc-400">
            <Link className="rounded px-2 py-1 hover:text-amber-200" href="/about">
              소개
            </Link>
            <Link
              className="rounded px-2 py-1 hover:text-amber-200"
              href="/how-to-play"
            >
              플레이 방법
            </Link>
            <Link
              className="rounded border border-amber-700/40 bg-amber-600/15 px-3 py-1.5 font-semibold text-amber-100"
              href="/play"
            >
              게임 시작
            </Link>
          </nav>
        </header>

        <section className="py-8 sm:py-12">
          {eyebrow ? (
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-amber-500/90">
              {eyebrow}
            </p>
          ) : null}
          <h1 className="mt-3 max-w-3xl text-3xl font-black leading-tight text-amber-50 sm:text-5xl">
            {title}
          </h1>
          {description ? (
            <p className="mt-4 max-w-3xl text-base leading-7 text-zinc-300 sm:text-lg">
              {description}
            </p>
          ) : null}
        </section>

        <div className="mb-10 min-w-0 rounded-xl border border-amber-900/35 bg-black/38 p-5 shadow-2xl ring-1 ring-amber-700/15 backdrop-blur-sm sm:p-8">
          <div className="prose-public min-w-0 space-y-7 break-words text-sm leading-7 text-zinc-300 sm:text-base">
            {children}
          </div>
        </div>

        <div className="mt-auto">
          <PublicFooter />
        </div>
      </div>
    </main>
  );
}

export function PublicSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="text-xl font-bold text-amber-100">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}
