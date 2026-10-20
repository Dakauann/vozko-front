"use client";

import { useMemo, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretDown, CaretRight, Info, PushPin } from "@/components/icons";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/elevated-design/elevated-tabs";
import { Notice } from "@/components/ui/notice";
import { prettyJsonText } from "@/lib/format/json-text";
import { stepTabs, type StepTab, type WaterfallBar } from "@/lib/workflows/run-format";
import { sandboxEffectsOf, type SandboxEffects } from "@/lib/workflows/sandbox-effects";
import type { RunHttpExchange, WorkflowRunLog } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

import { DurationText, FieldLine, JsonBlock, RunErrorText, stepDotClass } from "./run-bits";
import { SimMessageList } from "./sim-thread";

const ERROR_KIND_KEYS: Record<string, string> = {
  config: "config",
  timeout: "timeout",
  http_status: "httpStatus",
  transport: "transport",
  script: "script",
  panic: "panic",
  guard: "guard",
  gate: "gate",
  validation: "validation",
  cancelled: "cancelled",
  internal: "internal",
  real_call_not_confirmed: "realCallNotConfirmed",
};

export function StepRow({
  step,
  bar,
  label,
  expanded,
  onToggle,
  compact = false,
  children,
}: {
  step: WorkflowRunLog;
  bar?: WaterfallBar;
  label: string | undefined;
  expanded: boolean;
  onToggle: () => void;
  compact?: boolean;
  children?: ReactNode;
}) {
  const t = useTranslations("workflowRuns");
  const tDebug = useTranslations("workflowDebug");
  const failed = step.status === "failed";

  if (compact) {
    const Caret = expanded ? CaretDown : CaretRight;
    return (
      <li data-compact="true" className="flex flex-col items-center gap-1">
        <button
          type="button"
          onClick={onToggle}
          aria-expanded={expanded}
          className="inline-flex max-w-full items-center gap-1 rounded-full px-2 py-0.5 text-2xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <Caret size={10} className="shrink-0" />
          <span aria-hidden className={cn("h-1.5 w-1.5 shrink-0 rounded-full", stepDotClass(step.status))} />
          <span className="min-w-0 truncate">{label ?? step.nodeType}</span>
          {step.pinned && <PushPin size={10} weight="fill" className="shrink-0" aria-label={tDebug("step.pinned")} />}
          <span aria-hidden>·</span>
          <DurationText ms={step.durationMs} className="shrink-0" />
        </button>
        {expanded && <div className="w-full rounded-[--radius] border border-border">{children}</div>}
      </li>
    );
  }

  return (
    <li className={cn("rounded-[--radius] border", expanded ? "border-border" : "border-transparent")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="block w-full space-y-1 rounded-[--radius] px-2 py-1.5 text-left transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex items-center gap-1.5">
          {expanded ? <CaretDown size={10} className="shrink-0 text-muted-foreground" /> : <CaretRight size={10} className="shrink-0 text-muted-foreground" />}
          <span aria-hidden className={cn("h-2 w-2 shrink-0 rounded-full", stepDotClass(step.status))} />
          <span className="min-w-0 flex-1 truncate text-xs font-medium text-foreground">{label ?? step.nodeType}</span>
          {step.pinned && (
            <span title={tDebug("step.pinnedHint")} className="inline-flex shrink-0 items-center gap-0.5 text-2xs text-muted-foreground">
              <PushPin size={10} weight="fill" />
              {tDebug("step.pinned")}
            </span>
          )}
          {step.attempt > 1 && <span className="shrink-0 text-2xs text-muted-foreground">{t("detail.attempt", { attempt: step.attempt })}</span>}
          <DurationText ms={step.durationMs} className="shrink-0 text-2xs text-muted-foreground" />
        </span>
        {bar && (
          <span className="relative block h-1.5 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("absolute inset-y-0 rounded-full", failed ? "bg-destructive" : "bg-primary")}
              style={{ left: `${bar.offsetPct}%`, width: `${bar.widthPct}%` }}
            />
          </span>
        )}
      </button>
      {expanded && children}
    </li>
  );
}

export function useSandboxEffects(step: WorkflowRunLog): SandboxEffects {
  return useMemo(() => sandboxEffectsOf(step), [step]);
}

export function SandboxEffectLines({ effects }: { effects: SandboxEffects }) {
  const t = useTranslations("workflowDebug.chat");
  if (!effects.notice && effects.wouldDo.length === 0) return null;
  return (
    <ul className="space-y-0.5 text-2xs text-muted-foreground" data-testid="sandbox-effects">
      {effects.notice && (
        <li className="flex items-center gap-1.5">
          <Info size={11} className="shrink-0" aria-hidden />
          <span className="min-w-0 break-words">{effects.notice}</span>
        </li>
      )}
      {effects.wouldDo.map((change, index) => (
        <li key={`${change.kind}:${index}`} className="flex items-center gap-1.5">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-info" />
          <span className="min-w-0 break-words">{t("simulated", { description: change.description })}</span>
        </li>
      ))}
    </ul>
  );
}

function SentMessages({ effects }: { effects: SandboxEffects }) {
  const t = useTranslations("workflowDebug.chat");
  if (effects.sentMessages.length === 0) return null;
  return (
    <div className="space-y-1">
      <p className="text-2xs font-semibold text-foreground">{t("sentMessages")}</p>
      <div className="rounded-[--radius] bg-muted/40 p-2">
        <SimMessageList messages={effects.sentMessages} />
      </div>
    </div>
  );
}

export function StepDetail({ step, actions, children }: { step: WorkflowRunLog; actions?: ReactNode; children?: ReactNode }) {
  const t = useTranslations("workflowRuns");
  const tabs = stepTabs(step);
  const effects = useSandboxEffects(step);

  return (
    <div className="space-y-2 border-t border-border px-2 pb-2 pt-2" data-testid="step-detail">
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-2xs text-muted-foreground">
        <span className="font-mono">{step.nodeId}</span>
        <span>{t.has(`stepStatus.${step.status}`) ? t(`stepStatus.${step.status}`) : step.status}</span>
        {step.branch && <span>{t("detail.branch", { branch: step.branch })}</span>}
      </div>
      {actions && <div className="flex flex-wrap gap-1.5">{actions}</div>}
      <SandboxEffectLines effects={effects} />
      {children}
      <SentMessages effects={effects} />
      {tabs.length > 0 && (
        <Tabs defaultValue={tabs[0]}>
          <TabsList>
            {tabs.map((tab) => (
              <TabsTrigger key={tab} value={tab} className="px-2 py-1.5 text-2xs">
                {t(`tabs.${tab}`)}
              </TabsTrigger>
            ))}
          </TabsList>
          {tabs.map((tab) => (
            <TabsContent key={tab} value={tab} className="mt-2">
              <StepTabBody tab={tab} step={step} />
            </TabsContent>
          ))}
        </Tabs>
      )}
    </div>
  );
}

function StepTabBody({ tab, step }: { tab: StepTab; step: WorkflowRunLog }) {
  switch (tab) {
    case "input":
      return <JsonBlock value={step.input} />;
    case "output":
      return <JsonBlock value={step.output} />;
    case "error":
      return <StepError step={step} />;
    case "http":
      return (
        <div className="space-y-3">
          {(step.http ?? []).map((exchange, index) => (
            <HttpExchange key={index} exchange={exchange} />
          ))}
        </div>
      );
    case "logs":
      return (
        <ol className="max-h-64 space-y-0.5 overflow-auto rounded-[--radius] border border-border bg-background p-2 font-mono text-2xs leading-relaxed">
          {(step.scriptLogs ?? []).map((entry, index) => (
            <li key={index} className="whitespace-pre-wrap break-words">
              <span className="text-muted-foreground">[{entry.level}]</span> <span className="text-foreground">{entry.message}</span>
            </li>
          ))}
        </ol>
      );
  }
}

function StepError({ step }: { step: WorkflowRunLog }) {
  const t = useTranslations("workflowRuns");
  const kindKey = step.errorKind ? ERROR_KIND_KEYS[step.errorKind] : undefined;
  return (
    <div className="space-y-2 text-xs">
      {step.errorKind && (
        <FieldLine label={t("error.kind")}>
          {kindKey ? t(`errorKinds.${kindKey}`) : t("errorKinds.unknown", { kind: step.errorKind })}
        </FieldLine>
      )}
      {step.error && (
        <div className="space-y-1">
          <p className="text-2xs text-muted-foreground">{t("error.message")}</p>
          <p className="whitespace-pre-wrap break-words text-foreground">
            <RunErrorText error={step.error} />
          </p>
        </div>
      )}
      {step.errorChain && step.errorChain.length > 0 && (
        <div className="space-y-1">
          <p className="text-2xs text-muted-foreground">{t("error.chain")}</p>
          <ol className="list-decimal space-y-0.5 pl-4 text-foreground">
            {step.errorChain.map((cause, index) => (
              <li key={index} className="break-words">
                {cause}
              </li>
            ))}
          </ol>
        </div>
      )}
      {step.stack && (
        <div className="space-y-1">
          <p className="text-2xs text-muted-foreground">{t("error.stack")}</p>
          <JsonBlock value={step.stack} className="whitespace-pre" />
        </div>
      )}
    </div>
  );
}

function HttpExchange({ exchange }: { exchange: RunHttpExchange }) {
  const t = useTranslations("workflowRuns");
  return (
    <div className="space-y-2 rounded-[--radius] border border-border p-2">
      <div className="flex items-start gap-2">
        <span className="shrink-0 font-mono text-2xs font-semibold text-foreground">{exchange.method}</span>
        <span className="min-w-0 flex-1 break-all font-mono text-2xs text-foreground">{exchange.url}</span>
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <span
            aria-hidden
            className={cn(
              "h-1.5 w-1.5 rounded-full",
              !exchange.status ? "bg-muted-foreground" : exchange.status < 400 ? "bg-healthy" : "bg-destructive",
            )}
          />
          <span className="readout tabular-nums text-foreground">{exchange.status || t("http.noStatus")}</span>
        </span>
        <span>
          {t("http.latency")} <DurationText ms={exchange.latencyMs} />
        </span>
        {exchange.redirects ? <span>{t("http.redirects", { count: exchange.redirects })}</span> : null}
      </div>
      {exchange.tlsFallback && <p className="text-2xs text-muted-foreground">{t("http.tlsFallback")}</p>}
      {exchange.egressRefusal && <Notice tone="fault">{t("http.egressRefusal", { reason: exchange.egressRefusal })}</Notice>}
      {exchange.error && <p className="break-words text-2xs text-destructive-ink">{t("http.error", { error: exchange.error })}</p>}
      <HttpSide title={t("http.request")} headers={exchange.requestHeaders} body={exchange.requestBody} />
      <HttpSide title={t("http.response")} headers={exchange.responseHeaders} body={exchange.responseBody} />
      {exchange.truncated && <p className="text-2xs text-muted-foreground">{t("detail.truncated")}</p>}
    </div>
  );
}

function HttpSide({ title, headers, body }: { title: string; headers?: Record<string, string>; body?: string }) {
  const t = useTranslations("workflowRuns");
  const headerEntries = Object.entries(headers ?? {});
  if (headerEntries.length === 0 && !body) return null;
  return (
    <div className="space-y-1">
      <p className="text-2xs font-semibold text-foreground">{title}</p>
      {headerEntries.length > 0 && (
        <ul aria-label={t("http.headers")} className="space-y-0.5 rounded-[--radius] border border-border bg-background p-2 font-mono text-2xs">
          {headerEntries.map(([name, value]) => (
            <li key={name} className="break-all">
              <span className="text-muted-foreground">{name}:</span> <span className="text-foreground">{value}</span>
            </li>
          ))}
        </ul>
      )}
      {body && <JsonBlock value={prettyJsonText(body)} />}
    </div>
  );
}
