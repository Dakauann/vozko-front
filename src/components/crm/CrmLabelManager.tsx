"use client";

import {
  createLabelAction,
  deleteLabelAction,
  updateLabelAction,
} from "@/app/actions/labels";

import ElevatedButton from "@/components/elevated-design/button";
import ElevatedListManager from "@/components/elevated-design/elevated-list-manager";
import type { Label } from "@/lib/conversations/types";
import { Tag as TagIcon } from "@/components/icons";
import { useCallback } from "react";
import { useTranslations } from "next-intl";


const LABEL_COLORS = [
  "#7C3AED",
  "#DC2626",
  "#2563EB",
  "#059669",
  "#D97706",
  "#DB2777",
  "#0891B2",
  "#EA580C",
  "#65A30D",
  "#4F46E5",
  "#0D9488",
  "#9333EA",
];


interface CrmLabelManagerProps {
  labels: Label[];
  onLabelsChange: (labels: Label[]) => void;
  canCreate?: boolean;
  canUpdate?: boolean;
  canDelete?: boolean;
}


export default function CrmLabelManager({
  labels,
  onLabelsChange,
  canCreate = true,
  canUpdate = true,
  canDelete = true,
}: CrmLabelManagerProps) {
  const t = useTranslations("crmLabels");

  const handleCreate = useCallback(async (name: string, color: string) => {
    const result = await createLabelAction(name, color);
    return result.label ?? null;
  }, []);

  const handleUpdate = useCallback(
    async (id: string, data: { name?: string; color?: string }) => {
      const result = await updateLabelAction(id, data);
      return result.label ?? null;
    },
    [],
  );

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteLabelAction(id);
    return result.success ?? false;
  }, []);

  return (
    <ElevatedListManager<Label>
      items={labels}
      onItemsChange={onLabelsChange}
      trigger={
        <ElevatedButton
          variant="outline-subtle"
          size="sm"
          className="shrink-0"
          title={labels.length > 0 ? `Etiquetas (${labels.length})` : "Etiquetas"}
          titleClassName="max-md:sr-only"
          icon={<TagIcon size={14} weight="bold" />}
          iconVisible
        />
      }
      title={t("manage")}
      createPlaceholder={t("namePlaceholder")}
      createLabel={t("createNew")}
      emptyMessage={t("empty")}
      accent="violet"
      presetColors={LABEL_COLORS}
      onCreate={canCreate ? handleCreate : undefined}
      onUpdate={canUpdate ? handleUpdate : undefined}
      onDelete={canDelete ? handleDelete : undefined}
      canEdit={() => canUpdate}
      canDelete={() => canDelete}
    />
  );
}
