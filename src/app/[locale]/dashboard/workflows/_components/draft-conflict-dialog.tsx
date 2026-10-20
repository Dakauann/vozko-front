"use client";

import { useTranslations } from "next-intl";

import ElevatedButton from "@/components/elevated-design/button";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function DraftConflictDialog({
  open,
  canOverwrite,
  onReload,
  onOverwrite,
  onDismiss,
}: {
  open: boolean;
  canOverwrite: boolean;
  onReload: () => void;
  onOverwrite: () => void;
  onDismiss: () => void;
}) {
  const t = useTranslations("workflowsPage.draftSave");
  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) onDismiss();
      }}
    >
      <AlertDialogContent className="max-w-md gap-0 overflow-hidden rounded-[--radius] p-0 sm:rounded-[--radius]">
        <div className="space-y-4 p-6">
          <div className="space-y-1.5">
            <AlertDialogTitle className="flex items-center gap-2 text-base font-semibold">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-full bg-warning" />
              {t("conflictTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-sm leading-relaxed">{t("conflictDescription")}</AlertDialogDescription>
            {!canOverwrite && <p className="text-xs text-muted-foreground">{t("overwriteUnavailable")}</p>}
          </div>
          <AlertDialogFooter className="flex-row gap-2.5 sm:justify-stretch sm:space-x-0">
            <ElevatedButton variant="primary" size="sm" className="flex-1" title={t("reload")} onClick={onReload} />
            <ElevatedButton
              variant="outline-subtle"
              size="sm"
              className="flex-1"
              title={t("overwrite")}
              onClick={onOverwrite}
              disabled={!canOverwrite}
            />
          </AlertDialogFooter>
        </div>
      </AlertDialogContent>
    </AlertDialog>
  );
}
