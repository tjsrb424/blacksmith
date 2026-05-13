import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

export function FantasyPanel({
  className,
  title,
  children,
}: {
  className?: string;
  title?: string;
  children: ReactNode;
}) {
  return (
    <section
      className={cn(
        "rounded-xl border border-amber-700/26 bg-[rgba(8,6,4,0.74)] p-3 shadow-[inset_0_1px_0_rgba(251,191,36,0.08),0_14px_34px_rgba(0,0,0,0.22)] ring-1 ring-black/20 backdrop-blur-[2px] sm:p-4",
        className,
      )}
    >
      {title ? (
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.2em] text-amber-200/75 sm:mb-3">
          {title}
        </h3>
      ) : null}
      {children}
    </section>
  );
}
