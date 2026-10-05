"use client";

import * as React from "react";
import { useTranslations } from "next-intl";

import { Ribbon, X } from "@/components/icons";
import { cn } from "@/lib/utils";

import { activeCampaign, dismissalKey } from "./campaigns";

export const CAMPAIGN_STRIP_HEIGHT_VAR = "--campaign-strip-h";
const STRIP_HEIGHT = "28px";

function readDismissed(key: string): boolean {
  try {
    return localStorage.getItem(key) === "dismissed";
  } catch {
    return false;
  }
}

function writeDismissed(key: string) {
  try {
    localStorage.setItem(key, "dismissed");
  } catch {}
}

function subscribeNever() {
  return () => {};
}

export function CampaignStrip({ now: fixedNow }: { now?: Date }) {
  const t = useTranslations("campaignStrip");
  const isClient = React.useSyncExternalStore(
    subscribeNever,
    () => true,
    () => false,
  );
  const [dismissedKey, setDismissedKey] = React.useState<string | null>(null);

  const now = React.useMemo(
    () => fixedNow ?? (isClient ? new Date() : null),
    [fixedNow, isClient],
  );
  const campaign = now ? activeCampaign(now) : null;
  const key = campaign && now ? dismissalKey(campaign, now) : null;
  const dismissed = !key || dismissedKey === key || readDismissed(key);

  const visible = Boolean(campaign) && !dismissed;

  React.useLayoutEffect(() => {
    if (!visible) return;
    const root = document.documentElement;
    root.style.setProperty(CAMPAIGN_STRIP_HEIGHT_VAR, STRIP_HEIGHT);
    return () => {
      root.style.removeProperty(CAMPAIGN_STRIP_HEIGHT_VAR);
    };
  }, [visible]);

  if (!visible || !campaign || !key) return null;

  const dismiss = () => {
    writeDismissed(key);
    setDismissedKey(key);
  };

  return (
    <div
      role="region"
      aria-label={t(`${campaign.messagesKey}.title`)}
      className={cn(
        "fixed inset-x-0 top-0 z-40 flex h-7 items-center gap-2 pl-3 pr-1.5",
        "border-b border-[hsl(330_80%_40%)] bg-[hsl(330_84%_47%)] text-white",
        "dark:border-[hsl(330_60%_32%)] dark:bg-[hsl(330_68%_40%)]",
      )}
    >
      <Ribbon
        size={16}
        className="shrink-0 text-white [--icon-accent:hsl(330_100%_88%)]"
      />
      <p className="min-w-0 truncate text-xs leading-none">
        <span className="font-semibold tracking-[-0.005em]">
          {t(`${campaign.messagesKey}.title`)}
        </span>
        <span aria-hidden="true" className="mx-1.5 opacity-50">
          ·
        </span>
        <span>{t(`${campaign.messagesKey}.message`)}</span>
      </p>
      <button
        type="button"
        onClick={dismiss}
        aria-label={t("dismiss")}
        title={t("dismiss")}
        className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-[--radius] opacity-70 transition-opacity hover:bg-white/15 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X size={14} />
      </button>
    </div>
  );
}
