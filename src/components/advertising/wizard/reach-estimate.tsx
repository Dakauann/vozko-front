"use client";

import { useTranslations } from "next-intl";

import { estimateAdReachAction } from "@/app/actions/advertising-create";
import { Users } from "@/components/icons";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cleanPlacements, cleanTargeting } from "@/lib/advertising/draft";

import { useAdsFormat } from "../use-ads-format";
import { useAdsResource } from "./use-ads-resource";
import { useWizard } from "./wizard-context";

const ESTIMATE_DELAY_MS = 800;

export function ReachEstimate() {
  const t = useTranslations("adsWizard.reach");
  const fmt = useAdsFormat();
  const { form } = useWizard();
  const input =
    form.targeting.locations.length > 0 && form.accountId
      ? JSON.stringify({
          targeting: cleanTargeting(form.targeting, form.specialCategory),
          placements: cleanPlacements(form.placements),
          goal: form.goal || undefined,
        })
      : "";
  const settled = useDebouncedValue(input, ESTIMATE_DELAY_MS);
  const accountId = form.accountId;
  const estimate = useAdsResource(settled ? `${accountId}:${settled}` : null, () => estimateAdReachAction(accountId, JSON.parse(settled)));
  const pending = input !== settled || estimate.status === "loading";

  let text = t("needsLocation");
  if (input && pending) text = t("loading");
  else if (estimate.status === "ready" && estimate.data.ready && estimate.data.upper > 0) {
    text = t("range", { lower: fmt.count(estimate.data.lower), upper: fmt.count(estimate.data.upper) });
  } else if (input) text = t("unavailable");

  return (
    <div className="flex items-start gap-2 rounded-[--radius] border border-border bg-muted px-3 py-2.5" aria-live="polite">
      <Users className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
      <div className="min-w-0">
        <p className="text-sm font-semibold tabular-nums text-foreground">{text}</p>
        <p className="text-xs text-muted-foreground">{t("hint")}</p>
      </div>
    </div>
  );
}
