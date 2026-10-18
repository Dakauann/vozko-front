"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { Plus, Stack } from "@/components/icons";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import type { GroupDetail } from "@/lib/unofficial-whatsapp-groups/types";

import { useGroupName } from "../kit/use-groups-format";
import { canCreateNextInSeries } from "./detail-model";
import type { GroupActions } from "./use-group-actions";
import type { GroupPermissions } from "./use-group-permissions";

export function NextInSeriesConfirm({
  detail,
  actions,
  trigger,
  open,
  onOpenChange,
}: {
  detail: GroupDetail;
  actions: GroupActions;
  trigger?: ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const t = useTranslations("unofficialGroups.detail.actions");
  const groupName = useGroupName();
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      tone="default"
      icon={<Stack size={28} />}
      title={t("seriesConfirmTitle")}
      description={t("seriesConfirmText", { subject: groupName(detail.group.subject) })}
      confirmLabel={t("seriesConfirm")}
      onConfirm={() => actions.nextInSeries()}
      trigger={trigger}
    />
  );
}

export function NextInSeriesButton({
  detail,
  actions,
  permissions,
  label,
}: {
  detail: GroupDetail;
  actions: GroupActions;
  permissions: GroupPermissions;
  label: string;
}) {
  if (!canCreateNextInSeries(detail.group, permissions)) return null;
  return (
    <NextInSeriesConfirm
      detail={detail}
      actions={actions}
      trigger={<Button variant="secondary" size="sm" title={label} icon={<Plus />} iconVisible disabled={actions.busy !== null} />}
    />
  );
}
