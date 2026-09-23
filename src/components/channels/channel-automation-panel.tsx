"use client";

import { CheckCircle, GitBranch, Robot, Warning } from "@/components/icons";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { ElevatedSwitch as Switch } from "@/components/elevated-design/elevated-switch";
import type { AgentListItem } from "@/lib/agents/types";
import type { Workflow } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";
import { getAgentByIdAction, listAgentsAction } from "@/app/actions/agents";
import { listPipelinesAction } from "@/app/actions/crm-board";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import type { Pipeline } from "@/lib/crm/pipelines";
import { getWorkflowAction, listWorkflowsAction } from "@/app/actions/workflows";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useTranslations } from "next-intl";


type Mode = "agent" | "workflow";

export interface ChannelAutomationAccount {
  id: string;
  agentId?: string | null;
  workflowId?: string | null;
  enableAgentResponses: boolean;
  enableWorkflow: boolean;
  enableAnalysis?: boolean;
  enableAutoStaging?: boolean;
  enableAutoMemory?: boolean;
  pipelineId?: string | null;
}

export interface ChannelAutomationPayload {
  agentId?: string | null;
  workflowId?: string | null;
  pipelineId?: string | null;
  enableAgentResponses?: boolean;
  enableWorkflow?: boolean;
  enableAnalysis?: boolean;
  enableAutoStaging?: boolean;
  enableAutoMemory?: boolean;
}

const HANDLING_TOGGLES = ["enableAnalysis", "enableAutoStaging", "enableAutoMemory"] as const;

type HandlingKey = (typeof HANDLING_TOGGLES)[number];

