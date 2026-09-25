"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import {
  Brain,
  Buildings,
  Calculator,
  CaretRight,
  ChartBar,
  ChartLine,
  ChatsCircle,
  CircleNotch,
  Database,
  Hourglass,
  type Icon,
  ListBullets,
  ListNumbers,
  MagnifyingGlass,
  Microphone,
  PencilSimple,
  Plus,
  Sparkle,
  TrashSimple,
  Users,
  Wrench,
} from "@/components/icons";
import { ChatMarkdown } from "@/components/elevated-design/chat-markdown";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";
import type { ChatChart, ChatMessage, PendingAction } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";

import { ChatChartView } from "./chat-chart";

const TOOL_ICON: Record<string, Icon> = {
  create_agent: Plus,
  update_agent: PencilSimple,
  delete_agent: TrashSimple,
  get_agent: MagnifyingGlass,
  list_agents: ListBullets,
  count_agents: ListNumbers,
  list_models: Sparkle,
  list_voices: Microphone,
  list_departments: Buildings,
  list_agent_tools: Wrench,
  attendance_metrics: ChartBar,
  attendance_trend: ChartLine,
  attendance_team: Users,
  attendance_backlog: Hourglass,
  conversation_insights: ChatsCircle,
  calculate: Calculator,
  query_dataset: Database,
  render_chart: ChartBar,
};

const KNOWN_TOOLS = new Set(Object.keys(TOOL_ICON));

export type Segment =
  | { kind: "thinking"; text: string; streaming?: boolean }
  | { kind: "tool"; name: string; summary: string; ok: boolean }
  | { kind: "chart"; chart: ChatChart }
  | { kind: "text"; text: string; streaming?: boolean };

export type UIMessage = ChatMessage & {
  segments?: Segment[];
  pending?: PendingAction | null;
};

export function hydrate(m: ChatMessage): UIMessage {
  if (!m.reasoning && !(m.tools && m.tools.length > 0)) return m;
  const segments: Segment[] = [];
  if (m.reasoning) segments.push({ kind: "thinking", text: m.reasoning });
  for (const tool of m.tools ?? []) {
    segments.push({ kind: "tool", name: tool.name, summary: tool.summary, ok: tool.ok });
    if (tool.chart) segments.push({ kind: "chart", chart: tool.chart });
  }
  if (m.content) segments.push({ kind: "text", text: m.content });
  return { ...m, segments };
}

export interface BubbleLabels {
  thinking: string;
  thinkingLive: string;
  generatingResponse: string;
  approvalHint: string;
  approve: string;
  reject: string;
  toolFailed: string;
  toolLabel: (name: string) => string;
}

export function useBubbleLabels(): BubbleLabels {
  const t = useTranslations("aiChatPage");
  const tTools = useTranslations("aiChatPage.tools");
  const toolLabel = useCallback(
    (name: string) => (KNOWN_TOOLS.has(name) ? tTools(name) : name.replace(/_/g, " ")),
    [tTools],
  );
  return {
    thinking: t("thinking"),
    thinkingLive: t("thinkingLive"),
    generatingResponse: t("generatingResponse"),
    approvalHint: t("approvalHint"),
    approve: t("approve"),
    reject: t("reject"),
    toolFailed: t("toolFailed"),
    toolLabel,
  };
}

