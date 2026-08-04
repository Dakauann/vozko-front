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
  "#7C3AED", // violet
  "#DC2626", // red
  "#2563EB", // blue
  "#059669", // emerald
  "#D97706", // amber
  "#DB2777", // pink
  "#0891B2", // cyan
  "#EA580C", // orange
  "#65A30D", // lime
  "#4F46E5", // indigo
  "#0D9488", // teal
  "#9333EA", // purple
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
