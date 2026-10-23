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
  Table,
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
  Kanban,
  PhoneOutgoing,
  Users,
  Hash,
  Shuffle,
  CheckCircle,
  CurrencyDollar,
  WebhooksLogo,
  Shield,
  ShieldCheck,
  ArrowBendUpLeft,
  ClipboardText,
  Storefront,
  ChatText,
} from "@/components/icons";
import type { Icon } from "@/components/icons";
import { ChannelLogo, hasChannelMark } from "@/components/icons/channel-logos";
import type {
  WorkflowNodeType,
  NodeCategory,
  HandleDefinition,
} from "@/lib/workflows/types";
import { isInteractivePromptType } from "@/lib/workflows/types";
import type { NodePin } from "@/lib/workflows/node-pin";
import type { TriggerTestInput } from "@/lib/workflows/test-inputs";
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
  MessageMediaGlance,
  type ShellBranch,
} from "./message-node-primitives";
import { MESSAGE_NODE_TYPES } from "./canvas-detail";
import { renderActionContentPreview, renderConditionContentPreview, renderMessageContentPreview, renderMessageGlance } from "./node-previews";
import { agentNameOf, nodeSummary } from "./node-previews/node-summary";
import { TriggerEntryMark } from "./trigger-entry-mark";
import { sendsChoices } from "./choice-stats-store";
import { NodeOptionCtr } from "./node-choice-stats";


const ICON_MAP: Record<string, Icon> = {
  Table,
  ClipboardText,
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
  Kanban,
  PhoneOutgoing,
  Users,
  Hash,
  Shuffle,
  CheckCircle,
  CurrencyDollar,
  Webhooks: WebhooksLogo,
  ShieldCheck,
  SealQuestion: Shield,
  ArrowBendUpLeft,
  Storefront,
  ChatText,
};

function nodeIconOf(name: string | undefined, fallback: Icon = PaperPlaneTilt): Icon {
  return (name ? ICON_MAP[name] : undefined) ?? fallback;
}


const CATEGORY_STYLES: Record<NodeCategory, { color: string; ink: string }> = {
  trigger: { color: "hsl(var(--plate-2))", ink: "#ffffff" },
  action: { color: "hsl(var(--plate-1))", ink: "#ffffff" },
  ai: { color: "hsl(var(--plate-5))", ink: "#ffffff" },
  messaging: { color: "hsl(var(--plate-4))", ink: "#ffffff" },
  wait: { color: "hsl(var(--plate-3))", ink: "#ffffff" },
  condition: { color: "hsl(var(--info))", ink: "hsl(var(--info-foreground))" },
  logic: { color: "hsl(var(--plate-neutral))", ink: "#ffffff" },
  end: {
    color: "hsl(var(--destructive))",
    ink: "hsl(var(--destructive-foreground))",
  },
  visual: { color: "hsl(var(--plate-neutral))", ink: "#ffffff" },
};


