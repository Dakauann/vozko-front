"use client";

import { memo, useState } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";

import {
  ArrowLeft,
  ClockCounterClockwise,
  DotsThreeVertical,
  PaperPlaneTilt,
  Pause,
  Play,
  Stack,
  TestTube,
  Trash,
  Upload,
} from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { getApiBaseUrl } from "@/lib/api/browser-client";
import { openScoped } from "@/lib/browser/scoped-download-url";
import type { DraftSaveStatus } from "@/lib/workflows/draft-save";
import type { EntryPointFix } from "@/lib/workflows/entry-points";
import type { RuntimeAlertFix } from "@/lib/workflows/runtime-alerts";
import type { LintIssue, RuntimeAlert, Workflow, WorkflowType } from "@/lib/workflows/types";

import { DraftSaveStatusLine } from "./draft-save-status";
import { EntryPointChips } from "./entry-point-chips";
import { MoveToSecretDialog, type MoveToSecretRequest } from "./move-to-secret-dialog";
import { WorkflowPublicationChips } from "./publication-chips";
import { WorkflowAlerts } from "./workflow-alerts";

export interface EditorHeaderProps {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (description: string) => void;
  workflowType: WorkflowType;
  workflowTypeOptions: readonly { value: WorkflowType; label: string }[];
  onWorkflowTypeChange: (workflowType: WorkflowType) => void;
  workflowState: Workflow | null;
  testOpen: boolean;
  onToggleTest: () => void;
  runsOpen: boolean;
  onToggleRuns: () => void;
  lintValid: boolean;
  lintIssues: LintIssue[];
  linting: boolean;
  runtimeAlerts: RuntimeAlert[];
  runtimeAlertsFailed: boolean;
  initialAlertId: string | null;
  nodeLabel: (nodeId: string) => string | undefined;
  fieldLabel?: (nodeId: string, field: string) => string | undefined;
  outputLabel?: (nodeId: string, output: string) => string | undefined;
  nodeConfig: (nodeId: string) => Record<string, unknown> | undefined;
  onFocusNode: (nodeId: string) => void;
  onRuntimeFix: (fix: RuntimeAlertFix) => void;
  onAlertsOpen?: () => void;
  alertsRequest: number;
  onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
  saveStatus: DraftSaveStatus;
  unsaved: boolean;
  onRetrySave: () => void;
  onResolveConflict: () => void;
  onEntryFix: (fix: EntryPointFix) => void;
  publishing: boolean;
  onPublish: () => void;
  onPause: () => void;
  onResume: () => void;
  onOpenVersions: () => void;
  onDelete: () => Promise<void>;
}

