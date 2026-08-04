"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Check } from "@/components/icons";
import type { Icon } from "@/components/icons";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { softSurfaceShadow } from "./shadow-presets";

export interface ElevatedStepperStep {
  id: string;
  title: string;
  description?: string;
  icon?: Icon;
  optional?: boolean;
}

export interface ElevatedStepperProps {
  steps: ElevatedStepperStep[];
  currentStep: number;
  onStepClick?: (index: number) => void;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  compactOnMobile?: boolean;
}

export function ElevatedStepper({
  steps,
  currentStep,
  onStepClick,
  children,
  footer,
  className,
  compactOnMobile = true,
}: ElevatedStepperProps) {
  const total = steps.length;
  const safeIndex = Math.max(0, Math.min(currentStep, total - 1));
  const activeStep = steps[safeIndex];

  return (
    <div
      className={cn(
        "rounded-[--radius] border border-border bg-card",
        className,
      )}
      style={{ boxShadow: softSurfaceShadow }}
    >
      {/* ── Progress rail ── */}
      <div
        className={cn(
          "px-5 pt-5 pb-3 sm:px-8 sm:pt-8 sm:pb-6",
          compactOnMobile && "hidden sm:block",
        )}
      >
        <ol className="flex w-full items-start">
          {steps.map((step, index) => {
            const isCompleted = index < safeIndex;
            const isActive = index === safeIndex;
            const isClickable = !!onStepClick && index < safeIndex;
            const StepIcon = step.icon;

            return (
              <li
                key={step.id}
                className={cn(
                  "flex min-w-0 flex-1 items-start",
                  index === total - 1 ? "flex-none" : "",
                )}
              >
                <div className="flex min-w-0 flex-col items-center text-center">
                  <button
                    type="button"
                    disabled={!isClickable}
                    onClick={() => isClickable && onStepClick?.(index)}
                    aria-current={isActive ? "step" : undefined}
                    aria-label={step.title}
                    className={cn(
                      "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-all",
                      isActive &&
                        "bg-primary text-primary-foreground ring-4 ring-primary/15",
                      isCompleted &&
                        "bg-primary text-primary-foreground cursor-pointer hover:ring-4 hover:ring-primary/15",
                      !isActive &&
                        !isCompleted &&
                        "bg-muted text-muted-foreground",
                      !isClickable && !isActive && "cursor-default",
                    )}
                  >
                    {isCompleted ? (
                      <Check className="h-5 w-5" weight="bold" />
                    ) : StepIcon ? (
                      <StepIcon className="h-5 w-5" weight="fill" />
                    ) : (
                      <span>{index + 1}</span>
                    )}
                  </button>
                  <div className="mt-2 min-w-0 max-w-[140px]">
                    <p
                      className={cn(
                        "text-xs font-semibold leading-tight",
                        isActive
                          ? "text-foreground"
                          : isCompleted
                            ? "text-foreground/80"
                            : "text-muted-foreground",
                      )}
                    >
                      {step.title}
                    </p>
                    {step.description ? (
                      <p className="mt-0.5 hidden text-[11px] text-muted-foreground md:block">
                        {step.description}
                      </p>
                    ) : null}
                    {step.optional ? (
                      <span className="mt-1 inline-block rounded-[--radius] bg-muted px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                        opcional
                      </span>
                    ) : null}
                  </div>
                </div>

                {index < total - 1 && (
                  <div className="relative mx-1 mt-5 h-0.5 min-w-[24px] flex-1 overflow-hidden rounded-full bg-muted sm:mx-2">
                    <motion.div
                      className="h-full bg-primary"
                      initial={false}
                      animate={{ width: isCompleted ? "100%" : "0%" }}
                      transition={{ duration: 0.35, ease: "easeOut" }}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </div>

      {/* ── Mobile compact header ── */}
      {compactOnMobile && activeStep ? (
        <div className="sm:hidden px-5 pt-5 pb-0">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-lamp-ink">
            Etapa {safeIndex + 1} de {total}
          </p>
          <h2 className="mt-1 text-lg font-semibold text-foreground">
            {activeStep.title}
          </h2>
          {activeStep.description ? (
            <p className="mt-1 text-sm text-muted-foreground">
              {activeStep.description}
            </p>
          ) : null}
        </div>
      ) : null}

      {/* ── Step body ── */}
      <div className="relative px-5 pb-5 pt-4 sm:px-8 sm:pb-8 sm:pt-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep?.id ?? safeIndex}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
          >
            {children}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Footer (nav) ── */}
      {footer ? (
        <div className="border-t border-border bg-muted px-5 py-4 sm:px-8">
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export interface ElevatedStepperFooterProps {
  canGoBack: boolean;
  canGoNext: boolean;
  isLast: boolean;
  loading?: boolean;
  onBack: () => void;
  onNext: () => void;
  onSubmit?: () => void;
  labels: {
    back: string;
    next: string;
    submit: string;
  };
}

export function ElevatedStepperFooter({
  canGoBack,
  canGoNext,
  isLast,
  loading = false,
  onBack,
  onNext,
  onSubmit,
  labels,
}: ElevatedStepperFooterProps) {
  return (
    <div className="flex items-center justify-between gap-3">
      <button
        type="button"
        onClick={onBack}
        disabled={!canGoBack || loading}
        className={cn(
          "rounded-[--radius] px-4 py-2 text-sm font-medium transition-colors",
          "text-muted-foreground hover:bg-muted hover:text-foreground",
          "disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent",
        )}
      >
        ← {labels.back}
      </button>
      <button
        type="button"
        onClick={isLast ? onSubmit : onNext}
        disabled={(!isLast && !canGoNext) || loading}
        className={cn(
          "inline-flex items-center gap-2 rounded-[--radius] bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground transition-all",
          "hover:bg-[hsl(var(--primary-hover))] active:scale-[0.98]",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {loading ? (
          <span className="inline-block h-4 w-4 animate-spin rounded-full border border-rule-strong-foreground/40 border-t-primary-foreground" />
        ) : null}
        {isLast ? labels.submit : labels.next}
        {!isLast && !loading ? <span aria-hidden>→</span> : null}
      </button>
    </div>
  );
}
