"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import { useLocale } from "@/lib/i18n/useLocale";

const TUTORIAL_DONE_KEY = "blacksmith.crazygamesTutorial.done";

type TutorialStep = {
  selector: string;
  messageKey: string;
};

type TargetRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

function getTutorialDone() {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(TUTORIAL_DONE_KEY) === "true";
  } catch {
    return true;
  }
}

function setTutorialDone() {
  try {
    window.localStorage.setItem(TUTORIAL_DONE_KEY, "true");
  } catch {
    // Storage can be unavailable inside some embedded contexts.
  }
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function QuickTutorialOverlay({ enabled }: { enabled: boolean }) {
  const { t } = useLocale();
  const steps = useMemo<TutorialStep[]>(
    () => [
      {
        selector: '[data-tutorial-target="enhance-button"]',
        messageKey: "tutorial.tapEnhance",
      },
      {
        selector: '[data-tutorial-target="weapon-value"]',
        messageKey: "tutorial.weaponValue",
      },
      {
        selector: '[data-tutorial-target="sell-button"]',
        messageKey: "tutorial.sellWeapons",
      },
      {
        selector: '[data-tutorial-target="enhance-button"]',
        messageKey: "tutorial.reachHighest",
      },
    ],
    [],
  );
  const [visible, setVisible] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<TargetRect | null>(null);

  const step = steps[stepIndex];

  useEffect(() => {
    if (!enabled || getTutorialDone()) return;
    const timer = window.setTimeout(() => setVisible(true), 500);
    return () => window.clearTimeout(timer);
  }, [enabled]);

  const updateTargetRect = useCallback(() => {
    if (!visible || !step) return;
    const target = document.querySelector<HTMLElement>(step.selector);
    if (!target) {
      setTargetRect(null);
      return;
    }
    target.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "smooth",
    });
    const rect = target.getBoundingClientRect();
    setTargetRect({
      left: rect.left,
      top: rect.top,
      width: rect.width,
      height: rect.height,
    });
  }, [step, visible]);

  useEffect(() => {
    if (!visible) return;
    const frame = window.requestAnimationFrame(updateTargetRect);
    const refresh = () => updateTargetRect();
    window.addEventListener("resize", refresh);
    window.addEventListener("scroll", refresh, true);
    const timer = window.setInterval(refresh, 700);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", refresh);
      window.removeEventListener("scroll", refresh, true);
      window.clearInterval(timer);
    };
  }, [updateTargetRect, visible]);

  const finish = useCallback(() => {
    setTutorialDone();
    setVisible(false);
  }, []);

  const next = useCallback(() => {
    if (stepIndex >= steps.length - 1) {
      finish();
      return;
    }
    setStepIndex((value) => value + 1);
  }, [finish, stepIndex, steps.length]);

  if (!enabled || !visible || !step) return null;

  const highlightStyle: CSSProperties = targetRect
    ? {
        left: targetRect.left - 8,
        top: targetRect.top - 8,
        width: targetRect.width + 16,
        height: targetRect.height + 16,
      }
    : {};

  const panelWidth = Math.min(330, Math.max(280, window.innerWidth - 24));
  const panelLeft = targetRect
    ? clamp(
        targetRect.left + targetRect.width / 2 - panelWidth / 2,
        12,
        window.innerWidth - panelWidth - 12,
      )
    : clamp(window.innerWidth / 2 - panelWidth / 2, 12, window.innerWidth - panelWidth - 12);
  const panelBelowTop = targetRect ? targetRect.top + targetRect.height + 18 : 96;
  const panelAboveTop = targetRect ? targetRect.top - 172 : 96;
  const panelTop =
    targetRect && panelBelowTop + 150 < window.innerHeight
      ? panelBelowTop
      : Math.max(16, panelAboveTop);
  const panelStyle: CSSProperties = {
    left: panelLeft,
    top: panelTop,
    width: panelWidth,
  };

  return (
    <div className="pointer-events-auto fixed inset-0 z-[80]" aria-live="polite">
      <div className="absolute inset-0 bg-black/18" />
      {targetRect ? (
        <>
          <div
            className="absolute rounded-2xl border-2 border-amber-200 shadow-[0_0_0_9999px_rgba(0,0,0,0.28),0_0_30px_rgba(251,191,36,0.78)] motion-safe:animate-pulse"
            style={highlightStyle}
          />
          <div
            className="absolute h-10 w-10 rounded-full border-2 border-amber-100 bg-amber-300/20 shadow-[0_0_24px_rgba(251,191,36,0.7)]"
            style={{
              left: targetRect.left + targetRect.width / 2 - 20,
              top: targetRect.top + targetRect.height / 2 - 20,
            }}
          >
            <div className="absolute left-1/2 top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-amber-100" />
          </div>
        </>
      ) : null}
      <section
        className="pointer-events-auto fixed rounded-xl border border-amber-300/45 bg-zinc-950/94 p-4 text-zinc-100 shadow-2xl ring-1 ring-black/60 backdrop-blur"
        style={panelStyle}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-amber-300/80">
            {t("tutorial.stepLabel", {
              current: stepIndex + 1,
              total: steps.length,
            })}
          </div>
          <button
            type="button"
            className="rounded-md border border-zinc-700 px-2 py-1 text-xs font-bold text-zinc-300 transition hover:border-zinc-500"
            onClick={finish}
          >
            {t("tutorial.skip")}
          </button>
        </div>
        <p className="text-sm font-semibold leading-6 text-amber-50">
          {t(step.messageKey)}
        </p>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="min-h-10 rounded-lg bg-amber-400 px-4 text-sm font-black text-zinc-950 shadow-[0_8px_24px_rgba(245,158,11,0.28)] transition hover:brightness-110"
            onClick={next}
          >
            {stepIndex >= steps.length - 1
              ? t("tutorial.done")
              : t("tutorial.next")}
          </button>
        </div>
      </section>
    </div>
  );
}
