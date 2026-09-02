"use client";

import { memo, useMemo, type ReactNode } from "react";
import { NodeResizer, type NodeProps } from "@xyflow/react";
import {
  ChatCircleDots,
  ChatCircle,
  Megaphone,
  Tag,
  Play,
  ClockCountdown,
  PaperPlaneTilt,
  EnvelopeSimple,
  FileText,
  Image,
  SpeakerHigh,
  Robot,
  MagnifyingGlass,
  BracketsCurly,
  TagSimple,
  X,
  Globe,
  UserCircle,
  Headset,
  Wrench,
  Timer,
  ChatTeardropDots,
  Lightning,
  Broadcast,
  GitBranch,
  Brain,
  FlagCheckered,
  Square,
  Funnel,
  CalendarBlank,
  Code,
  GitMerge,
  ArrowsClockwise,
  Clock,
  CalendarCheck,
  PhoneCall,
  PhoneDisconnect,
  WaveSquare,
  Waveform,
  Microphone,
  TextAa,
  UsersThree,
  TagChevron,
  PhoneOutgoing,
  Users,
  Hash,
  Shuffle,
  CheckCircle,
  WebhooksLogo,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import { ChannelLogo, hasChannelMark } from "@/components/icons/channel-logos";
import type {
  WorkflowNodeType,
  NodeCategory,
  HandleDefinition,
} from "@/lib/workflows/types";
import { isInteractivePromptType } from "@/lib/workflows/types";
import { cn } from "@/lib/utils";
import {
  parseInteractiveConfig,
  WhatsAppMessagePreview,
} from "./whatsapp-message-preview";
import {
  BranchRow,
  BranchRows,
  EmptyPreview,
  InteractiveNodeShell,
  type ShellBranch,
} from "./message-node-primitives";
import {
  MediaNodePreview,
  renderConditionContentPreview,
  renderMessageContentPreview,
} from "./node-previews";


const ICON_MAP: Record<string, Icon> = {
  ChatCircleDots,
  ChatCircle,
  Megaphone,
  Tag,
  Play,
  ClockCountdown,
  PaperPlaneTilt,
  EnvelopeSimple,
  FileText,
  Image,
  SpeakerHigh,
  Robot,
  MagnifyingGlass,
  BracketsCurly,
  TagSimple,
  X,
  Globe,
  UserCircle,
  Headset,
  Wrench,
  Timer,
  ChatTeardropDots,
  Lightning,
  Broadcast,
  GitBranch,
  Brain,
  FlagCheckered,
  Square,
  Funnel,
  CalendarBlank,
  Code,
  GitMerge,
  ArrowsClockwise,
  Clock,
  CalendarCheck,
  PhoneCall,
  PhoneDisconnect,
  WaveSquare,
  Waveform,
  Microphone,
  TextAa,
  UsersThree,
  TagChevron,
  PhoneOutgoing,
  Users,
  Hash,
  Shuffle,
  CheckCircle,
  Webhooks: WebhooksLogo,
};


// Each category carries ONE color: the solid tile behind the node's glyph.
// Values are the design system's PLATE tokens — the hues re-tuned so a WHITE
// glyph clears ≥3:1 in both themes — so the canvas re-palettes with the theme,
// a category reads the same here as in a glyph tile elsewhere, and no plate
// ever carries a dark icon on a dark fill. `ink` stays in the API for the
// palette/config-panel consumers; it is white across the board now.
const CATEGORY_STYLES: Record<NodeCategory, { color: string; ink: string }> = {
  trigger: { color: "hsl(var(--plate-2))", ink: "#ffffff" },
  action: { color: "hsl(var(--plate-1))", ink: "#ffffff" },
  ai: { color: "hsl(var(--plate-5))", ink: "#ffffff" },
  messaging: { color: "hsl(var(--plate-4))", ink: "#ffffff" },
  wait: { color: "hsl(var(--plate-3))", ink: "#ffffff" },
  // condition shares the blue family with messaging (info vs plate-4) and is
  // disambiguated by glyph + label, not by inventing an off-token hue.
  //
  // The two NON-plate fills take their own measured foreground instead of a
  // hardcoded white. It matters for --info: its foreground is white in light
  // but NEAR-BLACK in dark (200 10% 6%), because dark --info is a light blue —
  // so every condition node was drawing white on pale blue in dark mode.
  // --destructive-foreground happens to be white in both themes, but naming the
  // token is what stops it drifting the way --info did.
  condition: { color: "hsl(var(--info))", ink: "hsl(var(--info-foreground))" },
  logic: { color: "hsl(var(--plate-neutral))", ink: "#ffffff" },
  end: {
    color: "hsl(var(--destructive))",
    ink: "hsl(var(--destructive-foreground))",
  },
  visual: { color: "hsl(var(--plate-neutral))", ink: "#ffffff" },
};


/**
 * The mark for one handle of the channel branch node.
 *
 * Brand marks come from channel-logos, which is the one place allowed to carry
 * a network's own colours — recolouring them is banned, and they are excluded
 * from every sweep for that reason. The two handles with no network behind them
 * get a neutral glyph instead of nothing, so every row keeps the same shape and
 * the labels stay aligned down the node.
 */
function channelBranchMark(handleId: string): ReactNode {
  if (hasChannelMark(handleId)) {
    return <ChannelLogo channel={handleId} className="h-3 w-3" />;
  }
  if (handleId === "support") {
    return <Headset className="h-3 w-3 text-muted-foreground" weight="fill" />;
  }
  return <Broadcast className="h-3 w-3 text-muted-foreground" weight="fill" />;
}

function getCategory(type: WorkflowNodeType): NodeCategory {
  if (type.startsWith("trigger_")) return "trigger";
  if (type.startsWith("wait_")) return "wait";
  if (type.startsWith("condition_")) return "condition";
  if (type === "end") return "end";
  if (type === "group") return "visual";
  const logicTypes: WorkflowNodeType[] = [
    "action_loop",
    "action_code",
    "action_format_date",
    "action_get_current_time",
    "action_set_variable",
  ];
  if ((logicTypes as string[]).includes(type)) return "logic";
  const aiTypes: WorkflowNodeType[] = [
    "action_ai_agent",
    "action_ai_extract",
  ];
  if ((aiTypes as string[]).includes(type)) return "ai";
  const messagingTypes: WorkflowNodeType[] = [
    "action_send_text",
    "action_send_template",
    "action_send_email",
    "action_send_interactive",
    "action_send_whatsapp_button",
    "action_send_media",
  ];
  if ((messagingTypes as string[]).includes(type)) return "messaging";
  return "action";
}


export interface WorkflowNodeData {
  nodeType: WorkflowNodeType;
  config: Record<string, unknown>;
  label?: string;
  icon?: string;
  outputs?: HandleDefinition[];
  hasMissingRequired?: boolean;
  /** Canvas search (Ctrl+F) flags, set transiently while searching. */
  searchMatch?: boolean;
  searchDim?: boolean;
  [key: string]: unknown;
}

// The interactive prompt node's non-tap outcomes. Options (tapped buttons/rows)
// come from config; these three are the fixed catch-all branches. Handle-pad
// tones are derived from the id by branchDotClass (shared with every other node).
const INTERACTIVE_CATCH_ALLS: { id: string; label: string }[] = [
  { id: "no_match", label: "Sem correspondência" },
  { id: "no_reply", label: "Não respondeu" },
  { id: "send_failed", label: "Falha no envio" },
];

// Rich "renders like the real thing" nodes (message send / buttons) need room
// for the message preview.
const INTERACTIVE_NODE_WIDTH = 232;

// Logic / action / condition / trigger nodes are compact operation gates, they
// carry a tight summary, not a message, so they read lighter and more vertical.
const GENERIC_NODE_WIDTH = 200;

// WhatsAppInteractiveNode renders the send-buttons/list node as the message would
// actually land in WhatsApp (top), with one source handle aligned to each option
// (and each catch-all), and a compact id bar at the bottom. Handle positions are
// measured from the DOM so they track wrapping, i18n, and variable content with
// no fixed row-height assumptions.
function WhatsAppInteractiveNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const parsed = useMemo(
    () => parseInteractiveConfig(nodeData.config),
    [nodeData.config],
  );

  // Branch order matches render order: options (from config) then catch-alls.
  // Each option is required (a tapped button must route somewhere); the three
  // catch-alls are optional.
  const branches: ShellBranch[] = useMemo(
    () => [
      ...parsed.options.map((o) => ({ id: o.id, required: true })),
      ...INTERACTIVE_CATCH_ALLS.map((c) => ({ id: c.id })),
    ],
    [parsed.options],
  );

  const flashAt =
    typeof nodeData._flashAt === "number" ? nodeData._flashAt : null;

  return (
    <InteractiveNodeShell
      id={id}
      label={nodeData.label ?? "Enviar Botões ou Lista"}
      icon={ICON_MAP[nodeData.icon ?? "PaperPlaneTilt"] ?? PaperPlaneTilt}
      iconColor={CATEGORY_STYLES.messaging.color}
      width={INTERACTIVE_NODE_WIDTH}
      branches={branches}
      selected={selected}
      flashAt={flashAt}
      hasMissingRequired={Boolean(nodeData.hasMissingRequired)}
      isSimulating={Boolean(nodeData.isSimulating)}
      searchMatch={Boolean(nodeData.searchMatch)}
      searchDim={Boolean(nodeData.searchDim)}
    >
      {({ registerRow }) => (
        <>
          {/* FULL WhatsApp render (top); each option row owns a handle. */}
          <WhatsAppMessagePreview parsed={parsed} rowRef={registerRow} />

          {/* Workflow-only branches (not part of the message). */}
          <BranchRows hasContentAbove>
            {INTERACTIVE_CATCH_ALLS.map((ca) => (
              <BranchRow
                key={ca.id}
                id={ca.id}
                label={ca.label}
                registerRow={registerRow}
              />
            ))}
          </BranchRows>
        </>
      )}
    </InteractiveNodeShell>
  );
}