export function MessageBubble({
  message,
  streaming,
  onApprove,
  onReject,
  labels,
}: {
  message: UIMessage;
  streaming: boolean;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  labels: BubbleLabels;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-lg max-w-[85%] whitespace-pre-wrap break-words border border-border bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
          {message.content}
        </div>
      </div>
    );
  }

  const segs = message.segments ?? [];
  const hasSegs = segs.length > 0;
  const isStreamingThis = streaming && !hasSegs && !message.content && !message.pending;

  return (
    <div className="flex gap-3">
      {message.model ? (
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center ink-plate">
          <ModelBrandIcon modelId={message.model} size={15} />
        </span>
      ) : (
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center ink-plate text-muted-foreground">
          <Brain weight="fill" className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        {hasSegs ? (
          segs.map((seg, i) => <SegmentView key={i} seg={seg} labels={labels} />)
        ) : message.content ? (
          <ChatMarkdown content={message.content} />
        ) : isStreamingThis ? (
          <TypingDots label={labels.generatingResponse} />
        ) : null}
        {message.pending ? (
          <ApprovalCard
            pending={message.pending}
            onApprove={onApprove}
            onReject={onReject}
            labels={labels}
          />
        ) : null}
      </div>
    </div>
  );
}

function SegmentView({ seg, labels }: { seg: Segment; labels: BubbleLabels }) {
  switch (seg.kind) {
    case "thinking":
      return <ThinkingBlock text={seg.text} streaming={seg.streaming} labels={labels} />;
    case "tool":
      return <ToolLine name={seg.name} summary={seg.summary} ok={seg.ok} labels={labels} />;
    case "chart":
      return <ChatChartView chart={seg.chart} />;
    default:
      return (
        <div className="text-sm">
          <ChatMarkdown content={seg.text} />
          {seg.streaming ? <Cursor /> : null}
        </div>
      );
  }
}

function ThinkingBlock({
  text,
  streaming,
  labels,
}: {
  text: string;
  streaming?: boolean;
  labels: BubbleLabels;
}) {
  const [userToggled, setUserToggled] = useState<boolean | null>(null);
  const open = userToggled ?? !!streaming;
  return (
    <div className="rounded-lg border border-border bg-muted">
      <button
        type="button"
        onClick={() => setUserToggled(!open)}
        className="flex w-full items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium italic text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <Brain weight="duotone" className="h-3.5 w-3.5" />
        <span>{streaming ? labels.thinkingLive : labels.thinking}</span>
        <CaretRight
          weight="bold"
          className={cn("h-3 w-3 transition-transform", open && "rotate-90")}
        />
      </button>
      {open ? (
        <div className="ml-2 whitespace-pre-wrap border-l-2 border-border px-2.5 pb-2 pl-3 text-xs italic leading-relaxed text-muted-foreground">
          {text}
          {streaming ? <Cursor /> : null}
        </div>
      ) : null}
    </div>
  );
}

function ToolLine({
  name,
  summary,
  ok,
  labels,
}: {
  name: string;
  summary: string;
  ok: boolean;
  labels: BubbleLabels;
}) {
  const TileIcon = TOOL_ICON[name] ?? Wrench;
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs",
        ok ? "text-muted-foreground" : "text-destructive-ink",
      )}
    >
      <TileIcon weight="bold" className="h-3.5 w-3.5 flex-shrink-0" />
      <span className="flex-shrink-0">{labels.toolLabel(name)}</span>
      {summary ? (
        <span className="truncate opacity-80">· {summary}</span>
      ) : ok ? null : (
        <span className="opacity-80">· {labels.toolFailed}</span>
      )}
    </div>
  );
}

function ApprovalCard({
  pending,
  onApprove,
  onReject,
  labels,
}: {
  pending: PendingAction;
  onApprove: (actionId: string) => void;
  onReject: (actionId: string) => void;
  labels: BubbleLabels;
}) {
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const TileIcon = TOOL_ICON[pending.toolName] ?? Wrench;
  return (
    <div className="rounded-lg border border-border bg-muted p-3.5">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground">
          <TileIcon weight="bold" className="h-[18px] w-[18px]" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold leading-snug text-foreground">
            {labels.toolLabel(pending.toolName)}
          </p>
          {pending.summary ? (
            <p className="mt-1 break-words text-xs leading-relaxed text-muted-foreground">
              {pending.summary}
            </p>
          ) : null}
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2.5 border-t border-border pt-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <span className="text-xs font-medium text-primary-ink">{labels.approvalHint}</span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setBusy("reject");
              onReject(pending.id);
            }}
            className="rounded-[--radius] inline-flex items-center gap-1.5 border border-control-edge bg-card px-3.5 py-2 text-sm font-medium text-foreground transition-colors duration-DEFAULT hover:bg-muted disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {busy === "reject" ? (
              <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {labels.reject}
          </button>
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => {
              setBusy("approve");
              onApprove(pending.id);
            }}
            className="inline-flex items-center gap-1.5 rounded-[--radius] bg-primary px-3.5 py-2 text-sm font-semibold text-primary-foreground transition-colors duration-DEFAULT hover:bg-primary-hover active:bg-primary-active disabled:pointer-events-none disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {busy === "approve" ? (
              <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {labels.approve}
          </button>
        </div>
      </div>
    </div>
  );
}

function Cursor() {
  return (
    <span className="ml-0.5 inline-block h-3 w-1 animate-pulse bg-muted-foreground/50 align-middle" />
  );
}

export function TypingDots({ label }: { label: string }) {
  return (
    <span className="inline-flex items-center gap-1 py-2" aria-label={label}>
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="h-1.5 w-1.5 animate-dot-pulse rounded-full bg-muted-foreground/60"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}
