"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { Info, Warning } from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { getPipelineUsageAction } from "@/app/actions/crm-board";
import { blockingBindings, type Pipeline, type PipelineUsage } from "@/lib/crm/pipelines";

interface DeleteFunnelDialogProps {
  funnel: Pipeline | null;
  destinations: Pipeline[];
  onCancel: () => void;
  onConfirm: (moveEntriesTo?: string) => Promise<void>;
}

export function DeleteFunnelDialog({
  funnel,
  destinations,
  onCancel,
  onConfirm,
}: DeleteFunnelDialogProps) {
  const t = useTranslations("funnels.remove");
  const [usage, setUsage] = useState<PipelineUsage | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [destination, setDestination] = useState("");
  const [busy, setBusy] = useState(false);

  const funnelId = funnel?.id ?? null;

  useEffect(() => {
    if (!funnelId) return;
    let alive = true;
    void (async () => {
      const { usage, error } = await getPipelineUsageAction(funnelId);
      if (!alive) return;
      if (error || !usage) {
        setLoadError(error ?? t("loadFailed"));
        return;
      }
      setUsage(usage);
    })();
    return () => {
      alive = false;
    };
  }, [funnelId, t]);

  const confirm = useCallback(async () => {
    setBusy(true);
    await onConfirm(destination || undefined);
    setBusy(false);
  }, [destination, onConfirm]);

  if (!funnel) return null;

  const blocked = usage ? blockingBindings(usage) > 0 : false;
  const needsDestination = usage ? usage.entries > 0 : false;
  const ready = usage !== null && !blocked && (!needsDestination || destination !== "");

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && onCancel()}>
      <ElevatedDialogContent className="sm:max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title", { name: funnel.name })}</ElevatedDialogTitle>
          <ElevatedDialogDescription>
            {usage === null && !loadError
              ? t("loading")
              : blocked
                ? t("blockedLead")
                : needsDestination
                  ? t("moveLead", { count: usage?.entries ?? 0 })
                  : t("emptyLead")}
          </ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <div className="flex flex-col gap-4 py-1">
          {loadError ? (
            <Notice tone="fault" text={loadError} />
          ) : usage === null ? (
            <div className="h-16 animate-pulse rounded-[--radius] bg-muted" />
          ) : blocked ? (
            <BlockedDetail usage={usage} />
          ) : needsDestination ? (
            <div className="flex flex-col gap-2">
              <ElevatedSelect
                label={t("destinationLabel")}
                value={destination}
                onValueChange={setDestination}
                placeholder={t("destinationPlaceholder")}
              >
                {destinations.map((d) => (
                  <ElevatedSelectItem key={d.id} value={d.id}>
                    {d.name}
                  </ElevatedSelectItem>
                ))}
              </ElevatedSelect>
              <p className="text-2xs leading-snug text-muted-foreground">
                {destination
                  ? t("destinationChosen", {
                      count: usage.entries,
                      name:
                        destinations.find((d) => d.id === destination)?.name ?? "",
                    })
                  : t("destinationHint")}
              </p>
            </div>
          ) : (
            <Notice tone="info" text={t("emptyDetail")} />
          )}
        </div>

        <ElevatedDialogFooter>
          <ElevatedButton
            variant="secondary"
            size="sm"
            onClick={onCancel}
            disabled={busy}
            title={blocked ? t("close") : t("cancel")}
          />
          {!blocked ? (
            <ElevatedButton
              variant="destructive"
              size="sm"
              onClick={confirm}
              disabled={!ready || busy}
              title={busy ? t("removing") : t("confirm")}
            />
          ) : null}
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function BlockedDetail({ usage }: { usage: PipelineUsage }) {
  const t = useTranslations("funnels.remove");
  const rows = [
    { key: "campaigns", n: usage.campaigns, label: t("blockedCampaigns", { count: usage.campaigns }) },
    { key: "channels", n: usage.channels, label: t("blockedChannels", { count: usage.channels }) },
    { key: "opportunities", n: usage.opportunities, label: t("blockedOpportunities", { count: usage.opportunities }) },
  ].filter((r) => r.n > 0);

  return (
    <div className="flex flex-col gap-3 rounded-[--radius] bg-muted px-3 py-3">
      <div className="flex items-start gap-2">
        <Warning
          className="mt-0.5 h-4 w-4 flex-none text-warning-ink"
          weight="bold"
          aria-hidden="true"
        />
        <p className="text-sm font-medium leading-snug text-foreground">
          {t("blockedTitle")}
        </p>
      </div>
      <ul className="flex flex-col gap-1.5 pl-6">
        {rows.map((r) => (
          <li key={r.key} className="flex items-baseline gap-2 text-sm text-muted-foreground">
            <span className="readout font-medium text-foreground">{r.n}</span>
            <span>{r.label}</span>
          </li>
        ))}
      </ul>
      <p className="pl-6 text-2xs leading-snug text-muted-foreground">
        {t("blockedHint")}
      </p>
    </div>
  );
}

function Notice({ tone, text }: { tone: "info" | "fault"; text: string }) {
  const Glyph = tone === "fault" ? Warning : Info;
  return (
    <div className="flex items-start gap-2 rounded-[--radius] bg-muted px-3 py-2.5">
      <Glyph
        className={
          tone === "fault"
            ? "mt-0.5 h-4 w-4 flex-none text-destructive-ink"
            : "mt-0.5 h-4 w-4 flex-none text-info-ink"
        }
        weight="bold"
        aria-hidden="true"
      />
      <p className="text-sm leading-snug text-muted-foreground">{text}</p>
    </div>
  );
}
