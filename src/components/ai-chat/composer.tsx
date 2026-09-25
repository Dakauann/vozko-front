"use client";

import { motion, useReducedMotion } from "framer-motion";

import { CaretDown, PaperPlaneTilt, Stop } from "@/components/icons";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { cn } from "@/lib/utils";

export const PANEL_EASE = [0.2, 0, 0, 1] as const;

export interface ComposerLabels {
  placeholder: string;
  send: string;
  stop: string;
  modelLabel: string;
  scrollToBottom: string;
}

export function Composer({
  docked,
  input,
  setInput,
  onSend,
  onStop,
  streaming,
  model,
  models,
  pricing,
  onModelChange,
  error,
  showScrollDown,
  onScrollDown,
  labels,
}: {
  docked: boolean;
  input: string;
  setInput: (v: string) => void;
  onSend: () => void;
  onStop: () => void;
  streaming: boolean;
  model: string;
  models: string[];
  pricing: ModelPricingInfo[];
  onModelChange: (m: string) => void;
  error: string | null;
  showScrollDown: boolean;
  onScrollDown: () => void;
  labels: ComposerLabels;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.div
      layout={reduceMotion ? false : "position"}
      transition={{ duration: reduceMotion ? 0 : 0.24, ease: PANEL_EASE }}
      className={cn(
        "relative px-4",
        docked ? "border-t border-border py-3" : "pb-2 pt-0",
      )}
    >
      {showScrollDown && docked ? (
        <button
          type="button"
          onClick={onScrollDown}
          className="absolute -top-11 left-1/2 z-10 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full border border-control-edge bg-card text-foreground shadow-lg transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={labels.scrollToBottom}
        >
          <CaretDown weight="bold" className="h-4 w-4" />
        </button>
      ) : null}

      <div className="mx-auto max-w-3xl">
        {error ? (
          <Alert variant="destructive" role="alert" className="mb-2">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <div className="rounded-lg border border-control-edge bg-card dark:bg-muted focus-within:ring-2 focus-within:ring-ring">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                onSend();
              }
            }}
            rows={docked ? 1 : 2}
            placeholder={labels.placeholder}
            aria-label={labels.placeholder}
            className="block max-h-40 w-full resize-none bg-transparent px-3 pt-2.5 text-sm leading-relaxed text-foreground outline-none placeholder:text-muted-foreground"
          />
          <div className="flex items-center justify-between gap-2 border-t border-border px-2 py-1.5">
            <div className="min-w-0 max-w-[15rem] flex-1">
              <AIModelSelector
                label={labels.modelLabel}
                value={model}
                onValueChange={onModelChange}
                models={models}
                modelPricing={pricing}
                disabled={streaming}
              />
            </div>
            {streaming ? (
              <button
                type="button"
                onClick={onStop}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] border border-control-edge bg-card text-foreground transition-colors duration-DEFAULT hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={labels.stop}
              >
                <Stop weight="fill" className="h-3.5 w-3.5" />
              </button>
            ) : (
              <button
                type="button"
                onClick={onSend}
                disabled={!input.trim() || !model}
                className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label={labels.send}
              >
                <PaperPlaneTilt weight="fill" className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
