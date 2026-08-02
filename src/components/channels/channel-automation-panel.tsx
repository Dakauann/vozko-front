"use client";

import { CheckCircle, GitBranch, Robot, Warning } from "@phosphor-icons/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { Switch } from "@/components/ui/switch";
import type { AgentListItem } from "@/lib/agents/types";
import type { Workflow } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";
import { getAgentByIdAction, listAgentsAction } from "@/app/actions/agents";
import { getWorkflowAction, listWorkflowsAction } from "@/app/actions/workflows";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useTranslations } from "next-intl";

/**
 * Who answers this account's conversations.
 *
 * An account is attended by an agent OR a workflow, never both — the same
 * exclusive choice the WhatsApp campaign form makes, so an operator configuring
 * several channels meets one mental model. Switching modes disables the other
 * side in the same write, which is what keeps "both enabled" unrepresentable.
 *
 * The two selectors are server-paginated and searched through the shared
 * usePaginatedSelect + ElevatedCommandSelect pair, so there is one selector
 * implementation in the product.
 *
 * Each control saves on change (there is no form to submit), so the panel owns
 * its saving / saved / error state instead of leaving the user guessing.
 *
 * It is channel-agnostic because the choice genuinely is: only the save call and
 * the translation namespace differ per channel. Copying it would mean fixing
 * every future bug in this flow once per channel.
 */

type Mode = "agent" | "workflow";

/** The subset of a channel account this panel reads and writes. */
export interface ChannelAutomationAccount {
  id: string;
  agentId?: string | null;
  workflowId?: string | null;
  enableAgentResponses: boolean;
  enableWorkflow: boolean;
}

export interface ChannelAutomationPayload {
  agentId?: string | null;
  workflowId?: string | null;
  enableAgentResponses?: boolean;
  enableWorkflow?: boolean;
}

export function ChannelAutomationPanel<T extends ChannelAutomationAccount>({
  account,
  onUpdated,
  onSave,
  translationNamespace,
  controlId = "channel-automation-enabled",
}: {
  account: T;
  onUpdated: (account: T) => void;
  /** The channel's own update call. Returns the saved account, or an error. */
  onSave: (
    accountId: string,
    payload: ChannelAutomationPayload,
  ) => Promise<{ account?: T; error?: string }>;
  /** e.g. "instagram.automation" — every channel ships the same key set. */
  translationNamespace: string;
  /** Distinct per channel so two panels on one page keep valid label targets. */
  controlId?: string;
}) {
  const t = useTranslations(translationNamespace);

  // A saved workflow wins the initial mode: it is the more specific setup, and
  // an account can only have one of the two enabled.
  const [mode, setMode] = useState<Mode>(
    account.enableWorkflow || (!account.agentId && account.workflowId) ? "workflow" : "agent",
  );
  const [agentId, setAgentId] = useState<string | null>(account.agentId ?? null);
  const [workflowId, setWorkflowId] = useState<string | null>(account.workflowId ?? null);
  const [enabled, setEnabled] = useState(
    account.enableWorkflow || account.enableAgentResponses,
  );
  const [saving, setSaving] = useState(false);
  // A flag, not a timestamp: it only drives the transient "Saved" label.
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        // An inactive agent can be selected but will not answer, so the state is
        // shown rather than hidden behind a successful-looking save.
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

  // The saved selection may live on a page the picker has not loaded, so its
  // name is resolved directly and merged into the options — otherwise the field
  // renders blank until the user happens to scroll to it. Both are keyed by id
  // so a slow lookup can never label a different selection.
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
      // Roll every control back to the server's truth, so the UI never shows a
      // setting that was not persisted.
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
    // Switching modes turns the other side off in the same write: an account
    // attended by both an agent and a workflow would answer twice.
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
    // Clearing the selection leaves nothing to answer with, so responses are
    // turned off in the same write rather than leaving an impossible "on, but
    // nothing selected".
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
            className={cn("h-4 w-4", active ? "text-primary" : "text-muted-foreground")}
            weight="fill"
          />
          <h2 className="text-sm font-semibold text-foreground">{t("title")}</h2>
        </div>

        {/* One live status line, so the panel's effect is never ambiguous. */}
        <span
          aria-live="polite"
          className={cn(
            "text-xs",
            error ? "text-destructive" : justSaved ? "text-emerald-600" : "text-muted-foreground",
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
        {/* Agent or workflow — never both. */}
        <div
          role="radiogroup"
          aria-label={t("modeLabel")}
          className="flex gap-1 rounded-lg bg-muted/60 p-1"
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
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
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
            // Without a selection there is nothing to enable; the hint says why.
            disabled={saving || !selectedId}
            aria-label={t("enableLabel")}
          />
        </div>

        {error ? (
          <p className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-muted/30 p-3 text-xs text-foreground">
            <Warning className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            {error}
          </p>
        ) : (
          active && (
            <p className="flex items-start gap-2 rounded-lg border border-border/70 bg-muted/30 p-3 text-xs text-foreground">
              <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" weight="fill" />
              {mode === "agent" ? t("activeNote") : t("activeNoteWorkflow")}
            </p>
          )
        )}
      </div>
    </ElevatedContainer>
  );
}
