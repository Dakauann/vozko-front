"use client";

import { useMemo, useState } from "react";
import {
  Warning,
  WarningCircle,
  CheckCircle,
  CircleNotch,
  ArrowRight,
} from "@phosphor-icons/react";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import type { LintIssue } from "@/lib/workflows/types";

export interface WorkflowAlertsProps {
  /** Graph passes every activation rule. */
  valid: boolean;
  /** Structured lint issues from the backend (same rules as activation). */
  issues: LintIssue[];
  /** A re-lint is in flight. */
  linting: boolean;
  /** Friendly label for a node id, shown as the issue's context chip. */
  nodeLabel?: (nodeId: string) => string | undefined;
  /** Select and center the node on the canvas. */
  onFocusNode?: (nodeId: string) => void;
}

function isBlocking(issue: LintIssue): boolean {
  return issue.severity === "blocking";
}

// pt-BR plural for the summary line ("1 bloqueio" / "2 bloqueios").
function count(n: number, one: string, many: string): string | null {
  if (n <= 0) return null;
  return `${n} ${n === 1 ? one : many}`;
}

export function WorkflowAlerts({
  valid,
  issues,
  linting,
  nodeLabel,
  onFocusNode,
}: WorkflowAlertsProps) {
  const [open, setOpen] = useState(false);

  const { blocking, advisory, sorted } = useMemo(() => {
    const b = issues.filter(isBlocking).length;
    const sortedIssues = [...issues].sort(
      (a, z) => Number(isBlocking(z)) - Number(isBlocking(a)),
    );
    return { blocking: b, advisory: issues.length - b, sorted: sortedIssues };
  }, [issues]);

  const total = issues.length;
  const tone: "clean" | "advisory" | "blocking" =
    blocking > 0 ? "blocking" : advisory > 0 ? "advisory" : "clean";

  const summary =
    [count(blocking, "bloqueio", "bloqueios"), count(advisory, "aviso", "avisos")]
      .filter(Boolean)
      .join(", ") || "Tudo certo";

  const triggerLabel =
    tone === "clean" ? "Sem alertas de validação" : `Alertas: ${summary}`;

  const TriggerIcon = linting
    ? CircleNotch
    : tone === "blocking"
      ? Warning
      : tone === "advisory"
        ? WarningCircle
        : CheckCircle;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          title={triggerLabel}
          aria-label={triggerLabel}
          className={cn(
            "inline-flex items-center gap-1.5 min-h-[32px] rounded-xl border-2 px-2.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            tone === "blocking" &&
              "border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-500/40 dark:text-rose-300 dark:hover:bg-rose-500/10",
            tone === "advisory" &&
              "border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-500/40 dark:text-amber-300 dark:hover:bg-amber-500/10",
            tone === "clean" &&
              "border-border text-muted-foreground hover:border-foreground/20 hover:bg-muted",
          )}
        >
          <TriggerIcon
            size={15}
            weight={tone === "clean" ? "regular" : "fill"}
            className={cn(
              linting && "animate-spin",
              tone === "clean" && !linting && "text-emerald-600 dark:text-emerald-400",
            )}
          />
          <span>Alertas</span>
          {total > 0 && (
            <span
              className={cn(
                "grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] font-bold text-white",
                tone === "blocking" ? "bg-rose-500" : "bg-amber-500",
              )}
            >
              {total}
            </span>
          )}
        </button>
      </PopoverTrigger>

      <PopoverContent align="end" className="w-[360px] overflow-hidden p-0">
        <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-3">
          <div className="text-sm font-semibold text-foreground">Alertas</div>
          <div
            className={cn(
              "text-xs font-medium",
              tone === "blocking" && "text-rose-600 dark:text-rose-400",
              tone === "advisory" && "text-amber-600 dark:text-amber-400",
              tone === "clean" && "text-muted-foreground",
            )}
          >
            {linting ? "Verificando..." : summary}
          </div>
        </div>

        <div className="border-t border-border">
          {total === 0 ? (
            <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
              <div className="grid h-10 w-10 place-items-center rounded-xl bg-emerald-500">
                <CheckCircle size={22} weight="fill" className="text-white" />
              </div>
              <div className="text-sm font-medium text-foreground">
                Nenhum alerta
              </div>
              <div className="max-w-[240px] text-xs leading-relaxed text-muted-foreground">
                {valid
                  ? "O workflow está válido e pronto para ativar."
                  : "O workflow está sem alertas no momento."}
              </div>
            </div>
          ) : (
            <div className="max-h-[320px] divide-y divide-border/60 overflow-y-auto">
              {sorted.map((issue, index) => {
                const blockingIssue = isBlocking(issue);
                const SeverityIcon = blockingIssue ? Warning : WarningCircle;
                const chip = issue.nodeId
                  ? (nodeLabel?.(issue.nodeId) ?? issue.nodeId)
                  : issue.edgeRef
                    ? "Conexão"
                    : null;
                const clickable = Boolean(issue.nodeId && onFocusNode);

                const body = (
                  <>
                    <div
                      className={cn(
                        "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg",
                        blockingIssue ? "bg-rose-500" : "bg-amber-500",
                      )}
                    >
                      <SeverityIcon
                        size={14}
                        weight="fill"
                        className="text-white"
                      />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium leading-snug text-foreground">
                        {issue.message}
                      </div>
                      {issue.hint && (
                        <div className="mt-1 text-xs leading-snug text-muted-foreground">
                          {issue.hint}
                        </div>
                      )}
                      {chip && (
                        <div className="mt-1.5 flex items-center gap-1.5">
                          <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                            {chip}
                          </span>
                          {clickable && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                              Ver no fluxo
                              <ArrowRight size={11} weight="bold" />
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </>
                );

                if (clickable) {
                  return (
                    <button
                      key={`${issue.code}-${issue.nodeId ?? issue.edgeRef ?? index}`}
                      type="button"
                      onClick={() => {
                        onFocusNode?.(issue.nodeId!);
                        setOpen(false);
                      }}
                      className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/60"
                    >
                      {body}
                    </button>
                  );
                }
                return (
                  <div
                    key={`${issue.code}-${issue.nodeId ?? issue.edgeRef ?? index}`}
                    className="group flex w-full items-start gap-3 px-4 py-3"
                  >
                    {body}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
