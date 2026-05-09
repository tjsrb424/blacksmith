import type { ModalPayload } from "@/types/game";
import { MODAL_FRAMES } from "@/data/assets";
import { cn } from "@/lib/cn";

export type ModalTone =
  | "default"
  | "success"
  | "fail"
  | "danger"
  | "destruction"
  | "transcend"
  | "transcendFail"
  | "record"
  | "reward"
  | "ad"
  | "purchase"
  | "sale";

const TONE_SHELL: Record<ModalTone, string> = {
  default:
    "border-amber-700/40 bg-zinc-950 shadow-[0_0_48px_rgba(251,146,60,0.16)]",
  success:
    "border-emerald-600/45 bg-zinc-950 shadow-[0_0_52px_rgba(52,211,153,0.22)]",
  fail: "border-red-700/45 bg-zinc-950 shadow-[0_0_48px_rgba(248,113,113,0.18)]",
  danger:
    "border-red-600/50 bg-zinc-950 shadow-[0_0_56px_rgba(220,38,38,0.22)]",
  destruction:
    "border-red-950/80 bg-[#0f0608] shadow-[0_0_64px_rgba(127,29,29,0.45)]",
  transcend:
    "border-violet-500/45 bg-zinc-950 shadow-[0_0_56px_rgba(167,139,250,0.28)]",
  transcendFail:
    "border-violet-950/70 bg-zinc-950 shadow-[0_0_48px_rgba(91,33,182,0.25)]",
  record:
    "border-fuchsia-500/45 bg-zinc-950 shadow-[0_0_60px_rgba(217,70,239,0.25)]",
  reward:
    "border-amber-500/45 bg-zinc-950 shadow-[0_0_52px_rgba(245,158,11,0.22)]",
  ad: "border-violet-600/40 bg-zinc-950 shadow-[0_0_48px_rgba(139,92,246,0.22)]",
  purchase:
    "border-sky-700/40 bg-zinc-950 shadow-[0_0_48px_rgba(56,189,248,0.18)]",
  sale: "border-orange-600/40 bg-zinc-950 shadow-[0_0_48px_rgba(249,115,22,0.2)]",
};

export function getModalShellClass(tone: ModalTone): string {
  return cn(
    "rounded-2xl border px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-9",
    TONE_SHELL[tone],
  );
}

/** 보유 3종 모달 프레임만으로 톤별 재사용 */
export function getModalFrameArtPath(tone: ModalTone): string {
  switch (tone) {
    case "record":
      return MODAL_FRAMES.record;
    case "success":
    case "fail":
    case "danger":
    case "destruction":
    case "transcend":
    case "transcendFail":
      return MODAL_FRAMES.forge;
    default:
      return MODAL_FRAMES.common;
  }
}

export function getModalToneFromPayload(m: ModalPayload): ModalTone {
  switch (m.kind) {
    case "enhance_success":
      return m.recordBreak ? "record" : "success";
    case "enhance_fail":
      return "fail";
    case "weapon_destroyed":
      return "destruction";
    case "transcend_success":
      return m.recordBreak ? "record" : "transcend";
    case "transcend_fail":
      return "transcendFail";
    case "offline_forge_reward":
    case "forge_collect_complete":
      return "reward";
    case "forge_upgrade_confirm":
    case "forge_upgrade_success":
      return "reward";
    case "buy_confirm":
    case "buy_success":
      return "purchase";
    case "sell_confirm":
    case "sell_success":
      return "sale";
    case "sell_locked_notice":
      return "danger";
    case "transcend_confirm":
      return "transcend";
    case "season_started":
      return "reward";
    default:
      return "default";
  }
}
