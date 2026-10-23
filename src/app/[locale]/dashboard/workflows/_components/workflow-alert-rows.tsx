"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ArrowRight, CaretDown, CheckCircle, Info, Key, Lightbulb, Lightning, Plus, Warning, WarningCircle } from "@/components/icons";
import { CopyValueButton } from "@/components/crm/CopyValueButton";
import { cn } from "@/lib/utils";
import type { LocalizedLintIssue } from "@/lib/workflows/lint-copy";
import { lintSeverityOf } from "@/lib/workflows/lint-severity";
import { unknownCustomFieldOf, type CreateCustomFieldRequest } from "@/lib/workflows/custom-field-fix";
import { codeTemplateSuggestion, plainSecretFix } from "@/lib/workflows/plain-secret";
import { runtimeAlertView, type RuntimeAlertFix } from "@/lib/workflows/runtime-alerts";
import type { RuntimeAlert } from "@/lib/workflows/types";
import { webhookReasonLabel } from "@/lib/workflows/webhook-delivery";

import type { MoveToSecretRequest } from "./move-to-secret-dialog";
import { DateTimeText } from "./run-bits";

export const ACTION_CLASS =
  "inline-flex items-center gap-1 rounded-[--radius] border border-border px-2 py-1 text-2xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function count(n: number, one: string, many: string): string | null {
  if (n <= 0) return null;
  return `${n} ${n === 1 ? one : many}`;
}

export function LintIssueRow({
  issue,
  nodeLabel,
  nodeConfig,
  onFocusNode,
  onMoveToSecret,
  onCreateCustomField,
  suggestionShown,
  onToggleSuggestion,
  onClose,
}: {
  issue: LocalizedLintIssue;
  nodeLabel?: (nodeId: string) => string | undefined;
  nodeConfig?: (nodeId: string) => Record<string, unknown> | undefined;
  onFocusNode?: (nodeId: string) => void;
  onMoveToSecret?: (request: MoveToSecretRequest) => void;
  onCreateCustomField?: (request: CreateCustomFieldRequest) => void;
  suggestionShown: boolean;
  onToggleSuggestion: () => void;
  onClose: () => void;
}) {
  const tLint = useTranslations("workflowsPage.lintCopy");
  const [technicalShown, setTechnicalShown] = useState(false);
  const severity = lintSeverityOf(issue);
  const SeverityIcon = severity === "blocking" ? Warning : severity === "info" ? Info : WarningCircle;
  const chip = issue.nodeId
    ? (nodeLabel?.(issue.nodeId) ?? issue.nodeId)
    : issue.edgeRef
      ? "Conexão"
      : null;
  const clickable = Boolean(issue.nodeId && onFocusNode);
  const config = issue.nodeId ? nodeConfig?.(issue.nodeId) : undefined;
  const secretFix = config && onMoveToSecret ? plainSecretFix(issue, config) : null;
  const suggestion = codeTemplateSuggestion(issue, config);
  const missingField = onCreateCustomField ? unknownCustomFieldOf(issue, config) : null;
  const actions =
    secretFix || suggestion || missingField || issue.technical ? (
      <div className="space-y-2 px-4 pb-3 pl-[52px]">
        <div className="flex flex-wrap gap-2">
          {issue.technical && (
            <button
              type="button"
              aria-expanded={technicalShown}
              onClick={() => setTechnicalShown((shown) => !shown)}
              className="inline-flex items-center gap-1 text-2xs font-medium text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {tLint("technicalDetails")}
              <CaretDown size={11} weight="bold" className={cn("transition-transform", technicalShown && "rotate-180")} />
            </button>
          )}
          {secretFix && issue.nodeId && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onMoveToSecret?.({
                  nodeId: issue.nodeId!,
                  nodeLabel: chip ?? issue.nodeId!,
                  inCode: issue.field === "code",
                  fix: secretFix,
                });
              }}
              className={ACTION_CLASS}
            >
              <Key size={12} weight="bold" />
              Mover para segredos
            </button>
          )}
          {missingField && (
            <button
              type="button"
              onClick={() => {
                onClose();
                onCreateCustomField?.(missingField);
              }}
              className={ACTION_CLASS}
            >
              <Plus size={12} weight="bold" />
              Criar campo
            </button>
          )}
          {suggestion && (
            <button
              type="button"
              aria-expanded={suggestionShown}
              onClick={onToggleSuggestion}
              className={ACTION_CLASS}
            >
              <Lightbulb size={12} weight="bold" />
              {suggestionShown ? "Ocultar sugestão" : "Ver sugestão"}
            </button>
          )}
        </div>
        {suggestion && suggestionShown && (
          <div className="space-y-1.5 rounded-[--radius] border border-border bg-background p-2.5 text-2xs" data-testid="code-suggestion">
            <div className="text-muted-foreground">Troque no código</div>
            <code className="block break-all font-mono text-foreground">{suggestion.template}</code>
            {suggestion.replacement ? (
              <>
                <div className="text-muted-foreground">por</div>
                <CopyValueButton value={suggestion.replacement} label="Copiar sugestão" copiedMessage="Copiado">
                  <code className="break-all font-mono text-foreground">{suggestion.replacement}</code>
                </CopyValueButton>
              </>
            ) : (
              <div className="text-muted-foreground">{issue.hint}</div>
            )}
          </div>
        )}
        {issue.technical && technicalShown && (
          <p className="break-words font-mono text-2xs text-muted-foreground">{issue.technical}</p>
        )}
      </div>
    ) : null;

  const body = (
    <>
      <div
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg",
          severity === "blocking" && "bg-destructive text-destructive-foreground",
          severity === "advisory" && "bg-warning text-warning-foreground",
          severity === "info" && "bg-info text-info-foreground",
        )}
      >
        <SeverityIcon size={14} weight="fill" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium leading-snug text-foreground">
          {issue.title}
        </div>
        <div className="mt-1 text-xs leading-snug text-muted-foreground">
          {issue.fix}
        </div>
        {chip && (
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
              {chip}
            </span>
            {clickable && (
              <span className="inline-flex items-center gap-0.5 text-2xs font-medium text-primary-ink opacity-0 transition-opacity group-hover:opacity-100">
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
      <div data-severity={severity}>
        <button
          type="button"
          onClick={() => {
            onFocusNode?.(issue.nodeId!);
            onClose();
          }}
          className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted"
        >
          {body}
        </button>
        {actions}
      </div>
    );
  }
  return (
    <div data-severity={severity}>
      <div className="group flex w-full items-start gap-3 px-4 py-3">
        {body}
      </div>
      {actions}
    </div>
  );
}

export function CleanState({ valid }: { valid: boolean }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
      <div className="grid h-10 w-10 place-items-center rounded-[--radius] bg-healthy">
        <CheckCircle size={22} weight="fill" className="text-healthy-foreground" />
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
  );
}

