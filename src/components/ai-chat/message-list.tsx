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
  ArrowRight,
  ArrowsLeftRight,
  CalendarBlank,
  ClockCountdown,
  ClockCounterClockwise,
  NotePencil,
  PaperPlaneRight,
  Pause,
  Play,
  TagSimple,
  UserPlus,
  XCircle,
  ChatText,
  EnvelopeSimple,
  FileText,
  FlowArrow,
  Handshake,
  Kanban,
  Tag,
  IdentificationCard,
  UserCircle,
  ArrowClockwise,
  Funnel,
  Pulse,
  CircleNotch,
  Database,
  Hourglass,
  DeviceMobile,
  UserMinus,
  ShieldCheck,
  Key,
  IdentificationBadge,
  UserGear,
  FileCsv,
  Megaphone,
  PlayCircle,
  Files,
  UploadSimple,
  type Icon,
  ListBullets,
  ListNumbers,
  MagnifyingGlass,
  PaperPlaneTilt,
  Microphone,
  PencilSimple,
  Phone,
  PhoneCall,
  Plus,
  Queue,
  TelegramLogo,
  Sparkle,
  TrashSimple,
  Users,
  Wrench,
  Image as ImageGlyph,
  CurrencyDollar,
  Archive,
  ChartPie,
  Copy,
  Trash,
} from "@/components/icons";
import { ChatMarkdown } from "@/components/elevated-design/chat-markdown";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ModelBrandIcon } from "@/components/elevated-design/model-brand-icon";
import { EloAvatar } from "./elo-mark";
import { hasProposalPreview, ProposalPreview } from "@/components/ai-chat/proposal-preview";
import { ActionCardView } from "@/components/ai-chat/action-card";
import type { ChatChart, ChatMessage, PendingAction, ProposalStatus, SecretField } from "@/lib/aichat/types";
import {
  humanizeFieldKey,
  isOpenProposal,
  pendingFromStored,
  proposalRows,
  secretsFilled,
  secretsPayload,
  type ProposalDictionary,
} from "@/lib/aichat/proposal";
import { cn } from "@/lib/utils";

