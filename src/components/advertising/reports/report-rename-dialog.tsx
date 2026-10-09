"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import { updateAdSavedReportAction } from "@/app/actions/advertising-reports";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { toast } from "sonner";
import type { AdSavedReport } from "@/lib/advertising/types";

export function ReportRenameDialog({
  report,
  onClose,
  onRenamed,
}: {
  report: AdSavedReport;
  onClose: () => void;
  onRenamed: (report: AdSavedReport) => void;
}) {
  const t = useTranslations("adsReports.rename");
  const [name, setName] = useState(report.name);
  const [saving, setSaving] = useState(false);
  const trimmed = name.trim();

  const submit = async () => {
    if (!trimmed) return;
    setSaving(true);
    const outcome = await updateAdSavedReportAction(report.id, { name: trimmed, adAccountId: report.adAccountId, definition: report.definition });
    setSaving(false);
    if (isAdsError(outcome)) {
      toast.error(t("failed"), { description: outcome.error });
      return;
    }
    toast(t("done"));
    onRenamed(outcome.data);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void submit();
            }}
          >
            <ElevatedInput label={t("label")} placeholder=" " value={name} onChange={(event) => setName(event.target.value)} autoFocus />
          </form>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("cancel")} onClick={onClose} disabled={saving} />
          <Button variant="primary" title={t("save")} onClick={() => void submit()} disabled={saving || !trimmed} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
