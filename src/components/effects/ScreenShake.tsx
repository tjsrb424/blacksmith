"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/cn";

export type ShakePreset = "light" | "medium" | "heavy";

const PRESETS: Record<
  ShakePreset,
  { x: number[]; duration: number }
> = {
  light: { x: [0, -4, 4, -3, 3, 0], duration: 0.38 },
  medium: { x: [0, -7, 7, -5, 5, 0], duration: 0.48 },
  heavy: { x: [0, -12, 12, -9, 9, -6, 6, 0], duration: 0.62 },
};

export function ScreenShake({
  active,
  preset = "medium",
  children,
  className,
}: {
  active: boolean;
  preset?: ShakePreset;
  children: ReactNode;
  className?: string;
}) {
  const p = PRESETS[preset];
  return (
    <motion.div
      className={cn(className)}
      animate={
        active
          ? {
              x: p.x,
              transition: { duration: p.duration, ease: "easeOut" },
            }
          : { x: 0 }
      }
    >
      {children}
    </motion.div>
  );
}
