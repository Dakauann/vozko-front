"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import {
  useJoyride,
  type Step,
  type TooltipRenderProps,
  ACTIONS,
  EVENTS,
} from "react-joyride";
import { useTranslations } from "next-intl";
import { ArrowRight, ArrowLeft, X } from "@/components/icons";
import { cn } from "@/lib/utils";
import type { Icon } from "@/components/icons";
import type { ColorGroup } from "@/components/elevated-design/grain-background";
import Button from "@/components/elevated-design/button";

export interface TourFeature {
  icon: Icon;
  text: string;
}

export type TourStep = Omit<Step, "content"> & {
  content?: Step["content"];
  badge?: string;
  subtitle?: string;
  features?: TourFeature[];
  palette?: ColorGroup[];
  seed?: number;
  ctaLabel?: string;
  ctaOnClick?: () => void;
};

export interface TourGuideProps {
  steps: TourStep[];
  storageKey?: string;
  i18nNamespace?: string;
  className?: string;
  introPalette?: ColorGroup[];
  introSeed?: number;
  onStep?: (index: number, step: TourStep) => void;
}

type Placement = "top" | "bottom" | "left" | "right";

const I18nNamespaceContext = createContext("tour");

const TOOLTIP_WIDTH = 360;
const TOOLTIP_MIN_HEIGHT = 280;
const MARGIN = 16;

function getSmartPlacement(targetRect: DOMRect): Placement {
  const vpW = window.innerWidth;
  const vpH = window.innerHeight;

  const spaceAbove = targetRect.top;
  const spaceBelow = vpH - targetRect.bottom;
  const spaceLeft = targetRect.left;
  const spaceRight = vpW - targetRect.right;

  const scores: Record<Placement, number> = {
    bottom: spaceBelow >= TOOLTIP_MIN_HEIGHT + MARGIN ? spaceBelow : -1,
    top: spaceAbove >= TOOLTIP_MIN_HEIGHT + MARGIN ? spaceAbove : -1,
    right: spaceRight >= TOOLTIP_WIDTH + MARGIN ? spaceRight : -1,
    left: spaceLeft >= TOOLTIP_WIDTH + MARGIN ? spaceLeft : -1,
  };

  const entries = (Object.entries(scores) as [Placement, number][]).filter(
    ([, v]) => v >= 0,
  );

  if (entries.length === 0) {
    const fallback: [Placement, number][] = [
      ["bottom", spaceBelow],
      ["top", spaceAbove],
      ["right", spaceRight],
      ["left", spaceLeft],
    ];
    fallback.sort((a, b) => b[1] - a[1]);
    return fallback[0][0];
  }

  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}

function TooltipArrow({ placement }: { placement: Placement }) {
  const base =
    "absolute h-4 w-4 overflow-hidden";

  const pos: Record<Placement, string> = {
    top: "-bottom-2 left-1/2 -translate-x-1/2",
    bottom: "-top-2 left-1/2 -translate-x-1/2 rotate-180",
    left: "-right-2 top-1/2 -translate-y-1/2 -rotate-90",
    right: "-left-2 top-1/2 -translate-y-1/2 rotate-90",
  };

  return (
    <div className={cn(base, pos[placement])}>
      <div className="h-full w-full bg-card border-l border-t border-black/8 [clip-path:polygon(0_0,100%_0,50%_100%)]" />
    </div>
  );
}