// Message-sending nodes reuse the SAME shell as the buttons/list node: WhatsApp
// (or channel) render on top, a single output handle, and the id bar on the
// bottom, the whole point of InteractiveNodeShell. Their per-node top content
// lives in node-previews/.
const MESSAGE_NODE_TYPES = new Set<WorkflowNodeType>([
  "action_send_text",
  "action_send_email",
  "action_send_template",
  "action_send_media",
]);

function MessageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const flashAt =
    typeof nodeData._flashAt === "number" ? nodeData._flashAt : null;
  const content = renderMessageContentPreview(
    nodeData.nodeType,
    nodeData.config,
  );
  return (
    <InteractiveNodeShell
      id={id}
      label={nodeData.label ?? nodeData.nodeType}
      icon={ICON_MAP[nodeData.icon ?? "PaperPlaneTilt"] ?? PaperPlaneTilt}
      iconColor={CATEGORY_STYLES.messaging.color}
      width={INTERACTIVE_NODE_WIDTH}
      branches={[]}
      selected={selected}
      flashAt={flashAt}
      hasMissingRequired={Boolean(nodeData.hasMissingRequired)}
      isSimulating={Boolean(nodeData.isSimulating)}
      searchMatch={Boolean(nodeData.searchMatch)}
      searchDim={Boolean(nodeData.searchDim)}
    >
      {() => content}
    </InteractiveNodeShell>
  );
}

