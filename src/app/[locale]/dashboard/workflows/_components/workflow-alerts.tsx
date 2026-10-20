"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  Warning,
  WarningCircle,
  CheckCircle,
  CircleNotch,
  CaretDown,
} from "@/components/icons";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import {
  openRuntimeAlertCount,
  sortedRuntimeAlerts,
  type RuntimeAlertFix,
} from "@/lib/workflows/runtime-alerts";
import { localizedLintIssues } from "@/lib/workflows/lint-copy";
import { lintCounts, sortedLintIssues } from "@/lib/workflows/lint-severity";
import type { LintIssue, RuntimeAlert } from "@/lib/workflows/types";

import type { MoveToSecretRequest } from "./move-to-secret-dialog";
import { CleanState, LintIssueRow, RuntimeAlertRow, count } from "./workflow-alert-rows";

interface WorkflowAlertsProps {
  valid: boolean;
  issues: LintIssue[];
  linting: boolean;
  runtimeAlerts: RuntimeAlert[];
  runtimeAlertsFailed?: boolean;
  defaultOpen?: boolean;
  highlightAlertId?: string | null;
  nodeLabel?: (nodeId: string) => string | undefined;
  fieldLabel?: (nodeId: string, field: string) => string | undefined;
  outputLabel?: (nodeId: string, output: string) => string | undefined;
  onFocusNode?: (nodeId: string) => void;
  nodeConfig?: (nodeId: string) => Record<string, unknown> | undefined;
  onMoveToSecret?: (request: MoveToSecretRequest) => void;
  onRuntimeFix?: (fix: RuntimeAlertFix) => void;
  onOpen?: () => void;
  openRequest?: number;
}

const UNVERIFIED_LABEL = "Alertas de execução indisponíveis";

