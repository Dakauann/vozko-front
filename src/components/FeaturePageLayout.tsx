"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowRight } from "@phosphor-icons/react";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";
import GrainBackground from "@/components/elevated-design/grain-background";
import Button from "@/components/elevated-design/button";
import { featureConfigs, type FeaturePageKey } from "@/data/feature-overview";

// A variant swaps the feature overview for a specific sub-route. `match` is
// tested as a substring of the current pathname (locale-prefix agnostic); the
// longest match wins. This lets one shared layout show route-appropriate content
//, e.g. receptive/organic sub-routes get their own overview instead of the
// outbound parent's.
interface FeaturePageVariant {
  match: string;
  featureKey: FeaturePageKey;
}

interface FeaturePageLayoutProps {
  featureKey: FeaturePageKey;
  variants?: FeaturePageVariant[];
  children: React.ReactNode;
}

export default function FeaturePageLayout({
  featureKey,
  variants,
  children,
}: FeaturePageLayoutProps) {
  const pathname = usePathname();
  const effectiveKey = useMemo<FeaturePageKey>(() => {
    if (!variants?.length || !pathname) return featureKey;
    const matched = variants
      .filter((v) => pathname.includes(v.match))
      .sort((a, b) => b.match.length - a.match.length)[0];
    return matched?.featureKey ?? featureKey;
  }, [pathname, variants, featureKey]);

  const config = featureConfigs[effectiveKey];
  const t = useTranslations("featurePages");
  const storageKey = `feature_overview_dismissed_${effectiveKey}`;
  // Start closed. Opening with useState(true) then closing in useEffect painted a
  // full-viewport dim veil (and Radix scroll-lock) on every layout mount , the
  // pure black/white "blackout" users reported that is not the page-reveal curtain.
  // Only open after we know this overview was not dismissed.
  const [open, setOpen] = useState(false);

  useEffect(() => {
    // Re-evaluate on every key change (e.g. navigating base → receptive within
    // the same shared layout): open iff this specific overview wasn't dismissed.
    try {
      setOpen(localStorage.getItem(storageKey) !== "true");
    } catch {
      setOpen(true);
    }
  }, [storageKey]);

  const handleDismiss = () => {
    setOpen(false);
    try {
      localStorage.setItem(storageKey, "true");
    } catch {
      // ignore
    }
  };

  const badge = t(`${effectiveKey}.badge`);
  const title = t(`${effectiveKey}.title`);
  const subtitle = t(`${effectiveKey}.subtitle`);
  const dismissLabel = t(`${effectiveKey}.dismissButton`);

  return (
    <>
      <ElevatedDialog
        open={open}
        onOpenChange={(next) => {
          if (!next) handleDismiss();
          else setOpen(true);
        }}
      >
        <ElevatedDialogContent
          overlayClassName="bg-black/25 data-[state=closed]:pointer-events-none"
          className="w-[420px] max-w-[calc(100vw-2rem)] !p-1.5 overflow-hidden max-h-max"
        >
          <VisuallyHidden.Root>
            <ElevatedDialogTitle>{title}</ElevatedDialogTitle>
          </VisuallyHidden.Root>
          <div className="rounded-[22px] overflow-hidden">
            <div
              className="relative w-full overflow-hidden"
              style={{ height: 176 }}
            >
              <div className="absolute inset-0">
                <GrainBackground
                  palette={config.palette}
                  mode="islands"
                  seed={config.seed}
                  islandsScale={0.01}
                  islandsElongation={0.9}
                  islandsWarp={10}
                  islandsBlur={2}
                  opacity={0}
                  className="h-full !rounded-none"
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-black/5" />
              <div className="absolute bottom-1/2 top-1/2 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 whitespace-nowrap">
                <span className="text-2xl sm:text-[26px] font-bold text-white tracking-tight drop-shadow-[0_1px_6px_rgba(0,0,0,0.25)]">
                  {badge}
                </span>
              </div>
            </div>

            <div className="px-5 sm:px-6 pt-4 sm:pt-[18px] pb-5 sm:pb-6 space-y-3 sm:space-y-4">
              <div>
                <h2 className="text-xl sm:text-[22px] font-bold text-foreground tracking-tight leading-tight">
                  {title}
                </h2>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                  {subtitle}
                </p>
              </div>

              <ul className="flex flex-col gap-[11px] sm:gap-[13px] list-none p-0 m-0">
                {config.features.map((f, i) => {
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
                        {t(`${effectiveKey}.features.${i}`)}
                      </p>
                    </li>
                  );
                })}
              </ul>

              <div className="flex gap-[10px] pt-1">
                <Button
                  variant="action"
                  title={dismissLabel}
                  icon={<ArrowRight size={14} weight="bold" />}
                  iconVisible
                  iconSide="right"
                  onClick={handleDismiss}
                  className="w-full rounded-[10px]"
                />
              </div>
            </div>
          </div>
        </ElevatedDialogContent>
      </ElevatedDialog>
      {children}
    </>
  );
}