// WorkflowNodeComponent is a pure dispatcher (no hooks) so it can pick a shell by
// node kind without violating rules-of-hooks. Each shell calls its own hooks
// unconditionally. A node's type never changes for a given instance.
function WorkflowNodeComponent(props: NodeProps) {
  const nodeType = (props.data as unknown as WorkflowNodeData)?.nodeType;
  if (isInteractivePromptType(nodeType)) {
    return <WhatsAppInteractiveNode {...props} />;
  }
  if (nodeType && MESSAGE_NODE_TYPES.has(nodeType)) {
    return <MessageNode {...props} />;
  }
  return <GenericWorkflowNode {...props} />;
}

function GenericWorkflowNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const nodeType = nodeData.nodeType;
  const category = getCategory(nodeType);
  const styles = CATEGORY_STYLES[category];
  const IconComp = ICON_MAP[nodeData.icon ?? "GitBranch"] ?? GitBranch;
  const label = nodeData.label ?? nodeType;
  const isTrigger = category === "trigger";
  const isEnd = category === "end";

  // Multi-output nodes (text_match cases, ai_agent tools, condition branches …)
  // expose one branch per output id; the shell measures each row and aligns a
  // handle to it (robust to wrapping, unlike a fixed row height). Single-output
  // nodes get one default handle.
  const visibleOutputs = (nodeData.outputs ?? []).filter((o) => o.id);
  const hasMultipleOutputs = visibleOutputs.length >= 1;
  const branches: ShellBranch[] = hasMultipleOutputs
    ? visibleOutputs.map((o) => ({ id: o.id, required: !o.optional }))
    : [];

  const appearSeq =
    typeof nodeData._appearSeq === "number" ? nodeData._appearSeq : null;
  const flashAt =
    typeof nodeData._flashAt === "number" ? nodeData._flashAt : null;

  // Only wrap real content, a node with no preview (e.g. transfer_department)
  // must not render an empty padded div, which would leave a phantom top gap.
  const content = renderNodeContent(nodeType, nodeData.config);

  return (
    <InteractiveNodeShell
      id={id}
      label={label}
      icon={IconComp}
      iconColor={styles.color}
      iconInk={styles.ink}
      width={GENERIC_NODE_WIDTH}
      branches={branches}
      selected={selected}
      appearSeq={appearSeq}
      flashAt={flashAt}
      hasMissingRequired={Boolean(nodeData.hasMissingRequired)}
      isSimulating={Boolean(nodeData.isSimulating)}
      searchMatch={Boolean(nodeData.searchMatch)}
      searchDim={Boolean(nodeData.searchDim)}
      hideInputHandle={isTrigger}
      hideOutputHandle={isEnd}
    >
      {({ registerRow }) => (
        <>
          {content != null && <div className="px-2.5 py-2">{content}</div>}

          {hasMultipleOutputs && (
            <BranchRows hasContentAbove={content != null}>
              {visibleOutputs.map((output) => (
                <BranchRow
                  key={output.id}
                  id={output.id}
                  label={output.label}
                  icon={
                    nodeType === "condition_channel"
                      ? channelBranchMark(output.id)
                      : undefined
                  }
                  registerRow={registerRow}
                />
              ))}
            </BranchRows>
          )}
        </>
      )}
    </InteractiveNodeShell>
  );
}


