"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";

export function UnsavedChangesDialog({
  open,
  canSave,
  saving,
  onDiscard,
  onCancel,
  onSave,
}: {
  open: boolean;
  canSave: boolean;
  saving: boolean;
  onDiscard: () => void;
  onCancel: () => void;
  onSave: () => void;
}) {
  const t = useTranslations("adsReports.unsaved");
  return (
    <ElevatedDialog open={open} onOpenChange={(next) => !next && !saving && onCancel()}>
      <ElevatedDialogContent className="max-w-md">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("body")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>
        <ElevatedDialogFooter className="flex-wrap">
          <Button variant="ghost" title={t("discard")} onClick={onDiscard} disabled={saving} />
          <Button variant="secondary" title={t("cancel")} onClick={onCancel} disabled={saving} />
          {canSave ? <Button variant="primary" title={t("save")} onClick={onSave} disabled={saving} /> : null}
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