function channelBranchMark(handleId: string): ReactNode {
  if (hasChannelMark(handleId)) {
    return <ChannelLogo channel={handleId} className="h-3 w-3" />;
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
    "action_send_form",
    "action_send_carrier",
    "action_send_platform_email",
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
  searchMatch?: boolean;
  searchDim?: boolean;
  pinned?: NodePin;
  testInputs?: TriggerTestInput[];
  [key: string]: unknown;
}

const INTERACTIVE_NODE_WIDTH = 232;

const GENERIC_NODE_WIDTH = 200;

function WhatsAppInteractiveNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const outputs = useMemo(() => (nodeData.outputs ?? []).filter((o) => o.id), [nodeData.outputs]);
  const parsed = useMemo(
    () => parseInteractiveConfig(nodeData.config, outputs),
    [nodeData.config, outputs],
  );
  const branches: ShellBranch[] = useMemo(
    () => outputs.map((o) => ({ id: o.id, required: !o.optional, label: o.label })),
    [outputs],
  );
  const catchAlls = useMemo(() => outputs.filter((o) => o.optional), [outputs]);

  const flashAt =
    typeof nodeData._flashAt === "number" ? nodeData._flashAt : null;
  const headerImage =
    parsed.headerType === "image" ? parsed.headerMediaUrl.trim() : "";
  const summary = useMemo(
    () => nodeSummary(nodeData.nodeType, nodeData.config),
    [nodeData.nodeType, nodeData.config],
  );

  return (
    <InteractiveNodeShell
      id={id}
      label={nodeData.label ?? "Enviar Botões ou Lista"}
      glance={headerImage ? <MessageMediaGlance url={headerImage} /> : undefined}
      summary={summary}
      icon={nodeIconOf(nodeData.icon)}
      iconColor={CATEGORY_STYLES.messaging.color}
      width={INTERACTIVE_NODE_WIDTH}
      branches={branches}
      selected={selected}
      flashAt={flashAt}
      hasMissingRequired={Boolean(nodeData.hasMissingRequired)}
      isSimulating={Boolean(nodeData.isSimulating)}
      pinned={Boolean(nodeData.pinned)}
      searchMatch={Boolean(nodeData.searchMatch)}
      searchDim={Boolean(nodeData.searchDim)}
      choiceNode
    >
      {({ registerRow, choice }) => (
        <>
          {}
          <WhatsAppMessagePreview
            parsed={parsed}
            rowRef={registerRow}
            optionStat={choice?.kind === "stats" ? (optionId) => <NodeOptionCtr view={choice} optionId={optionId} /> : undefined}
          />

          {}
          <BranchRows hasContentAbove>
            {catchAlls.map((ca) => (
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

function MessageNode({ id, data, selected }: NodeProps) {
  const nodeData = data as unknown as WorkflowNodeData;
  const flashAt =
    typeof nodeData._flashAt === "number" ? nodeData._flashAt : null;
  const content = renderMessageContentPreview(
    nodeData.nodeType,
    nodeData.config,
  );
  const glance = renderMessageGlance(nodeData.nodeType, nodeData.config);
  const summary = useMemo(
    () => nodeSummary(nodeData.nodeType, nodeData.config),
    [nodeData.nodeType, nodeData.config],
  );
  return (
    <InteractiveNodeShell
      id={id}
      label={nodeData.label ?? nodeData.nodeType}
      icon={nodeIconOf(nodeData.icon)}
      iconColor={CATEGORY_STYLES.messaging.color}
      width={INTERACTIVE_NODE_WIDTH}
      branches={[]}
      selected={selected}
      flashAt={flashAt}
      hasMissingRequired={Boolean(nodeData.hasMissingRequired)}
      isSimulating={Boolean(nodeData.isSimulating)}
      pinned={Boolean(nodeData.pinned)}
      searchMatch={Boolean(nodeData.searchMatch)}
      searchDim={Boolean(nodeData.searchDim)}
      glance={glance}
      summary={summary}
      choiceNode={sendsChoices(nodeData.nodeType)}
    >
      {() => content}
    </InteractiveNodeShell>
  );
}

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
  const IconComp = nodeIconOf(nodeData.icon, GitBranch);
  const label = nodeData.label ?? nodeType;
  const isTrigger = category === "trigger";
  const isEnd = category === "end";

  const visibleOutputs = (nodeData.outputs ?? []).filter((o) => o.id);
  const hasMultipleOutputs = visibleOutputs.length >= 1;
  const branches: ShellBranch[] = hasMultipleOutputs
    ? visibleOutputs.map((o) => ({ id: o.id, required: !o.optional, label: o.label }))
    : [];

  const appearSeq =
    typeof nodeData._appearSeq === "number" ? nodeData._appearSeq : null;
  const flashAt =
    typeof nodeData._flashAt === "number" ? nodeData._flashAt : null;

  const content = renderNodeContent(nodeType, nodeData.config);
  const summary = useMemo(
    () => nodeSummary(nodeType, nodeData.config),
    [nodeType, nodeData.config],
  );

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
      pinned={Boolean(nodeData.pinned)}
      searchMatch={Boolean(nodeData.searchMatch)}
      searchDim={Boolean(nodeData.searchDim)}
      hideInputHandle={isTrigger}
      hideOutputHandle={isEnd}
      summary={summary}
    >
      {({ registerRow }) => (
        <>
          {content != null && <div className="px-2.5 py-2">{content}</div>}

          {isTrigger && <TriggerEntryMark nodeId={id} />}

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

function renderNodeContent(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode {
  if (!config) return null;

  const conditionPreview = renderConditionContentPreview(nodeType, config);
  if (conditionPreview !== undefined) return conditionPreview;

  const actionPreview = renderActionContentPreview(nodeType, config);
  if (actionPreview !== undefined) return actionPreview;

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


    case "action_ai_agent": {
      const agentName = agentNameOf(config);
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

interface GroupNodeData {
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
        "rounded-xl transition-[background-color,border-color,box-shadow] w-full h-full min-w-[200px] min-h-[100px]",
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

export { getCategory, CATEGORY_STYLES, ICON_MAP, nodeIconOf };
