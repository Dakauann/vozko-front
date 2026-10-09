"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { useReducedMotion } from "framer-motion";
import { useTranslations } from "next-intl";
import { useStore } from "zustand";

import { EloMark } from "@/components/ai-chat/elo-mark";
import { requestScreenStop } from "@/components/ai-chat/screen-bridge";
import { Stop } from "@/components/icons";
import { cn } from "@/lib/utils";

import type { AgentTask } from "./agent-tasks";
import type { AgentPresence, AgentPresenceState } from "./presence";

const ANCHOR_INSET = 12;
const ANCHOR_ATTEMPTS = 120;

interface AnchorRect {
  top: number;
  right: number;
}

function useAnchorRect(selector: string): AnchorRect | null {
  const [rect, setRect] = useState<AnchorRect | null>(null);
  useEffect(() => {
    let element: HTMLElement | null = null;
    let frame = 0;
    let attempts = 0;
    const measure = () => {
      if (!element) return;
      const box = element.getBoundingClientRect();
      setRect((current) => (current && current.top === box.top && current.right === box.right ? current : { top: box.top, right: box.right }));
    };
    const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
    const find = () => {
      element = document.querySelector<HTMLElement>(selector);
      if (element) {
        observer?.observe(element);
        measure();
        return;
      }
      if (++attempts < ANCHOR_ATTEMPTS) frame = requestAnimationFrame(find);
    };
    find();
    window.addEventListener("resize", measure);
    window.addEventListener("scroll", measure, true);
    return () => {
      cancelAnimationFrame(frame);
      observer?.disconnect();
      window.removeEventListener("resize", measure);
      window.removeEventListener("scroll", measure, true);
    };
  }, [selector]);
  return rect;
}

function TaskList({ tasks }: { tasks: readonly AgentTask[] }) {
  const t = useTranslations("studio.agent");
  return (
    <div className="border-t border-border px-2.5 pb-2 pt-1.5">
      <p className="text-2xs font-medium text-muted-foreground">{t("queue.title")}</p>
      <ul className="mt-1 space-y-1">
        {tasks.map((task) => (
          <li key={task.id} className="flex items-center gap-2 text-xs">
            <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full bg-primary", !task.settling && "animate-dot-pulse")} />
            <span className="min-w-0 flex-1 truncate text-foreground">{t(`actions.${task.action}`)}</span>
            <span className="shrink-0 text-2xs text-muted-foreground">{t(task.settling ? "queue.settling" : "queue.running")}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

interface ActivityPanelProps {
  state: AgentPresenceState;
  tasks: readonly AgentTask[];
  anchor: string;
  reduceMotion: boolean;
}

function ActivityPanel({ state, tasks, anchor, reduceMotion }: ActivityPanelProps) {
  const t = useTranslations("studio.agent");
  const rect = useAnchorRect(anchor);
  const { label, progress } = state;
  const acting = state.visible;
  const shown = acting || tasks.length > 0;
  const share = acting && progress ? Math.round((progress.step / progress.total) * 100) : null;
  const placement: CSSProperties | undefined = rect ? { top: rect.top + ANCHOR_INSET, left: rect.right - ANCHOR_INSET, transform: "translateX(-100%)" } : undefined;
  return (
    <div
      style={placement}
      className={cn(
        "fixed z-[56] transition-opacity duration-200",
        !rect && "left-1/2 top-[calc(var(--dashboard-header-h,48px)+56px)] -translate-x-1/2",
        shown ? "opacity-100" : "pointer-events-none opacity-0",
      )}
    >
      <div className="vz-ai-card relative rounded-xl" data-busy={state.busy}>
        <span aria-hidden className="vz-ai-halo" />
        <span aria-hidden className="vz-ai-ring" />
        <div role="status" aria-live="polite" className="w-[min(19rem,80vw)] overflow-hidden rounded-xl border border-border-strong bg-card shadow-md">
          <div className="flex items-center gap-2.5 py-1.5 pl-2.5 pr-1.5">
            <EloMark className="h-5 w-5 shrink-0 text-foreground" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-semibold text-foreground">{acting ? label || t("actions.working") : t("queue.following", { count: tasks.length })}</p>
              {share !== null ? (
                <div className="mt-1 flex items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${share}%`, transition: reduceMotion ? "none" : "width 240ms cubic-bezier(0.22, 1, 0.36, 1)" }} />
                  </div>
                  <span className="text-2xs tabular-nums text-muted-foreground">{t("progress", { step: progress!.step, total: progress!.total })}</span>
                </div>
              ) : null}
            </div>
            {acting ? (
              <button
                type="button"
                onClick={() => requestScreenStop()}
                className="inline-flex h-7 shrink-0 items-center gap-1 rounded-[--radius] border border-control-edge bg-card px-2 text-xs font-medium text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <Stop className="h-3.5 w-3.5" aria-hidden />
                {t("stop")}
              </button>
            ) : null}
          </div>
          {tasks.length > 0 ? <TaskList tasks={tasks} /> : null}
        </div>
      </div>
    </div>
  );
}

interface AgentCursorProps {
  presence: AgentPresence;
  tasks: readonly AgentTask[];
  anchor: string;
}

export function AgentCursor({ presence, tasks, anchor }: AgentCursorProps) {
  const t = useTranslations("studio.agent");
  const state = useStore(presence.store);
  const { visible, busy, x, y, label, outline } = state;
  const reduceMotion = Boolean(useReducedMotion());
  const move = reduceMotion ? "opacity 120ms linear" : "transform 380ms cubic-bezier(0.22, 1, 0.36, 1), opacity 160ms linear";

  return (
    <>
      {busy ? <div data-studio-agent-lock aria-hidden className="fixed inset-0 z-[55] cursor-progress" /> : null}
      {visible && outline ? (
        <div
          aria-hidden
          className="pointer-events-none fixed left-0 top-0 z-[57] rounded-[--radius] border-2 border-dashed border-primary"
          style={{
            width: Math.max(8, outline.width),
            height: Math.max(8, outline.height),
            transform: `translate3d(${Math.round(outline.left)}px, ${Math.round(outline.top)}px, 0)`,
            transition: reduceMotion ? "none" : "transform 320ms cubic-bezier(0.22, 1, 0.36, 1), width 320ms cubic-bezier(0.22, 1, 0.36, 1), height 320ms cubic-bezier(0.22, 1, 0.36, 1)",
          }}
        />
      ) : null}
      <ActivityPanel state={state} tasks={tasks} anchor={anchor} reduceMotion={reduceMotion} />
      <div
        aria-hidden
        aria-label={visible ? t("cursorLabel", { action: label }) : undefined}
        className={cn("pointer-events-none fixed left-0 top-0 z-[58]", visible ? "opacity-100" : "opacity-0")}
        style={{ transform: `translate3d(${Math.round(x)}px, ${Math.round(y)}px, 0)`, transition: move }}
      >
        <svg viewBox="0 0 16 16" aria-hidden className="h-5 w-5 drop-shadow-sm">
          <path d="M1 1l5.5 13 1.8-5.2L13.5 7z" className="fill-primary stroke-primary-foreground" strokeWidth="1.2" strokeLinejoin="round" />
        </svg>
        {visible && label ? (
          <span className="ml-3 mt-0.5 inline-flex max-w-[16rem] items-center gap-1.5 truncate rounded-[--radius] bg-primary px-2 py-1 text-2xs font-semibold text-primary-foreground shadow-button-primary">
            <EloMark className="h-3.5 w-3.5 [--elo-accent:currentColor]" />
            <span className="truncate">{label}</span>
          </span>
        ) : null}
      </div>
    </>
  );
}
