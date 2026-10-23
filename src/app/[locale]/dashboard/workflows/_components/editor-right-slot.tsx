"use client";

import { memo, useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import type { SimStep, UseWorkflowSimulationReturn } from "@/hooks/use-workflow-simulation";
import { useDragResize } from "@/hooks/use-drag-resize";
import { useViewportWidth } from "@/hooks/use-viewport-width";
import type { TriggerTestInput } from "@/lib/workflows/test-inputs";
import {
  RIGHT_SLOT_DEFAULT_WIDTH,
  RIGHT_SLOT_MIN_WIDTH,
  rightSlotMaxWidth,
  rightSlotView,
  rightSlotWidth,
  type RightPanel,
} from "@/lib/workflows/editor-docking";
import type { WorkflowGraph, WorkflowType } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

import { WorkflowCopilotFab, WorkflowCopilotPanel } from "./workflow-copilot-panel";
import { WorkflowTestPanel } from "./workflow-test-panel";

const RESIZE_KEY_STEP = 40;

export interface EditorRightSlotProps {
  testOpen: boolean;
  copilotOpen: boolean;
  copilotMounted: boolean;
  copilotBusy: boolean;
  preferred: RightPanel;
  onPrefer: (panel: RightPanel) => void;
  onOpenCopilot: () => void;
  onCloseCopilot: () => void;
  simulation: UseWorkflowSimulationReturn;
  voice: boolean;
  onCloseTest: () => void;
  unsaved: boolean;
  nodeLabel: (nodeId: string) => string | undefined;
  nodeExists: (nodeId: string) => boolean;
  onFocusNode: (nodeId: string) => void;
  onPinStep: (step: SimStep) => void;
  versionDiffers: (version: number | undefined) => boolean;
  onViewVersion: (version: number) => void;
  scenariosOf: (nodeId: string) => TriggerTestInput[] | undefined;
  onScenariosChange: (nodeId: string, scenarios: TriggerTestInput[]) => void;
  workflowId: string;
  workflowType: WorkflowType;
  onCopilotGraph: (graph: WorkflowGraph) => void;
  onCopilotMeta: (meta: { name?: string; description?: string; workflowType?: WorkflowType }) => void;
  getCopilotGraph: () => WorkflowGraph | null | undefined;
  onCopilotBusyChange: (busy: boolean) => void;
}

function EditorRightSlotView({
  testOpen,
  copilotOpen,
  copilotMounted,
  copilotBusy,
  preferred,
  onPrefer,
  onOpenCopilot,
  onCloseCopilot,
  simulation,
  voice,
  onCloseTest,
  unsaved,
  nodeLabel,
  nodeExists,
  onFocusNode,
  onPinStep,
  versionDiffers,
  onViewVersion,
  scenariosOf,
  onScenariosChange,
  workflowId,
  workflowType,
  onCopilotGraph,
  onCopilotMeta,
  getCopilotGraph,
  onCopilotBusyChange,
}: EditorRightSlotProps) {
  const tDebug = useTranslations("workflowDebug");
  const rightSlot = rightSlotView({ testOpen, copilotOpen, preferred });
  const viewportWidth = useViewportWidth();
  const [desiredWidth, setDesiredWidth] = useState(RIGHT_SLOT_DEFAULT_WIDTH);
  const width = viewportWidth > 0 ? rightSlotWidth(desiredWidth, viewportWidth) : desiredWidth;
  const resizeTo = useCallback((next: number) => {
    const applied = rightSlotWidth(next, window.innerWidth);
    setDesiredWidth(applied);
    return applied;
  }, []);
  const resize = useDragResize({ edge: "left", step: RESIZE_KEY_STEP, read: () => width, resizeTo, commit: setDesiredWidth });

  return (
    <>
      {rightSlot.launcher && <WorkflowCopilotFab onClick={onOpenCopilot} busy={copilotMounted && copilotBusy} />}
      {(copilotMounted || rightSlot.active) && (
        <div
          data-testid="right-slot"
          style={{ width, paddingRight: "var(--dock-rail-w, 0px)" }}
          className={cn("relative flex min-h-0 min-w-0 shrink-0 flex-col border-l border-border bg-card", !rightSlot.active && "hidden")}
        >
          <div
            role="separator"
            tabIndex={0}
            aria-label={tDebug("slot.resize")}
            aria-orientation="vertical"
            aria-valuemin={RIGHT_SLOT_MIN_WIDTH}
            aria-valuemax={rightSlotMaxWidth(viewportWidth)}
            aria-valuenow={width}
            className="absolute inset-y-0 -left-1 z-20 w-2 cursor-ew-resize touch-none hover:bg-primary/20 focus-visible:bg-primary/20 focus-visible:outline-none"
            {...resize.handleProps}
          />
          {rightSlot.tabs && (
            <div role="tablist" aria-label={tDebug("slot.label")} className="flex shrink-0 gap-1 border-b border-border px-2 pt-1.5">
              {(["test", "copilot"] as const).map((panel) => (
                <button
                  key={panel}
                  type="button"
                  role="tab"
                  aria-selected={rightSlot.active === panel}
                  onClick={() => (panel === "copilot" && !copilotOpen ? onOpenCopilot() : onPrefer(panel))}
                  className={cn(
                    "-mb-px rounded-t-[--radius] border-b-2 px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    rightSlot.active === panel ? "border-primary text-foreground" : "border-transparent text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tDebug(`slot.${panel}`)}
                </button>
              ))}
            </div>
          )}
          {testOpen && (
            <div className={cn("flex min-h-0 flex-1", rightSlot.active !== "test" && "hidden")}>
              <WorkflowTestPanel
                simulation={simulation}
                voice={voice}
                onClose={onCloseTest}
                unsaved={unsaved}
                nodeLabel={nodeLabel}
                nodeExists={nodeExists}
                onFocusNode={onFocusNode}
                onPinStep={onPinStep}
                versionDiffers={versionDiffers}
                onViewVersion={onViewVersion}
                workflowId={workflowId}
                scenariosOf={scenariosOf}
                onScenariosChange={onScenariosChange}
              />
            </div>
          )}
          {copilotMounted && (
            <WorkflowCopilotPanel
              visible={rightSlot.active === "copilot"}
              workflowId={workflowId}
              workflowType={workflowType}
              onGraph={onCopilotGraph}
              onMeta={onCopilotMeta}
              getGraph={getCopilotGraph}
              onBusyChange={onCopilotBusyChange}
              onClose={onCloseCopilot}
            />
          )}
        </div>
      )}
    </>
  );
}

export const EditorRightSlot = memo(EditorRightSlotView);
