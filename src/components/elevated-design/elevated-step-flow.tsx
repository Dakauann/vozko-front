"use client";

import { useEffect, useRef, type ReactNode } from "react";

import { Check, PencilSimple } from "@/components/icons";
import { cn } from "@/lib/utils";

export interface ElevatedStepFlowStep {
  id: string;
  title: string;
  description?: string;
  caption?: string;
  summary?: ReactNode;
}

type StepState = "done" | "active" | "upcoming";

interface ElevatedStepFlowProps {
  steps: ElevatedStepFlowStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  editLabel: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}

function StepMarker({ state, number }: { state: StepState; number: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-[1] flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold tabular-nums transition-colors duration-150",
        state === "done" && "bg-primary text-primary-foreground shadow-button-primary",
        state === "active" && "border-2 border-primary-edge bg-card text-foreground",
        state === "upcoming" && "border border-control-edge bg-card text-muted-foreground",
      )}
    >
      {state === "done" ? <Check className="h-3.5 w-3.5" weight="bold" /> : number}
    </span>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && Boolean(window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches);
}

export function ElevatedStepFlow({ steps, currentStep, onStepClick, editLabel, children, actions, className }: ElevatedStepFlowProps) {
  const safeIndex = Math.max(0, Math.min(currentStep, steps.length - 1));
  const activeRef = useRef<HTMLLIElement>(null);
  const shownIndex = useRef(safeIndex);

  useEffect(() => {
    if (shownIndex.current === safeIndex) return;
    shownIndex.current = safeIndex;
    activeRef.current?.scrollIntoView?.({ block: "start", behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }, [safeIndex]);

  return (
    <ol className={cn("rounded-lg border border-border bg-card px-5 py-6 shadow-sm sm:px-8 sm:py-8", className)}>
      {steps.map((step, index) => {
        const state: StepState = index < safeIndex ? "done" : index === safeIndex ? "active" : "upcoming";
        const isLast = index === steps.length - 1;
        return (
          <li
            key={step.id}
            ref={state === "active" ? activeRef : undefined}
            aria-current={state === "active" ? "step" : undefined}
            className="relative grid scroll-mt-20 grid-cols-[1.75rem_minmax(0,1fr)] gap-x-4"
          >
            <div className="relative flex justify-center">
              <StepMarker state={state} number={index + 1} />
              {isLast ? null : (
                <span
                  aria-hidden
                  className={cn("absolute bottom-1 top-9 w-px", state === "done" ? "bg-primary-edge" : "bg-border-strong")}
                />
              )}
            </div>

            <div className={cn("min-w-0", isLast ? null : state === "active" ? "pb-10" : "pb-7")}>
              {state === "done" ? (
                onStepClick ? (
                  <button
                    type="button"
                    onClick={() => onStepClick(index)}
                    aria-label={`${editLabel} ${step.title}`}
                    className="group -mx-2 flex w-[calc(100%+1rem)] items-start justify-between gap-3 rounded-[--radius] px-2 py-1 text-left transition-colors duration-150 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <DoneHeading step={step} />
                    <span className="mt-0.5 inline-flex shrink-0 items-center gap-1 text-xs font-medium text-muted-foreground transition-colors group-hover:text-foreground">
                      <PencilSimple className="h-3.5 w-3.5" />
                      {editLabel}
                    </span>
                  </button>
                ) : (
                  <div className="py-1">
                    <DoneHeading step={step} />
                  </div>
                )
              ) : null}

              {state === "active" ? (
                <div>
                  <h2 className="pt-0.5 font-display text-lg font-semibold leading-6 tracking-[0.01em] text-foreground">{step.title}</h2>
                  {step.description ? <p className="mt-1 max-w-[62ch] text-sm text-muted-foreground">{step.description}</p> : null}
                  <div className="mt-6 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-200">{children}</div>
                  {actions ? <div className="mt-8 flex flex-wrap items-center gap-2">{actions}</div> : null}
                </div>
              ) : null}

              {state === "upcoming" ? (
                <div className="pt-1">
                  <p className="text-sm font-medium leading-5 text-muted-foreground">{step.title}</p>
                  {step.caption ?? step.description ? (
                    <p className="mt-0.5 text-xs text-muted-foreground">{step.caption ?? step.description}</p>
                  ) : null}
                </div>
              ) : null}
            </div>
          </li>
        );
      })}
    </ol>
  );
}

function DoneHeading({ step }: { step: ElevatedStepFlowStep }) {
  return (
    <span className="min-w-0 flex-1">
      <span className="block text-sm font-semibold leading-5 text-foreground">{step.title}</span>
      {step.summary ? <span className="mt-0.5 block truncate text-sm text-muted-foreground">{step.summary}</span> : null}
    </span>
  );
}
