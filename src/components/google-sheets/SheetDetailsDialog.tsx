"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

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
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { updateSheetDetails } from "@/lib/google-sheets/client";
import type { GoogleSheet } from "@/lib/google-sheets/types";

export function SheetDetailsDialog({ sheet, onClose, onSaved }: { sheet: GoogleSheet; onClose: () => void; onSaved: (sheet: GoogleSheet) => void }) {
  const t = useTranslations("googleSheets");
  const [title, setTitle] = useState(sheet.title);
  const [description, setDescription] = useState(sheet.description ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setSaving(true);
    setError(null);
    const res = await updateSheetDetails(sheet.id, { version: sheet.version, title: title.trim(), description: description.trim() });
    setSaving(false);
    if (res.error || !res.data) {
      setError(codedErrorMessage(t, res.error ?? {}, t("details.failed")));
      return;
    }
    toast(t("details.saved"));
    onSaved(res.data);
  };

  return (
    <ElevatedDialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <ElevatedDialogContent className="max-w-lg">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("details.title")}</ElevatedDialogTitle>
        </ElevatedDialogHeader>
        <ElevatedDialogBody>
          <div className="space-y-3">
            <ElevatedInput label={`${t("create.sheetTitle")} *`} value={title} onChange={(event) => setTitle(event.target.value)} autoFocus />
            <div className="space-y-1">
              <ElevatedTextarea label={t("create.sheetDescription")} value={description} onChange={(event) => setDescription(event.target.value)} autoResize />
              <p className="text-2xs text-muted-foreground">{t("create.sheetDescriptionHint")}</p>
            </div>
            {error ? <p className="text-xs text-destructive-ink">{error}</p> : null}
          </div>
        </ElevatedDialogBody>
        <ElevatedDialogFooter>
          <Button variant="secondary" title={t("details.cancel")} onClick={onClose} disabled={saving} />
          <Button variant="primary" title={t("details.save")} onClick={() => void submit()} disabled={saving || !title.trim()} />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
