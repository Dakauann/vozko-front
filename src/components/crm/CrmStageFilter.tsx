"use client";

import { AnimatePresence, motion } from "framer-motion";
import { CaretDown, Check, Funnel } from "@/components/icons";
import { useCallback, useRef, useState } from "react";

import type { Stage } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";


interface CrmStageFilterProps {
  stages: Stage[];
  selectedStageIds: string[];
  onSelectionChange: (stageIds: string[]) => void;
}


export default function CrmStageFilter({
  stages,
  selectedStageIds,
  onSelectionChange,
}: CrmStageFilterProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggle = useCallback(
    (stageId: string) => {
      if (selectedStageIds.includes(stageId)) {
        onSelectionChange(selectedStageIds.filter((id) => id !== stageId));
      } else {
        onSelectionChange([...selectedStageIds, stageId]);
      }
    },
    [selectedStageIds, onSelectionChange],
  );

  const clearAll = useCallback(() => {
    onSelectionChange([]);
  }, [onSelectionChange]);

  const hasSelection = selectedStageIds.length > 0;

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-2xs font-medium transition-all duration-150",
          hasSelection
            ? "border-healthy bg-healthy text-healthy-foreground"
            : "border-border bg-card text-muted-foreground hover:bg-muted",
        )}
      >
        <Funnel
          weight={hasSelection ? "fill" : "regular"}
          className="h-3.5 w-3.5"
        />
        {hasSelection ? selectedStageIds.length : "Filtrar"}
        <CaretDown
          weight="bold"
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            open && "rotate-180",
          )}
        />
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Backdrop */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setOpen(false)}
            />

            <motion.div
              initial={{ opacity: 0, y: -4, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -4, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute left-0 top-full z-50 mt-1.5 w-56 overflow-hidden rounded-[--radius] border border-border bg-card shadow-xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-2xs font-semibold text-muted-foreground">
                  Tags
                </span>
                {hasSelection && (
                  <button
                    onClick={clearAll}
                    className="text-2xs font-medium text-healthy-ink hover:text-healthy-ink transition-colors"
                  >
                    Limpar
                  </button>
                )}
              </div>

              {/* Tag list */}
              <div className="max-h-60 overflow-y-auto py-1">
                {stages.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-muted-foreground">
                    Nenhuma tag disponível
                  </p>
                ) : (
                  stages
                    .sort((a, b) => a.position - b.position)
                    .map((stage) => {
                      const isSelected = selectedStageIds.includes(stage.id);
                      return (
                        <button
                          key={stage.id}
                          onClick={() => toggle(stage.id)}
                          className={cn(
                            "flex w-full items-center gap-2.5 px-3 py-2 text-left transition-colors duration-100",
                            isSelected ? "bg-primary-subtle text-primary-ink" : "hover:bg-muted",
                          )}
                        >
                          {/* Color dot */}
                          <span
                            className="h-3 w-3 rounded-full flex-shrink-0 ring-1 ring-black/5"
                            style={{ backgroundColor: stage.color }}
                          />
                          <span className="flex-1 truncate text-xs font-medium text-foreground">
                            {stage.name}
                          </span>
                          {/* Checkmark */}
                          <span
                            className={cn(
                              "flex h-4 w-4 items-center justify-center rounded-md border transition-all duration-150",
                              isSelected
                                ? "border-healthy bg-healthy/100"
                                : "border-foreground/20 bg-card",
                            )}
                          >
                            {isSelected && (
                              <Check
                                weight="bold"
                                className="h-2.5 w-2.5 text-white"
                              />
                            )}
                          </span>
                        </button>
                      );
                    })
                )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