export function RuntimeAlertRow({
  alert,
  highlighted,
  nodeLabel,
  onFocusNode,
  onFix,
}: {
  alert: RuntimeAlert;
  highlighted: boolean;
  nodeLabel?: (nodeId: string) => string | undefined;
  onFocusNode?: (nodeId: string) => void;
  onFix?: (fix: RuntimeAlertFix) => void;
}) {
  const tWebhook = useTranslations("workflowRuns.webhook");
  const rowRef = useRef<HTMLDivElement>(null);
  const resolved = alert.status === "resolved";
  const view = runtimeAlertView(alert, {
    webhookReason: (reason) => webhookReasonLabel(reason, tWebhook),
    nodeLabel: (nodeId) => nodeLabel?.(nodeId),
  });
  const chip = alert.nodeId ? (nodeLabel?.(alert.nodeId) ?? alert.nodeId) : null;

  useEffect(() => {
    if (highlighted) rowRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [highlighted]);

  let action: ReactNode = null;
  if (!resolved && view.fix && view.actionLabel) {
    const fix = view.fix;
    action =
      fix.kind === "link" ? (
        <a href={fix.href} className={ACTION_CLASS}>
          {view.actionLabel}
          <ArrowRight size={11} weight="bold" />
        </a>
      ) : (
        <button type="button" onClick={() => onFix?.(fix)} className={ACTION_CLASS}>
          {view.actionLabel}
          <ArrowRight size={11} weight="bold" />
        </button>
      );
  }

  return (
    <div
      ref={rowRef}
      data-alert-id={alert.id}
      data-resolved={resolved ? "true" : undefined}
      data-highlighted={highlighted ? "true" : undefined}
      className={cn("flex items-start gap-3 px-4 py-3", highlighted && "bg-muted", resolved && "opacity-60")}
    >
      <div
        className={cn(
          "mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-lg",
          resolved
            ? "bg-muted text-muted-foreground"
            : alert.severity === "high"
              ? "bg-destructive text-destructive-foreground"
              : "bg-warning text-warning-foreground",
        )}
      >
        {resolved ? <CheckCircle size={14} weight="fill" /> : <Lightning size={14} weight="fill" />}
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <h4 className="text-sm font-medium leading-snug text-foreground">{view.title}</h4>
        <p className="text-xs leading-snug text-muted-foreground">{view.description}</p>
        {alert.sample && (
          <p className="truncate font-mono text-2xs text-muted-foreground" title={alert.sample}>
            {alert.sample}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-x-1.5 text-2xs text-muted-foreground">
          <span className="readout tabular-nums">{count(alert.count, "ocorrência", "ocorrências")}</span>
          <span aria-hidden>·</span>
          <span>
            {resolved ? "resolvido em " : "última em "}
            <DateTimeText value={resolved ? alert.resolvedAt : alert.lastSeen} />
          </span>
        </div>
        {(chip || action) && (
          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            {chip && alert.nodeId && (
              onFocusNode && !resolved ? (
                <button
                  type="button"
                  onClick={() => onFocusNode(alert.nodeId!)}
                  className="inline-flex max-w-full items-center gap-1 truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {chip}
                </button>
              ) : (
                <span className="inline-flex max-w-full items-center truncate rounded-md bg-muted px-1.5 py-0.5 font-mono text-2xs text-muted-foreground">
                  {chip}
                </span>
              )
            )}
            {action}
          </div>
        )}
      </div>
    </div>
  );
}
