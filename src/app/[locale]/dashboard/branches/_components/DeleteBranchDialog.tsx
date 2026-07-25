"use client";

import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";

import Button from "@/components/elevated-design/button";
import { CircleNotch, Trash } from "@phosphor-icons/react";
import { useTranslations } from "next-intl";

interface DeleteBranchDialogProps {
  open: boolean;
  branchName: string;
  isLoading?: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteBranchDialog({ open, branchName, isLoading, onClose, onConfirm }: DeleteBranchDialogProps) {
  const t = useTranslations("branchesPage.delete");

  return (
    <ElevatedDialog open={open} onOpenChange={(o) => !o && onClose()}>
      <ElevatedDialogContent className="max-w-[420px]">
        <ElevatedDialogHeader>
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10 text-red-600">
            <Trash weight="fill" className="h-5 w-5" />
          </div>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("message", { name: branchName })}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        <ElevatedDialogFooter>
          <Button variant="outline" title={t("cancel")} onClick={onClose} disabled={isLoading} />
          <Button
            variant="action"
            title={t("confirm")}
            onClick={onConfirm}
            disabled={isLoading}
            icon={
              isLoading ? (
                <CircleNotch weight="bold" className="h-4 w-4 animate-spin" />
              ) : (
                <Trash weight="bold" className="h-4 w-4" />
              )
            }
            iconVisible
            iconSide="left"
            className="!bg-red-600 hover:!bg-red-700"
          />
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
