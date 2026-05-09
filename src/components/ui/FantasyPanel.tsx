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
        "rounded-xl border border-amber-600/25 bg-[rgba(6,7,12,0.66)] p-3 shadow-[inset_0_1px_0_rgba(251,191,36,0.1),0_12px_36px_rgba(0,0,0,0.18)] backdrop-blur-[1px] sm:p-4",
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
