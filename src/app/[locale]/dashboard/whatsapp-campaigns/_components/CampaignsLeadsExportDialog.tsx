"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import Button from "@/components/elevated-design/button";
import { Checkbox } from "@/components/elevated-design/elevated-checkbox";
import { DownloadSimple, Info } from "@/components/icons";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { useExportEntries } from "@/hooks/use-export-entries";
import { useToast } from "@/hooks/use-toast";
import {
  DISPATCHED_STATUSES,
  SEND_STATUSES,
} from "@/lib/whatsapp-campaigns/statuses";
import { exportErrorKey } from "@/lib/whatsapp-campaigns/export-errors";
import type {
  WhatsAppCampaignMetrics,
  WhatsAppCampaignPhoneStatus,
} from "@/lib/whatsapp-campaigns/types";

interface CampaignsLeadsExportDialogProps {
  type?: string;
  from: string;
  to: string;
  metrics: WhatsAppCampaignMetrics | null;
  disabled?: boolean;
}

export function CampaignsLeadsExportDialog({
  type,
  from,
  to,
  metrics,
  disabled,
}: CampaignsLeadsExportDialogProps) {
  const t = useTranslations("campaignsSummary");
  const tStatus = useTranslations("whatsappCampaignsPage");
  const { toast } = useToast();
  const { exporting, exportEntries } = useExportEntries();

  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<WhatsAppCampaignPhoneStatus[]>(
    DISPATCHED_STATUSES,
  );

  const expectedRows = useMemo(() => {
    if (!metrics) return null;
    const perStatus: Record<WhatsAppCampaignPhoneStatus, number> = {
      PENDING: metrics.pending ?? 0,
      SENT: metrics.sent ?? 0,
      DELIVERED: metrics.delivered ?? 0,
      READ: metrics.read ?? 0,
      FAILED: metrics.failed ?? 0,
      NOT_ELIGIBLE_POSSIBLE_SPAM: metrics.notEligiblePossibleSpam ?? 0,
    };
    return selected.reduce((sum, status) => sum + (perStatus[status] ?? 0), 0);
  }, [metrics, selected]);

  const toggle = (status: WhatsAppCampaignPhoneStatus) => {
    setSelected((prev) =>
      prev.includes(status)
        ? prev.filter((s) => s !== status)
        : [...prev, status],
    );
  };

  const handleExport = async () => {
    const result = await exportEntries(
      {
        kind: "workspace",
        type,
        from: from || undefined,
        to: to || undefined,
      },
      {
        statuses:
          selected.length === SEND_STATUSES.length ? undefined : selected,
      },
    );

    if ("error" in result) {
      toast({
        title: t("export.errorTitle"),
        description: t(`export.${exportErrorKey(result.error)}`),
        variant: "destructive",
      });
      return;
    }

    toast({ title: t("export.success") });
    setOpen(false);
  };

  return (
    <>
      <Button
        variant="outline-subtle"
        size="sm"
        title={t("export.trigger")}
        icon={<DownloadSimple weight="bold" className="h-4 w-4" />}
        iconVisible
        iconSide="left"
        disabled={disabled || exporting}
        onClick={() => setOpen(true)}
      />

      <ElevatedDialog open={open} onOpenChange={setOpen}>
        <ElevatedDialogContent className="sm:max-w-[480px]">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{t("export.title")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>
              {from || to
                ? t("export.descriptionFiltered", {
                    from: from || "—",
                    to: to || "—",
                  })
                : t("export.descriptionAllTime")}
            </ElevatedDialogDescription>
          </ElevatedDialogHeader>

          <fieldset className="flex flex-col gap-3 py-2">
            <legend className="pb-2 text-xs font-semibold text-muted-foreground">
              {t("export.statusesLabel")}
            </legend>
            {SEND_STATUSES.map((status) => (
              <label
                key={status.value}
                className="flex cursor-pointer items-center gap-2.5 text-sm text-foreground"
              >
                <Checkbox
                  checked={selected.includes(status.value)}
                  onCheckedChange={() => toggle(status.value)}
                />
                {tStatus(status.labelKey)}
              </label>
            ))}
          </fieldset>

          <div className="flex items-start gap-2 rounded-[--radius] bg-muted px-3 py-2.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{t("export.ledgerNote")}</span>
          </div>

          <ElevatedDialogFooter className="items-center gap-3">
            {expectedRows !== null ? (
              <span className="mr-auto text-xs text-muted-foreground">
                <TooltipWrapper content={t("export.expectedRowsHelp")} side="top">
                  <span className="cursor-help border-b border-dotted border-current">
                    {t("export.expectedRows", {
                      count: expectedRows.toLocaleString("pt-BR"),
                    })}
                  </span>
                </TooltipWrapper>
              </span>
            ) : null}
            <Button
              variant="outline-subtle"
              size="sm"
              title={t("export.cancel")}
              disabled={exporting}
              onClick={() => setOpen(false)}
            />
            <Button
              variant="primary"
              size="sm"
              title={
                exporting ? t("export.exporting") : t("export.confirm")
              }
              disabled={exporting || selected.length === 0}
              onClick={handleExport}
            />
          </ElevatedDialogFooter>
        </ElevatedDialogContent>
      </ElevatedDialog>
    </>
  );
}