import { ChatChartView } from "./chat-chart";
import { isThinkingBetweenSteps, layoutSegments, type Block, type Segment } from "./segments";

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
  attendance_stages: Funnel,
  attendance_rework: ArrowClockwise,
  attendance_live: Pulse,
  campaign_dispatch: PaperPlaneTilt,
  conversation_insights: ChatsCircle,
  calculate: Calculator,
  query_dataset: Database,
  render_chart: ChartBar,
  search_conversations: MagnifyingGlass,
  read_conversation: ChatText,
  search_leads: UserCircle,
  get_lead: IdentificationCard,
  list_knowledge_bases: FileText,
  search_knowledge: FileText,
  list_templates: EnvelopeSimple,
  list_pipelines: Kanban,
  list_labels: Tag,
  list_calendar_events: CalendarBlank,
  list_workflows: FlowArrow,
  add_lead_memory: NotePencil,
  update_lead_memory: NotePencil,
  move_conversation_stage: ArrowRight,
  move_conversation_funnel: ArrowsLeftRight,
  apply_label: Tag,
  remove_label: TagSimple,
  create_label: Tag,
  send_message: PaperPlaneRight,
  schedule_message: ClockCountdown,
  cancel_scheduled_message: XCircle,
  send_template: EnvelopeSimple,
  list_assignable_members: Users,
  assign_conversation: UserPlus,
  transfer_conversation: ArrowsLeftRight,
  pause_workflow: Pause,
  activate_workflow: Play,
  create_calendar_event: CalendarBlank,
  create_pipeline: Kanban,
  create_stage: Plus,
  rename_stage: PencilSimple,
  reorder_stages: ListNumbers,
  set_initial_stage: ArrowRight,
  list_deal_pipelines: Kanban,
  list_deals: Handshake,
  create_deal: Handshake,
  move_deal: ArrowRight,
  link_deal: Handshake,
  list_business_phones: DeviceMobile,
  create_template: EnvelopeSimple,
  preview_campaign_import: FileCsv,
  create_campaign: Megaphone,
  start_campaign: PlayCircle,
  create_knowledge_base: Files,
  add_knowledge_document: UploadSimple,
  offer_action: ArrowRight,
  list_unofficial_numbers: DeviceMobile,
  preview_unofficial_campaign_import: FileCsv,
  create_unofficial_campaign: Megaphone,
  start_unofficial_campaign: PlayCircle,
  list_workspace_members: Users,
  list_workspace_invites: EnvelopeSimple,
  get_member_permissions: ShieldCheck,
  list_permission_catalog: ShieldCheck,
  invite_member: UserPlus,
  cancel_invite: XCircle,
  remove_member: UserMinus,
  change_member_role: UserGear,
  update_member_permissions: Key,
  list_roles: IdentificationBadge,
  create_role: IdentificationBadge,
  update_role: IdentificationBadge,
  delete_role: IdentificationBadge,
  list_department_members: Buildings,
  create_department: Buildings,
  update_department: Buildings,
  delete_department: Buildings,
  add_department_member: UserPlus,
  remove_department_member: UserMinus,
  place_call: Phone,
  list_calls: ClockCounterClockwise,
  get_call: PhoneCall,
  list_phone_lines: Phone,
  create_phone_line: Phone,
  update_phone_line: Phone,
  change_phone_line_password: Key,
  delete_phone_line: Phone,
  list_call_queues: Queue,
  create_call_queue: Queue,
  update_call_queue: Queue,
  delete_call_queue: Queue,
  list_telegram_bots: TelegramLogo,
  connect_telegram_bot: TelegramLogo,
  list_ad_accounts: Megaphone,
  ads_results: ChartBar,
  list_ad_pages: Megaphone,
  search_ad_locations: MagnifyingGlass,
  generate_ad_image: ImageGlyph,
  create_ad: Megaphone,
  turn_on_ad: Play,
  turn_off_ad: Pause,
  update_ad_budget: CurrencyDollar,
  duplicate_ad: Copy,
  archive_ad: Archive,
  delete_ad: Trash,
  ads_breakdown: ChartPie,
};

const KNOWN_TOOLS = new Set(Object.keys(TOOL_ICON));

export type { Segment };

export type UIMessage = ChatMessage & {
  segments?: Segment[];
  pending?: PendingAction | null;
};

export function hydrate(m: ChatMessage): UIMessage {
  const pending = pendingFromStored(m.proposal);
  if (!m.reasoning && !(m.tools && m.tools.length > 0)) return { ...m, pending };
  const segments: Segment[] = [];
  if (m.reasoning) segments.push({ kind: "thinking", text: m.reasoning });
  for (const tool of m.tools ?? []) {
    segments.push({ kind: "tool", name: tool.name, summary: tool.summary, ok: tool.ok });
    if (tool.chart) segments.push({ kind: "chart", chart: tool.chart });
    if (tool.card) segments.push({ kind: "card", card: tool.card });
  }
  if (m.content) segments.push({ kind: "text", text: m.content });
  return { ...m, segments, pending };
}

export interface BubbleLabels {
  thinking: string;
  thinkingLive: string;
  generatingResponse: string;
  approvalHint: string;
  approve: string;
  reject: string;
  toolFailed: string;
  toolDenied: string;
  toolLabel: (name: string) => string;
  secretLabel: (field: SecretField) => string;
  secretHint: string;
  proposal: ProposalDictionary;
  decided: Record<DecidedStatus, string>;
}

