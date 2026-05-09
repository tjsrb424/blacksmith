"use client";

import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/cn";
import { EFFECT_ASSETS } from "@/data/assets";

export type BlacksmithFxKind =
  | "idle"
  | "enhance_ok"
  | "enhance_fail"
  | "destroy"
  | "transcend_ok"
  | "transcend_fail";

type Props = {
  kind: BlacksmithFxKind;
  /** 모달 재오픈 시 완전히 리마운트해 잔상 방지 */
  burstKey?: number;
};

/** 스파크 — 소량 DOM 노드 */
function Sparks({ tone }: { tone: "gold" | "violet" }) {
  const color =
    tone === "gold"
      ? "bg-amber-300/90 shadow-[0_0_6px_rgba(251,191,36,0.9)]"
      : "bg-violet-300/90 shadow-[0_0_6px_rgba(196,181,253,0.9)]";
  const seeds = [12, 28, 44, 56, 68, 82, 36, 64, 48];
  return (
    <>
      {seeds.map((left, i) => (
        <motion.span
          key={i}
          className={cn("absolute top-1/2 h-1 w-1 rounded-full", color)}
          style={{ left: `${left}%` }}
          initial={{ opacity: 0, y: 0, scale: 0.4 }}
          animate={{
            opacity: [0, 1, 0],
            y: [-6 - (i % 3) * 4, -28 - i * 2],
            x: [(i % 2 === 0 ? -1 : 1) * (8 + i), (i % 2 === 0 ? -1 : 1) * 18],
            scale: [0.4, 1, 0.3],
          }}
          transition={{ duration: 0.55, ease: "easeOut" }}
        />
      ))}
    </>
  );
}

/**
 * 대장간 무기 스테이지 위 오버레이 — 1회성 연출만 (마지막 프레임 잔상 없음)
 */
export function BlacksmithResultFx({ kind, burstKey = 0 }: Props) {
  const show = kind !== "idle";

  return (
    <AnimatePresence mode="wait">
      {show ? (
        <motion.div
          key={`${kind}-${burstKey}`}
          className="pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-3xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
        >
          {kind === "enhance_ok" ? (
            <>
              <motion.img
                src={EFFECT_ASSETS.successFlash}
                alt=""
                className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
                initial={{ opacity: 0, scale: 1.08 }}
                animate={{ opacity: [0, 0.85, 0], scale: [1.08, 1, 1.02] }}
                transition={{ duration: 0.5 }}
              />
              <motion.img
                src={EFFECT_ASSETS.forgeGlow}
                alt=""
                className="absolute inset-[12%] object-contain mix-blend-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.45, 0] }}
                transition={{ duration: 0.55 }}
              />
              <motion.div
                className="absolute inset-0 bg-amber-400/20"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.45, 0] }}
                transition={{ duration: 0.45 }}
              />
              <Sparks tone="gold" />
            </>
          ) : null}

          {kind === "enhance_fail" ? (
            <>
              <motion.img
                src={EFFECT_ASSETS.failSmoke}
                alt=""
                className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.52, 0] }}
                transition={{ duration: 0.95, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 bg-zinc-950/60"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.42, 0] }}
                transition={{ duration: 0.85, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(15,15,15,0.5),transparent_70%)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.55, 0] }}
                transition={{ duration: 0.9, ease: "easeOut" }}
              />
            </>
          ) : null}

          {kind === "destroy" ? (
            <>
              <motion.img
                src={EFFECT_ASSETS.destructionCrack}
                alt=""
                className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.88, 0] }}
                transition={{ duration: 0.65, ease: "easeOut" }}
              />
              <motion.img
                src={EFFECT_ASSETS.emberParticle}
                alt=""
                className="absolute inset-[8%] h-[84%] w-full object-contain mix-blend-screen"
                initial={{ opacity: 0, scale: 0.92 }}
                animate={{ opacity: [0, 0.85, 0], scale: [0.92, 1.05, 1] }}
                transition={{ duration: 0.75 }}
              />
              <motion.div
                className="absolute inset-0 bg-red-600/30"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.55, 0] }}
                transition={{ duration: 0.55 }}
              />
            </>
          ) : null}

          {kind === "transcend_ok" ? (
            <>
              <motion.img
                src={EFFECT_ASSETS.transcendAura}
                alt=""
                className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.62, 0] }}
                transition={{ duration: 0.7, ease: "easeOut" }}
              />
              <motion.img
                src={EFFECT_ASSETS.transcendStar}
                alt=""
                className="absolute inset-[18%] object-contain mix-blend-screen"
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: [0, 0.95, 0], scale: [0.85, 1.08, 1] }}
                transition={{ duration: 0.6 }}
              />
              <motion.div
                className="absolute inset-0 bg-violet-400/18"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.45, 0] }}
                transition={{ duration: 0.55 }}
              />
              <Sparks tone="violet" />
              <motion.div
                className="absolute inset-0 bg-[radial-gradient(circle_at_50%_30%,rgba(196,181,253,0.18),transparent_55%)]"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.42, 0] }}
                transition={{ duration: 0.55, ease: "easeOut" }}
              />
            </>
          ) : null}

          {kind === "transcend_fail" ? (
            <>
              <motion.img
                src={EFFECT_ASSETS.failSmoke}
                alt=""
                className="absolute inset-0 h-full w-full object-cover mix-blend-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.42, 0] }}
                transition={{ duration: 0.85, ease: "easeOut" }}
              />
              <motion.img
                src={EFFECT_ASSETS.transcendAura}
                alt=""
                className="absolute inset-[22%] object-contain mix-blend-screen"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.32, 0] }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-0 bg-violet-950/45 mix-blend-multiply"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 0.48, 0] }}
                transition={{ duration: 0.75, ease: "easeOut" }}
              />
              <motion.div
                className="absolute inset-[18%] rounded-lg border border-violet-500/25"
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ opacity: [0, 0.55, 0], scale: [1, 1.02, 1] }}
                transition={{ duration: 0.75, ease: "easeOut" }}
              />
            </>
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
