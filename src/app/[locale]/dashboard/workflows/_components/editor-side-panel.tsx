"use client";

import { memo } from "react";

import type { NodeDefinition, RunDetail } from "@/lib/workflows/types";
import type { PublicationFacts } from "@/lib/workflows/publication";

import { NodePalette } from "./node-palette";
import type { TestNodeSeed } from "./test-node-section";
import type { RunDebugActions } from "./workflow-run-detail";
import { WorkflowRunsPanel } from "./workflow-runs-panel";
import { WorkflowVersionsPanel } from "./workflow-versions-panel";

export interface EditorSidePanelProps {
  workflowId: string | null;
  publication: PublicationFacts | null;
  runsOpen: boolean;
  selectedRunId: string | null;
  onSelectRun: (runId: string | null) => void;
  onRunDetail: (detail: RunDetail) => void;
  triggerLabel: (triggerType: string) => string | undefined;
  nodeLabel: (nodeId: string) => string | undefined;
  nodeExists: (nodeId: string) => boolean;
  onFocusNode: (nodeId: string) => void;
  onTestStep: (nodeId: string, seed: TestNodeSeed) => void;
  runDiffersFromCanvas: (runVersion: number | undefined) => boolean;
  runDebug: RunDebugActions;
  onCloseRuns: () => void;
  versionsOpen: boolean;
  versionsReload: number;
  hasLocalEdits: boolean;
  onRestoreVersion: (version: number) => Promise<boolean>;
  onCloseVersions: () => void;
  definitions: NodeDefinition[];
}

function EditorSidePanelView({
  workflowId,
  publication,
  runsOpen,
  selectedRunId,
  onSelectRun,
  onRunDetail,
  triggerLabel,
  nodeLabel,
  nodeExists,
  onFocusNode,
  onTestStep,
  runDiffersFromCanvas,
  runDebug,
  onCloseRuns,
  versionsOpen,
  versionsReload,
  hasLocalEdits,
  onRestoreVersion,
  onCloseVersions,
  definitions,
}: EditorSidePanelProps) {
  if (runsOpen && workflowId) {
    return (
      <WorkflowRunsPanel
        workflowId={workflowId}
        selectedRunId={selectedRunId}
        onSelectRun={onSelectRun}
        onRunDetail={onRunDetail}
        triggerLabel={triggerLabel}
        nodeLabel={nodeLabel}
        nodeExists={nodeExists}
        onFocusNode={onFocusNode}
        onTestStep={onTestStep}
        runDiffersFromCanvas={runDiffersFromCanvas}
        debug={runDebug}
        onClose={onCloseRuns}
      />
    );
  }
  if (versionsOpen && workflowId && publication) {
    return (
      <WorkflowVersionsPanel
        workflowId={workflowId}
        publication={publication}
        reloadToken={versionsReload}
        hasLocalEdits={hasLocalEdits}
        onRestore={onRestoreVersion}
        onClose={onCloseVersions}
      />
    );
  }
  return <NodePalette definitions={definitions} />;
}

export const EditorSidePanel = memo(EditorSidePanelView);
