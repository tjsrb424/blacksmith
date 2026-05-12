"use client";

import Link from "next/link";

const PUBLIC_LINKS = [
  { href: "/about", label: "게임 소개" },
  { href: "/how-to-play", label: "플레이 방법" },
  { href: "/beta", label: "베타 안내" },
  { href: "/privacy", label: "개인정보처리방침" },
  { href: "/terms", label: "이용약관" },
  { href: "/contact", label: "문의" },
] as const;

export function PublicFooter({ compact = false }: { compact?: boolean }) {
  return (
    <footer
      className={
        compact
          ? "px-4 py-5 text-center text-xs text-zinc-600"
          : "border-t border-amber-900/25 px-4 py-8 text-center text-xs text-zinc-500"
      }
    >
      <nav className="mx-auto flex max-w-3xl flex-wrap justify-center gap-x-3 gap-y-2">
        {PUBLIC_LINKS.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded px-1 py-1 underline-offset-4 hover:text-amber-200 hover:underline"
          >
            {link.label}
          </Link>
        ))}
      </nav>
      <p className="mt-4 text-[11px] text-zinc-700">
        © 세계 최강의 대장장이 beta
      </p>
    </footer>
  );
}