export function WorkflowAlerts({
  valid,
  issues,
  linting,
  runtimeAlerts,
  runtimeAlertsFailed = false,
  defaultOpen = false,
  highlightAlertId = null,
  nodeLabel,
  fieldLabel,
  outputLabel,
  onFocusNode,
  nodeConfig,
  onMoveToSecret,
  onRuntimeFix,
  onOpen,
  openRequest = 0,
}: WorkflowAlertsProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [seenRequest, setSeenRequest] = useState(openRequest);
  if (openRequest !== seenRequest) {
    setSeenRequest(openRequest);
    setOpen(true);
  }
  const [suggestionShown, setSuggestionShown] = useState<string | null>(null);
  const [resolvedShown, setResolvedShown] = useState(false);

  const t = useTranslations("workflowsPage");
  const { blocking, advisory, info, sorted } = useMemo(
    () => ({ ...lintCounts(issues), sorted: localizedLintIssues(t, sortedLintIssues(issues), { nodeLabel, fieldLabel, outputLabel }) }),
    [t, issues, nodeLabel, fieldLabel, outputLabel],
  );

  const runtime = useMemo(() => sortedRuntimeAlerts(runtimeAlerts), [runtimeAlerts]);
  const openRuntime = openRuntimeAlertCount(runtimeAlerts);
  const highRuntime = runtime.open.some((alert) => alert.severity === "high");

  const total = blocking + advisory + openRuntime;
  const listed = issues.length + openRuntime;
  const tone: "clean" | "unverified" | "advisory" | "blocking" =
    blocking > 0 || highRuntime
      ? "blocking"
      : total > 0
        ? "advisory"
        : runtimeAlertsFailed
          ? "unverified"
          : "clean";

  const summary =
    [
      count(openRuntime, "em execução", "em execução"),
      count(blocking, "bloqueio", "bloqueios"),
      count(advisory, "aviso", "avisos"),
      count(info, "informação", "informações"),
    ]
      .filter(Boolean)
      .join(", ") || (runtimeAlertsFailed ? UNVERIFIED_LABEL : "Tudo certo");

  const triggerLabel =
    listed > 0 ? `Alertas: ${summary}` : runtimeAlertsFailed ? UNVERIFIED_LABEL : "Sem alertas de validação";

  const TriggerIcon = linting
    ? CircleNotch
    : tone === "blocking"
      ? Warning
      : tone === "advisory" || tone === "unverified"
        ? WarningCircle
        : CheckCircle;

  const changeOpen = (next: boolean) => {
    setOpen(next);
    if (next) onOpen?.();
  };

  const runFix = (fix: RuntimeAlertFix) => {
    setOpen(false);
    onRuntimeFix?.(fix);
  };

  return (
    <Popover open={open} onOpenChange={changeOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={triggerLabel}
          aria-label={triggerLabel}
          className={cn(
            "inline-flex items-center gap-1.5 min-h-[32px] rounded-[--radius] border px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            tone === "blocking" &&
              "border-border text-destructive-ink hover:bg-muted dark:border-border dark:text-destructive-ink dark:hover:bg-muted",
            tone === "advisory" &&
              "border-border text-warning-ink hover:bg-muted dark:border-border dark:text-warning-ink dark:hover:bg-muted",
            (tone === "clean" || tone === "unverified") &&
              "border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted",
          )}
        >
          <TriggerIcon
            size={15}
            weight={tone === "clean" || tone === "unverified" ? "regular" : "fill"}
            className={cn(
              linting && "animate-spin",
              tone === "clean" && !linting && "text-healthy-ink",
            )}
          />
          <span>Alertas</span>
          {total > 0 && (
            <span
              className={cn(
                "grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-2xs font-semibold",
                tone === "blocking"
                  ? "bg-destructive text-destructive-foreground"
                  : "bg-warning text-warning-foreground",
              )}
            >
              {total}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[380px] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-3">
          <div className="text-sm font-semibold text-foreground">Alertas</div>
          <div
            className={cn(
              "text-xs font-medium",
              tone === "blocking" && "text-destructive-ink",
              tone === "advisory" && "text-warning-ink",
              (tone === "clean" || tone === "unverified") && "text-muted-foreground",
            )}
          >
            {linting ? "Verificando..." : summary}
          </div>
        </div>

        <div className="max-h-[420px] overflow-y-auto border-t border-border">
          {runtimeAlertsFailed && (
            <p className="border-b border-border/60 px-4 py-2 text-2xs text-muted-foreground">
              Não foi possível carregar os alertas de execução.
            </p>
          )}

          {runtime.open.length > 0 && (
            <div data-testid="runtime-alerts" className="divide-y divide-border/60 border-b border-border/60">
              {runtime.open.map((alert) => (
                <RuntimeAlertRow
                  key={alert.id}
                  alert={alert}
                  highlighted={alert.id === highlightAlertId}
                  nodeLabel={nodeLabel}
                  onFocusNode={
                    onFocusNode
                      ? (nodeId) => {
                          setOpen(false);
                          onFocusNode(nodeId);
                        }
                      : undefined
                  }
                  onFix={runFix}
                />
              ))}
            </div>
          )}

          {listed === 0 ? (
            runtimeAlertsFailed ? null : <CleanState valid={valid} />
          ) : (
            <div className="divide-y divide-border/60">
              {sorted.map((issue, index) => {
                const rowKey = `${issue.code}-${issue.nodeId ?? issue.edgeRef ?? index}`;
                return (
                  <LintIssueRow
                    key={rowKey}
                    issue={issue}
                    nodeLabel={nodeLabel}
                    nodeConfig={nodeConfig}
                    onFocusNode={onFocusNode}
                    onMoveToSecret={onMoveToSecret}
                    suggestionShown={suggestionShown === rowKey}
                    onToggleSuggestion={() => setSuggestionShown((shown) => (shown === rowKey ? null : rowKey))}
                    onClose={() => setOpen(false)}
                  />
                );
              })}
            </div>
          )}

          {runtime.resolved.length > 0 && (
            <div className="border-t border-border/60">
              <button
                type="button"
                aria-expanded={resolvedShown}
                onClick={() => setResolvedShown((shown) => !shown)}
                className="flex w-full items-center justify-between gap-2 px-4 py-2 text-left text-2xs font-medium text-muted-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
              >
                <span>Resolvidos (24 h) · {runtime.resolved.length}</span>
                <CaretDown size={11} weight="bold" className={cn("transition-transform", resolvedShown && "rotate-180")} />
              </button>
              {resolvedShown && (
                <div className="divide-y divide-border/60">
                  {runtime.resolved.map((alert) => (
                    <RuntimeAlertRow key={alert.id} alert={alert} highlighted={false} nodeLabel={nodeLabel} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
