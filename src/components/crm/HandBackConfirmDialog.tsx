"use client";

import { useTranslations } from "next-intl";

import { FlowArrow, Robot } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { HandBackTarget } from "@/lib/conversations/hand-back";

export function HandBackConfirmDialog({
  open,
  onOpenChange,
  target,
  canViewOthers,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: HandBackTarget | null;
  canViewOthers: boolean;
  onConfirm: () => void | Promise<void>;
}) {
  const t = useTranslations("crmHandBack");
  if (!target) return null;
  const Icon = target.kind === "workflow" ? FlowArrow : Robot;

  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="default"
      icon={<Icon size={28} weight="fill" />}
      title={t("title", { name: target.name })}
      description={
        canViewOthers
          ? t("descriptionStays", { name: target.name })
          : t("descriptionLeaves", { name: target.name })
      }
      confirmLabel={t("confirm")}
      cancelLabel={t("cancel")}
      onConfirm={onConfirm}
    />
  );
}
