"use client";

import { createContext, memo, useContext } from "react";
import { useTranslations } from "next-intl";

import { ArrowSquareOut, Robot } from "@/components/icons";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import { toolCallOutcome, type ToolCallOutcomeKey } from "@/lib/conversations/agent-tool-calls";
import type { ThreadRow } from "@/lib/conversations/thread-rows";
import { workflowRunHref } from "@/lib/workflows/run-format";
import { cn } from "@/lib/utils";

import { MessageTime } from "./message-parts";

export interface AgentToolCallNames {
  agentName: (agentId: string) => string | undefined;
  toolName: (toolName: string) => string;
}

const NO_NAMES: AgentToolCallNames = {
  agentName: () => undefined,
  toolName: (toolName) => toolName,
};

const AgentToolCallNamesContext = createContext<AgentToolCallNames>(NO_NAMES);

export const AgentToolCallNamesProvider = AgentToolCallNamesContext.Provider;

const OUTCOME_DOTS: Record<ToolCallOutcomeKey, string> = {
  ok: "bg-healthy",
  runStarted: "bg-healthy",
  error: "bg-destructive",
  requested: "bg-muted-foreground",
};

type AgentToolCallThreadRow = Extract<ThreadRow, { kind: "agent-tool-call" }>;

function AgentToolCallRowView({ row }: { row: AgentToolCallThreadRow }) {
  const t = useTranslations("crmConversation.thread.agentToolCall");
  const names = useContext(AgentToolCallNamesContext);
  const { call } = row;
  const outcome = toolCallOutcome(call);
  const runHref = call.runId && call.workflowId ? workflowRunHref(call.workflowId, call.runId) : null;
  const line = t("line", { agent: names.agentName(call.agentId) ?? t("agentFallback"), tool: names.toolName(call.toolName) });

  return (
    <div data-tool-call-id={call.id} className="flex justify-center py-0.5">
      <div
        title={call.error}
        className="inline-flex max-w-[85%] items-center gap-1.5 rounded-full border border-border bg-card py-0.5 pl-1 pr-2.5 text-2xs leading-none"
      >
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Robot weight="bold" className="h-2.5 w-2.5" aria-hidden />
        </span>
        <span className="min-w-0 truncate font-medium text-foreground">{line}</span>
        <span aria-hidden className="text-muted-foreground">·</span>
        <span className="inline-flex shrink-0 items-center gap-1 text-muted-foreground">
          <span aria-hidden className={cn("h-1.5 w-1.5 rounded-full", OUTCOME_DOTS[outcome])} />
          {t(`outcomes.${outcome}`)}
        </span>
        {runHref ? (
          <>
            <span aria-hidden className="text-muted-foreground">·</span>
            <a
              href={runHref}
              target="_blank"
              rel="noreferrer"
              className="inline-flex shrink-0 items-center gap-0.5 font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {t("openRun")}
              <ArrowSquareOut size={10} aria-hidden />
            </a>
          </>
        ) : null}
        <time dateTime={call.createdAt} className="shrink-0 tabular-nums text-muted-foreground">
          <MessageTime iso={call.createdAt} />
        </time>
      </div>
    </div>
  );
}

export const AgentToolCallRow = memo(AgentToolCallRowView);

export function AgentToolCallsLoadError({ failure, onRetry }: { failure: CodedError; onRetry: () => void }) {
  const t = useTranslations("crmConversation.thread.agentToolCall");
  const tCodes = useTranslations("workflowsPage");
  return (
    <div role="status" className="flex items-center justify-center gap-1.5 py-0.5 text-2xs text-muted-foreground">
      <Robot weight="bold" className="h-2.5 w-2.5 shrink-0" aria-hidden />
      <span className="min-w-0 truncate">{codedErrorMessage(tCodes, failure, t("loadFailed"))}</span>
      <button
        type="button"
        onClick={onRetry}
        className="shrink-0 rounded-[--radius] font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {t("retry")}
      </button>
    </div>
  );
}
