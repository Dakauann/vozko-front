"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

import { getWorkflowAction, getWorkflowVersionAction } from "@/app/actions/workflows";
import { ArrowSquareOut, CircleNotch, Info } from "@/components/icons";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import type { ToolConfig } from "@/lib/agents/types";
import { agentCallInputsOfGraph, isAgentCallInputType, type AgentCallInput } from "@/lib/workflows/agent-call";
import { publishedVersionOf } from "@/lib/workflows/publication";
import { workflowHref } from "@/lib/workflows/run-format";
import type { WorkflowStatus } from "@/lib/workflows/types";

interface LoadedWorkflow {
  workflowId: string;
  name: string | null;
  status: WorkflowStatus | null;
  inputs: AgentCallInput[] | null;
  unpublished: boolean;
  failed: boolean;
}

async function loadBinding(workflowId: string): Promise<LoadedWorkflow> {
  const { workflow } = await getWorkflowAction(workflowId);
  const known = { workflowId, name: workflow?.name ?? null, status: workflow?.status ?? null, inputs: null };
  if (!workflow) return { ...known, unpublished: false, failed: true };
  const version = publishedVersionOf(workflow);
  if (version === null) return { ...known, unpublished: true, failed: false };
  const published = await getWorkflowVersionAction(workflowId, version);
  if (!published.version) return { ...known, unpublished: false, failed: true };
  return { ...known, inputs: agentCallInputsOfGraph(published.version.graph), unpublished: false, failed: false };
}

function workflowIdOf(config: ToolConfig | undefined): string {
  const value = config?.workflow_id;
  return typeof value === "string" ? value : "";
}

export default function RunWorkflowBindingDetails({ config }: { config: ToolConfig | undefined }) {
  const t = useTranslations("agents.form.tools.runWorkflow");
  const tTypes = useTranslations("workflowsPage.agentCall.types");
  const workflowId = workflowIdOf(config);
  const [loaded, setLoaded] = useState<LoadedWorkflow | null>(null);
  const loading = workflowId !== "" && loaded?.workflowId !== workflowId;

  useEffect(() => {
    if (!workflowId) return;
    let live = true;
    void loadBinding(workflowId).then((next) => {
      if (live) setLoaded(next);
    });
    return () => {
      live = false;
    };
  }, [workflowId]);

  const current = !loading && loaded?.workflowId === workflowId ? loaded : null;
  const inputs = current?.inputs ?? [];

  return (
    <div className="space-y-2.5 rounded-lg border border-border bg-muted p-3 text-xs" data-testid="run-workflow-binding">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-2xs font-medium text-muted-foreground">{t("workflow")}</span>
        {loading ? (
          <CircleNotch className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : (
          <span className="font-medium text-foreground">{current?.name ?? <EmptyValue />}</span>
        )}
        {current?.status && current.status !== "active" && (
          <StatusChip tone="warning" label={t("inactive")} />
        )}
        {current?.unpublished && <StatusChip tone="warning" label={t("unpublished")} />}
        {current && !current.failed && !current.unpublished && current.inputs === null && (
          <StatusChip tone="warning" label={t("noTrigger")} />
        )}
        {workflowId && (
          <a
            href={workflowHref(workflowId)}
            target="_blank"
            rel="noreferrer"
            className="ml-auto inline-flex items-center gap-1 text-2xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("open")}
            <ArrowSquareOut className="h-3 w-3" />
          </a>
        )}
      </div>

      {current?.failed && <p className="text-2xs font-medium text-destructive-ink">{t("loadFailed")}</p>}

      {current && !current.failed && current.inputs !== null && (
        <div className="space-y-1.5">
          <p className="text-2xs font-medium text-muted-foreground">{t("inputsTitle")}</p>
          {inputs.length === 0 ? (
            <p className="text-2xs text-muted-foreground">{t("noInputs")}</p>
          ) : (
            <ul className="space-y-1.5">
              {inputs.map((input) => (
                <li key={input.name} className="flex flex-col gap-0.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <code className="font-mono text-2xs text-foreground">{input.name}</code>
                    <span className="rounded bg-border px-1.5 py-0.5 text-2xs text-muted-foreground">{isAgentCallInputType(input.type) ? tTypes(input.type) : input.type}</span>
                    {input.required && (
                      <StatusChip
                        tone="outline"
                        className="px-1.5 text-2xs"
                        icon={<span className="h-1.5 w-1.5 rounded-full bg-warning" />}
                        label={t("required")}
                      />
                    )}
                  </div>
                  {input.description && <span className="text-2xs text-muted-foreground">{input.description}</span>}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      <p className="flex items-start gap-1.5 text-2xs leading-relaxed text-muted-foreground">
        <Info weight="fill" className="mt-0.5 h-3 w-3 shrink-0" />
        {t("conversationNote")}
      </p>
    </div>
  );
}
