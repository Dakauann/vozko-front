"use client";

import { Funnel, Star } from "@/components/icons";
import {
  createStageAction,
  deleteStageAction,
  setInitialStageAction,
  updateStageAction,
} from "@/app/actions/stages";

import ElevatedButton from "@/components/elevated-design/button";
import ElevatedListManager from "@/components/elevated-design/elevated-list-manager";
import type { ReactNode } from "react";
import type { Stage } from "@/lib/conversations/types";
import { useCallback } from "react";
import { useTranslations } from "next-intl";


const STAGE_COLORS = [
  "#3B82F6", // blue
  "#10B981", // emerald
  "#F59E0B", // amber
  "#EF4444", // red
  "#8B5CF6", // violet
  "#EC4899", // pink
  "#06B6D4", // cyan
  "#F97316", // orange
  "#84CC16", // lime
  "#6366F1", // indigo
  "#14B8A6", // teal
  "#A855F7", // purple
];


interface CrmStageManagerProps {
  stages: Stage[];
  onStagesChange: (stages: Stage[]) => void;
  trigger?: ReactNode;
  campaignId?: string;
  campaignType?: string;
}


export default function CrmStageManager({
  stages,
  onStagesChange,
  trigger: customTrigger,
  campaignId,
  campaignType,
}: CrmStageManagerProps) {
  const tCrm = useTranslations("crm");

  const handleCreate = useCallback(
    async (name: string, color: string, description: string) => {
      const result = await createStageAction(
        name,
        color,
        description,
        campaignId,
        campaignType,
      );
      return result.stage ?? null;
    },
    [campaignId, campaignType],
  );

  const handleUpdate = useCallback(
    async (
      id: string,
      data: { name?: string; color?: string; description?: string },
    ) => {
      const result = await updateStageAction(id, data);
      return result.stage ?? null;
    },
    [],
  );

  const handleDelete = useCallback(async (id: string) => {
    const result = await deleteStageAction(id);
    return result.success ?? false;
  }, []);

  const handleSetInitial = useCallback(
    async (stageId: string) => {
      const result = await setInitialStageAction(stageId);
      if (result.stage) {
        onStagesChange(
          stages.map((t) => ({
            ...t,
            isInitial: t.id === stageId,
          })),
        );
      }
    },
    [stages, onStagesChange],
  );

  return (
    <ElevatedListManager<Stage>
      items={stages}
      onItemsChange={onStagesChange}
      trigger={
        customTrigger ?? (
          <ElevatedButton
            variant="outline-subtle"
            size="sm"
            className="shrink-0"
            title="Etapas"
            titleClassName="max-md:sr-only"
            icon={<Funnel size={14} weight="bold" />}
            iconVisible
          />
        )
      }
      title="Gerenciar Etapas"
      createPlaceholder="Nome da etapa..."
      createDescriptionPlaceholder="Descrição da etapa (quando mover lead para esta etapa)..."
      createLabel={tCrm("createNewStage")}
      accent="emerald"
      presetColors={STAGE_COLORS}
      onCreate={handleCreate}
      onUpdate={handleUpdate}
      onDelete={handleDelete}
      canDelete={(stage) => !stage.isDefault}
      canEdit={() => true}
      renderItemBadge={(stage) =>
        stage.isInitial ? (
          <Star
            weight="fill"
            className="h-3 w-3 text-warning-ink flex-shrink-0"
          />
        ) : null
      }
      renderItemActions={(stage) =>
        !stage.isInitial ? (
          <button
            onClick={() => handleSetInitial(stage.id)}
            title="Definir como etapa inicial"
            className="flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:bg-warning hover:text-warning-foreground transition-colors"
          >
            <Star weight="regular" className="h-3 w-3" />
          </button>
        ) : null
      }
    />
  );
}
