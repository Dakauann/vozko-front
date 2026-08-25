"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  Phone,
  Monitor,
  Clock,
  ArrowRight,
} from "@/components/icons";
import {
  ElevatedDialog,
  ElevatedDialogContent,
} from "@/components/elevated-design/elevated-dialog";
import { cn } from "@/lib/utils";
import GrainBackground, {
  type ColorGroup,
} from "@/components/elevated-design/grain-background";
import Button, { type ButtonProps } from "@/components/elevated-design/button";
import type { Icon } from "@/components/icons";
import type { ReactNode } from "react";

export interface FeatureItem {
  icon: Icon;
  text: string;
}

export interface FeatureOverviewButton {
  label: string;
  variant?: ButtonProps["variant"];
  icon?: ReactNode;
  iconVisible?: boolean;
  iconSide?: "left" | "right";
  onClick?: () => void;
}

export interface FeatureOverviewDialogProps {
  feature: string;
  headerTitle?: string;
  badge?: string;
  title: string;
  subTitle: string;
  description?: string;
  features: FeatureItem[];
  buttons: FeatureOverviewButton[];
  mediaSrc?: string;
  mediaAlt?: string;
  palette?: ColorGroup[];
  headerHeight?: number;
}

const defaultPalette: ColorGroup[] = [
  { colors: ["#e8d4a0", "#f5ecce"], weight: 40 },
  { colors: ["#c49a45", "#b8874a"], weight: 30 },
  { colors: ["#8b6b3e", "#6e5230"], weight: 20 },
  { colors: ["#f5e8c8", "#faf3e0"], weight: 10 },
];

function isVideo(src: string) {
  return /\.(mp4|webm|ogg)(\?.*)?$/i.test(src);
}

export default function FeatureOverviewDialog({
  feature,
  headerTitle,
  badge,
  title,
  subTitle,
  description,
  features,
  buttons,
  mediaSrc,
  mediaAlt,
  palette = defaultPalette,
  headerHeight,
}: FeatureOverviewDialogProps) {
  // Start closed so the first paint never covers the page with a dim veil.
  // Open after mount (one frame later) for first-time intros.
  const [open, setOpen] = useState(false);
  useEffect(() => {
    setOpen(true);
  }, []);

  const resolvedHeaderTitle =
    headerTitle ?? feature.charAt(0).toUpperCase() + feature.slice(1);
  const resolvedTitle = subTitle;
  const resolvedFeatures = features;
  const resolvedHeaderHeight = headerHeight ?? 176;

  const resolvedButtons: FeatureOverviewButton[] = buttons ?? [
    {
      label: "Começar agora",
      variant: "action",
      icon: <ArrowRight size={14} weight="bold" />,
      iconVisible: true,
      iconSide: "right",
      onClick: () => setOpen(false),
    },
  ];

  return (
    <ElevatedDialog open={open} onOpenChange={setOpen}>
      <ElevatedDialogContent
        overlayClassName="bg-black/25 data-[state=closed]:pointer-events-none"
        className="w-[420px] max-w-[calc(100vw-2rem)] !p-1.5 overflow-hidden max-h-max"
      >
        <div className="overflow-hidden rounded-[--radius]">
          <div
            className="relative w-full overflow-hidden"
            style={{ height: resolvedHeaderHeight }}
          >
            {mediaSrc ? (
              <>
                {isVideo(mediaSrc) ? (
                  <video
                    src={mediaSrc}
                    className="absolute inset-0 h-full w-full object-cover"
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <img
                    src={mediaSrc}
                    alt={mediaAlt ?? resolvedHeaderTitle}
                    className="absolute inset-0 h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-0 bg-muted" />
              </>
            ) : (
              // No generative colour field behind the title. When there is no
              // real media to show, the panel shows its own surface — the
              // legend below carries the name.
              <div className="absolute inset-0 bg-muted" />
            )}
            {/* Ink follows the ground: white over media, panel ink over the
                plain surface. The title was unconditionally white, which went
                invisible the moment the colour field behind it was removed. */}
            <div className="absolute bottom-1/2 left-1/2 top-1/2 z-10 flex -translate-x-1/2 items-center gap-2 whitespace-nowrap">
              <span
                className={cn(
                  "font-display text-2xl font-semibold tracking-[0.01em] sm:text-2xl",
                  mediaSrc
                    ? "text-white drop-shadow-[0_1px_6px_rgba(0,0,0,0.25)]"
                    : "text-foreground",
                )}
              >
                {resolvedHeaderTitle}
              </span>
              {badge && (
                <span
                  className={cn(
                    "rounded-[--radius] border px-2 py-[3px] text-2xs font-medium tracking-wide sm:px-2.5 sm:py-1 sm:text-xs",
                    mediaSrc
                      ? "border-white/40 bg-white/25 text-white"
                      : "border-border text-muted-foreground",
                  )}
                >
                  {badge}
                </span>
              )}
            </div>
          </div>

          <div className="px-5 sm:px-6 pt-4 sm:pt-[18px] pb-5 sm:pb-6 space-y-3 sm:space-y-4">
            <div>
              <h2 className="font-display text-xl sm:text-2xl font-semibold text-foreground tracking-[0.01em]">
                {resolvedTitle}
              </h2>
              {description && (
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            <ul className="flex flex-col gap-[11px] sm:gap-[13px] list-none p-0 m-0">
              {resolvedFeatures.map((f, i) => {
                const Icon = f.icon;
                return (
                  <li
                    key={i}
                    className="flex items-center gap-[9px] sm:gap-[11px]"
                  >
                    <span className="shrink-0 text-muted-foreground">
                      <Icon size={20} weight="regular" />
                    </span>
                    <p className="text-sm sm:text-base leading-[1.6] text-foreground/80 m-0">
                      {f.text}
                    </p>
                  </li>
                );
              })}
            </ul>

            <div className="flex gap-[10px] pt-1">
              {resolvedButtons.map((btn, i) => (
                <Button
                  key={i}
                  variant={btn.variant ?? "action"}
                  title={btn.label}
                  icon={btn.icon}
                  iconVisible={btn.iconVisible ?? !!btn.icon}
                  iconSide={btn.iconSide ?? "right"}
                  onClick={btn.onClick}
                  className={
                    resolvedButtons.length === 1
                      ? "w-full rounded-[--radius]"
                      : i === resolvedButtons.length - 1
                        ? "flex-1 rounded-[--radius]"
                        : "rounded-[--radius]"
                  }
                />
              ))}
            </div>
          </div>
        </div>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
