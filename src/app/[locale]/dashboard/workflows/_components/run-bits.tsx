"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { getAgentByIdAction } from "@/app/actions/agents";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { ArrowSquareOut } from "@/components/icons";
import { ChannelLogo } from "@/components/icons/channel-logos";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { Notice } from "@/components/ui/notice";
import { conversationHref, isEntryId, isEntryType } from "@/lib/conversations/deep-link";
import { durationUnit, isRunStatus, parseStartedBy } from "@/lib/workflows/run-format";
import { ACCESS_REFUSAL_KEYS, accessRefusalOf, runErrorReasonKey } from "@/lib/workflows/run-errors";
import { statusTone } from "@/lib/workflows/status-tone";
import type { RunStatus } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";

export function useAgentNames(startedBys: readonly (string | undefined)[]): (agentId: string) => string | undefined {
  const agentIds = useMemo(
    () =>
      startedBys.flatMap((raw) => {
        const started = parseStartedBy(raw);
        return started?.kind === "agent" && started.ref ? [started.ref] : [];
      }),
    [startedBys],
  );
  return useAgentNamesById(agentIds);
}

export function useAgentNamesById(agentIds: readonly string[]): (agentId: string) => string | undefined {
  const canReadAgents = useSettledPermission("agents", "read");
  const [names, setNames] = useState<ReadonlyMap<string, string>>(() => new Map());
  const wantedKey = useMemo(() => [...new Set(agentIds.filter(Boolean))].sort().join(","), [agentIds]);

  useEffect(() => {
    if (!canReadAgents || !wantedKey) return;
    const missing = wantedKey.split(",").filter((id) => !names.has(id));
    if (missing.length === 0) return;
    let current = true;
    void Promise.all(missing.map((id) => getAgentByIdAction(id).then((res) => [id, res.agent?.name ?? ""] as const))).then((found) => {
      if (!current) return;
      setNames((prev) => {
        const next = new Map(prev);
        for (const [id, name] of found) next.set(id, name);
        return next;
      });
    });
    return () => {
      current = false;
    };
  }, [canReadAgents, wantedKey, names]);

  return useCallback((agentId: string) => names.get(agentId) || undefined, [names]);
}

export const OpenRunContext = createContext<((runId: string) => void) | null>(null);

export function useOpenRun(): ((runId: string) => void) | null {
  return useContext(OpenRunContext);
}

export function ToneChip({ status, label }: { status: string; label: string }) {
  const { tone, dot } = statusTone(status);
  return (
    <StatusChip
      tone={tone}
      label={label}
      icon={dot ? <span className={cn("h-1.5 w-1.5 rounded-full", dot)} /> : undefined}
      className="px-2 text-2xs"
    />
  );
}

export function RunStatusChip({ status }: { status: RunStatus }) {
  const t = useTranslations("workflowRuns");
  return <ToneChip status={status} label={isRunStatus(status) ? t(`status.${status}`) : status} />;
}

const STEP_DOTS: Record<string, string> = {
  executed: "bg-healthy",
  failed: "bg-destructive",
  skipped: "bg-muted-foreground",
  cancelled: "bg-muted-foreground",
  waiting: "bg-warning",
  gate: "bg-warning",
};

export function stepDotClass(status: string): string {
  return STEP_DOTS[status] ?? "bg-muted-foreground";
}

export function DurationText({ ms, className }: { ms: number | null | undefined; className?: string }) {
  const format = useFormatter();
  if (ms == null) return <EmptyValue className={className} />;
  const d = durationUnit(ms);
  return (
    <span className={cn("readout tabular-nums", className)}>
      {format.number(d.value, { style: "unit", unit: d.unit, unitDisplay: "short", maximumFractionDigits: d.maximumFractionDigits })}
    </span>
  );
}

export function DateTimeText({ value, className }: { value: string | undefined; className?: string }) {
  const format = useFormatter();
  const at = value ? new Date(value) : null;
  if (!at || Number.isNaN(at.getTime())) return <EmptyValue className={className} />;
  return <span className={className}>{format.dateTime(at, { dateStyle: "short", timeStyle: "medium" })}</span>;
}

export function StartedByText({ raw, agentName }: { raw: string | undefined; agentName: (agentId: string) => string | undefined }) {
  const t = useTranslations("workflowRuns.startedBy");
  const parsed = parseStartedBy(raw);
  if (!parsed) return <EmptyValue />;
  if (parsed.kind !== "agent") return <>{t(parsed.kind)}</>;
  const name = agentName(parsed.ref);
  return <>{name ? t("agent", { name }) : t("agentUnnamed")}</>;
}

export function ConversationLink({ entryId, entryType }: { entryId: string | undefined; entryType: string | undefined }) {
  const t = useTranslations("workflowRuns");
  if (!entryId || !entryType || !isEntryId(entryId) || !isEntryType(entryType)) return <EmptyValue />;
  return (
    <a
      href={conversationHref(entryId, entryType)}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="inline-flex min-w-0 items-center gap-1.5 rounded-[--radius] text-xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <ChannelLogo channel={entryType} className="h-3.5 w-3.5 shrink-0" />
      <span className="truncate">{t("openConversation")}</span>
      <ArrowSquareOut size={11} className="shrink-0" />
    </a>
  );
}

export function JsonBlock({ value, className }: { value: unknown; className?: string }) {
  return (
    <pre className={cn("max-h-64 overflow-auto rounded-[--radius] border border-border bg-background p-2.5 font-mono text-2xs leading-relaxed text-foreground", className)}>
      {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
    </pre>
  );
}

export function FieldLine({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-xs">
      <span className="shrink-0 text-muted-foreground">{label}</span>
      <span className="min-w-0 truncate text-right text-foreground">{children}</span>
    </div>
  );
}

export function useLoadFailureText(): (status: number | null | undefined, fallback: string) => string {
  const t = useTranslations("workflowRuns.refusal");
  return useCallback(
    (status, fallback) => {
      const refusal = accessRefusalOf(status ?? undefined);
      return refusal ? t(ACCESS_REFUSAL_KEYS[refusal]) : fallback;
    },
    [t],
  );
}

export function LoadFailure({ status, fallback }: { status: number | null | undefined; fallback: string }) {
  const failureText = useLoadFailureText();
  return <Notice tone="fault">{failureText(status, fallback)}</Notice>;
}

export function RunErrorText({ error }: { error: string }) {
  const t = useTranslations("workflowRuns.errorReasons");
  const key = runErrorReasonKey(error);
  return <>{key ? t(key) : error}</>;
}
