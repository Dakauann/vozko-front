"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Plus, Tag as TagIcon, X } from "@/components/icons";
import type { EntryStage, EntryType, Stage } from "@/lib/conversations/types";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useCallback, useState } from "react";

import { cn } from "@/lib/utils";


interface EntryStageBadgeTranslations {
  addStage: string;
  removeStage: string;
  noStages: string;
  changeStage: string;
}

interface EntryStageBadgeProps {
  entryId: string;
  entryType: EntryType;
  currentStage: EntryStage | null | undefined;
  stages: Stage[];
  canManage: boolean;
  canRead: boolean;
  translations: EntryStageBadgeTranslations;
  onAssign: (
    stageId: string,
    entryId: string,
    entryType: EntryType,
  ) => Promise<void>;
  onRemove: (
    stageId: string,
    entryId: string,
    entryType: EntryType,
  ) => Promise<void>;
}


export default function EntryStageBadge({
  entryId,
  entryType,
  currentStage,
  stages,
  canManage,
  canRead,
  translations: t,
  onAssign,
  onRemove,
}: EntryStageBadgeProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleAssign = useCallback(
    async (stageId: string) => {
      setLoading(true);
      try {
        if (currentStage) {
          await onRemove(currentStage.stageId, entryId, entryType);
        }
        await onAssign(stageId, entryId, entryType);
      } finally {
        setLoading(false);
        setOpen(false);
      }
    },
    [currentStage, entryId, entryType, onAssign, onRemove],
  );

  const handleRemove = useCallback(async () => {
    if (!currentStage) return;
    setLoading(true);
    try {
      await onRemove(currentStage.stageId, entryId, entryType);
    } finally {
      setLoading(false);
      setOpen(false);
    }
  }, [currentStage, entryId, entryType, onRemove]);

  if (!canRead) return null;

  if (!canManage) {
    if (!currentStage) return null;
    return (
      <span
        className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-2xs font-semibold"
        style={{
          backgroundColor: `${currentStage.stageColor}18`,
          color: currentStage.stageColor,
        }}
      >
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: currentStage.stageColor }}
        />
        {currentStage.stageName}
      </span>
    );
  }

  if (!currentStage) {
    return (
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            className={cn(
              "inline-flex items-center gap-1 rounded-lg border border-dashed border-foreground/20 px-2 py-1",
              "text-2xs font-semibold text-muted-foreground",
              "transition-all hover:border-slate-400 hover:text-muted-foreground hover:bg-muted",
              loading && "opacity-50 pointer-events-none",
            )}
            title={t.addStage}
          >
            <Plus weight="bold" className="h-3 w-3" />
            <TagIcon weight="bold" className="h-3 w-3" />
          </button>
        </PopoverTrigger>
        <StagePickerContent
          stages={stages}
          currentStageId={null}
          loading={loading}
          translations={t}
          onSelect={handleAssign}
          onRemove={null}
        />
      </Popover>
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-2xs font-semibold",
            "transition-all hover:opacity-80 cursor-pointer",
            loading && "opacity-50 pointer-events-none",
          )}
          style={{
            backgroundColor: `${currentStage.stageColor}18`,
            color: currentStage.stageColor,
          }}
          title={t.changeStage}
        >
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: currentStage.stageColor }}
          />
          {currentStage.stageName}
        </button>
      </PopoverTrigger>
      <StagePickerContent
        stages={stages}
        currentStageId={currentStage.stageId}
        loading={loading}
        translations={t}
        onSelect={handleAssign}
        onRemove={handleRemove}
      />
    </Popover>
  );
}


function StagePickerContent({
  stages,
  currentStageId,
  loading,
  translations: t,
  onSelect,
  onRemove,
}: {
  stages: Stage[];
  currentStageId: string | null;
  loading: boolean;
  translations: EntryStageBadgeTranslations;
  onSelect: (stageId: string) => void;
  onRemove: (() => void) | null;
}) {
  if (!stages.length) {
    return (
      <PopoverContent className="w-48 p-3" align="start" sideOffset={6}>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <TagIcon weight="duotone" className="h-4 w-4" />
          <span>{t.noStages}</span>
        </div>
      </PopoverContent>
    );
  }

  return (
    <PopoverContent className="w-52 p-2" align="start" sideOffset={6}>
      <AnimatePresence>
        <div className="space-y-0.5 max-h-48 overflow-y-auto">
          {stages.map((stage) => {
            const isActive = stage.id === currentStageId;
            return (
              <motion.button
                key={stage.id}
                type="button"
                disabled={loading}
                onClick={() => {
                  if (isActive && onRemove) {
                    onRemove();
                  } else if (!isActive) {
                    onSelect(stage.id);
                  }
                }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-[--radius] px-3 py-2 text-left text-sm transition-colors",
                  isActive ? "bg-primary-subtle font-medium text-primary-ink" : "hover:bg-muted",
                  loading && "opacity-50 pointer-events-none",
                )}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.15 }}
              >
                <span
                  className="h-3 w-3 rounded-full shrink-0"
                  style={{ backgroundColor: stage.color }}
                />
                <span className="truncate flex-1 text-foreground">
                  {stage.name}
                </span>
                {isActive && (
                  <div className="flex items-center gap-1 shrink-0">
                    <Check
                      weight="bold"
                      className="h-3.5 w-3.5 text-healthy-ink"
                    />
                    <X
                      weight="bold"
                      className="h-3 w-3 text-muted-foreground hover:text-destructive-ink transition-colors"
                    />
                  </div>
                )}
              </motion.button>
            );
          })}
        </div>
      </AnimatePresence>
    </PopoverContent>
  );
}

export type { EntryStageBadgeTranslations, EntryStageBadgeProps };