export default function TourGuide({
  steps,
  storageKey = "tour_dismissed",
  i18nNamespace = "tour",
  className,
  introPalette,
  introSeed = 42,
  onStep,
}: TourGuideProps) {
  const tt = useTranslations("tour");
  const [mounted, setMounted] = useState(false);
  const [dismissed, setDismissed] = useState(true);
  const [introVisible, setIntroVisible] = useState(false);
  const [computedPlacements, setComputedPlacements] = useState<
    Record<number, Placement>
  >({});

  useEffect(() => {
    setMounted(true);
    try {
      if (localStorage.getItem(storageKey) === "true") {
        setDismissed(true);
      } else {
        setDismissed(false);
        setIntroVisible(true);
      }
    } catch {
      setDismissed(false);
      setIntroVisible(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!mounted) return;
    const compute = () => {
      const newPlacements: Record<number, Placement> = {};
      steps.forEach((s, i) => {
        const selector = s.target as string;
        if (!selector) return;
        const el = document.querySelector<HTMLElement>(selector);
        if (!el) {
          newPlacements[i] = (s.placement as Placement) || "bottom";
          return;
        }
        const rect = el.getBoundingClientRect();
        newPlacements[i] = getSmartPlacement(rect);
      });
      setComputedPlacements(newPlacements);
    };
    compute();
    const timer = setTimeout(compute, 300);
    return () => clearTimeout(timer);
  }, [mounted, steps]);

  const handleSkip = () => {
    setDismissed(true);
    setIntroVisible(false);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // ignore
    }
  };

  const handleStart = () => {
    setIntroVisible(false);
    controlsRef.current?.start();
  };

  const handleCallback = (data: { type: string; action: string; [key: string]: any }) => {
    if (data.type === EVENTS.TOUR_END || data.action === ACTIONS.SKIP || data.action === ACTIONS.CLOSE) {
      try { localStorage.setItem(storageKey, "true"); } catch { /* ignore */ }
      setDismissed(true);
    }
    if (data.action === ACTIONS.COMPLETE) {
      try { localStorage.setItem(storageKey, "true"); } catch { /* ignore */ }
      setDismissed(true);
    }
  };

  const onStepRef = useRef(onStep);
  onStepRef.current = onStep;

  const resolvedSteps = useMemo(
    () => steps.map((s, i) => {
      const data = (s as any).data;
      const needsBefore = data?._tab || data?._selectComponent;
      const base: any = {
        ...s,
        placement: computedPlacements[i] || s.placement || "bottom",
      };
      if (needsBefore) {
        base.before = async () => {
          onStepRef.current?.(-1, s);
          await new Promise<void>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                const el = document.querySelector(s.target as string);
                if (el) {
                  resolve();
                } else {
                  setTimeout(resolve, 500);
                }
              });
            });
          });
        };
      }
      return base;
    }),
    [steps, i18nNamespace, computedPlacements],
  );

  const controlsRef = useRef<ReturnType<typeof useJoyride>["controls"] | null>(null);

  const { Tour, controls } = useJoyride({
    run: !dismissed && !introVisible,
    continuous: true,
    scrollToFirstStep: true,
    steps: resolvedSteps as Step[],
    options: {
      arrowColor: "transparent",
      backgroundColor: "transparent",
      overlayColor: "rgba(15, 23, 42, 0.2)",
      primaryColor: "#3b82f6",
      textColor: "#0f172a",
      zIndex: 60,
      skipBeacon: true,
      overlayClickAction: false,
      showProgress: false,
      spotlightPadding: 8,
      scrollOffset: 120,
      scrollDuration: 400,
    },
    styles: {
      overlay: {
        backdropFilter: "none",
      },
      spotlight: {
        filter: "drop-shadow(0 0 10px rgba(59,130,246,0.55)) drop-shadow(0 0 0 3px rgba(59,130,246,0.85))",
      },
      floater: { filter: "none" },
    },
    tooltipComponent: TourGuideTooltip as unknown as React.ElementType<TooltipRenderProps>,
    onEvent: handleCallback as never,
  });

  useEffect(() => {
    controlsRef.current = controls;
  }, [controls]);

  if (!mounted || dismissed) return null;

  return createPortal(
    <I18nNamespaceContext.Provider value={i18nNamespace}>
      {introVisible && (
        <div className="fixed bottom-6 right-6 z-[61] animate-in fade-in slide-in-from-right-4 duration-300">
          <div
            className={cn(
              "w-[320px] overflow-hidden rounded-[--radius] border border-border bg-card shadow-xl",
              className,
            )}
          >
            <div className="rule-engraved relative flex h-9 w-full items-center bg-muted px-3">
              <button
                type="button"
                onClick={handleSkip}
                className="absolute right-2 top-1/2 z-10 flex min-w-[34px] -translate-y-1/2 items-center justify-center rounded-[--radius] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground sm:min-w-0"
              >
                <X size={12} />
              </button>
              <div className="flex items-center">
                <span className="legend">
                  {tt("introTitle")}
                </span>
              </div>
            </div>
            <div className="px-4 pt-3 pb-3.5 space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {tt("introDescription")}
              </p>
              <div className="flex gap-[8px]">
                <Button
                  variant="ghost"
                  title={tt("skip")}
                  onClick={handleSkip}
                  className="rounded-[9px] text-xs h-8"
                />
                <Button
                  variant="action"
                  title={tt("start")}
                  icon={<ArrowRight size={12} weight="bold" />}
                  iconVisible
                  iconSide="right"
                  onClick={handleStart}
                  className="flex-1 rounded-[9px] text-xs h-8"
                />
              </div>
            </div>
          </div>
        </div>
      )}
      {Tour}
    </I18nNamespaceContext.Provider>,
    document.body
  );
}

