"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { getAdPublishJobAction, isAdsError, switchOnPublishJobAction } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import { CheckCircle, Play, Plus, X } from "@/components/icons";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { newAdHref } from "@/lib/advertising/connect";
import { canSwitchOnLater } from "@/lib/advertising/publish";
import type { AdAccount } from "@/lib/advertising/types";

import { useAdsErrorText } from "./use-ads-error";
import { readyData, useAdsResource } from "./wizard/use-ads-resource";

function SwitchOnButton({ jobId, onSwitchedOn }: { jobId: string; onSwitchedOn: () => void }) {
  const t = useTranslations("adsManager.published");
  const errorText = useAdsErrorText();
  const job = useAdsResource(`publish-job:${jobId}`, () => getAdPublishJobAction(jobId));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const loaded = readyData(job);
  if (!loaded || !canSwitchOnLater(loaded)) return null;

  const switchOn = async () => {
    setBusy(true);
    setError(null);
    const result = await switchOnPublishJobAction(jobId);
    setBusy(false);
    if (isAdsError(result)) {
      setError(errorText(result));
      return;
    }
    onSwitchedOn();
  };

  return (
    <div className="space-y-1">
      <Button
        variant="primary"
        size="sm"
        title={busy ? t("switchingOn") : t("switchOn")}
        icon={<Play className="h-4 w-4" />}
        iconVisible
        iconSide="left"
        disabled={busy}
        onClick={() => void switchOn()}
      />
      <p className="text-xs text-muted-foreground">{t("switchOnHint")}</p>
      {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
    </div>
  );
}

export function PublishedNotice({
  account,
  canCreate,
  jobId,
  onSwitchedOn,
  onDismiss,
}: {
  account: AdAccount;
  canCreate: boolean;
  jobId: string | null;
  onSwitchedOn: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("adsManager.published");
  return (
    <Alert variant="healthy" className="relative pr-12">
      <CheckCircle className="h-4 w-4" weight="fill" />
      <AlertTitle>{t("title")}</AlertTitle>
      <AlertDescription className="space-y-2">
        <p>{t("body")}</p>
        <p>{account.canSpend ? t("paused") : t("pausedNoFunding")}</p>
        <div className="flex flex-wrap items-start gap-3">
          {jobId && account.canSpend ? <SwitchOnButton jobId={jobId} onSwitchedOn={onSwitchedOn} /> : null}
          {canCreate ? (
            <Button
              variant="secondary"
              size="sm"
              title={t("createAnother")}
              icon={<Plus className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              link={newAdHref(account.id)}
            />
          ) : null}
        </div>
      </AlertDescription>
      <button
        type="button"
        onClick={onDismiss}
        aria-label={t("dismiss")}
        className="absolute right-3 top-3 inline-flex h-7 w-7 items-center justify-center rounded-[--radius] text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </Alert>
  );
}
