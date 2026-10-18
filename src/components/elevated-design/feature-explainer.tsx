"use client";

import { useId, useState, type ReactNode } from "react";

import {
  HoverCard,
  HoverCardContent,
  HoverCardPortal,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import { usePortalContainer } from "@/contexts/host-document-context";
import { cn } from "@/lib/utils";

const COLLISION_PADDING = { top: 72, right: 16, bottom: 16, left: 16 };

export type FeatureExplainerStep = { title: string; text: string };

export function FeatureExplainer({
  children,
  name,
  tagline,
  steps,
  mark,
  visual,
  footnote,
  side = "bottom",
  align = "start",
  className,
}: {
  children: ReactNode;
  name: string;
  tagline: string;
  steps: FeatureExplainerStep[];
  mark?: ReactNode;
  visual?: ReactNode;
  footnote?: string;
  side?: "top" | "right" | "bottom" | "left";
  align?: "start" | "center" | "end";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const nameId = useId();
  const portalContainer = usePortalContainer();

  return (
    <HoverCard
      open={open}
      onOpenChange={setOpen}
      openDelay={150}
      closeDelay={100}
    >
      <HoverCardTrigger asChild onClick={() => setOpen(true)}>
        {children}
      </HoverCardTrigger>
      <HoverCardPortal container={portalContainer}>
        <HoverCardContent
          role="dialog"
          aria-labelledby={nameId}
          side={side}
          align={align}
          sideOffset={10}
          collisionPadding={COLLISION_PADDING}
          className={cn(
            "z-[210] max-h-[var(--radix-hover-card-content-available-height)] w-[min(23rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border-border-strong p-0 shadow-xl",
            className,
          )}
        >
          {visual ? (
            <div className="border-b border-border bg-muted/50">{visual}</div>
          ) : null}
          <div className="space-y-4 p-4">
            <div className="flex items-center gap-3">
              {mark}
              <div className="min-w-0">
                <p
                  id={nameId}
                  className="font-display text-base font-semibold leading-tight text-foreground"
                >
                  {name}
                </p>
                <p className="text-xs text-muted-foreground">{tagline}</p>
              </div>
            </div>
            <ol className="space-y-2.5">
              {steps.map((step, index) => (
                <li
                  key={step.title}
                  className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-2"
                >
                  <span className="flex h-5 w-5 items-center justify-center rounded-full border border-border-strong font-mono text-2xs font-semibold tabular-nums text-foreground">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-semibold text-foreground">
                      {step.title}
                    </p>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {step.text}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            {footnote ? (
              <p className="border-t border-border pt-3 text-2xs leading-relaxed text-muted-foreground">
                {footnote}
              </p>
            ) : null}
          </div>
        </HoverCardContent>
      </HoverCardPortal>
    </HoverCard>
  );
}