export function ChannelAutomationPanel<T extends ChannelAutomationAccount>({
  account,
  onUpdated,
  onSave,
  translationNamespace,
  controlId = "channel-automation-enabled",
  showHandling = false,
}: {
  account: T;
  onUpdated: (account: T) => void;
  onSave: (
    accountId: string,
    payload: ChannelAutomationPayload,
  ) => Promise<{ account?: T; error?: string }>;
  translationNamespace: string;
  controlId?: string;
  showHandling?: boolean;
}) {
  const t = useTranslations(translationNamespace);

  const [mode, setMode] = useState<Mode>(
    account.enableWorkflow || (!account.agentId && account.workflowId) ? "workflow" : "agent",
  );
  const [agentId, setAgentId] = useState<string | null>(account.agentId ?? null);
  const [workflowId, setWorkflowId] = useState<string | null>(account.workflowId ?? null);
  const [pipelineId, setPipelineId] = useState<string | null>(account.pipelineId ?? null);
  const [pipelines, setPipelines] = useState<Pipeline[]>([]);
  const [enabled, setEnabled] = useState(
    account.enableWorkflow || account.enableAgentResponses,
  );
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [handling, setHandling] = useState<Record<HandlingKey, boolean>>({
    enableAnalysis: account.enableAnalysis ?? false,
    enableAutoStaging: account.enableAutoStaging ?? false,
    enableAutoMemory: account.enableAutoMemory ?? false,
  });

  const agentSelect = usePaginatedSelect<AgentListItem>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listAgentsAction({ page, pageSize: 20, search: search || undefined });
      return { items: result.agents ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (agent: AgentListItem): ElevatedCommandOption => ({
        value: agent.id,
        label: agent.name,
        description: agent.messagingModel,
        meta: agent.isActive ? undefined : t("agentInactive"),
      }),
      [t],
    ),
  });

  const workflowSelect = usePaginatedSelect<Workflow>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listWorkflowsAction({ page, pageSize: 20, search: search || undefined });
      return { items: result.workflows ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (workflow: Workflow): ElevatedCommandOption => ({
        value: workflow.id,
        label: workflow.name,
      }),
      [],
    ),
  });

  useEffect(() => {
    let active = true;
    void listPipelinesAction("conversation").then((result) => {
      if (active) setPipelines(result.pipelines);
    });
    return () => {
      active = false;
    };
  }, []);

  const [resolvedAgent, setResolvedAgent] = useState<{ id: string; name: string } | null>(null);
  const [resolvedWorkflow, setResolvedWorkflow] = useState<{ id: string; name: string } | null>(
    null,
  );

  useEffect(() => {
    if (!agentId) return;
    let cancelled = false;
    void getAgentByIdAction(agentId).then((r) => {
      const name = r.agent?.name;
      if (!cancelled && name) setResolvedAgent({ id: agentId, name });
    });
    return () => {
      cancelled = true;
    };
  }, [agentId]);

  useEffect(() => {
    if (!workflowId) return;
    let cancelled = false;
    void getWorkflowAction(workflowId).then((r) => {
      const name = r.workflow?.name;
      if (!cancelled && name) setResolvedWorkflow({ id: workflowId, name });
    });
    return () => {
      cancelled = true;
    };
  }, [workflowId]);

  const withSelected = (
    options: ElevatedCommandOption[],
    id: string | null,
    resolved: { id: string; name: string } | null,
  ) => {
    if (!id || resolved?.id !== id || options.some((o) => o.value === id)) return options;
    return [{ value: id, label: resolved.name }, ...options];
  };

  const agentOptions = useMemo(
    () => withSelected(agentSelect.options, agentId, resolvedAgent),
    [agentSelect.options, agentId, resolvedAgent],
  );
  const workflowOptions = useMemo(
    () => withSelected(workflowSelect.options, workflowId, resolvedWorkflow),
    [workflowSelect.options, workflowId, resolvedWorkflow],
  );

  const savedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(
    () => () => {
      if (savedTimer.current) clearTimeout(savedTimer.current);
    },
    [],
  );

  const save = async (payload: ChannelAutomationPayload) => {
    setSaving(true);
    setError(null);

    const result = await onSave(account.id, payload);

    setSaving(false);
    if (result.error || !result.account) {
      setError(result.error ?? t("saveFailed"));
      setAgentId(account.agentId ?? null);
      setWorkflowId(account.workflowId ?? null);
      setEnabled(account.enableWorkflow || account.enableAgentResponses);
      return;
    }

    onUpdated(result.account);
    setJustSaved(true);
    if (savedTimer.current) clearTimeout(savedTimer.current);
    savedTimer.current = setTimeout(() => setJustSaved(false), 2500);
  };

  const handleModeChange = (next: Mode) => {
    if (next === mode) return;
    setMode(next);
    setEnabled(false);
    void save({ enableAgentResponses: false, enableWorkflow: false });
  };

  const selectedId = mode === "agent" ? agentId : workflowId;

  const handleSelectionChange = (next: string) => {
    const value = next || null;
    if (mode === "agent") {
      setAgentId(value);
    } else {
      setWorkflowId(value);
    }
    if (!value && enabled) {
      setEnabled(false);
      void save(
        mode === "agent"
          ? { agentId: null, enableAgentResponses: false }
          : { workflowId: null, enableWorkflow: false },
      );
      return;
    }
    void save(mode === "agent" ? { agentId: value } : { workflowId: value });
  };

  const handleEnabledChange = (next: boolean) => {
    setEnabled(next);
    void save(
      mode === "agent" ? { enableAgentResponses: next } : { enableWorkflow: next },
    );
  };

  const handleHandlingChange = (key: HandlingKey, next: boolean) => {
    setHandling((current) => ({ ...current, [key]: next }));
    void save({ [key]: next });
  };

  const handlePipelineChange = (next: string) => {
    setPipelineId(next);
    void save({ pipelineId: next });
  };

  const active = enabled && !!selectedId;

  const modes: { id: Mode; label: string; icon: typeof Robot }[] = [
    { id: "agent", label: t("modeAgent"), icon: Robot },
    { id: "workflow", label: t("modeWorkflow"), icon: GitBranch },
  ];

  return (
    <ElevatedContainer className="overflow-hidden !p-0">
      <div className="flex items-center justify-between gap-3 border-b border-border px-5 py-3">
        <div className="flex items-center gap-2">
          <Robot
            className={cn("h-4 w-4", active ? "text-primary-ink" : "text-muted-foreground")}
            weight="fill"
          />
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        </div>

        {}
        <span
          aria-live="polite"
          className={cn(
            "text-xs",
            error ? "text-destructive-ink" : justSaved ? "text-healthy-ink" : "text-muted-foreground",
          )}
        >
          {saving
            ? t("saving")
            : error
              ? t("saveFailed")
              : justSaved
                ? t("saved")
                : active
                  ? t("statusActive")
                  : t("statusInactive")}
        </span>
      </div>

      <div className="space-y-5 p-5">
        {}
        <div
          role="radiogroup"
          aria-label={t("modeLabel")}
          className="flex gap-1 rounded-lg bg-muted p-1"
        >
          {modes.map(({ id, label, icon: Icon }) => {
            const selected = mode === id;
            return (
              <button
                key={id}
                type="button"
                role="radio"
                aria-checked={selected}
                disabled={saving}
                onClick={() => handleModeChange(id)}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  "disabled:cursor-not-allowed disabled:opacity-60",
                  selected
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-3.5 w-3.5" weight={selected ? "fill" : "regular"} />
                {label}
              </button>
            );
          })}
        </div>

        <div className="space-y-1.5">
          {mode === "agent" ? (
            <ElevatedCommandSelect
              label={t("agentLabel")}
              value={agentId ?? ""}
              onValueChange={handleSelectionChange}
              options={agentOptions}
              searchPlaceholder={t("agentSearch")}
              emptyMessage={t("agentEmpty")}
              onSearch={agentSelect.onSearch}
              onScrollEnd={agentSelect.onScrollEnd}
              onOpenChange={agentSelect.onOpenChange}
              isLoading={agentSelect.isLoading}
              disabled={saving}
              fullWidth
            />
          ) : (
            <ElevatedCommandSelect
              label={t("workflowLabel")}
              value={workflowId ?? ""}
              onValueChange={handleSelectionChange}
              options={workflowOptions}
              searchPlaceholder={t("workflowSearch")}
              emptyMessage={t("workflowEmpty")}
              onSearch={workflowSelect.onSearch}
              onScrollEnd={workflowSelect.onScrollEnd}
              onOpenChange={workflowSelect.onOpenChange}
              isLoading={workflowSelect.isLoading}
              disabled={saving}
              fullWidth
            />
          )}
          <p className="text-xs text-muted-foreground">
            {mode === "agent" ? t("agentHint") : t("workflowHint")}
          </p>
        </div>

        <div className="flex items-start justify-between gap-4 border-t border-border pt-5">
          <div className="min-w-0 space-y-1">
            <label
              htmlFor={controlId}
              className={cn(
                "text-sm font-medium",
                selectedId ? "text-foreground" : "text-muted-foreground",
              )}
            >
              {t("enableLabel")}
            </label>
            <p className="text-xs text-muted-foreground">
              {selectedId
                ? t("enableHint")
                : mode === "agent"
                  ? t("enableRequiresAgent")
                  : t("enableRequiresWorkflow")}
            </p>
          </div>
          <Switch
            id={controlId}
            checked={enabled}
            onCheckedChange={handleEnabledChange}
            disabled={saving || !selectedId}
            aria-label={t("enableLabel")}
          />
        </div>

        {pipelines.length > 0 ? (
          <div className="space-y-1.5 border-t border-border pt-4">
            <label htmlFor={`${controlId}-pipeline`} className="text-sm text-foreground">
              {t("pipelineLabel")}
            </label>
            <p className="text-xs text-muted-foreground">{t("pipelineHint")}</p>
            <ElevatedSelect
              value={pipelineId ?? ""}
              onValueChange={(next: string) => handlePipelineChange(next)}
              disabled={saving}
            >
              <ElevatedSelectItem value="">{t("pipelineDefault")}</ElevatedSelectItem>
              {pipelines.map((pipeline) => (
                <ElevatedSelectItem key={pipeline.id} value={pipeline.id}>
                  {pipeline.name}
                </ElevatedSelectItem>
              ))}
            </ElevatedSelect>
          </div>
        ) : null}

        {
}
        {showHandling ? (
          <div className="space-y-3 border-t border-border pt-4">
            <p className="text-xs font-medium text-muted-foreground">{t("handlingTitle")}</p>
            {HANDLING_TOGGLES.map((key) => (
              <div key={key} className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <label htmlFor={`${controlId}-${key}`} className="text-sm text-foreground">
                    {t(`${key}Label`)}
                  </label>
                  <p className="mt-0.5 text-xs text-muted-foreground">{t(`${key}Hint`)}</p>
                </div>
                <Switch
                  id={`${controlId}-${key}`}
                  checked={handling[key]}
                  onCheckedChange={(next: boolean) => handleHandlingChange(key, next)}
                  disabled={saving}
                  aria-label={t(`${key}Label`)}
                />
              </div>
            ))}
          </div>
        ) : null}

        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-xs text-foreground">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : (
          active && (
            <p className="flex items-start gap-2 rounded-lg border border-border bg-muted p-3 text-xs text-foreground">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
              {mode === "agent" ? t("activeNote") : t("activeNoteWorkflow")}
            </p>
          )
        )}
      </div>
    </ElevatedContainer>
  );
}
