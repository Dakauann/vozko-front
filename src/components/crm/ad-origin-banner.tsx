"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getConversationAdOriginAction, isAdsError } from "@/app/actions/advertising";
import { useAdsFormat } from "@/components/advertising/use-ads-format";
import { ArrowSquareOut, FacebookLogo, Info, InstagramLogo, Megaphone } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkspace } from "@/contexts/workspace-context";
import type { AdConversationOrigin } from "@/lib/advertising/types";
import type { AdOrigin } from "@/lib/conversations/ad-origin";
import { cn } from "@/lib/utils";

const PLATFORM_ICON = {
  instagram: InstagramLogo,
  facebook: FacebookLogo,
} as const;

interface OriginLookup {
  key: string;
  origin: AdConversationOrigin | null;
}

function useConversationAdOrigin(entryType: string | undefined, entryId: string | undefined): AdConversationOrigin | null {
  const { can, permissionsLoading } = useWorkspace();
  const allowed = !permissionsLoading && can("ads", "read");
  const key = entryType && entryId ? `${entryType}:${entryId}` : "";
  const [lookup, setLookup] = useState<OriginLookup | null>(null);

  useEffect(() => {
    if (!allowed || !entryType || !entryId) return;
    let cancelled = false;
    const requested = `${entryType}:${entryId}`;
    void getConversationAdOriginAction(entryType, entryId).then((result) => {
      if (cancelled) return;
      setLookup({ key: requested, origin: isAdsError(result) ? null : result.data });
    });
    return () => {
      cancelled = true;
    };
  }, [allowed, entryType, entryId]);

  return allowed && lookup?.key === key ? lookup.origin : null;
}

function AdAccountDetails({ origin }: { origin: AdConversationOrigin }) {
  const t = useTranslations("crmAdOrigin");
  const fmt = useAdsFormat();
  const path = [origin.campaignName, origin.adSetName, origin.adName].filter(Boolean).join(" › ");
  return (
    <span className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-0.5 text-2xs text-muted-foreground">
      <span className="truncate" title={path}>
        {path}
      </span>
      {origin.estimatedLeadCost !== null ? (
        <TooltipProvider delayDuration={150}>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                type="button"
                className="inline-flex items-center gap-1 rounded-[--radius] font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <span className="tabular-nums">{t("leadCost", { amount: fmt.micros(origin.estimatedLeadCost, origin.currency) })}</span>
                <Info className="h-3 w-3 text-muted-foreground" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs text-xs">
              {t("leadCostHint", {
                spend: fmt.micros(origin.daySpend, origin.currency),
                conversations: origin.dayConversations,
                day: origin.day,
              })}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      ) : null}
    </span>
  );
}

export function AdOriginBanner({ origin, entryType, entryId }: { origin: AdOrigin; entryType?: string; entryId?: string }) {
  const t = useTranslations("crmAdOrigin");
  const PlatformIcon = origin.platform ? PLATFORM_ICON[origin.platform] : Megaphone;
  const account = useConversationAdOrigin(entryType, entryId);

  return (
    <div className={cn("flex shrink-0 items-center gap-3 border-b border-border bg-card px-4", account ? "min-h-14 py-2" : "h-14")}>
      <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-[--radius] bg-muted">
        {origin.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={origin.imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" decoding="async" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-muted-foreground">
            <PlatformIcon className="h-5 w-5" aria-hidden />
          </span>
        )}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
          <PlatformIcon className="h-3 w-3 shrink-0" aria-hidden />
          {origin.platform ? t(`cameFrom.${origin.platform}`) : t("cameFrom.unknown")}
        </span>
        <span className="block truncate text-sm font-semibold text-foreground">{origin.title ?? account?.adName ?? t("untitled")}</span>
        {account ? <AdAccountDetails origin={account} /> : null}
      </span>
      {origin.sourceUrl ? (
        <a
          href={origin.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-primary-ink hover:underline"
        >
          {t("open")}
          <ArrowSquareOut className="h-3.5 w-3.5" weight="bold" aria-hidden />
        </a>
      ) : null}
    </div>
  );
}