export function useBubbleLabels(): BubbleLabels {
  const t = useTranslations("aiChatPage");
  const tTools = useTranslations("aiChatPage.tools");
  const toolLabel = useCallback(
    (name: string) => (KNOWN_TOOLS.has(name) ? tTools(name) : name.replace(/_/g, " ")),
    [tTools],
  );
  const tFields = useTranslations("aiChatPage.fields");
  const fieldLabel = useCallback(
    (key: string) => (tFields.has(key) ? tFields(key) : humanizeFieldKey(key)),
    [tFields],
  );
  return {
    thinking: t("thinking"),
    thinkingLive: t("thinkingLive"),
    generatingResponse: t("generatingResponse"),
    approvalHint: t("approvalHint"),
    approve: t("approve"),
    reject: t("reject"),
    toolFailed: t("toolFailed"),
    toolDenied: t("toolDenied"),
    toolLabel,
    secretLabel: (field: SecretField) => (tFields.has(field.key) ? tFields(field.key) : field.label),
    secretHint: t("secretHint"),
    proposal: { label: fieldLabel, yes: t("yes"), no: t("no") },
    decided: { approved: t("decided.approved"), rejected: t("decided.rejected"), expired: t("decided.expired") },
  };
}

export function MessageBubble({
  elo = false,
  message,
  live,
  onApprove,
  onReject,
  labels,
}: {
  elo?: boolean;
  message: UIMessage;
  live: boolean;
  onApprove: (actionId: string, secrets?: Record<string, string>) => void;
  onReject: (actionId: string) => void;
  labels: BubbleLabels;
}) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-lg max-w-[85%] whitespace-pre-wrap break-words border border-border bg-muted px-3.5 py-2.5 text-sm leading-relaxed text-foreground">
          {message.content}
          {message.attachments && message.attachments.length > 0 ? (
            <ul className="mt-2 flex flex-wrap gap-1.5 whitespace-normal">
              {message.attachments.map((file) => (
                <li
                  key={file.mediaId}
                  className="flex max-w-full items-center gap-1.5 rounded-[--radius] border border-border bg-card px-2 py-1 text-xs"
                >
                  <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">{file.name}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>
    );
  }

  const segs = message.segments ?? [];
  const hasSegs = segs.length > 0;
  const working = live && !message.pending && isThinkingBetweenSteps(segs);

  return (
    <div className="flex gap-3">
      {elo ? <EloAvatar className="mt-0.5 h-8 w-8" /> : message.model ? (
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center ink-plate">
          <ModelBrandIcon modelId={message.model} size={15} />
        </span>
      ) : (
        <span className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center ink-plate text-muted-foreground">
          <Brain weight="fill" className="h-4 w-4" />
        </span>
      )}
      <div className="min-w-0 flex-1 space-y-2 pt-0.5">
        {elo ? <p className="text-xs font-semibold text-foreground">Elo</p> : null}
        {hasSegs ? (
          layoutSegments(segs).map((block, i) => <SegmentView key={i} seg={block} labels={labels} />)
        ) : message.content ? (
          <ChatMarkdown content={message.content} />
        ) : null}
        {working ? (
          <span role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
            <TypingDots label={labels.generatingResponse} />
            {labels.thinkingLive}
          </span>
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

function SegmentView({ seg, labels }: { seg: Block; labels: BubbleLabels }) {
  switch (seg.kind) {
    case "thinking":
      return <ThinkingBlock text={seg.text} streaming={seg.streaming} labels={labels} />;
    case "tool":
      return <ToolLine name={seg.name} summary={seg.summary} ok={seg.ok} running={seg.running} labels={labels} />;
    case "charts":
      return <ChartGrid charts={seg.charts} />;
    case "card":
      return <ActionCardView card={seg.card} live={seg.live} />;
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
  running,
  labels,
}: {
  name: string;
  summary: string;
  ok: boolean;
  running?: boolean;
  labels: BubbleLabels;
}) {
  const note = toolNote(summary, ok, labels);
  const TileIcon = TOOL_ICON[name] ?? Wrench;
  return (
    <div
      className={cn(
        "flex items-center gap-2 text-xs",
        ok ? "text-muted-foreground" : "text-destructive-ink",
      )}
    >
      {running ? (
        <CircleNotch weight="bold" className="h-3.5 w-3.5 flex-shrink-0 animate-spin motion-reduce:animate-none" aria-hidden />
      ) : (
        <TileIcon weight="bold" className="h-3.5 w-3.5 flex-shrink-0" />
      )}
      <span className={cn("flex-shrink-0", running && "text-foreground")}>{labels.toolLabel(name)}</span>
      {running ? null : note ? <span className="truncate opacity-80">· {note}</span> : null}
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
  onApprove: (actionId: string, secrets?: Record<string, string>) => void;
  onReject: (actionId: string) => void;
  labels: BubbleLabels;
}) {
  const TileIcon = TOOL_ICON[pending.toolName] ?? Wrench;
  const rows = proposalRows(pending.fields, labels.proposal);
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
          {rows.length > 0 ? (
            <dl className="mt-2 grid gap-x-3 gap-y-1.5 text-xs leading-relaxed [grid-template-columns:minmax(0,auto)_minmax(0,1fr)]">
              {rows.map((row) => (
                <div key={row.key} className="contents">
                  <dt className={cn("text-muted-foreground", row.key === "risks" && "font-semibold text-warning-ink")}>{row.label}</dt>
                  <dd className={cn("whitespace-pre-wrap break-words text-foreground", row.key === "risks" && "text-warning-ink")}>{row.value}</dd>
                </div>
              ))}
            </dl>
          ) : null}
        </div>
      </div>
      {hasProposalPreview(pending.preview) ? (
        <div className="mt-3">
          <ProposalPreview preview={pending.preview} />
        </div>
      ) : null}
      {isOpenProposal(pending) ? (
        <ApprovalActions pending={pending} onApprove={onApprove} onReject={onReject} labels={labels} />
      ) : (
        <p className="mt-3 border-t border-border pt-3 text-xs font-medium text-muted-foreground">
          {labels.decided[pending.status as DecidedStatus]}
        </p>
      )}
    </div>
  );
}

type DecidedStatus = Exclude<ProposalStatus, "pending">;

function ApprovalActions({
  pending,
  onApprove,
  onReject,
  labels,
}: {
  pending: PendingAction;
  onApprove: (actionId: string, secrets?: Record<string, string>) => void;
  onReject: (actionId: string) => void;
  labels: BubbleLabels;
}) {
  const [busy, setBusy] = useState<null | "approve" | "reject">(null);
  const [secrets, setSecrets] = useState<Record<string, string>>({});
  const asksSecrets = (pending.secrets ?? []).length > 0;
  return (
    <div className="mt-3 border-t border-border pt-3">
      {asksSecrets ? (
        <div className="mb-3 grid gap-2">
          {pending.secrets?.map((field) => (
            <ElevatedInput
              key={field.key}
              label={labels.secretLabel(field)}
              type="password"
              autoComplete="new-password"
              disabled={busy !== null}
              value={secrets[field.key] ?? ""}
              onChange={(e) => setSecrets((prev) => ({ ...prev, [field.key]: e.target.value }))}
            />
          ))}
          <p className="text-xs text-muted-foreground">{labels.secretHint}</p>
        </div>
      ) : null}
      <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
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
            disabled={busy !== null || !secretsFilled(pending.secrets, secrets)}
            onClick={() => {
              setBusy("approve");
              onApprove(pending.id, secretsPayload(pending.secrets, secrets));
              setSecrets({});
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

const STATUS_CODES = new Set(["ok", "error", "denied", "permissão negada"]);

function toolNote(summary: string, ok: boolean, labels: BubbleLabels): string | null {
  if (summary === "denied" || summary === "permissão negada") return labels.toolDenied;
  if (!ok) return labels.toolFailed;
  if (!summary || STATUS_CODES.has(summary)) return null;
  return summary;
}

function ChartGrid({ charts }: { charts: ChatChart[] }) {
  if (charts.length === 1) return <ChatChartView chart={charts[0]} />;
  return (
    <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]">
      {charts.map((chart, i) => (
        <ChatChartView key={i} chart={chart} />
      ))}
    </div>
  );
}