function EditorHeaderView({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  workflowType,
  workflowTypeOptions,
  onWorkflowTypeChange,
  workflowState,
  testOpen,
  onToggleTest,
  runsOpen,
  onToggleRuns,
  lintValid,
  lintIssues,
  linting,
  runtimeAlerts,
  runtimeAlertsFailed,
  initialAlertId,
  nodeLabel,
  fieldLabel,
  outputLabel,
  nodeConfig,
  onFocusNode,
  onRuntimeFix,
  onAlertsOpen,
  alertsRequest,
  onConfigChange,
  saveStatus,
  unsaved,
  onRetrySave,
  onResolveConflict,
  onEntryFix,
  publishing,
  onPublish,
  onPause,
  onResume,
  onOpenVersions,
  onDelete,
}: EditorHeaderProps) {
  const t = useTranslations("workflowsPage");
  const tRuns = useTranslations("workflowRuns");
  const router = useRouter();
  const canUpdate = useSettledPermission("workflows", "update");
  const canCreate = useSettledPermission("workflows", "create");
  const canDelete = useSettledPermission("workflows", "delete");
  const [confirmDeleteOpen, setConfirmDeleteOpen] = useState(false);
  const [confirmLeaveOpen, setConfirmLeaveOpen] = useState(false);
  const [moveToSecret, setMoveToSecret] = useState<MoveToSecretRequest | null>(null);
  const canSave = workflowState?.id ? canUpdate : canCreate;
  const canPublish = canSave && canUpdate;
  const leave = () => router.push("/dashboard/workflows");
  const entryPoints = workflowState?.entryPoints;

  return (
    <div className="flex items-center gap-3 px-4 py-2.5 border-b border-border bg-card flex-shrink-0">
      <ElevatedButton
        variant="ghost"
        size="icon"
        icon={<ArrowLeft size={16} />}
        iconVisible
        aria-label={t("backToList")}
        onClick={() => (canSave && unsaved ? setConfirmLeaveOpen(true) : leave())}
      />
      <ConfirmDialog
        open={confirmLeaveOpen}
        onOpenChange={setConfirmLeaveOpen}
        title={t("draftSave.leaveTitle")}
        description={t("draftSave.leaveDescription")}
        confirmLabel={t("draftSave.leaveConfirm")}
        cancelLabel={t("draftSave.leaveStay")}
        tone="danger"
        onConfirm={leave}
      />

      <ElevatedInput
        value={name}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onNameChange(e.target.value)
        }
        label={t("namePlaceholder")}
        controlSize="sm"
        className="w-56"
      />

      <ElevatedInput
        value={description}
        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
          onDescriptionChange(e.target.value)
        }
        label={t("descriptionPlaceholder")}
        controlSize="sm"
        className="w-56"
      />

      <ElevatedSelect
        value={workflowType}
        onValueChange={(val) => onWorkflowTypeChange(val as WorkflowType)}
        label={t("workflowType")}
        className="w-48"
      >
        {workflowTypeOptions.map((opt) => (
          <ElevatedSelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>

      {entryPoints && entryPoints.length > 0 && (
        <div role="group" aria-label={t("entryPoints.title")} className="flex min-w-0 items-center gap-1.5">
          <span className="whitespace-nowrap text-xs text-muted-foreground">{t("entryPoints.title")}</span>
          <EntryPointChips entries={entryPoints} canUpdate={canUpdate} onFix={onEntryFix} />
        </div>
      )}

      <div className="flex-1" />

      {workflowState?.id && (
        <ElevatedButton
          variant={testOpen ? "primary" : "outline-subtle"}
          size="sm"
          title="Testar"
          icon={<TestTube size={14} weight="fill" />}
          iconVisible
          aria-pressed={testOpen}
          onClick={onToggleTest}
        />
      )}

      {workflowState?.id && (
        <ElevatedButton
          variant={runsOpen ? "primary" : "outline-subtle"}
          size="sm"
          title={tRuns("open")}
          icon={<ClockCounterClockwise size={14} weight="bold" />}
          iconVisible
          aria-pressed={runsOpen}
          onClick={onToggleRuns}
        />
      )}

      <WorkflowAlerts
        valid={lintValid}
        issues={lintIssues}
        linting={linting}
        runtimeAlerts={runtimeAlerts}
        runtimeAlertsFailed={runtimeAlertsFailed}
        defaultOpen={Boolean(initialAlertId)}
        highlightAlertId={initialAlertId}
        nodeLabel={nodeLabel}
        fieldLabel={fieldLabel}
        outputLabel={outputLabel}
        onFocusNode={onFocusNode}
        nodeConfig={nodeConfig}
        onMoveToSecret={canUpdate ? setMoveToSecret : undefined}
        onRuntimeFix={onRuntimeFix}
        onOpen={onAlertsOpen}
        openRequest={alertsRequest}
      />
      {moveToSecret && (
        <MoveToSecretDialog
          request={moveToSecret}
          onClose={() => setMoveToSecret(null)}
          onMoved={onConfigChange}
        />
      )}

      {workflowState && <WorkflowPublicationChips workflow={workflowState} />}

      {canSave && <DraftSaveStatusLine status={saveStatus} onRetry={onRetrySave} onResolve={onResolveConflict} />}

      {canSave && (
        <TooltipProvider delayDuration={300}>
          {canPublish && (
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <ElevatedButton
                    variant="primary"
                    size="sm"
                    title={publishing ? t("publication.publishing") : t("publication.publish")}
                    icon={<PaperPlaneTilt size={14} weight="fill" />}
                    iconVisible
                    onClick={onPublish}
                    disabled={publishing}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="max-w-xs">
                {t("publication.publishHint")}
              </TooltipContent>
            </Tooltip>
          )}
        </TooltipProvider>
      )}

      {workflowState && (
        <>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <ElevatedButton
                variant="outline-subtle"
                size="sm"
                title="Mais ações"
                icon={<DotsThreeVertical size={16} weight="bold" />}
                iconVisible
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {workflowState.id && (
                <DropdownMenuItem
                  className="rounded-lg border-l-0"
                  onSelect={onOpenVersions}
                >
                  <Stack weight="bold" />
                  {t("publication.versions")}
                </DropdownMenuItem>
              )}
              {canUpdate && workflowState.status === "active" && (
                <DropdownMenuItem
                  className="rounded-lg border-l-0"
                  onSelect={onPause}
                >
                  <Pause weight="fill" />
                  {t("pause")}
                </DropdownMenuItem>
              )}
              {canUpdate && workflowState.status === "paused" && workflowState.publishedVersion != null && (
                <DropdownMenuItem
                  className="rounded-lg border-l-0"
                  onSelect={onResume}
                >
                  <Play weight="fill" />
                  {t("publication.resume")}
                </DropdownMenuItem>
              )}
              {workflowState.id && (
                <DropdownMenuItem
                  className="rounded-lg border-l-0"
                  onSelect={() =>
                    openScoped(
                      `${getApiBaseUrl()}/workflows/${encodeURIComponent(workflowState.id)}/export`,
                    )
                  }
                >
                  <Upload weight="bold" />
                  {t("export")}
                </DropdownMenuItem>
              )}
              {canDelete && (
                <DropdownMenuItem
                  className="rounded-lg border-l-0 text-destructive-ink hover:bg-muted hover:text-destructive-ink focus:bg-muted focus:text-destructive-ink"
                  onSelect={() => setConfirmDeleteOpen(true)}
                >
                  <Trash />
                  Excluir workflow
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <ConfirmDialog
            open={confirmDeleteOpen}
            onOpenChange={setConfirmDeleteOpen}
            title="Excluir workflow"
            description="Tem certeza que deseja excluir este workflow? Esta ação não pode ser desfeita."
            confirmLabel="Excluir"
            tone="danger"
            onConfirm={onDelete}
          />
        </>
      )}
    </div>
  );
}

export const EditorHeader = memo(EditorHeaderView);
