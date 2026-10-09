"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { optOutLeadAction } from "@/app/actions/leads";
import { ChoiceRow } from "@/components/elevated-design/choice-row";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { RadioGroup } from "@/components/ui/radio-group";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { LEAD_OPT_OUT_SOURCES, type LeadOptOutSource, type LeadRecord } from "@/lib/leads/types";

export function LeadOptOutDialog({
  leadId,
  onOpenChange,
  onRecorded,
}: {
  leadId: string;
  onOpenChange: (open: boolean) => void;
  onRecorded: (record: LeadRecord) => void;
}) {
  const t = useTranslations("leadDetail");
  const tErrors = useTranslations("leads");
  const [source, setSource] = useState<LeadOptOutSource | null>(null);

  const record = async (): Promise<boolean> => {
    if (!source) return false;
    const result = await optOutLeadAction(leadId, source);
    if (result.error) {
      toast.error(t("optOut.failed"), { description: codedErrorMessage(tErrors, result.error, "") || undefined });
      return false;
    }
    onRecorded(result.lead);
    toast.success(t("optOut.done"));
    return true;
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={t("optOut.title")}
      description={t("optOut.description")}
      confirmLabel={t("optOut.confirm")}
      cancelLabel={t("cancel")}
      tone="default"
      onConfirm={record}
      confirmDisabled={!source}
    >
      <OptOutSourceChoice value={source} onChange={setSource} />
    </ConfirmDialog>
  );
}

function OptOutSourceChoice({ value, onChange }: { value: LeadOptOutSource | null; onChange: (source: LeadOptOutSource) => void }) {
  const t = useTranslations("leadDetail.optOut");
  const titleId = useId();
  return (
    <div className="space-y-2">
      <p id={titleId} className="text-sm font-medium text-foreground">
        {t("sourceLabel")}
      </p>
      <RadioGroup
        aria-labelledby={titleId}
        value={value ?? ""}
        onValueChange={(next) => {
          const source = LEAD_OPT_OUT_SOURCES.find((candidate) => candidate === next);
          if (source) onChange(source);
        }}
        className="gap-2"
      >
        {LEAD_OPT_OUT_SOURCES.map((source) => (
          <ChoiceRow key={source} value={source} title={t(`sources.${source}`)} />
        ))}
      </RadioGroup>
    </div>
  );
}