function PreviewIcon({
  icon: IconEl,
  gradient,
}: {
  icon: Icon;
  gradient: string;
}) {
  return (
    <div
      className={cn(
        "flex h-5 w-5 shrink-0 items-center justify-center rounded",
        gradient,
      )}
    >
      <IconEl size={11} weight="fill" />
    </div>
  );
}

// renderNodeContent returns the content preview for a node, or null when the
// node has none (so the caller can skip the padded wrapper and avoid an empty
// gap). It is a plain function, not a component, it uses no hooks.
function renderNodeContent(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode {
  if (!config) return null;

  // Condition/branch nodes render a distinct DecisionBlock (see node-previews/).
  const conditionPreview = renderConditionContentPreview(nodeType, config);
  if (conditionPreview !== undefined) return conditionPreview;

  switch (nodeType) {
    case "trigger_first_message":
      return (
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <PreviewIcon
            icon={Lightning}
            gradient="tile-2"
          />
          <span>Primeira mensagem do contato</span>
        </div>
      );
    case "trigger_message_received":
      return (
        <div className="flex items-center gap-2 text-2xs text-muted-foreground">
          <PreviewIcon
            icon={ChatCircleDots}
            gradient="tile-2"
          />
          <span>Qualquer mensagem recebida</span>
        </div>
      );

    // The message-sending nodes (send_text/sms/email/template/media) and
    // action_send_whatsapp_button are handled before this switch (via
    // renderMessageContentPreview and the WhatsAppInteractiveNode shell).

    case "action_ai_agent": {
      const agentName =
        (config._display_agent_id as string) ||
        (config.agent_name as string) ||
        (config.agent_id as string);
      const source = config.source as string;
      const toolMode = (config.tool_mode as string) || "route";
      const tools = (config.custom_tools as Array<{ name: string }>) ?? [];
      const hasTools = tools.filter((t) => t.name).length > 0;

      const toolModeBadge =
        hasTools && toolMode === "execute" ? (
          <div className="flex items-center gap-1.5 rounded-md bg-muted px-1.5 py-0.5 mt-1">
            <ArrowsClockwise
              size={10}
              weight="bold"
              className="text-primary-ink shrink-0"
            />
            <span className="text-2xs font-semibold text-primary-ink">
              Execução inline
            </span>
          </div>
        ) : null;

      if (source === "prompt") {
        const model = config.model as string;
        const instructions = (config.instructions as string) || "";
        const instructionsPreview = instructions.trim();
        return (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <PreviewIcon
                icon={Robot}
                gradient="tile-4"
              />
              <span className="text-2xs text-foreground/70 truncate">
                {model || "Modelo IA"}
              </span>
            </div>
            {instructionsPreview ? (
              <p className="text-2xs text-muted-foreground leading-relaxed line-clamp-2">
                {instructionsPreview.slice(0, 120)}
                {instructionsPreview.length > 120 ? "…" : ""}
              </p>
            ) : null}
            {toolModeBadge}
          </div>
        );
      }
      if (!agentName) return <EmptyPreview label="Nenhum agente" />;
      return (
        <div className="space-y-1">
          <div className="flex items-center gap-2 rounded-lg bg-muted px-2.5 py-1.5">
            <PreviewIcon
              icon={Robot}
              gradient="tile-4"
            />
            <span className="text-2xs font-medium text-foreground/70 truncate">
              {agentName}
            </span>
          </div>
          {toolModeBadge}
        </div>
      );
    }

    case "action_set_variable": {
      const variable = config.variable as string;
      const val = config.value as string;
      if (!variable) return <EmptyPreview label="Nenhuma variável" />;
      return (
        <div className="rounded-lg bg-muted px-2.5 py-1.5">
          <code className="text-2xs text-foreground/70">
            {variable} = {val ?? ""}
          </code>
        </div>
      );
    }

    case "action_http_request": {
      const method = (config.method as string) || "GET";
      const url = config.url as string;
      const captureVariable = (config.capture_variable as string) || "";
      if (!url) return <EmptyPreview label="Nenhuma URL" />;
      return (
        <div className="min-w-0 rounded-lg bg-muted px-2.5 py-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-2xs font-semibold tracking-[0.18em] text-muted-foreground">
              {method}
            </span>
            <code className="min-w-0 flex-1 truncate text-2xs text-foreground/60">
              {url}
            </code>
          </div>
          {captureVariable ? (
            <div className="mt-1 flex items-center gap-1 text-2xs text-muted-foreground min-w-0">
              <span className="shrink-0">captura</span>
              <code className="min-w-0 truncate">{`{{${captureVariable}}}`}</code>
            </div>
          ) : null}
        </div>
      );
    }

    case "wait_duration": {
      const sec =
        (config.seconds as number) || ((config.minutes as number) || 0) * 60;
      if (!sec) return <EmptyPreview label="Sem duração" />;
      const display =
        sec >= 3600
          ? `${Math.floor(sec / 3600)}h ${Math.floor((sec % 3600) / 60)}m`
          : sec >= 60
            ? `${Math.floor(sec / 60)}m ${sec % 60}s`
            : `${sec}s`;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon icon={Timer} gradient="tile-3" />
          <span className="text-2xs font-medium text-foreground/70">
            {display}
          </span>
        </div>
      );
    }

    case "wait_for_reply": {
      const timeout =
        (config.timeout_seconds as number) ||
        ((config.timeout_minutes as number) || 0) * 60;
      const timeDisplay = timeout
        ? timeout >= 3600
          ? `${Math.floor(timeout / 3600)}h ${Math.floor((timeout % 3600) / 60)}m`
          : timeout >= 60
            ? `${Math.floor(timeout / 60)}min`
            : `${timeout}s`
        : null;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon
            icon={ChatTeardropDots}
            gradient="tile-3"
          />
          <span className="text-2xs text-foreground/70">
            {timeDisplay ? `Tempo limite: ${timeDisplay}` : "Aguardar resposta"}
          </span>
        </div>
      );
    }

    case "wait_for_event": {
      const event = config.event as string;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon
            icon={Lightning}
            gradient="tile-3"
          />
          <span className="text-2xs text-foreground/70">
            {event || "Aguardar evento"}
          </span>
        </div>
      );
    }




    case "end":
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon
            icon={FlagCheckered}
            gradient="tile-5"
          />
          <span className="text-2xs text-muted-foreground">
            Fim do fluxo
          </span>
        </div>
      );

    case "action_format_date": {
      const input = config.input as string;
      const format = config.format as string;
      const operation = config.operation as string;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon
            icon={CalendarBlank}
            gradient="tile-1"
          />
          <span className="text-2xs text-foreground/70 truncate">
            {input || "now"} → {format || "YYYY-MM-DD"}
            {operation && operation !== "none" ? ` (${operation})` : ""}
          </span>
        </div>
      );
    }

    case "action_code": {
      const code = (config.code as string) || "";
      const trimmed = code.trim();
      if (!trimmed) return <EmptyPreview label="Nenhum código" />;
      const lines = trimmed.split("\n").length;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon icon={Code} gradient="tile-1" />
          <span className="text-2xs text-foreground/70">
            JavaScript · {lines} linha{lines > 1 ? "s" : ""}
          </span>
        </div>
      );
    }

    case "action_run_workflow": {
      const wfId = config.workflow_id as string;
      const wfName = config._display_workflow_id as string;
      if (!wfId) return <EmptyPreview label="Nenhum fluxo" />;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon icon={GitMerge} gradient="tile-1" />
          <span className="text-2xs text-foreground/70 truncate">
            {wfName || "Sub-fluxo"}
          </span>
        </div>
      );
    }

    case "action_loop": {
      const listVar = config.list_variable as string;
      const itemVar = config.item_variable as string;
      if (!listVar) return <EmptyPreview label="Nenhuma lista" />;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon
            icon={ArrowsClockwise}
            gradient="tile-1"
          />
          <span className="text-2xs text-foreground/70 truncate">
            {listVar} → {itemVar || "item"}
          </span>
        </div>
      );
    }

    case "action_get_current_time": {
      const tz = config.timezone as string;
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon icon={Clock} gradient="tile-1" />
          <span className="text-2xs text-foreground/70">{tz || "UTC"}</span>
        </div>
      );
    }

    case "wait_schedule": {
      const mode = config.mode as string;
      const time = config.time as string;
      const date = config.date as string;
      const label =
        mode === "datetime"
          ? `${date || "?"} ${time || ""}`
          : mode === "next_weekday"
            ? `${config.weekday || "?"} ${time || ""}`
            : time || "?";
      return (
        <div className="flex items-center gap-2">
          <PreviewIcon
            icon={CalendarCheck}
            gradient="tile-3"
          />
          <span className="text-2xs text-foreground/70 truncate">
            {label}
          </span>
        </div>
      );
    }

    default:
      return null;
  }
}

