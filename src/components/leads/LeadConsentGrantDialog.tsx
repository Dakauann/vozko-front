"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import { grantLeadConsentAction } from "@/app/actions/leads";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { codedErrorMessage } from "@/lib/api/coded-error";
import type { LeadRecord } from "@/lib/leads/types";

const MAX_NOTE = 280;
const MAX_PURPOSE = 200;

export function LeadConsentGrantDialog({
  leadId,
  onOpenChange,
  onRecorded,
}: {
  leadId: string;
  onOpenChange: (open: boolean) => void;
  onRecorded: (record: LeadRecord) => void;
}) {
  const t = useTranslations("leadExit.regrant");
  const tErrors = useTranslations("leads");
  const [note, setNote] = useState("");
  const [purpose, setPurpose] = useState("");

  const record = async (): Promise<boolean> => {
    const result = await grantLeadConsentAction(leadId, { note, purpose });
    if (result.error) {
      toast.error(t("failed"), { description: codedErrorMessage(tErrors, result.error, "") || undefined });
      return false;
    }
    onRecorded(result.lead);
    toast.success(result.changed ? t("done") : t("unchanged"));
    return true;
  };

  return (
    <ConfirmDialog
      open
      onOpenChange={onOpenChange}
      title={t("title")}
      description={t("description")}
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      tone="default"
      onConfirm={record}
      confirmDisabled={!note.trim()}
    >
      <div className="space-y-3">
        <ElevatedTextarea label={t("note")} value={note} rows={3} maxLength={MAX_NOTE} onChange={(event) => setNote(event.target.value)} />
        <ElevatedInput label={t("purpose")} value={purpose} maxLength={MAX_PURPOSE} onChange={(event) => setPurpose(event.target.value)} />
      </div>
    </ConfirmDialog>
  );
}
