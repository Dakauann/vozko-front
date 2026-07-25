"use client";

import { useEffect, useState } from "react";
import {
  Brain,
  Phone,
  Monitor,
  Clock,
  ArrowRight,
} from "@phosphor-icons/react";
import {
  ElevatedDialog,
  ElevatedDialogContent,
} from "@/components/elevated-design/elevated-dialog";
import GrainBackground, {
  type ColorGroup,
} from "@/components/elevated-design/grain-background";
import Button, { type ButtonProps } from "@/components/elevated-design/button";
import type { Icon } from "@phosphor-icons/react";
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
        <div className="rounded-[22px] overflow-hidden">
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
                <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-black/10" />
              </>
            ) : (
              <>
                <div className="absolute inset-0">
                  <GrainBackground
                    palette={[
                      { colors: ["#3b82f6", "#2563eb"], weight: 40 },
                      { colors: ["#2563eb", "#1d4ed8"], weight: 30 },
                      { colors: ["#1d4ed8", "#1e40af"], weight: 20 },
                      { colors: ["#1e40af", "#1e3a8a"], weight: 10 },
                    ]}
                    mode="islands"
                    seed={50}
                    islandsScale={0.01}
                    islandsElongation={0.9}
                    islandsWarp={10}
                    islandsBlur={2}
                    opacity={0}
                    className="h-full !rounded-none"
                  />
                </div>
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-black/5" />
              </>
            )}
            <div className="absolute bottom-1/2 top-1/2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 whitespace-nowrap">
              <span className="text-2xl sm:text-[26px] font-semibold text-white tracking-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.25)]">
                {resolvedHeaderTitle}
              </span>
              {badge && (
                <span className="text-[11px] sm:text-xs font-medium text-white bg-white/25 border border-white/40 rounded-full px-2 sm:px-2.5 py-[3px] sm:py-1 tracking-wide">
                  {badge}
                </span>
              )}
            </div>
          </div>

          <div className="px-5 sm:px-6 pt-4 sm:pt-[18px] pb-5 sm:pb-6 space-y-3 sm:space-y-4">
            <div>
              <h2 className="text-xl sm:text-[22px] font-semibold text-foreground tracking-tight">
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
                    <p className="text-sm sm:text-[15px] leading-[1.6] text-foreground/80 m-0">
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
                      ? "w-full rounded-[10px]"
                      : i === resolvedButtons.length - 1
                        ? "flex-1 rounded-[10px]"
                        : "rounded-[10px]"
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