export const WorkflowNode = memo(WorkflowNodeComponent);


const BORDER_STYLE_MAP: Record<string, string> = {
  solid: "border-solid",
  dashed: "border-dashed",
  dotted: "border-dotted",
  double: "border-double",
  none: "border-none",
};

const GROUP_BG_COLORS: Record<string, string> = {
  gray: "bg-muted/50",
  blue: "bg-muted",
  green: "bg-muted",
  yellow: "bg-warning/40 dark:bg-muted",
  red: "bg-muted",
  purple: "bg-muted dark:bg-chart-4/15",
  transparent: "bg-transparent",
};

const GROUP_BG_COLORS_SOLID: Record<string, string> = {
  gray: "bg-muted",
  blue: "bg-muted dark:bg-info",
  green: "bg-muted dark:bg-healthy",
  yellow: "bg-muted dark:bg-warning",
  red: "bg-muted dark:bg-destructive",
  purple: "bg-muted dark:bg-chart-4",
  transparent: "bg-transparent",
};

const GROUP_BORDER_COLORS: Record<string, string> = {
  gray: "border-border-strong",
  blue: "border-info/30",
  green: "border-healthy/30",
  yellow: "border-warning/30",
  red: "border-destructive/30",
  purple: "border-chart-4/30 dark:border-chart-4",
  transparent: "border-border/50",
};