function TourTooltip({
  index,
  step,
  size,
  backProps,
  primaryProps,
  closeProps,
  tooltipProps,
  ts,
}: TooltipRenderProps & { ts: ReturnType<typeof useTranslations> }) {
  const tt = useTranslations("tour");
  const tourStep = step as TourStep;
  const isLast = index === size - 1;
  const isFirst = index === 0;

  const placement = (tourStep.placement as Placement) || "bottom";

  const badge = tourStep.badge ? ts(tourStep.badge) : undefined;
  const title = ts(tourStep.title as string);
  const subtitle = tourStep.subtitle ? ts(tourStep.subtitle) : undefined;
  const ctaLabel = tourStep.ctaLabel ? ts(tourStep.ctaLabel) : undefined;

  return (
    <div
      {...tooltipProps}
      className={cn(
        "w-[360px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-[--radius] border border-border bg-card shadow-2xl",
      )}
    >
      <TooltipArrow placement={placement} />
        <div className="rule-engraved relative w-full bg-muted px-4 py-2.5">
          <button
            {...closeProps}
            className="absolute right-2 top-2 z-10 rounded-[--radius] p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label={tt("close")}
          >
            <X size={14} />
          </button>
          <div className="flex flex-col gap-1 pr-8">
            {badge && <span className="legend">{badge}</span>}
            <span className="text-[15px] font-semibold leading-tight tracking-tight text-foreground">
              {title}
            </span>
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {subtitle && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          )}
          {tourStep.content && (
            <div className="text-sm text-foreground/80 leading-relaxed">
              {tourStep.content}
            </div>
          )}
          {tourStep.features && tourStep.features.length > 0 && (
            <ul className="flex flex-col gap-[9px] list-none p-0 m-0">
              {tourStep.features.map((f, i) => {
                const Icon = f.icon;
                return (
                  <li key={i} className="flex items-center gap-[8px]">
                    <span className="shrink-0 text-muted-foreground">
                      <Icon size={16} weight="regular" />
                    </span>
                    <p className="text-xs text-foreground/80 leading-[1.5] m-0">
                      {ts(f.text)}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex items-center gap-[10px] pt-1">
            {!isFirst && (
              <Button
                variant="ghost"
                title={tt("back")}
                icon={<ArrowLeft size={14} />}
                iconVisible
                iconSide="left"
                onClick={backProps.onClick}
                className="rounded-[--radius]"
              />
            )}
            <Button
              variant="action"
              title={
                ctaLabel
                  ? ctaLabel
                  : isLast
                    ? tt("finish")
                    : tt("next")
              }
              icon={isLast ? undefined : <ArrowRight size={14} weight="bold" />}
              iconVisible={!isLast}
              iconSide="right"
              onClick={(e: React.MouseEvent) => {
                if (tourStep.ctaOnClick) {
                  tourStep.ctaOnClick();
                }
                (primaryProps.onClick as React.MouseEventHandler)(e);
              }}
              className="flex-1 rounded-[--radius]"
            />
          </div>

          <div className="flex justify-center">
            <span className="text-[11px] text-muted-foreground/60">
              {index + 1} / {size}
            </span>
          </div>
        </div>
    </div>
  );
}

function TourGuideTooltip(props: TooltipRenderProps) {
  const i18nNs = useContext(I18nNamespaceContext);
  const ts = useTranslations(i18nNs);
  return <TourTooltip {...props} ts={ts} />;
}