export interface GroupNodeData {
  nodeType: "group";
  config: Record<string, unknown>;
  label?: string;
  [key: string]: unknown;
}

function GroupNodeComponent({ data, selected }: NodeProps) {
  const d = data as unknown as GroupNodeData;
  const config = d.config ?? {};
  const label = (config.display_name as string) || d.label || "";
  const borderStyle = (config.border_style as string) || "dashed";
  const color = (config.color as string) || "gray";
  const solidBg = config.solid_bg === true;
  const borderWidth = (config.border_width as number) || 2;

  const borderCls = BORDER_STYLE_MAP[borderStyle] ?? "border-dashed";
  const bgMap = solidBg ? GROUP_BG_COLORS_SOLID : GROUP_BG_COLORS;
  const bgCls = bgMap[color] ?? bgMap.gray;
  const borderColorCls = GROUP_BORDER_COLORS[color] ?? GROUP_BORDER_COLORS.gray;

  return (
    <div
      className={cn(
        "rounded-xl transition-all w-full h-full min-w-[200px] min-h-[100px]",
        bgCls,
        borderColorCls,
        borderCls,
        selected && "ring-2 ring-primary ring-offset-1 ring-offset-background",
      )}
      style={{ borderWidth: `${borderWidth}px` }}
    >
      <NodeResizer
        isVisible={selected}
        minWidth={150}
        minHeight={80}
        lineClassName="!border-primary/40"
        handleClassName="!w-2.5 !h-2.5 !bg-primary !border !border-background !rounded-sm"
      />
      {label && (
        <div className="px-3 py-1.5">
          <span className="text-2xs font-semibold text-muted-foreground">
            {label}
          </span>
        </div>
      )}
    </div>
  );
}

export const GroupNode = memo(GroupNodeComponent);

export { getCategory, CATEGORY_STYLES, ICON_MAP };
