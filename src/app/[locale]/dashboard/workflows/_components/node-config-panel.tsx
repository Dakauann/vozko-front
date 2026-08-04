"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import type { Node, Edge } from "@xyflow/react";
import { useTranslations } from "next-intl";
import {
  X,
  Plus,
  Trash,
  CaretDown,
  CaretRight,
  Copy,
  Info,
  UploadSimple,
  Image as ImageIcon,
  VideoCamera,
  SpeakerHigh,
  File as FileIcon,
  Wrench,
  Check,
  ArrowRight,
  Play,
  Pause,
} from "@/components/icons";
import ElevatedButton from "@/components/elevated-design/button";
import {
  ChannelReachLegend,
  DescriptionReachNote,
  OptionChannelReach,
} from "./option-channel-reach";
import {
  authorableOptionCount,
  type PromptStyle,
} from "@/lib/workflows/interactive-reach";
import {
  isInteractivePromptType,
  type ChannelInteractiveLimits,
} from "@/lib/workflows/types";
import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import { Slider } from "@/components/ui/slider";
import { TestNodeSection } from "./test-node-section";
import { WebhookTriggerConfig } from "./webhook-trigger-config";
import { VariableCommandInput } from "./variable-command-input";
import { CodeField } from "./code-field";
import {
  ICON_MAP,
  CATEGORY_STYLES,
  getCategory,
  type WorkflowNodeData,
} from "./workflow-node";
import type {
  WorkflowNodeType,
  NodeDefinition,
  ConfigField,
  ConfigFieldOption,
} from "@/lib/workflows/types";
import { cn } from "@/lib/utils";
import { listAgentsAction, getAgentOptionsAction } from "@/app/actions/agents";
import {
  getBusinessPhoneByIdAction,
  listBusinessPhonesAction,
} from "@/app/actions/whatsapp-business-phones";
import {
  listWhatsAppTemplatesAction,
  getWhatsAppTemplateByIdAction,
} from "@/app/actions/whatsapp-templates";
import {
  listMediasAction,
  getMediaAction,
  uploadMediaAction,
} from "@/app/actions/medias";
import { listWorkflowsAction } from "@/app/actions/workflows";
import { listKnowledgeBasesAction } from "@/app/actions/knowledge-bases";
import { listLabelsAction } from "@/app/actions/labels";
import { listMembersAction } from "@/app/actions/workspace";
import { fetchDepartments } from "@/lib/department/client";
import { fetchGoogleConnection } from "@/lib/calendar/client";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { useAgentRequiredVariables } from "@/lib/agents/use-agent-required-variables";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import type { Media } from "@/lib/medias/types";
import type { WorkspaceMember } from "@/lib/workspace/types";

const PAGINATED_OPTION_SOURCES = new Set([
  "agents",
  "business_phones",
  "whatsapp_templates",
  "workflows",
  "knowledge_bases",
] as const);

type PaginatedOptionSource =
  | "agents"
  | "business_phones"
  | "whatsapp_templates"
  | "workflows"
  | "knowledge_bases";

function isPaginatedOptionSource(
  source?: string,
): source is PaginatedOptionSource {
  return Boolean(
    source && PAGINATED_OPTION_SOURCES.has(source as PaginatedOptionSource),
  );
}

function mergeCommandOptions(
  selectedOption: ElevatedCommandOption | null,
  options: ElevatedCommandOption[],
) {
  if (!selectedOption) {
    return options;
  }

  return options.some((option) => option.value === selectedOption.value)
    ? options
    : [selectedOption, ...options];
}

function upsertById<T extends { id: string }>(current: T[], incoming: T[]) {
  if (incoming.length === 0) {
    return current;
  }

  const next = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    next.set(item.id, item);
  });
  return Array.from(next.values());
}

function getSourceSearchPlaceholder(
  source: string | undefined,
  nc: (key: string) => string,
) {
  switch (source) {
    case "agents":
      return nc("searchAgent");
    case "business_phones":
      return nc("searchWhatsApp");
    case "whatsapp_templates":
      return nc("searchTemplate");
    case "workflows":
      return nc("searchWorkflow");
    default:
      return nc("search");
  }
}

function getSourceEmptyMessage(source?: string) {
  switch (source) {
    case "agents":
      return "Nenhum agente encontrado";
    case "business_phones":
      return "Nenhum número encontrado";
    case "whatsapp_templates":
      return "Nenhum template encontrado";
    case "workflows":
      return "Nenhum workflow encontrado";
    default:
      return "Nenhuma opção encontrada";
  }
}

interface NodeConfigPanelProps {
  node: Node;
  workflowId?: string | null;
  workspaceId?: string | null;
  isWorkflowDirty?: boolean;
  definitions: NodeDefinition[];
  allNodes: Node[];
  allEdges: Edge[];
  onClose: () => void;
  onConfigChange: (nodeId: string, config: Record<string, unknown>) => void;
  /** Rename the node's structural id; returns an error string or null on success. */
  onRenameNode?: (oldId: string, newId: string) => string | null;
}

export function NodeConfigPanel({
  node,
  workflowId,
  workspaceId,
  isWorkflowDirty = false,
  definitions,
  allNodes,
  allEdges,
  onClose,
  onConfigChange,
  onRenameNode,
}: NodeConfigPanelProps) {
  const t = useTranslations("workflowsPage");
  const nc = useTranslations("workflows.nodeConfig");
  const data = node.data as unknown as WorkflowNodeData;
  const nodeType = data.nodeType as WorkflowNodeType;
  const category = getCategory(nodeType);
  const styles = CATEGORY_STYLES[category];

  const def = definitions.find((d) => d.type === nodeType);
  const iconName = def?.icon ?? data.icon ?? "GitBranch";
  const IconComp = ICON_MAP[iconName];
  const schema = def?.configSchema ?? [];
  const config = data.config ?? {};
  const displayName = (config.display_name as string) || "";
  const label = displayName || (def?.label ?? data.label ?? nodeType);
  const isScheduleMeetingNode = nodeType === "action_schedule_meeting";
  const isRescheduleMeetingNode = nodeType === "action_reschedule_meeting";
  const isCalendarNode =
    isScheduleMeetingNode ||
    isRescheduleMeetingNode ||
    nodeType === "action_check_calendar_availability";
  const isTestableNode =
    !nodeType.startsWith("trigger_") &&
    nodeType !== "end" &&
    nodeType !== "group" &&
    nodeType !== "decoration_background";
  const isWebhookTriggerNode = nodeType === "trigger_webhook";
  const isHTTPRequestNode = nodeType === "action_http_request";
  const isSendTemplateNode = nodeType === "action_send_template";
  const isInteractivePromptNode = isInteractivePromptType(nodeType);

  // The option limits of every connected channel, published to the option
  // editors below. Empty for every other node type, which makes the reach
  // annotations disappear rather than needing a per-field guard.
  const interactiveReach = useMemo(
    () => ({
      style: ((config.interactive_type as string) === "list"
        ? "list"
        : "buttons") as PromptStyle,
      channelLimits: isInteractivePromptNode
        ? (def?.channelLimits ?? {})
        : {},
    }),
    [config.interactive_type, def?.channelLimits, isInteractivePromptNode],
  );

  const MIN_PANEL_WIDTH = 380;
  const DEFAULT_PANEL_WIDTH = 440;
  const WIDE_PANEL_WIDTH = 760;
  const isCodeNode = nodeType === "action_code";
  const [panelWidth, setPanelWidth] = useState(
    isCodeNode ? WIDE_PANEL_WIDTH : DEFAULT_PANEL_WIDTH,
  );
  useEffect(() => {
    if (isCodeNode) {
      setPanelWidth((current) =>
        current < WIDE_PANEL_WIDTH ? WIDE_PANEL_WIDTH : current,
      );
    }
  }, [isCodeNode, node.id]);
  const isResizingRef = useRef(false);
  const startXRef = useRef(0);
  const startWidthRef = useRef(DEFAULT_PANEL_WIDTH);
  const isWidePanel = panelWidth >= 560;
  const isExtraWidePanel = panelWidth >= 920;

  const handleResizeStart = useCallback(
    (e: ReactMouseEvent<HTMLDivElement>) => {
      e.preventDefault();
      isResizingRef.current = true;
      startXRef.current = e.clientX;
      startWidthRef.current = panelWidth;
      document.body.style.cursor = "ew-resize";
      document.body.style.userSelect = "none";

      const handleMouseMove = (moveEvent: MouseEvent) => {
        if (!isResizingRef.current) return;
        const delta = startXRef.current - moveEvent.clientX;
        const newWidth = Math.max(
          MIN_PANEL_WIDTH,
          startWidthRef.current + delta,
        );
        setPanelWidth(newWidth);
      };

      const handleMouseUp = () => {
        isResizingRef.current = false;
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [panelWidth],
  );

  const [googleCalendarStatus, setGoogleCalendarStatus] = useState<{
    loading: boolean;
    connected: boolean;
    email?: string;
    error?: string;
  }>({ loading: false, connected: false });

  const updateField = (
    key: string,
    value: unknown,
    extra?: Record<string, unknown>,
  ) => {
    onConfigChange(node.id, { ...config, [key]: value, ...extra });
  };

  const [selectedTemplate, setSelectedTemplate] =
    useState<WhatsAppTemplate | null>(null);
  const [templateLoading, setTemplateLoading] = useState(false);

  const templateIdField = schema.find(
    (f) => f.optionsSource === "whatsapp_templates",
  );
  const currentTemplateId = templateIdField
    ? ((config[templateIdField.key] as string) ?? "")
    : "";

  const fetchTemplate = useCallback(async (id: string) => {
    setTemplateLoading(true);
    try {
      const res = await getWhatsAppTemplateByIdAction(id);
      setSelectedTemplate(res.template ?? null);
    } finally {
      setTemplateLoading(false);
    }
  }, []);

  const prevTemplateId = useMemo(() => currentTemplateId, [currentTemplateId]);

  useEffect(() => {
    if (!prevTemplateId) {
      setSelectedTemplate(null);
      return;
    }
    fetchTemplate(prevTemplateId);
  }, [prevTemplateId, fetchTemplate]);

  const templateParams = useMemo(
    () => extractTemplateParams(currentTemplateId ? selectedTemplate : null),
    [selectedTemplate, currentTemplateId],
  );

  const [selectedMedia, setSelectedMedia] = useState<Media | null>(null);
  const [mediaLoading, setMediaLoading] = useState(false);

  const mediaIdField = schema.find((f) => f.optionsSource === "medias");
  const currentMediaId = mediaIdField
    ? ((config[mediaIdField.key] as string) ?? "")
    : "";

  const fetchMedia = useCallback(async (id: string) => {
    setMediaLoading(true);
    try {
      const res = await getMediaAction(id);
      setSelectedMedia(res ?? null);
    } finally {
      setMediaLoading(false);
    }
  }, []);

  const prevMediaId = useMemo(() => currentMediaId, [currentMediaId]);

  useEffect(() => {
    if (!prevMediaId) return;
    fetchMedia(prevMediaId);
  }, [prevMediaId, fetchMedia]);

  useEffect(() => {
    if (!isCalendarNode) {
      setGoogleCalendarStatus({ loading: false, connected: false });
      return;
    }

    let active = true;
    setGoogleCalendarStatus((prev) => ({
      ...prev,
      loading: true,
      error: undefined,
    }));

    void fetchGoogleConnection().then((result) => {
      if (!active) return;
      setGoogleCalendarStatus({
        loading: false,
        connected: result.connected,
        email: result.connection?.email,
        error: result.error,
      });
    });

    return () => {
      active = false;
    };
  }, [isCalendarNode]);

  const availableVars = useMemo(
    () => buildAvailableVariables(node.id, allNodes, allEdges, definitions),
    [node.id, allNodes, allEdges, definitions],
  );

  return (
    <div
      className="border-l border-border bg-card flex-shrink-0 relative flex flex-col"
      style={{ width: panelWidth }}
    >
      {/* Resize handle - outside scroll container for consistent behavior */}
      <div
        className="absolute left-0 top-0 bottom-0 w-1.5 cursor-ew-resize hover:bg-primary/30 active:bg-primary/50 transition-colors z-20"
        onMouseDown={handleResizeStart}
      />
      <div className="p-3 border-b border-border flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <div
            className="flex h-7 w-7 items-center justify-center rounded-lg shadow-sm"
            style={{ backgroundColor: styles.color }}
          >
            {IconComp && (
              <IconComp size={15} weight="fill" className="text-white" />
            )}
          </div>
          <span className="text-sm font-semibold">{label}</span>
        </div>
        <ElevatedButton
          variant="ghost"
          size="icon"
          icon={<X size={16} />}
          iconVisible
          onClick={onClose}
        />
      </div>

      <div className="p-3 space-y-4 overflow-y-auto flex-1">
        {/* Display name, editable label for any node */}
        <ElevatedInput
          label="Nome do nó"
          value={displayName}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            updateField("display_name", e.target.value)
          }
          placeholder={def?.label ?? nodeType}
          controlSize="sm"
        />

        {/* Group node config */}
        {nodeType === "group" ? (
          <GroupConfigSection
            config={config}
            updateField={updateField}
            nc={nc}
          />
        ) : (
          <>
            {/* AI Agent source toggle (Agent vs Prompt), rendered first */}
            {nodeType === "action_ai_agent" && (
              <AIAgentSection config={config} updateField={updateField} nc={nc} />
            )}

            {isCalendarNode && (
              <div
                className={cn(
                  "rounded-lg border px-3 py-2",
                  googleCalendarStatus.connected
                    ? "border-emerald-200 bg-healthy/10/70 text-emerald-900"
                    : "border-amber-200 bg-amber-50/80 text-amber-950",
                )}
              >
                <div className="flex items-start gap-2">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <p className="text-xs font-medium">
                      Google Calendar da área de trabalho
                    </p>
                    <p className="text-[11px] leading-relaxed text-current/80">
                      {googleCalendarStatus.loading
                        ? "Verificando integração da área de trabalho..."
                        : googleCalendarStatus.connected
                          ? `Conectado com ${googleCalendarStatus.email ?? "uma conta Google"}. ${isScheduleMeetingNode ? "Este nó criará eventos nesse calendário." : isRescheduleMeetingNode ? "Este nó reagendará (moverá) eventos nesse calendário." : "Este nó consultará disponibilidade nesse calendário."}`
                          : "Nenhuma conta Google Calendar conectada nesta área de trabalho. Este nó seguirá pela saída de erro até a integração ser configurada."}
                    </p>
                    {!googleCalendarStatus.loading &&
                      !googleCalendarStatus.connected && (
                        <p className="text-[10px] leading-relaxed text-current/70">
                          Conecte o Google Calendar na página de Integrações
                          antes de testar ou publicar este fluxo.
                        </p>
                      )}
                    {!googleCalendarStatus.loading &&
                      googleCalendarStatus.error && (
                        <p className="text-[10px] leading-relaxed text-current/70">
                          Não foi possível confirmar o status agora:{" "}
                          {googleCalendarStatus.error}
                        </p>
                      )}
                  </div>
                </div>
              </div>
            )}

            {isWebhookTriggerNode && (
              <WebhookTriggerConfig workflowId={workflowId} />
            )}

            {isSendTemplateNode && (
              <SendTemplateConfigSection
                config={config}
                updateField={updateField}
                nc={nc}
                selectedTemplate={selectedTemplate}
              />
            )}

            {isHTTPRequestNode && (
              <HTTPRequestConfigSection
                config={config}
                updateField={updateField}
                schema={schema}
                availableVars={availableVars}
                isWidePanel={isWidePanel}
                isExtraWidePanel={isExtraWidePanel}
              />
            )}

            {schema.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                {t("config.noConfig")}
              </p>
            ) : (
              schema
                .filter((f) => {
                  if (nodeType === "action_ai_agent") {
                    const hidden = [
                      "source",
                      "model",
                      "instructions",
                      "agent_id",
                      "agent_prompt",
                      "knowledge_base_ids",
                    ];
                    if (hidden.includes(f.key)) return false;
                    if (f.key === "tool_mode") {
                      const tools =
                        (config.custom_tools as Array<{ name: string }>) ?? [];
                      return tools.filter((t) => t.name).length > 0;
                    }
                    return true;
                  }
                  if (nodeType === "action_http_request") {
                    if (
                      [
                        "method",
                        "url",
                        "headers",
                        "query_params",
                        "body",
                        "auth_type",
                        "auth_token",
                        "auth_user",
                        "auth_key_name",
                        "timeout_seconds",
                        "capture_variable",
                      ].includes(f.key)
                    ) {
                      return false;
                    }
                    const authType = (
                      (config.auth_type as string) ?? ""
                    ).trim();
                    if (f.key === "auth_token") {
                      return authType !== "";
                    }
                    if (f.key === "auth_user") {
                      return authType === "basic";
                    }
                    if (f.key === "auth_key_name") {
                      return authType === "api_key";
                    }
                    return true;
                  }
                  if (
                    isSendTemplateNode &&
                    (f.key === "business_phone_id" || f.key === "template_id")
                  ) {
                    return false;
                  }
                  if (isInteractivePromptNode) {
                    const itype = (
                      (config.interactive_type as string) ?? "buttons"
                    ).trim();
                    // Show only the fields relevant to the chosen format.
                    if (f.key === "buttons") {
                      return itype !== "list";
                    }
                    if (f.key === "list_button" || f.key === "sections") {
                      return itype === "list";
                    }
                    // Media header only applies to the buttons format.
                    if (f.key === "header_media_url") {
                      return itype !== "list";
                    }
                  }
                  return true;
                })
                .map((field: ConfigField) => (
                  <InteractiveReachContext.Provider
                    key={field.key}
                    value={interactiveReach}
                  >
                    <SchemaField
                      field={field}
                      value={
                        config[field.key] ?? def?.defaultConfig?.[field.key]
                      }
                      displayValue={
                        (config[`_display_${field.key}`] as
                          | string
                          | undefined) ?? undefined
                      }
                      onChange={(val, meta) => updateField(field.key, val, meta)}
                      availableVars={availableVars}
                      workspaceId={workspaceId}
                    />
                  </InteractiveReachContext.Provider>
                ))
            )}

            {/* Template parameter inputs (dynamic based on selected template) */}
            {templateParams.length > 0 && (
              <TemplateParamsSection
                params={templateParams}
                values={(config.params as Record<string, string>) ?? {}}
                onChange={(params) => updateField("params", params)}
                templateName={selectedTemplate?.name}
                availableVars={availableVars}
              />
            )}
            {templateLoading && currentTemplateId && (
              <p className="text-[10px] text-muted-foreground italic">
                Carregando parâmetros do template...
              </p>
            )}

            {/* Media preview (dynamic based on selected media) */}
            {currentMediaId && selectedMedia && (
              <MediaPreviewSection media={selectedMedia} />
            )}
            {mediaLoading && currentMediaId && (
              <p className="text-[10px] text-muted-foreground italic">
                Carregando preview da mídia...
              </p>
            )}

            {isTestableNode && workflowId && (
              <TestNodeSection
                key={`${workflowId}:${node.id}`}
                workflowId={workflowId}
                nodeId={node.id}
                disabled={isWorkflowDirty}
                disabledReason={
                  isWorkflowDirty
                    ? "Salve as alterações do workflow antes de testar este nó. O teste usa sempre a última versão salva."
                    : undefined
                }
              />
            )}

            {isTestableNode && !workflowId && (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Salve o workflow primeiro para habilitar o teste de nós.
              </div>
            )}

            <AvailableVariablesPanel groups={availableVars} />
          </>
        )}

        {/* Node ID, the structural reference the AI/engine uses (n1, n2…).
            Always the last field; renaming rewires edges + {{id.…}} refs. */}
        {onRenameNode && (
          <NodeIdField
            key={node.id}
            nodeId={node.id}
            onRename={onRenameNode}
          />
        )}
      </div>
    </div>
  );
}

function NodeIdField({
  nodeId,
  onRename,
}: {
  nodeId: string;
  onRename: (oldId: string, newId: string) => string | null;
}) {
  // Remounted per node via `key`, so initial state from props is always fresh.
  const [draft, setDraft] = useState(nodeId);
  const [error, setError] = useState<string | null>(null);

  const commit = () => {
    const next = draft.trim();
    if (next === nodeId) {
      setError(null);
      return;
    }
    const err = onRename(nodeId, next);
    if (err) {
      setError(err);
      setDraft(nodeId);
    } else {
      setError(null);
    }
  };

  return (
    <div className="border-t border-border pt-3">
      <ElevatedInput
        label="ID do nó"
        value={draft}
        onChange={(e: ChangeEvent<HTMLInputElement>) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            (e.target as HTMLInputElement).blur();
          }
        }}
        controlSize="sm"
        placeholder={nodeId}
      />
      {error ? (
        <p className="mt-1 text-[10px] text-destructive">{error}</p>
      ) : (
        <p className="mt-1 text-[10px] text-muted-foreground">
          Referenciado como{" "}
          <code className="font-mono text-foreground/70">{`{{${nodeId}.campo}}`}</code>
          . Renomear reconecta as arestas e referências.
        </p>
      )}
    </div>
  );
}

function formatBusinessPhoneLabel(phone: WhatsAppBusinessPhone): string {
  const verifiedName = phone.verifiedName?.trim();
  if (verifiedName) {
    return `${verifiedName} • ${phone.displayPhoneNumber}`;
  }
  return phone.displayPhoneNumber;
}

function formatBusinessPhoneDescription(phone: WhatsAppBusinessPhone): string {
  const parts = [`Status ${phone.status}`];
  if (phone.wabaId) {
    parts.push(`WABA ${phone.wabaId}`);
  }
  return parts.join(" • ");
}

function formatTemplateDescription(template: WhatsAppTemplate): string {
  const parts = [template.language, template.category];
  if (template.usabilityStatus && template.usabilityStatus !== "ready") {
    parts.push(template.usabilityStatus);
  }
  return parts.join(" • ");
}

function formatMemberLabel(member: WorkspaceMember): string {
  const username = member.username?.trim();
  const email = member.email?.trim();

  if (username && email) {
    return `${username} • ${email}`;
  }

  return username || email || member.userId;
}

function normalizeKeyValueMap(value: unknown): Record<string, string> {
  if (!value) {
    return {};
  }

  if (typeof value === "string") {
    try {
      const parsed = JSON.parse(value) as Record<string, unknown>;
      return Object.fromEntries(
        Object.entries(parsed).map(([key, entryValue]) => [
          key,
          entryValue == null ? "" : String(entryValue),
        ]),
      );
    } catch {
      return {};
    }
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(
        ([key, entryValue]) => [
          key,
          entryValue == null ? "" : String(entryValue),
        ],
      ),
    );
  }

  return {};
}

function KeyValueField({
  field,
  label,
  value,
  onChange,
  availableVars,
  error,
}: {
  field: ConfigField;
  label: string;
  value: unknown;
  onChange: (val: unknown, meta?: Record<string, unknown>) => void;
  availableVars: Array<{
    label: string;
    description?: string;
    vars: { template: string; description: string }[];
  }>;
  error?: string;
}) {
  const entries = useMemo(
    () => Object.entries(normalizeKeyValueMap(value)),
    [value],
  );
  const [draftKey, setDraftKey] = useState("");
  const [draftValue, setDraftValue] = useState("");

  const commitEntries = useCallback(
    (nextEntries: Array<[string, string]>) => {
      onChange(Object.fromEntries(nextEntries.filter(([key]) => key.trim())));
    },
    [onChange],
  );

  const handleAdd = useCallback(() => {
    const trimmedKey = draftKey.trim();
    if (!trimmedKey) {
      return;
    }

    const nextEntries = entries.filter(([key]) => key !== trimmedKey);
    nextEntries.push([trimmedKey, draftValue]);
    commitEntries(nextEntries);
    setDraftKey("");
    setDraftValue("");
  }, [commitEntries, draftKey, draftValue, entries]);

  const handleRemove = useCallback(
    (keyToRemove: string) => {
      commitEntries(entries.filter(([key]) => key !== keyToRemove));
    },
    [commitEntries, entries],
  );

  const handleValueChange = useCallback(
    (keyToUpdate: string, nextValue: string) => {
      commitEntries(
        entries.map(([key, currentValue]) =>
          key === keyToUpdate ? [key, nextValue] : [key, currentValue],
        ),
      );
    },
    [commitEntries, entries],
  );

  return (
    <div className="space-y-2">
      <div>
        <p className="text-xs font-medium text-foreground">{label}</p>
        {field.description && (
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            {field.description}
          </p>
        )}
      </div>

      {entries.length > 0 && (
        <div className="space-y-2.5">
          {entries.map(([entryKey, entryValue]) => (
            <div
              key={entryKey}
              className="rounded-[--radius] border border-border bg-mist p-3"
            >
              <div className="space-y-3">
                <div className="min-w-0 space-y-1">
                  <p className="mb-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Chave
                  </p>
                  <div className="rounded-[--radius] border border-border bg-background px-2.5 py-2 font-mono text-[11px] text-foreground break-all max-h-24 overflow-y-auto">
                    {entryKey}
                  </div>
                </div>
                <div className="min-w-0">
                  <VariableCommandInput
                    label="Valor"
                    value={entryValue}
                    onChange={(nextValue) =>
                      handleValueChange(entryKey, nextValue)
                    }
                    placeholder={field.placeholder ?? "Valor"}
                    controlSize="sm"
                    availableVars={availableVars}
                    multiline
                  />
                </div>
                <div className="flex justify-end">
                  <ElevatedButton
                    variant="ghost"
                    size="sm"
                    title="Remover"
                    icon={<Trash size={14} />}
                    iconVisible
                    onClick={() => handleRemove(entryKey)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-[--radius] border border-dashed border-border bg-background p-3">
        <div className="space-y-3">
          <div className="min-w-0">
            <ElevatedInput
              label="Nova chave"
              value={draftKey}
              onChange={(e) => setDraftKey(e.target.value)}
              placeholder="Authorization"
              controlSize="sm"
            />
          </div>
          <div className="min-w-0">
            <VariableCommandInput
              label="Novo valor"
              value={draftValue}
              onChange={setDraftValue}
              placeholder={field.placeholder ?? "Valor"}
              controlSize="sm"
              availableVars={availableVars}
              multiline
            />
          </div>
          <div className="flex justify-end">
            <ElevatedButton
              variant="secondary"
              size="sm"
              icon={<Plus size={14} />}
              iconVisible
              onClick={handleAdd}
              title="Adicionar"
            />
          </div>
        </div>
      </div>

      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

function HTTPRequestConfigSection({
  config,
  updateField,
  schema,
  availableVars,
  isWidePanel,
  isExtraWidePanel,
}: {
  config: Record<string, unknown>;
  updateField: (
    key: string,
    value: unknown,
    extra?: Record<string, unknown>,
  ) => void;
  schema: ConfigField[];
  availableVars: Array<{
    label: string;
    description?: string;
    vars: { template: string; description: string }[];
  }>;
  isWidePanel: boolean;
  isExtraWidePanel: boolean;
}) {
  const fieldByKey = useMemo(
    () =>
      Object.fromEntries(schema.map((field) => [field.key, field])) as Record<
        string,
        ConfigField
      >,
    [schema],
  );
  const method = ((config.method as string) ?? "GET").toUpperCase();
  const authType = ((config.auth_type as string) ?? "").trim();
  const showBody = method !== "GET" && method !== "HEAD";

  return (
    <div className="space-y-4 rounded-[--radius] border border-border bg-mist p-3.5">
      <div className="flex items-start gap-2">
        <div className="rounded-lg bg-muted px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
          HTTP
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground">
            Configuração da requisição
          </p>
          <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">
            Monte a chamada com método, autenticação, headers, query params e
            captura de resposta.
          </p>
        </div>
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          isWidePanel && "grid-cols-[140px_minmax(0,1fr)]",
        )}
      >
        <SchemaField
          field={fieldByKey.method}
          value={config.method}
          onChange={(val, meta) => updateField("method", val, meta)}
          availableVars={availableVars}
        />
        <SchemaField
          field={fieldByKey.url}
          value={config.url}
          onChange={(val, meta) => updateField("url", val, meta)}
          availableVars={availableVars}
        />
      </div>

      <div
        className={cn(
          "grid grid-cols-1 gap-3",
          isExtraWidePanel && "grid-cols-2",
        )}
      >
        <KeyValueField
          field={fieldByKey.headers}
          label={fieldByKey.headers?.label ?? "Headers"}
          value={config.headers}
          onChange={(val, meta) => updateField("headers", val, meta)}
          availableVars={availableVars}
        />
        <KeyValueField
          field={fieldByKey.query_params}
          label={fieldByKey.query_params?.label ?? "Parâmetros de Query"}
          value={config.query_params}
          onChange={(val, meta) => updateField("query_params", val, meta)}
          availableVars={availableVars}
        />
      </div>

      <div className="space-y-3 rounded-[--radius] border border-border bg-mist p-3.5">
        <div
          className={cn(
            "flex gap-2",
            isWidePanel
              ? "items-center justify-between"
              : "flex-col items-start",
          )}
        >
          <div>
            <p className="text-xs font-semibold text-foreground">
              Autenticação
            </p>
            <p className="mt-1 text-[10px] text-muted-foreground">
              Configure Bearer, Basic Auth ou API Key sem precisar montar
              headers manualmente.
            </p>
          </div>
          <div className="rounded-[--radius] bg-muted px-2 py-1 text-[10px] font-medium text-muted-foreground">
            {authType || "nenhuma"}
          </div>
        </div>

        <div
          className={cn("grid grid-cols-1 gap-3", isWidePanel && "grid-cols-2")}
        >
          <SchemaField
            field={fieldByKey.auth_type}
            value={config.auth_type}
            onChange={(val, meta) => updateField("auth_type", val, meta)}
            availableVars={availableVars}
          />
          <SchemaField
            field={fieldByKey.timeout_seconds}
            value={config.timeout_seconds}
            onChange={(val, meta) => updateField("timeout_seconds", val, meta)}
            availableVars={availableVars}
          />
        </div>

        {authType !== "" && (
          <div
            className={cn(
              "grid grid-cols-1 gap-3",
              isWidePanel && "grid-cols-2",
            )}
          >
            {authType === "basic" && fieldByKey.auth_user && (
              <SchemaField
                field={fieldByKey.auth_user}
                value={config.auth_user}
                onChange={(val, meta) => updateField("auth_user", val, meta)}
                availableVars={availableVars}
              />
            )}
            {authType === "api_key" && fieldByKey.auth_key_name && (
              <SchemaField
                field={fieldByKey.auth_key_name}
                value={config.auth_key_name}
                onChange={(val, meta) =>
                  updateField("auth_key_name", val, meta)
                }
                availableVars={availableVars}
              />
            )}
            {fieldByKey.auth_token && (
              <SchemaField
                field={fieldByKey.auth_token}
                value={config.auth_token}
                onChange={(val, meta) => updateField("auth_token", val, meta)}
                availableVars={availableVars}
              />
            )}
          </div>
        )}
      </div>

      {showBody ? (
        <SchemaField
          field={fieldByKey.body}
          value={config.body}
          onChange={(val, meta) => updateField("body", val, meta)}
          availableVars={availableVars}
        />
      ) : (
        <div className="rounded-[--radius] border border-border bg-mist px-3 py-2 text-[11px] text-muted-foreground">
          O corpo da requisição fica oculto para métodos {method}. Altere para
          POST, PUT, PATCH ou DELETE se precisar enviar payload.
        </div>
      )}

      <SchemaField
        field={fieldByKey.capture_variable}
        value={config.capture_variable}
        onChange={(val, meta) => updateField("capture_variable", val, meta)}
        availableVars={availableVars}
      />
    </div>
  );
}

function SendTemplateConfigSection({
  config,
  updateField,
  selectedTemplate,
  nc,
}: {
  config: Record<string, unknown>;
  updateField: (
    key: string,
    value: unknown,
    extra?: Record<string, unknown>,
  ) => void;
  selectedTemplate: WhatsAppTemplate | null;
  nc: ReturnType<typeof useTranslations>;
}) {
  const currentBusinessPhoneId = (
    (config.business_phone_id as string) ?? ""
  ).trim();
  const currentTemplateId = ((config.template_id as string) ?? "").trim();

  const [phones, setPhones] = useState<WhatsAppBusinessPhone[]>([]);
  const [phonesError, setPhonesError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);

  const phoneSelect = usePaginatedSelect<WhatsAppBusinessPhone>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listBusinessPhonesAction({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      setPhonesError(result.error ?? null);
      return { items: result.phones ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: useCallback(
      (phone: WhatsAppBusinessPhone): ElevatedCommandOption => ({
        label: formatBusinessPhoneLabel(phone),
        value: phone.id,
        description: formatBusinessPhoneDescription(phone),
      }),
      [],
    ),
  });

  const templateSelect = usePaginatedSelect<WhatsAppTemplate>({
    fetchFn: useCallback(
      async (page: number, search: string) => {
        if (!currentBusinessPhoneId) {
          setTemplatesError(null);
          return { items: [], totalPages: 1 };
        }

        const result = await listWhatsAppTemplatesAction({
          businessPhoneId: currentBusinessPhoneId,
          page,
          pageSize: 20,
          search: search || undefined,
        });

        setTemplatesError(result.error ?? null);
        return {
          items: (result.templates ?? []).filter(
            (template) => template.usabilityStatus === "ready",
          ),
          totalPages: result.meta.totalPages,
        };
      },
      [currentBusinessPhoneId],
    ),
    mapOption: useCallback(
      (template: WhatsAppTemplate): ElevatedCommandOption => ({
        label: template.name,
        value: template.id,
        description: formatTemplateDescription(template),
      }),
      [],
    ),
    enabled: Boolean(currentBusinessPhoneId),
  });

  useEffect(() => {
    setPhones((prev) => upsertById(prev, phoneSelect.items));
  }, [phoneSelect.items]);

  useEffect(() => {
    setTemplates((prev) => upsertById(prev, templateSelect.items));
  }, [templateSelect.items]);

  useEffect(() => {
    if (
      !currentBusinessPhoneId ||
      phones.some((phone) => phone.id === currentBusinessPhoneId)
    ) {
      return;
    }

    let active = true;
    getBusinessPhoneByIdAction(currentBusinessPhoneId).then((result) => {
      const phone = result.phone;
      if (!active || !phone) {
        return;
      }

      setPhones((prev) => upsertById(prev, [phone]));
    });

    return () => {
      active = false;
    };
  }, [currentBusinessPhoneId, phones]);

  useEffect(() => {
    if (!selectedTemplate) {
      return;
    }

    setTemplates((prev) => upsertById(prev, [selectedTemplate]));
  }, [selectedTemplate]);

  const readyTemplates = useMemo(
    () => templates.filter((template) => template.usabilityStatus === "ready"),
    [templates],
  );

  const selectedPhone = useMemo(
    () => phones.find((phone) => phone.id === currentBusinessPhoneId) ?? null,
    [phones, currentBusinessPhoneId],
  );

  const currentTemplateIsVisible = useMemo(
    () => readyTemplates.some((template) => template.id === currentTemplateId),
    [readyTemplates, currentTemplateId],
  );

  const handleBusinessPhoneChange = useCallback(
    (nextPhoneId: string) => {
      const nextPhone = phones.find((phone) => phone.id === nextPhoneId);
      updateField("business_phone_id", nextPhoneId, {
        _display_business_phone_id: nextPhone
          ? formatBusinessPhoneLabel(nextPhone)
          : "",
        template_id: "",
        _display_template_id: "",
        params: {},
      });
    },
    [phones, updateField],
  );

  const handleTemplateChange = useCallback(
    (nextTemplateId: string) => {
      const nextTemplate = readyTemplates.find(
        (template) => template.id === nextTemplateId,
      );
      updateField(
        "template_id",
        nextTemplateId,
        nextTemplate ? { _display_template_id: nextTemplate.name } : undefined,
      );
    },
    [readyTemplates, updateField],
  );

  const phoneOptions = useMemo(() => {
    const currentPhone =
      phones.find((phone) => phone.id === currentBusinessPhoneId) ?? null;

    return mergeCommandOptions(
      currentPhone
        ? {
            label: formatBusinessPhoneLabel(currentPhone),
            value: currentPhone.id,
            description: formatBusinessPhoneDescription(currentPhone),
          }
        : null,
      phoneSelect.options,
    );
  }, [phones, currentBusinessPhoneId, phoneSelect.options]);

  const templateOptions = useMemo(() => {
    const currentOption = currentTemplateId
      ? selectedTemplate
        ? {
            label: selectedTemplate.name,
            value: selectedTemplate.id,
            description: formatTemplateDescription(selectedTemplate),
          }
        : {
            label: currentTemplateId,
            value: currentTemplateId,
          }
      : null;

    return mergeCommandOptions(currentOption, templateSelect.options);
  }, [currentTemplateId, selectedTemplate, templateSelect.options]);

  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-mist p-3">
      <div className="space-y-1">
        <ElevatedCommandSelect
          label="Número do WhatsApp"
          value={currentBusinessPhoneId}
          onValueChange={(value) => handleBusinessPhoneChange(value)}
          options={phoneOptions}
          searchPlaceholder="Buscar número do WhatsApp..."
          emptyMessage={phonesError ?? "Nenhum número encontrado"}
          onSearch={phoneSelect.onSearch}
          onScrollEnd={phoneSelect.onScrollEnd}
          onOpenChange={phoneSelect.onOpenChange}
          isLoading={phoneSelect.isLoading}
        />
        {phonesError && (
          <p className="text-[10px] text-destructive">{phonesError}</p>
        )}
      </div>

      <div className="space-y-1">
        <ElevatedCommandSelect
          label="Template WhatsApp *"
          value={currentTemplateId}
          onValueChange={(value) => handleTemplateChange(value)}
          options={templateOptions}
          searchPlaceholder="Buscar template..."
          emptyMessage={
            !currentBusinessPhoneId
              ? nc("selectNumberFirst")
              : (templatesError ?? "Nenhum template pronto encontrado")
          }
          onSearch={templateSelect.onSearch}
          onScrollEnd={templateSelect.onScrollEnd}
          onOpenChange={templateSelect.onOpenChange}
          isLoading={templateSelect.isLoading}
          disabled={!currentBusinessPhoneId}
        />
        {!!currentBusinessPhoneId && !currentTemplateId && (
          <p className="text-[10px] text-destructive">Campo obrigatório</p>
        )}
        {templatesError && (
          <p className="text-[10px] text-destructive">{templatesError}</p>
        )}
        {selectedPhone && !templatesError && (
          <p className="text-[10px] text-muted-foreground">
            Listando apenas templates do mesmo WABA do número selecionado:
            <span className="font-medium text-foreground">
              {" "}
              {selectedPhone.wabaId}
            </span>
            .
          </p>
        )}
        {!!currentTemplateId &&
          !currentTemplateIsVisible &&
          !templateSelect.isLoading && (
            <p className="text-[10px] text-warning">
              O template salvo não está pronto para envio neste WABA. Escolha um
              template aprovado e utilizável.
            </p>
          )}
      </div>

      <div className="rounded-lg border border-sky-200 bg-muted px-3 py-2 text-sky-950">
        <div className="flex items-start gap-2">
          <Info size={15} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-xs font-medium">Cobrança e simulação</p>
            <p className="text-[11px] leading-relaxed text-current/80">
              Execuções reais debitam o saldo conforme a categoria do template.
              Se a API do WhatsApp rejeitar o envio, o valor é estornado.
            </p>
            <p className="text-[10px] leading-relaxed text-current/70">
              Na simulação do fluxo, este nó é executado em modo não faturado.
            </p>
          </div>
        </div>
      </div>

      {selectedTemplate && selectedTemplate.usabilityStatus !== "ready" && (
        <p className="text-[10px] text-warning">
          O template atual não está pronto para envio:{" "}
          {selectedTemplate.usabilityMessage ??
            selectedTemplate.usabilityStatus}
          .
        </p>
      )}
    </div>
  );
}

const GROUP_BORDER_OPTIONS = [
  { value: "dashed", label: "Tracejado" },
  { value: "dotted", label: "Pontilhado" },
  { value: "solid", label: "Sólido" },
  { value: "double", label: "Duplo" },
  { value: "none", label: "Nenhum" },
];

const GROUP_COLOR_OPTIONS = [
  { value: "gray", label: "Cinza" },
  { value: "blue", label: "Azul" },
  { value: "green", label: "Verde" },
  { value: "yellow", label: "Amarelo" },
  { value: "red", label: "Vermelho" },
  { value: "purple", label: "Roxo" },
  { value: "transparent", label: "Transparente" },
];

function GroupConfigSection({
  config,
  updateField,
  nc,
}: {
  config: Record<string, unknown>;
  updateField: (key: string, value: unknown) => void;
  nc: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="space-y-3">
      <ElevatedSelect
        label="Estilo da borda"
        value={(config.border_style as string) || "dashed"}
        onValueChange={(v) => updateField("border_style", v)}
      >
        {GROUP_BORDER_OPTIONS.map((opt) => (
          <ElevatedSelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>

      <ElevatedSelect
        label="Cor"
        value={(config.color as string) || "gray"}
        onValueChange={(v) => updateField("color", v)}
      >
        {GROUP_COLOR_OPTIONS.map((opt) => (
          <ElevatedSelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>

      <ElevatedInput
        label="Espessura da borda"
        type="number"
        value={String((config.border_width as number) ?? 2)}
        onChange={(e: ChangeEvent<HTMLInputElement>) =>
          updateField("border_width", parseInt(e.target.value) || 1)
        }
        placeholder="2"
        controlSize="sm"
      />

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={config.solid_bg === true}
          onChange={(e) => updateField("solid_bg", e.target.checked)}
          className="rounded border-border"
        />
        <span className="text-xs font-medium text-foreground">
          Cor sólida (sem transparência)
        </span>
      </label>
    </div>
  );
}

function RangeField({
  field,
  label,
  value,
  onChange,
  error,
}: {
  field: ConfigField;
  label: string;
  value: unknown;
  onChange: (val: unknown) => void;
  error?: string;
}) {
  const min = typeof field.min === "number" ? field.min : 0;
  const max = typeof field.max === "number" ? field.max : 1;
  const step = typeof field.step === "number" ? field.step : 0.01;

  const decimals = (() => {
    const s = step.toString();
    const dot = s.indexOf(".");
    return dot >= 0 ? s.length - dot - 1 : 0;
  })();

  const numeric =
    typeof value === "number"
      ? value
      : typeof value === "string" && value !== ""
        ? Number(value)
        : min;
  const clamped = Number.isFinite(numeric)
    ? Math.min(Math.max(numeric, min), max)
    : min;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <span className="font-mono text-[11px] text-muted-foreground tabular-nums">
          {clamped.toFixed(decimals)}
        </span>
      </div>
      <Slider
        min={min}
        max={max}
        step={step}
        value={[clamped]}
        onValueChange={(values) => {
          const next = values[0];
          if (typeof next === "number" && Number.isFinite(next)) {
            onChange(next);
          }
        }}
      />
      <div className="flex justify-between text-[10px] text-muted-foreground tabular-nums">
        <span>{min.toFixed(decimals)}</span>
        <span>{max.toFixed(decimals)}</span>
      </div>
      {field.description && (
        <p className="text-[10px] leading-relaxed text-muted-foreground">
          {field.description}
        </p>
      )}
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}

function SchemaField({
  field,
  value,
  displayValue,
  onChange,
  availableVars,
  workspaceId,
}: {
  field: ConfigField;
  value: unknown;
  displayValue?: string;
  onChange: (val: unknown, meta?: Record<string, unknown>) => void;
  availableVars: VarGroup[];
  workspaceId?: string | null;
}) {
  const requiredEmpty =
    field.required === true &&
    (value === undefined || value === null || value === "");
  const reqLabel = field.required ? `${field.label} *` : field.label;
  const reqError = requiredEmpty ? "Campo obrigatório" : undefined;

  switch (field.type) {
    case "textarea":
      return (
        <VariableCommandInput
          label={reqLabel}
          value={(value as string) ?? ""}
          onChange={(val) => onChange(val)}
          placeholder={field.placeholder ?? ""}
          controlSize="sm"
          availableVars={availableVars}
          multiline
        />
      );
    case "number":
      return (
        <ElevatedInput
          label={reqLabel}
          type="number"
          value={String(value ?? "")}
          onChange={(e: ChangeEvent<HTMLInputElement>) =>
            onChange(parseInt(e.target.value) || 0)
          }
          placeholder={field.placeholder ?? ""}
          controlSize="sm"
          error={reqError}
        />
      );
    case "range":
      return (
        <RangeField
          field={field}
          label={reqLabel}
          value={value}
          onChange={onChange}
          error={reqError}
        />
      );
    case "cases":
      return <CasesField value={value} onChange={onChange} />;
    case "tools":
      return <ToolsField value={value} onChange={onChange} />;
    case "buttons":
      return <ButtonsField value={value} onChange={onChange} />;
    case "list_sections":
      return <ListSectionsField value={value} onChange={onChange} />;
    case "expressions":
      return <ExpressionsField value={value} onChange={onChange} />;
    case "code":
      return <CodeField field={field} value={value} onChange={onChange} />;
    case "select":
      return (
        <div className="space-y-1">
          <SelectField
            field={field}
            label={reqLabel}
            value={value}
            displayValue={displayValue}
            onChange={onChange}
            error={reqError}
            workspaceId={workspaceId}
          />
          {field.description && (
            <p className="text-[10px] leading-relaxed text-muted-foreground">
              {field.description}
            </p>
          )}
        </div>
      );
    case "keyvalue":
      return (
        <KeyValueField
          field={field}
          label={reqLabel}
          value={value}
          onChange={onChange}
          availableVars={availableVars}
          error={reqError}
        />
      );
    case "multi-select":
      return null;
    case "boolean":
      return (
        <div className="space-y-1">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={value === true}
              onChange={(e) => onChange(e.target.checked)}
              className="mt-0.5 rounded border-border"
            />
            <span className="text-xs font-medium text-foreground">
              {reqLabel}
            </span>
          </label>
          {field.description && (
            <p className="text-[10px] text-muted-foreground pl-6">
              {field.description}
            </p>
          )}
          {reqError && (
            <p className="text-[10px] text-destructive pl-6">{reqError}</p>
          )}
        </div>
      );
    default:
      return (
        <VariableCommandInput
          label={reqLabel}
          value={(value as string) ?? ""}
          onChange={(val) => onChange(val)}
          placeholder={field.placeholder ?? ""}
          controlSize="sm"
          availableVars={availableVars}
        />
      );
  }
}


function AIAgentSection({
  config,
  updateField,
  nc,
}: {
  config: Record<string, unknown>;
  updateField: (
    key: string,
    value: unknown,
    extra?: Record<string, unknown>,
  ) => void;
  nc: ReturnType<typeof useTranslations>;
}) {
  const source = ((config.source as string) || "agent") as "agent" | "prompt";
  const agentId = (config.agent_id as string) || "";

  const { variables: agentRequiredVars } = useAgentRequiredVariables(
    source === "agent" ? agentId : null,
  );

  const {
    options: agentOptions,
    isLoading: agentsLoading,
    onSearch: onAgentSearch,
    onScrollEnd: onAgentScrollEnd,
    onOpenChange: onAgentOpenChange,
    error: agentError,
  } = usePaginatedConfigOptions("agents");

  const {
    options: kbOptions,
    isLoading: kbLoading,
    onSearch: onKBSearch,
    onScrollEnd: onKBScrollEnd,
    onOpenChange: onKBOpenChange,
    error: kbError,
  } = usePaginatedConfigOptions("knowledge_bases", source === "prompt");

  const selectedAgentOption = useMemo(() => {
    const agentId = (config.agent_id as string) || "";
    if (!agentId) {
      return null;
    }

    return {
      label: (config._display_agent_id as string) || agentId,
      value: agentId,
    } satisfies ElevatedCommandOption;
  }, [config.agent_id, config._display_agent_id]);

  const commandOptions = useMemo(
    () => mergeCommandOptions(selectedAgentOption, agentOptions),
    [selectedAgentOption, agentOptions],
  );

  const selectedKBIds = useMemo(() => {
    const raw = config.knowledge_base_ids;
    if (Array.isArray(raw)) return raw as string[];
    return [];
  }, [config.knowledge_base_ids]);

  const selectedKBLabels = useMemo(() => {
    const raw = config._display_knowledge_base_ids;
    if (raw && typeof raw === "object" && !Array.isArray(raw))
      return raw as Record<string, string>;
    return {} as Record<string, string>;
  }, [config._display_knowledge_base_ids]);

  const availableKBOptions = useMemo(
    () => kbOptions.filter((o) => !selectedKBIds.includes(o.value)),
    [kbOptions, selectedKBIds],
  );

  const addKB = useCallback(
    (id: string, option?: ElevatedCommandOption | null) => {
      if (!id || selectedKBIds.includes(id)) return;
      const newIds = [...selectedKBIds, id];
      const newLabels = {
        ...selectedKBLabels,
        ...(option ? { [id]: option.label } : {}),
      };
      updateField("knowledge_base_ids", newIds, {
        _display_knowledge_base_ids: newLabels,
      });
    },
    [selectedKBIds, selectedKBLabels, updateField],
  );

  const removeKB = useCallback(
    (id: string) => {
      const newIds = selectedKBIds.filter((v) => v !== id);
      const newLabels = { ...selectedKBLabels };
      delete newLabels[id];
      updateField("knowledge_base_ids", newIds, {
        _display_knowledge_base_ids: newLabels,
      });
    },
    [selectedKBIds, selectedKBLabels, updateField],
  );

  return (
    <div className="space-y-3">
      <div>
        <span className="text-xs font-medium text-foreground block mb-1.5">
          Fonte de IA
        </span>
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            type="button"
            className={cn(
              "flex-1 text-[11px] font-medium py-1.5 transition-colors",
              source === "agent"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted",
            )}
            onClick={() =>
              updateField("source", "agent", {
                model: "",
                instructions: "",
                voice_id: "",
              })
            }
          >
            Agente
          </button>
          <button
            type="button"
            className={cn(
              "flex-1 text-[11px] font-medium py-1.5 transition-colors",
              source === "prompt"
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted",
            )}
            onClick={() =>
              updateField("source", "prompt", {
                agent_id: "",
              })
            }
          >
            Prompt
          </button>
        </div>
      </div>

      {source === "agent" ? (
        <div className="space-y-1">
          <ElevatedCommandSelect
            label="Agente *"
            value={(config.agent_id as string) ?? ""}
            onValueChange={(v, option) => {
              updateField(
                "agent_id",
                v,
                option ? { _display_agent_id: option.label } : undefined,
              );
            }}
            options={commandOptions}
            searchPlaceholder={nc("searchAgent")}
            emptyMessage={agentError ?? "Nenhum agente encontrado"}
            onSearch={onAgentSearch}
            onScrollEnd={onAgentScrollEnd}
            onOpenChange={onAgentOpenChange}
            isLoading={agentsLoading}
          />
          {!config.agent_id && (
            <p className="text-[10px] text-destructive">Campo obrigatório</p>
          )}
          {agentError && (
            <p className="text-[10px] text-destructive">{agentError}</p>
          )}
          {agentId && agentRequiredVars.length > 0 && (
            <div className="mt-2 space-y-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">
                {nc("agentVariables") ?? "Agent variables"}:
              </p>
              <div className="flex flex-wrap gap-1">
                {agentRequiredVars.map((v) => (
                  <span
                    key={v.name}
                    className={cn(
                      "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-medium",
                      v.required
                        ? "bg-amber-100 text-amber-800"
                        : "bg-muted text-muted-foreground",
                    )}
                    title={[
                      v.usedIn?.messagingPrompt && "messaging prompt",
                      v.usedIn?.initialMessage && "initial message",
                    ].filter(Boolean).join(", ") || undefined}
                  >
                    {v.description || v.name}
                    {v.required && " *"}
                  </span>
                ))}
              </div>
              <p className="text-[9px] text-muted-foreground">
                {nc("agentVariablesAutoMap") ?? "Variables are auto-mapped from campaign entry metadata by name."}
              </p>
            </div>
          )}
        </div>
      ) : (
        <>
          <div className="space-y-1">
            <ModelCombobox
              value={(config.model as string) ?? ""}
              onValueChange={(v: string) => updateField("model", v)}
            />
            {!config.model && (
              <p className="text-[10px] text-destructive">Campo obrigatório</p>
            )}
          </div>
          <ElevatedTextarea
            label="Prompt do sistema *"
            value={(config.instructions as string) ?? ""}
            onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
              updateField("instructions", e.target.value)
            }
            placeholder="Descreva como a IA deve se comportar..."
            controlSize="sm"
            rows={4}
          />
          <div className="space-y-1.5">
            <span className="text-xs font-medium text-foreground block">
              Bases de Conhecimento (RAG)
            </span>
            {selectedKBIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {selectedKBIds.map((id) => (
                  <span
                    key={id}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-0.5 text-[11px] font-medium text-white"
                  >
                    {selectedKBLabels[id] || id.slice(0, 8)}
                    <button
                      type="button"
                      onClick={() => removeKB(id)}
                      className="ml-0.5 rounded-full hover:bg-muted p-0.5"
                    >
                      <X size={10} />
                    </button>
                  </span>
                ))}
              </div>
            )}
            <ElevatedCommandSelect
              label=""
              value=""
              onValueChange={(v, option) => addKB(v, option)}
              options={availableKBOptions}
              searchPlaceholder="Buscar base de conhecimento..."
              emptyMessage={kbError ?? "Nenhuma base encontrada"}
              onSearch={onKBSearch}
              onScrollEnd={onKBScrollEnd}
              onOpenChange={onKBOpenChange}
              isLoading={kbLoading}
            />
            <p className="text-[10px] text-muted-foreground">
              Opcional, contexto adicional da base de conhecimento será
              injetado no prompt.
            </p>
          </div>
        </>
      )}
    </div>
  );
}


function usePaginatedConfigOptions(
  source?: string,
  enabled = true,
): {
  options: ElevatedCommandOption[];
  isLoading: boolean;
  onSearch: (query: string) => void;
  onScrollEnd: () => void;
  onOpenChange: (open: boolean) => void;
  error: string | null;
} {
  const paginatedSource =
    enabled && isPaginatedOptionSource(source) ? source : undefined;
  const [error, setError] = useState<string | null>(null);

  const select = usePaginatedSelect<ElevatedCommandOption>({
    fetchFn: useCallback(
      async (page: number, search: string) => {
        if (!paginatedSource) {
          return { items: [], totalPages: 1 };
        }

        switch (paginatedSource) {
          case "agents": {
            const result = await listAgentsAction({
              page,
              pageSize: 20,
              search: search || undefined,
            });

            if (result.error) {
              setError(result.error);
              return { items: [], totalPages: 1 };
            }

            setError(null);
            return {
              items: (result.agents ?? []).map((agent) => ({
                label: agent.name,
                value: agent.id,
              })),
              totalPages: result.meta.totalPages,
            };
          }
          case "business_phones": {
            const result = await listBusinessPhonesAction({
              page,
              pageSize: 20,
              search: search || undefined,
            });

            if (result.error) {
              setError(result.error);
              return { items: [], totalPages: 1 };
            }

            setError(null);
            return {
              items: (result.phones ?? []).map((phone) => ({
                label: formatBusinessPhoneLabel(phone),
                value: phone.id,
                description: formatBusinessPhoneDescription(phone),
              })),
              totalPages: result.meta.totalPages,
            };
          }
          case "whatsapp_templates": {
            const result = await listWhatsAppTemplatesAction({
              page,
              pageSize: 20,
              search: search || undefined,
            });

            if (result.error) {
              setError(result.error);
              return { items: [], totalPages: 1 };
            }

            setError(null);
            return {
              items: (result.templates ?? []).map((template) => ({
                label: template.name,
                value: template.id,
                description: formatTemplateDescription(template),
              })),
              totalPages: result.meta.totalPages,
            };
          }
          case "workflows": {
            const result = await listWorkflowsAction({
              page,
              pageSize: 20,
              search: search || undefined,
            });

            if (result.error) {
              setError(result.error);
              return { items: [], totalPages: 1 };
            }

            setError(null);
            return {
              items: (result.workflows ?? []).map((workflow) => ({
                label: workflow.name,
                value: workflow.id,
              })),
              totalPages: result.meta.totalPages,
            };
          }
          case "knowledge_bases": {
            const result = await listKnowledgeBasesAction({
              page,
              pageSize: 20,
              search: search || undefined,
            });

            if (result.error) {
              setError(result.error);
              return { items: [], totalPages: 1 };
            }

            setError(null);
            return {
              items: (result.knowledgeBases ?? []).map((kb) => ({
                label: kb.name,
                value: kb.id,
                description: kb.description || undefined,
              })),
              totalPages: result.meta.totalPages,
            };
          }
        }
      },
      [paginatedSource],
    ),
    mapOption: useCallback((option: ElevatedCommandOption) => option, []),
    enabled: Boolean(paginatedSource),
  });

  useEffect(() => {
    if (!paginatedSource) {
      setError(null);
    }
  }, [paginatedSource]);

  return {
    options: select.options,
    isLoading: select.isLoading,
    onSearch: select.onSearch,
    onScrollEnd: select.onScrollEnd,
    onOpenChange: select.onOpenChange,
    error,
  };
}

function useDynamicOptions(
  source?: string,
  workspaceId?: string | null,
): {
  options: ConfigFieldOption[];
  loading: boolean;
  refresh: () => void;
} {
  const [options, setOptions] = useState<ConfigFieldOption[]>([]);
  const [loading, setLoading] = useState(!!source);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!source) {
      setOptions([]);
      setLoading(false);
      return;
    }

    if (source === "members" && !workspaceId) {
      setOptions([]);
      setLoading(false);
      return;
    }

    let cancelled = false;

    setLoading(true);

    (async () => {
      let fetched: ConfigFieldOption[] = [];
      try {
        switch (source) {
          case "medias": {
            const res = await listMediasAction();
            if (!cancelled && res.medias) {
              fetched = res.medias.map((m) => ({
                value: m.id,
                label: m.description || m.type,
              }));
            }
            break;
          }
          case "ai_models": {
            const res = await getAgentOptionsAction();
            if (!cancelled && res.options?.messaging) {
              fetched = res.options.messaging.map((m) => ({
                value: m,
                label: m.includes("/") ? m.split("/").slice(1).join("/") : m,
              }));
            }
            break;
          }
          case "labels": {
            const res = await listLabelsAction();
            if (!cancelled && res.labels) {
              fetched = res.labels.map((l) => ({
                value: l.id,
                label: l.name,
              }));
            }
            break;
          }
          case "departments": {
            const res = await fetchDepartments();
            if (!cancelled && res.departments) {
              fetched = res.departments.map((d) => ({
                value: d.id,
                label: d.name,
              }));
            }
            break;
          }
          case "members": {
            if (!workspaceId) {
              break;
            }

            const res = await listMembersAction(workspaceId);
            if (!cancelled && res.members) {
              fetched = res.members.map((member) => ({
                value: member.userId,
                label: formatMemberLabel(member),
              }));
            }
            break;
          }
        }
      } catch {
        // silently ignore
      }
      if (!cancelled) {
        setOptions(fetched);
        setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [source, tick, workspaceId]);

  return { options, loading, refresh };
}


interface TemplateParam {
  name: string;
  component: "body" | "header";
  index: number;
}

function extractTemplateParams(
  template: WhatsAppTemplate | null,
): TemplateParam[] {
  if (!template) return [];
  const params: TemplateParam[] = [];
  const seen = new Set<string>();

  for (const comp of template.components) {
    if (comp.type !== "BODY" && comp.type !== "HEADER") continue;
    if (comp.type === "HEADER" && comp.format !== "TEXT") continue;
    const text = comp.text ?? "";
    const matches = text.matchAll(/\{\{(\w+)\}\}/g);
    let idx = 0;
    for (const m of matches) {
      const name = m[1];
      const key = `${comp.type}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      params.push({
        name,
        component: comp.type === "HEADER" ? "header" : "body",
        index: idx++,
      });
    }
  }
  return params;
}


function TemplateParamsSection({
  params,
  values,
  onChange,
  templateName,
  availableVars,
}: {
  params: TemplateParam[];
  values: Record<string, string>;
  onChange: (params: Record<string, string>) => void;
  templateName?: string;
  availableVars: VarGroup[];
}) {
  const updateParam = useCallback(
    (key: string, val: string) => {
      onChange({ ...values, [key]: val });
    },
    [values, onChange],
  );

  const bodyParams = params.filter((p) => p.component === "body");
  const headerParams = params.filter((p) => p.component === "header");

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Parâmetros do Template
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {templateName && (
        <p className="text-[10px] text-muted-foreground">
          Template:{" "}
          <span className="font-medium text-foreground">{templateName}</span>
        </p>
      )}

      {headerParams.length > 0 && (
        <div className="space-y-2">
          <span className="text-[10px] font-medium text-muted-foreground uppercase">
            Cabeçalho
          </span>
          {headerParams.map((p) => {
            const paramKey = `header_${p.name}`;
            return (
              <VariableCommandInput
                key={paramKey}
                label={`${p.name} *`}
                value={values[paramKey] ?? ""}
                onChange={(val) => updateParam(paramKey, val)}
                placeholder={`Ex: {{var.${p.name}}} ou valor fixo`}
                controlSize="sm"
                availableVars={availableVars}
              />
            );
          })}
        </div>
      )}

      {bodyParams.length > 0 && (
        <div className="space-y-2">
          {headerParams.length > 0 && (
            <span className="text-[10px] font-medium text-muted-foreground uppercase">
              Corpo
            </span>
          )}
          {bodyParams.map((p) => (
            <VariableCommandInput
              key={p.name}
              label={`${p.name} *`}
              value={values[p.name] ?? ""}
              onChange={(val) => updateParam(p.name, val)}
              placeholder={`Ex: {{var.${p.name}}} ou valor fixo`}
              controlSize="sm"
              availableVars={availableVars}
            />
          ))}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground italic">
        Use {"{{var.nome}}"} para interpolar variáveis do fluxo.
      </p>
    </div>
  );
}


function SelectField({
  field,
  label,
  value,
  displayValue,
  onChange,
  error,
  workspaceId,
}: {
  field: ConfigField;
  label: string;
  value: unknown;
  displayValue?: string;
  onChange: (val: unknown, meta?: Record<string, unknown>) => void;
  error?: string;
  workspaceId?: string | null;
}) {
  const nc = useTranslations("workflows.nodeConfig");
  const shouldUsePaginated =
    !field.options?.length && isPaginatedOptionSource(field.optionsSource);
  const { options: dynamicOptions, loading } = useDynamicOptions(
    shouldUsePaginated || field.optionsSource === "ai_models"
      ? undefined
      : field.optionsSource,
    workspaceId,
  );
  const {
    options: paginatedOptions,
    isLoading: paginatedLoading,
    onSearch,
    onScrollEnd,
    onOpenChange,
    error: paginatedError,
  } = usePaginatedConfigOptions(field.optionsSource, shouldUsePaginated);

  if (field.optionsSource === "medias") {
    return (
      <MediaSelectField
        field={field}
        label={label}
        value={value}
        onChange={onChange}
        error={error}
      />
    );
  }

  if (field.optionsSource === "ai_models") {
    return (
      <div className="space-y-1">
        <ModelCombobox
          label={label}
          value={(value as string) ?? ""}
          onValueChange={(v: string) => onChange(v)}
        />
        {error && <p className="text-[10px] text-destructive">{error}</p>}
      </div>
    );
  }

  const options = field.options?.length ? field.options : dynamicOptions;
  const strVal = (value as string) ?? "";
  const safeOptions = options.filter((o) => o.value !== "");

  if (shouldUsePaginated) {
    const selectedOption = strVal
      ? {
          label: displayValue || strVal,
          value: strVal,
        }
      : null;
    const commandOptions = mergeCommandOptions(
      selectedOption,
      paginatedOptions,
    );

    return (
      <div className="space-y-1">
        <ElevatedCommandSelect
          label={label}
          value={strVal}
          onValueChange={(v, option) =>
            onChange(
              v,
              option ? { [`_display_${field.key}`]: option.label } : undefined,
            )
          }
          options={commandOptions}
          searchPlaceholder={getSourceSearchPlaceholder(
            field.optionsSource,
            nc,
          )}
          emptyMessage={
            paginatedError ?? getSourceEmptyMessage(field.optionsSource)
          }
          onSearch={onSearch}
          onScrollEnd={onScrollEnd}
          onOpenChange={onOpenChange}
          isLoading={paginatedLoading}
        />
        {error && <p className="text-[10px] text-destructive">{error}</p>}
        {paginatedError && (
          <p className="text-[10px] text-destructive">{paginatedError}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <ElevatedSelect
        label={label}
        placeholder={loading ? nc("loading") : (field.placeholder ?? "")}
        value={strVal}
        onValueChange={(v) => {
          const opt = safeOptions.find((o) => o.value === v);
          onChange(
            v,
            opt ? { [`_display_${field.key}`]: opt.label } : undefined,
          );
        }}
      >
        {safeOptions.map((opt) => (
          <ElevatedSelectItem key={opt.value} value={opt.value}>
            {opt.label}
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      {error && <p className="text-[10px] text-destructive">{error}</p>}
    </div>
  );
}


const ACCEPTED_MEDIA_TYPES =
  "image/jpeg,image/png,image/gif,image/webp,video/mp4,video/webm,audio/mpeg,audio/ogg,audio/wav,application/pdf";

function detectMediaTypeFromFile(file: File): string {
  if (file.type.startsWith("image")) return "image";
  if (file.type.startsWith("video")) return "video";
  if (file.type.startsWith("audio")) return "audio";
  return "document";
}

function mediaTypeIcon(type: string) {
  const t = type?.toLowerCase() ?? "";
  if (t.includes("image") || t === "sticker")
    return <ImageIcon size={14} weight="duotone" />;
  if (t.includes("video") || t === "vsl_video")
    return <VideoCamera size={14} weight="duotone" />;
  if (t.includes("audio")) return <SpeakerHigh size={14} weight="duotone" />;
  return <FileIcon size={14} weight="duotone" />;
}

function MediaSelectField({
  field,
  label,
  value,
  onChange,
  error,
}: {
  field: ConfigField;
  label: string;
  value: unknown;
  onChange: (val: unknown, meta?: Record<string, unknown>) => void;
  error?: string;
}) {
  const nc = useTranslations("workflows.nodeConfig");
  const {
    options: dynamicOptions,
    loading,
    refresh,
  } = useDynamicOptions("medias");

  const [mediaList, setMediaList] = useState<Media[]>([]);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await listMediasAction();
      if (!cancelled && res.medias) setMediaList(res.medias);
    })();
    return () => {
      cancelled = true;
    };
  }, [dynamicOptions]); 

  const options = field.options?.length ? field.options : dynamicOptions;
  const safeOptions = options.filter((o) => o.value !== "");
  const strVal = (value as string) ?? "";

  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const handleUpload = useCallback(
    async (file: File) => {
      setUploadError(null);
      setUploading(true);
      try {
        const formData = new FormData();
        formData.append("media", file);
        formData.append("mediaType", detectMediaTypeFromFile(file));
        formData.append("description", file.name);

        const res = await uploadMediaAction(formData);
        if (res.error || !res.mediaId) {
          setUploadError(res.error ?? nc("mediaUploadError"));
          return;
        }
        refresh();
        const uploadMeta: Record<string, unknown> = {
          [`_display_${field.key}`]: file.name,
          _media_type: detectMediaTypeFromFile(file),
        };
        if (res.mediaPreviewUrl || res.mediaUrl) {
          uploadMeta._media_preview_url = res.mediaPreviewUrl || res.mediaUrl;
        }
        onChange(res.mediaId, uploadMeta);
      } catch {
        setUploadError(nc("mediaUploadError"));
      } finally {
        setUploading(false);
      }
    },
    [onChange, refresh, field.key],
  );

  const onFileChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleUpload(file);
      e.target.value = "";
    },
    [handleUpload],
  );

  return (
    <div className="space-y-2">
      <ElevatedSelect
        label={label}
        placeholder={
          loading ? nc("loading") : (field.placeholder ?? "Selecione uma mídia")
        }
        value={strVal}
        onValueChange={(v) => {
          const opt = safeOptions.find((o) => o.value === v);
          const media = mediaList.find((m) => m.id === v);
          const meta: Record<string, unknown> = {};
          if (opt) meta[`_display_${field.key}`] = opt.label;
          if (media) {
            meta._media_preview_url = media.previewUrl || media.url;
            meta._media_type = media.type;
          }
          onChange(v, Object.keys(meta).length > 0 ? meta : undefined);
        }}
      >
        {safeOptions.map((opt) => (
          <ElevatedSelectItem key={opt.value} value={opt.value}>
            <span className="inline-flex items-center gap-1.5">
              {mediaTypeIcon(opt.label)}
              {opt.label}
            </span>
          </ElevatedSelectItem>
        ))}
      </ElevatedSelect>
      {error && <p className="text-[10px] text-destructive">{error}</p>}

      {/* Inline upload area */}
      <input
        ref={fileRef}
        type="file"
        accept={ACCEPTED_MEDIA_TYPES}
        className="hidden"
        onChange={onFileChange}
      />
      <button
        type="button"
        disabled={uploading}
        onClick={() => fileRef.current?.click()}
        className={cn(
          "w-full flex items-center justify-center gap-1.5 rounded-lg border border-dashed border-border py-2 px-3",
          "text-[11px] text-muted-foreground hover:border-primary/50 hover:text-lamp-ink transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        <UploadSimple size={14} weight="bold" />
        {uploading ? "Enviando..." : "Enviar nova mídia"}
      </button>
      {uploadError && (
        <p className="text-[10px] text-destructive">{uploadError}</p>
      )}
    </div>
  );
}


function ModelCombobox({
  label,
  value,
  onValueChange,
}: {
  label?: string;
  value: string;
  onValueChange: (value: string) => void;
}) {
  const nc = useTranslations("workflows.nodeConfig");
  const [models, setModels] = useState<string[]>([]);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadModelOptions() {
      setLoading(true);
      try {
        const res = await getAgentOptionsAction();
        if (cancelled) {
          return;
        }

        const messagingModels = res.options?.messaging ?? [];
        setModels(messagingModels);
        setModelPricing(res.options?.modelPricing ?? []);
        setLoadError(res.error ?? null);
      } catch {
        if (cancelled) {
          return;
        }

        setModels([]);
        setModelPricing([]);
        setLoadError(nc("modelLoadError"));
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadModelOptions();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-1">
      <AIModelSelector
        label={label ?? nc("aiModelLabel")}
        value={value}
        onValueChange={onValueChange}
        models={models}
        modelPricing={modelPricing}
        disabled={loading || models.length === 0}
        emptyMessage={loadError ?? "Nenhum modelo encontrado"}
      />
      {loadError && <p className="text-[10px] text-destructive">{loadError}</p>}
    </div>
  );
}


interface ToolParam {
  name: string;
  type: string;
  description: string;
  required: boolean;
  enum?: string[];
}

interface ToolItem {
  name: string;
  description: string;
  parameters: ToolParam[];
}

function ToolsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const nc = useTranslations("workflows.nodeConfig");
  const tools: ToolItem[] = useMemo(() => {
    if (!Array.isArray(value)) return [];
    return value.map((t) => ({
      name: t?.name ?? "",
      description: t?.description ?? "",
      parameters: Array.isArray(t?.parameters)
        ? t.parameters.map((p: Record<string, unknown>) => ({
            name: (p?.name as string) ?? "",
            type: (p?.type as string) ?? "string",
            description: (p?.description as string) ?? "",
            required: Boolean(p?.required),
            enum: Array.isArray(p?.enum)
              ? (p.enum as string[]).filter(Boolean)
              : undefined,
          }))
        : [],
    }));
  }, [value]);

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const updateTools = useCallback(
    (updated: ToolItem[]) => onChange(updated),
    [onChange],
  );

  const addTool = useCallback(() => {
    const newTools = [...tools, { name: "", description: "", parameters: [] }];
    updateTools(newTools);
    setExpandedIndex(newTools.length - 1);
  }, [tools, updateTools]);

  const removeTool = useCallback(
    (index: number) => {
      updateTools(tools.filter((_, i) => i !== index));
      if (expandedIndex === index) setExpandedIndex(null);
      else if (expandedIndex !== null && expandedIndex > index)
        setExpandedIndex(expandedIndex - 1);
    },
    [tools, updateTools, expandedIndex],
  );

  const updateTool = useCallback(
    (index: number, partial: Partial<ToolItem>) => {
      updateTools(
        tools.map((t, i) => (i === index ? { ...t, ...partial } : t)),
      );
    },
    [tools, updateTools],
  );

  const addParam = useCallback(
    (toolIndex: number) => {
      const tool = tools[toolIndex];
      if (!tool) return;
      updateTool(toolIndex, {
        parameters: [
          ...tool.parameters,
          {
            name: "",
            type: "string",
            description: "",
            required: false,
            enum: undefined,
          },
        ],
      });
    },
    [tools, updateTool],
  );

  const removeParam = useCallback(
    (toolIndex: number, paramIndex: number) => {
      const tool = tools[toolIndex];
      if (!tool) return;
      updateTool(toolIndex, {
        parameters: tool.parameters.filter((_, i) => i !== paramIndex),
      });
    },
    [tools, updateTool],
  );

  const updateParam = useCallback(
    (toolIndex: number, paramIndex: number, partial: Partial<ToolParam>) => {
      const tool = tools[toolIndex];
      if (!tool) return;
      updateTool(toolIndex, {
        parameters: tool.parameters.map((p, i) =>
          i === paramIndex ? { ...p, ...partial } : p,
        ),
      });
    },
    [tools, updateTool],
  );

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-medium text-foreground block">
            Ferramentas Personalizadas
          </span>
          <span className="text-[10px] text-muted-foreground">
            A IA pode chamar estas ferramentas durante a conversa
          </span>
        </div>
        <ElevatedButton
          variant="ghost"
          size="sm"
          onClick={addTool}
          icon={<Plus size={14} weight="bold" />}
          iconVisible
        >
          Nova
        </ElevatedButton>
      </div>

      {tools.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-mist p-4 text-center">
          <Wrench
            size={24}
            weight="duotone"
            className="text-muted-foreground/50 mx-auto mb-2"
          />
          <p className="text-xs text-muted-foreground">
            Nenhuma ferramenta configurada
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-1">
            Adicione ferramentas para que a IA possa executar ações
          </p>
        </div>
      )}

      {tools.map((tool, ti) => {
        const isExpanded = expandedIndex === ti;
        const hasErrors = !tool.name || !tool.description;
        return (
          <div
            key={ti}
            className={cn(
              "rounded-lg border overflow-hidden transition-colors",
              hasErrors && !isExpanded
                ? "border-warning/50 bg-warning/5"
                : "border-border bg-card",
            )}
          >
            {/* Tool header */}
            <div
              className="flex items-center gap-2 px-3 py-2.5 cursor-pointer hover:bg-muted transition-colors"
              onClick={() => setExpandedIndex(isExpanded ? null : ti)}
            >
              <div
                className={cn(
                  "flex h-7 w-7 items-center justify-center rounded-md shrink-0",
                  tool.name ? "bg-muted" : "bg-muted",
                )}
              >
                <Wrench
                  size={14}
                  weight="duotone"
                  className={
                    tool.name ? "text-lamp-ink" : "text-muted-foreground"
                  }
                />
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium truncate block">
                  {tool.name || (
                    <span className="text-muted-foreground italic">
                      Nova ferramenta
                    </span>
                  )}
                </span>
                {tool.description && (
                  <span className="text-[10px] text-muted-foreground truncate block">
                    {tool.description}
                  </span>
                )}
              </div>
              {tool.parameters.length > 0 && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-md font-medium">
                  {tool.parameters.length}{" "}
                  {tool.parameters.length === 1 ? "param" : "params"}
                </span>
              )}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  removeTool(ti);
                }}
                className="text-muted-foreground hover:text-destructive shrink-0 p-1 rounded hover:bg-destructive/10 transition-colors"
              >
                <Trash size={14} />
              </button>
              {isExpanded ? (
                <CaretDown
                  size={14}
                  className="text-muted-foreground shrink-0"
                />
              ) : (
                <CaretRight
                  size={14}
                  className="text-muted-foreground shrink-0"
                />
              )}
            </div>

            {/* Expanded tool config */}
            {isExpanded && (
              <div className="border-t border-border bg-mist px-3 py-3 space-y-4">
                {/* Basic info */}
                <div className="space-y-3">
                  <ElevatedInput
                    label="Nome da função *"
                    value={tool.name}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      updateTool(ti, {
                        name: e.target.value.replace(/\s/g, "_"),
                      })
                    }
                    placeholder="agendar_reuniao"
                    controlSize="sm"
                    error={!tool.name ? nc("required") : undefined}
                  />
                  <ElevatedTextarea
                    label={nc("descriptionLabel")}
                    value={tool.description}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) =>
                      updateTool(ti, { description: e.target.value })
                    }
                    placeholder="Quando o usuário quiser agendar uma reunião, chame esta função com os dados necessários."
                    controlSize="sm"
                    rows={2}
                  />
                </div>

                {/* Parameters section */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between border-t border-border pt-3">
                    <span className="text-xs font-medium text-foreground">
                      Parâmetros
                    </span>
                    <ElevatedButton
                      variant="ghost"
                      size="sm"
                      onClick={() => addParam(ti)}
                      icon={<Plus size={12} weight="bold" />}
                      iconVisible
                      className="h-7 text-[10px]"
                    >
                      Adicionar
                    </ElevatedButton>
                  </div>

                  {tool.parameters.length === 0 && (
                    <p className="text-[10px] text-muted-foreground italic py-2 px-2 bg-muted rounded-md">
                      Sem parâmetros, a IA chamará esta função sem argumentos
                    </p>
                  )}

                  <div className="space-y-2">
                    {tool.parameters.map((param, pi) => (
                      <div
                        key={pi}
                        className="rounded-md border border-border bg-card p-3 space-y-2"
                      >
                        <div className="flex items-start gap-2">
                          <div className="flex-1 space-y-2">
                            <div className="flex gap-2 items-end">
                              <div className="flex-1">
                                <ElevatedInput
                                  label="Nome"
                                  value={param.name}
                                  onChange={(
                                    e: ChangeEvent<HTMLInputElement>,
                                  ) =>
                                    updateParam(ti, pi, {
                                      name: e.target.value.replace(/\s/g, "_"),
                                    })
                                  }
                                  placeholder="data_inicio"
                                  controlSize="sm"
                                />
                              </div>
                              <div className="w-28">
                                <ElevatedSelect
                                  value={param.type}
                                  onValueChange={(v) =>
                                    updateParam(ti, pi, { type: v })
                                  }
                                >
                                  <ElevatedSelectItem value="string">
                                    Texto
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="number">
                                    Número
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="boolean">
                                    Sim/Não
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="date">
                                    Data
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="time">
                                    Hora
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="datetime">
                                    Data/Hora
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="email">
                                    Email
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="phone">
                                    Telefone
                                  </ElevatedSelectItem>
                                  <ElevatedSelectItem value="enum">
                                    Opções
                                  </ElevatedSelectItem>
                                </ElevatedSelect>
                              </div>
                            </div>
                            <ElevatedInput
                              label={nc("description")}
                              value={param.description}
                              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                updateParam(ti, pi, {
                                  description: e.target.value,
                                })
                              }
                              placeholder="Data de início do evento no formato YYYY-MM-DD"
                              controlSize="sm"
                            />
                            {param.type === "enum" && (
                              <ElevatedInput
                                label="Opções (separadas por vírgula)"
                                value={(param.enum ?? []).join(", ")}
                                onChange={(
                                  e: ChangeEvent<HTMLInputElement>,
                                ) => {
                                  const raw = e.target.value;
                                  const vals = raw
                                    .split(",")
                                    .map((s) => s.trim())
                                    .filter(Boolean);
                                  updateParam(ti, pi, {
                                    enum: vals.length > 0 ? vals : undefined,
                                  });
                                }}
                                placeholder="manhã, tarde, noite"
                                controlSize="sm"
                              />
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => removeParam(ti, pi)}
                            className="text-muted-foreground hover:text-destructive shrink-0 p-1.5 rounded hover:bg-destructive/10 transition-colors mt-5"
                          >
                            <Trash size={14} />
                          </button>
                        </div>
                        <div
                          role="checkbox"
                          aria-checked={param.required}
                          tabIndex={0}
                          onClick={() =>
                            updateParam(ti, pi, {
                              required: !param.required,
                            })
                          }
                          onKeyDown={(e) => {
                            if (e.key === " " || e.key === "Enter") {
                              e.preventDefault();
                              updateParam(ti, pi, {
                                required: !param.required,
                              });
                            }
                          }}
                          className={cn(
                            "flex items-center gap-2 text-xs rounded-md px-2.5 py-2 transition-colors cursor-pointer select-none border",
                            param.required
                              ? "bg-muted border-primary/30 text-foreground"
                              : "bg-muted border-transparent text-muted-foreground hover:bg-muted",
                          )}
                        >
                          <div
                            className={cn(
                              "w-4 h-4 rounded border flex items-center justify-center transition-all",
                              param.required
                                ? "bg-primary border-primary"
                                : "border-muted-foreground/50 bg-transparent",
                            )}
                          >
                            {param.required && (
                              <Check
                                size={10}
                                weight="bold"
                                className="text-primary-foreground"
                              />
                            )}
                          </div>
                          <span className="font-medium">
                            {param.required ? nc("required") : nc("optional")}
                          </span>
                          <span className="text-muted-foreground text-[10px]">
                            {param.required
                              ? ", IA deve preencher"
                              : ", IA pode ignorar"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        );
      })}

      {tools.length > 0 && (
        <div className="flex items-center gap-2 px-2 py-2 rounded-md bg-muted border border-dashed border-border">
          <div className="flex h-5 w-5 items-center justify-center rounded bg-muted">
            <ArrowRight size={10} className="text-muted-foreground" />
          </div>
          <span className="text-[10px] text-muted-foreground">
            <strong>Resposta de texto:</strong> Quando a IA responde sem chamar
            nenhuma ferramenta
          </span>
        </div>
      )}
    </div>
  );
}


interface ButtonItem {
  Type: "reply" | "copy_code";
  ID: string;
  Title: string;
  CopyCode: string;
}

/**
 * InteractiveReachContext carries the interactive prompt's per-channel limits
 * down to the option editors.
 *
 * Context rather than props because the option editors are reached through
 * SchemaField's generic `field.type` dispatch, which every other field type
 * shares. Threading two interactive-only props through that dispatch would put
 * this node's concern in the path of a dozen unrelated fields.
 */
const InteractiveReachContext = createContext<{
  style: PromptStyle;
  channelLimits: Record<string, ChannelInteractiveLimits>;
}>({ style: "buttons", channelLimits: {} });

function useInteractiveReach() {
  return useContext(InteractiveReachContext);
}

function ButtonsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const nc = useTranslations("workflows.nodeConfig");
  const buttons: ButtonItem[] = useMemo(() => {
    try {
      const raw = typeof value === "string" ? value : "[]";
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map((b: Record<string, unknown>) => ({
        Type: b.Type === "copy_code" ? "copy_code" : "reply",
        ID: (b.ID as string) ?? "",
        Title: (b.Title as string) ?? "",
        CopyCode: (b.CopyCode as string) ?? "",
      }));
    } catch {
      return [];
    }
  }, [value]);

  const emit = useCallback(
    (updated: ButtonItem[]) => onChange(JSON.stringify(updated)),
    [onChange],
  );

  const { style, channelLimits } = useInteractiveReach();

  const hasCopyCode = buttons.some((b) => b.Type === "copy_code");
  const hasReply = buttons.some((b) => b.Type === "reply");
  // The ceiling is the most permissive connected channel, not WhatsApp's three.
  // Stopping at three would make it impossible to author the fourth option that
  // Telegram renders perfectly well; the per-option notes below say which
  // channels drop the overflow.
  const maxOptions = authorableOptionCount(style, channelLimits, 3);
  const isFull = buttons.length >= maxOptions;

  const addReply = useCallback(() => {
    if (isFull || hasCopyCode) return;
    emit([
      ...buttons,
      { Type: "reply", ID: `btn_${Date.now()}`, Title: "", CopyCode: "" },
    ]);
  }, [buttons, emit, isFull, hasCopyCode]);

  const addCopyCode = useCallback(() => {
    if (isFull || hasCopyCode || hasReply) return;
    emit([
      ...buttons,
      { Type: "copy_code", ID: `btn_${Date.now()}`, Title: "", CopyCode: "" },
    ]);
  }, [buttons, emit, isFull, hasCopyCode, hasReply]);

  const removeButton = useCallback(
    (index: number) => emit(buttons.filter((_, i) => i !== index)),
    [buttons, emit],
  );

  const updateButton = useCallback(
    (index: number, partial: Partial<ButtonItem>) => {
      emit(buttons.map((b, i) => (i !== index ? b : { ...b, ...partial })));
    },
    [buttons, emit],
  );

  const canAddReply = !isFull && !hasCopyCode;
  const canAddCopyCode = buttons.length === 0;

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-foreground block">
          Botões interativos
        </span>
        <ChannelReachLegend style={style} channelLimits={channelLimits} />
      </div>

      {/* Quick-add strip */}
      {(canAddReply || canAddCopyCode) && (
        <div className="flex gap-1.5">
          {canAddReply && (
            <button
              type="button"
              onClick={addReply}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-muted py-2 text-[11px] font-medium text-lamp-ink hover:bg-muted transition-colors"
            >
              <Plus size={13} weight="bold" />
              Resposta rápida
            </button>
          )}
          {canAddCopyCode && (
            <button
              type="button"
              onClick={addCopyCode}
              className="flex-1 flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-muted py-2 text-[11px] font-medium text-lamp-ink hover:bg-muted transition-colors"
            >
              <Copy size={13} weight="bold" />
              Copiar código
            </button>
          )}
        </div>
      )}

      {/* Empty hint */}
      {buttons.length === 0 && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Adicione até{" "}
          <strong>
            {maxOptions} {maxOptions === 1 ? "opção" : "opções"}
          </strong>{" "}
          ou <strong>1 botão de copiar código</strong>. Não é possível misturar
          os dois tipos.
        </p>
      )}

      {/* Button cards */}
      {buttons.map((btn, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-mist p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
              {btn.Type === "reply" ? (
                <>
                  <CaretRight
                    size={10}
                    weight="bold"
                    className="text-lamp-ink"
                  />
                  Resposta rápida
                </>
              ) : (
                <>
                  <Copy size={10} weight="bold" className="text-lamp-ink" />
                  Copiar código
                </>
              )}
            </span>
            <button
              type="button"
              onClick={() => removeButton(i)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash size={14} />
            </button>
          </div>

          {btn.Type === "reply" && (
            <ElevatedInput
              label="Texto do botão"
              value={btn.Title}
              onChange={(e: ChangeEvent<HTMLInputElement>) =>
                updateButton(i, { Title: e.target.value })
              }
              placeholder="Ex: Confirmar, Cancelar, Sim..."
              controlSize="sm"
              error={!btn.Title ? nc("required") : undefined}
            />
          )}

          {btn.Type === "copy_code" && (
            <>
              <ElevatedInput
                label="Código / cupom"
                value={btn.CopyCode}
                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                  updateButton(i, { CopyCode: e.target.value })
                }
                placeholder="Ex: DESCONTO20"
                controlSize="sm"
                error={!btn.CopyCode ? nc("required") : undefined}
              />
              <p className="text-[10px] text-muted-foreground">
                Use{" "}
                <code className="bg-muted px-1 rounded text-[10px]">
                  {"{{variável}}"}
                </code>{" "}
                para valores dinâmicos. O usuário receberá um botão para copiar
                este código.
              </p>
            </>
          )}

          <OptionChannelReach
            option={{ id: btn.ID, title: btn.Title }}
            index={i}
            style={style}
            channelLimits={channelLimits}
          />
        </div>
      ))}

      {/* Limit / constraint hints */}
      {isFull && (
        <p className="text-[10px] text-muted-foreground italic">
          Limite de {maxOptions} opções atingido
        </p>
      )}
      {hasReply && !isFull && (
        <p className="text-[10px] text-muted-foreground">
          {buttons.length}/{maxOptions} opções · Clique acima para adicionar
          mais
        </p>
      )}
    </div>
  );
}


interface ListRowItem {
  id: string;
  title: string;
  description: string;
}

// ListSectionsField edits the interactive list's rows. It presents a flat list of
// up to 10 options (WhatsApp's max) and persists them wrapped in a single section,
// the shape the backend/executor expect ([{title, rows:[...]}]). Each row's id
// is the STABLE routing key (auto-generated, never shown) that becomes the node's
// output handle; the title/description are what the contact sees.
function ListSectionsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const nc = useTranslations("workflows.nodeConfig");
  const rows: ListRowItem[] = useMemo(() => {
    try {
      const raw = typeof value === "string" ? value : "[]";
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) return [];
      const out: ListRowItem[] = [];
      for (const section of parsed) {
        const secRows = Array.isArray(section?.rows) ? section.rows : [];
        for (const r of secRows) {
          out.push({
            id: (r?.id as string) ?? "",
            title: (r?.title as string) ?? "",
            description: (r?.description as string) ?? "",
          });
        }
      }
      return out;
    } catch {
      return [];
    }
  }, [value]);

  const emit = useCallback(
    (updated: ListRowItem[]) =>
      onChange(JSON.stringify([{ title: "", rows: updated }])),
    [onChange],
  );

  const { style, channelLimits } = useInteractiveReach();
  // Telegram renders far more than WhatsApp's ten list rows, so the ceiling is
  // the most permissive connected channel and the overflow is annotated instead
  // of being unauthorable.
  const maxOptions = authorableOptionCount(style, channelLimits, 10);
  const isFull = rows.length >= maxOptions;

  const addRow = useCallback(() => {
    if (isFull) return;
    emit([...rows, { id: `row_${Date.now()}`, title: "", description: "" }]);
  }, [rows, emit, isFull]);

  const removeRow = useCallback(
    (index: number) => emit(rows.filter((_, i) => i !== index)),
    [rows, emit],
  );

  const updateRow = useCallback(
    (index: number, partial: Partial<ListRowItem>) => {
      emit(rows.map((r, i) => (i !== index ? r : { ...r, ...partial })));
    },
    [rows, emit],
  );

  return (
    <div className="space-y-2.5">
      <div className="space-y-1.5">
        <span className="text-xs font-medium text-foreground block">
          Opções da lista
        </span>
        <ChannelReachLegend style={style} channelLimits={channelLimits} />
      </div>

      {!isFull && (
        <button
          type="button"
          onClick={addRow}
          className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-muted py-2 text-[11px] font-medium text-lamp-ink hover:bg-muted transition-colors"
        >
          <Plus size={13} weight="bold" />
          Adicionar opção
        </button>
      )}

      {rows.length === 0 && (
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Adicione até <strong>{maxOptions} opções</strong>. Cada opção vira uma
          saída do nó, permitindo um caminho diferente por escolha.
        </p>
      )}

      {rows.map((row, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-mist p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground flex items-center gap-1.5">
              <CaretRight size={10} weight="bold" className="text-lamp-ink" />
              Opção {i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeRow(i)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash size={14} />
            </button>
          </div>

          <ElevatedInput
            label="Título"
            value={row.title}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateRow(i, { title: e.target.value })
            }
            placeholder="Ex: Falar com vendas"
            controlSize="sm"
            error={!row.title ? nc("required") : undefined}
          />
          <ElevatedInput
            label="Descrição (opcional)"
            value={row.description}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateRow(i, { description: e.target.value })
            }
            placeholder="Texto secundário abaixo do título"
            controlSize="sm"
          />
          <DescriptionReachNote channelLimits={channelLimits} />

          <OptionChannelReach
            option={{ id: row.id, title: row.title }}
            index={i}
            style={style}
            channelLimits={channelLimits}
          />
        </div>
      ))}

      {isFull && (
        <p className="text-[10px] text-muted-foreground italic">
          Limite de {maxOptions} opções atingido
        </p>
      )}
      {rows.length > 0 && !isFull && (
        <p className="text-[10px] text-muted-foreground">
          {rows.length}/{maxOptions} opções
        </p>
      )}
    </div>
  );
}

interface ExpressionItem {
  variable: string;
  expression: string;
}

function ExpressionsField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const nc = useTranslations("workflows.nodeConfig");
  const expressions: ExpressionItem[] = useMemo(() => {
    try {
      const raw = typeof value === "string" ? value : "[]";
      const parsed = JSON.parse(raw || "[]");
      if (!Array.isArray(parsed)) return [];
      return parsed.map((e: Record<string, unknown>) => ({
        variable: (e.variable as string) ?? "",
        expression: (e.expression as string) ?? "",
      }));
    } catch {
      return [];
    }
  }, [value]);

  const emit = useCallback(
    (updated: ExpressionItem[]) => onChange(JSON.stringify(updated)),
    [onChange],
  );

  const addExpression = useCallback(() => {
    emit([...expressions, { variable: "", expression: "" }]);
  }, [expressions, emit]);

  const removeExpression = useCallback(
    (index: number) => emit(expressions.filter((_, i) => i !== index)),
    [expressions, emit],
  );

  const updateExpression = useCallback(
    (index: number, partial: Partial<ExpressionItem>) => {
      emit(expressions.map((e, i) => (i !== index ? e : { ...e, ...partial })));
    },
    [expressions, emit],
  );

  return (
    <div className="space-y-2.5">
      <span className="text-xs font-medium text-foreground block">
        Expressões
      </span>

      <p className="text-[10px] text-muted-foreground leading-relaxed">
        Cada expressão cria uma variável acessível nos próximos nós via{" "}
        <code className="bg-muted px-1 rounded text-[10px]">
          {"{{var.nome}}"}
        </code>
        . Use{" "}
        <code className="bg-muted px-1 rounded text-[10px]">
          {"{{last.campo}}"}
        </code>{" "}
        para dados do nó anterior.
      </p>

      {expressions.map((expr, i) => (
        <div
          key={i}
          className="rounded-lg border border-border bg-mist p-2.5 space-y-2"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-medium text-muted-foreground">
              Variável #{i + 1}
            </span>
            <button
              type="button"
              onClick={() => removeExpression(i)}
              className="text-muted-foreground hover:text-destructive transition-colors"
            >
              <Trash size={14} />
            </button>
          </div>
          <ElevatedInput
            label="Nome da variável"
            value={expr.variable}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateExpression(i, { variable: e.target.value })
            }
            placeholder="Ex: preco_final"
            controlSize="sm"
            error={!expr.variable ? nc("required") : undefined}
          />
          <ElevatedInput
            label="Expressão"
            value={expr.expression}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateExpression(i, { expression: e.target.value })
            }
            placeholder="Ex: {{last.price}} * 1.1"
            controlSize="sm"
            error={!expr.expression ? nc("required") : undefined}
          />
        </div>
      ))}

      <button
        type="button"
        onClick={addExpression}
        className="w-full flex items-center justify-center gap-1.5 rounded-md border border-dashed border-primary/40 bg-muted py-2 text-[11px] font-medium text-lamp-ink hover:bg-muted transition-colors"
      >
        <Plus size={13} weight="bold" />
        Adicionar expressão
      </button>

      <details className="text-[10px] text-muted-foreground">
        <summary className="cursor-pointer hover:text-foreground transition-colors font-medium">
          Funções disponíveis
        </summary>
        <div className="mt-1.5 space-y-0.5 pl-2">
          <p>
            <strong>Texto:</strong> upper(), lower(), trim(), length(),
            reverse(), replace(texto, antigo, novo), concat(a, b, ...),
            split(texto, separador), substring(texto, início, tamanho)
          </p>
          <p>
            <strong>Número:</strong> tonumber(), abs(), round(), floor(), ceil()
          </p>
          <p>
            <strong>Matemática:</strong> + - * / % (ex:{" "}
            <code className="bg-muted px-0.5 rounded">
              {"{{last.price}} * 0.9"}
            </code>
            )
          </p>
          <p>
            <strong>JSON:</strong> jsonparse(), jsonstringify()
          </p>
        </div>
      </details>
    </div>
  );
}


interface CaseItem {
  value: string;
}

function CasesField({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (val: unknown) => void;
}) {
  const cases: CaseItem[] = Array.isArray(value) ? value : [];

  const addCase = useCallback(() => {
    onChange([...cases, { value: "" }]);
  }, [cases, onChange]);

  const removeCase = useCallback(
    (index: number) => {
      onChange(cases.filter((_, i) => i !== index));
    },
    [cases, onChange],
  );

  const updateCase = useCallback(
    (index: number, newValue: string) => {
      const updated = cases.map((c, i) =>
        i === index ? { ...c, value: newValue } : c,
      );
      onChange(updated);
    },
    [cases, onChange],
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-foreground">Casos</span>
        <button
          type="button"
          onClick={addCase}
          className="flex items-center gap-1 text-[10px] font-medium text-lamp-ink hover:underline"
        >
          <Plus size={12} weight="bold" />
          Adicionar
        </button>
      </div>

      {cases.map((c, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground font-mono w-5 shrink-0">
            {i + 1}.
          </span>
          <ElevatedInput
            value={c.value}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              updateCase(i, e.target.value)
            }
            placeholder={`Valor ${i + 1}`}
            controlSize="sm"
          />
          <button
            type="button"
            onClick={() => removeCase(i)}
            className="text-muted-foreground hover:text-destructive shrink-0"
          >
            <Trash size={14} />
          </button>
        </div>
      ))}

      {cases.length > 0 && (
        <div className="flex items-center gap-1.5 opacity-60">
          <span className="text-[10px] text-muted-foreground font-mono w-5 shrink-0">
            ↳
          </span>
          <span className="text-[10px] text-muted-foreground italic">
            Nenhuma correspondência (se nenhum caso corresponder)
          </span>
        </div>
      )}
    </div>
  );
}


interface VarGroup {
  label: string;
  description?: string;
  vars: { template: string; description: string }[];
}

function buildAvailableVariables(
  nodeId: string,
  allNodes: Node[],
  allEdges: Edge[],
  definitions: NodeDefinition[],
): VarGroup[] {
  const groups: VarGroup[] = [];
  const defMap = new Map(definitions.map((d) => [d.type, d]));

  const incomingMap = new Map<string, string[]>();
  for (const edge of allEdges) {
    const arr = incomingMap.get(edge.target) ?? [];
    arr.push(edge.source);
    incomingMap.set(edge.target, arr);
  }

  const edgeLabelMap = new Map<string, string>();
  for (const edge of allEdges) {
    const lbl = (edge.sourceHandle as string) || (edge.label as string) || "";
    if (lbl) edgeLabelMap.set(`${edge.source}:${edge.target}`, lbl);
  }

  const visited = new Set<string>();
  const ordered: string[] = [];
  const ancestorToolLabel = new Map<string, string>();
  let frontier = incomingMap.get(nodeId) ?? [];
  for (const id of frontier) {
    visited.add(id);
    const lbl = edgeLabelMap.get(`${id}:${nodeId}`);
    if (lbl) ancestorToolLabel.set(id, lbl);
  }
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    for (const nid of frontier) {
      ordered.push(nid);
      const nidLabel = ancestorToolLabel.get(nid);
      for (const src of incomingMap.get(nid) ?? []) {
        if (!visited.has(src)) {
          visited.add(src);
          nextFrontier.push(src);
          const lbl = edgeLabelMap.get(`${src}:${nid}`);
          if (lbl) ancestorToolLabel.set(src, lbl);
          else if (nidLabel) ancestorToolLabel.set(src, nidLabel);
        }
      }
    }
    frontier = nextFrontier;
  }

  const directParentIds = new Set(incomingMap.get(nodeId) ?? []);

  const addedIds = new Set<string>();

  for (const ancestorId of ordered) {
    const ancestorNode = allNodes.find((n) => n.id === ancestorId);
    if (!ancestorNode) continue;
    const srcData = ancestorNode.data as unknown as WorkflowNodeData;
    const srcDef = defMap.get(srcData.nodeType);
    if (!srcDef) continue;
    if (addedIds.has(ancestorId)) continue;
    addedIds.add(ancestorId);

    const isDirect = directParentIds.has(ancestorId);
    const nodeLabel = srcDef.label ?? srcData.nodeType;
    const vars: { template: string; description: string }[] = [];

    const toolEdgeLabel = ancestorToolLabel.get(ancestorId);

    const captureVar =
      srcData.config?.capture_variable ?? srcData.config?.response_variable;
    const hasCustomVar =
      typeof captureVar === "string" && captureVar.trim() !== "";
    const varName = hasCustomVar ? captureVar.trim() : null;

    const outputKeys = srcDef.outputKeys;
    if (outputKeys && outputKeys.length > 0) {
      for (const ok of outputKeys) {
        if (ok.key === "*") continue;

        if (varName) {
          vars.push({
            template: `{{${varName}.${ok.key}}}`,
            description: ok.description,
          });
        } else {
          vars.push({
            template: isDirect
              ? `{{last.${ok.key}}}`
              : `{{node.${ancestorId}.${ok.key}}}`,
            description: ok.description,
          });
        }
      }
    }

    if (varName) {
      vars.push({
        template: `{{${varName}}}`,
        description: "Objeto completo da resposta",
      });

      if (srcData.config?.response_variable && srcData.config?.custom_tools) {
        const tools = srcData.config.custom_tools as Array<{
          name: string;
          parameters?: Array<{
            name: string;
            description?: string;
            required?: boolean;
          }>;
        }>;
        const matchedTool = toolEdgeLabel
          ? tools.find((t) => t.name === toolEdgeLabel)
          : undefined;
        const toolsToShow = matchedTool ? [matchedTool] : [];
        for (const tool of toolsToShow) {
          if (!tool.parameters?.length) continue;
          for (const param of tool.parameters) {
            if (!param.name) continue;
            const opt = param.required === false ? " (opcional)" : "";
            vars.push({
              template: `{{${varName}.tool_args.${param.name}}}`,
              description: `${param.description || param.name}${opt}`,
            });
          }
        }
      }
    }

    if (vars.length > 0) {
      groups.push({
        label: isDirect ? `${nodeLabel} (nó anterior)` : nodeLabel,
        description: isDirect ? undefined : `ID: ${ancestorId}`,
        vars,
      });
    }
  }

  groups.push({
    label: "Sistema",
    vars: [
      { template: "{{message}}", description: "Texto da mensagem recebida" },
      { template: "{{sys.date}}", description: "Data atual (YYYY-MM-DD)" },
      { template: "{{sys.time}}", description: "Hora atual (HH:MM:SS)" },
      { template: "{{sys.timestamp}}", description: "Timestamp Unix" },
    ],
  });

  return groups;
}


function MediaPreviewSection({ media }: { media: Media }) {
  const url = media.previewUrl || media.url;
  const mediaType = media.type?.toLowerCase() ?? "";

  const isImage = mediaType.includes("image") || mediaType === "sticker";
  const isVideo = mediaType.includes("video") || mediaType === "vsl_video";
  const isAudio = mediaType.includes("audio");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
          Preview
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="rounded-lg border border-border overflow-hidden bg-muted">
        {isImage && url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={media.description || "Media preview"}
            className="w-full h-auto max-h-40 object-contain"
          />
        )}
        {isVideo && url && (
          <video
            src={url}
            controls
            className="w-full max-h-40"
            preload="metadata"
          />
        )}
        {isAudio && url && (
          <audio src={url} controls className="w-full" preload="metadata" />
        )}
        {!isImage && !isVideo && !isAudio && (
          <div className="p-3 flex items-center gap-2">
            <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
              <span className="text-xs font-semibold text-muted-foreground">
                {mediaType.split("_").pop()?.toUpperCase() || "DOC"}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">
                {media.description || "Documento"}
              </p>
              <p className="text-[10px] text-muted-foreground">{media.type}</p>
            </div>
          </div>
        )}
      </div>

      {media.description && (
        <p className="text-[10px] text-muted-foreground truncate">
          {media.description}
        </p>
      )}
    </div>
  );
}

function AvailableVariablesPanel({ groups }: { groups: VarGroup[] }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  if (groups.length === 0) return null;

  const query = search.toLowerCase().trim();
  const filteredGroups = query
    ? groups
        .map((g) => ({
          ...g,
          vars: g.vars.filter(
            (v) =>
              v.template.toLowerCase().includes(query) ||
              v.description.toLowerCase().includes(query) ||
              g.label.toLowerCase().includes(query),
          ),
        }))
        .filter((g) => g.vars.length > 0)
    : groups;

  return (
    <div className="border border-border rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
      >
        {open ? (
          <CaretDown size={12} weight="bold" />
        ) : (
          <CaretRight size={12} weight="bold" />
        )}
        <Info size={12} />
        Variáveis disponíveis
        <span className="ml-auto text-[10px] text-muted-foreground/60">
          {groups.reduce((n, g) => n + g.vars.length, 0)}
        </span>
      </button>

      {open && (
        <div className="px-3 pb-3 space-y-2">
          <ElevatedInput
            value={search}
            onChange={(e: ChangeEvent<HTMLInputElement>) =>
              setSearch(e.target.value)
            }
            placeholder="Buscar variável..."
            controlSize="sm"
          />
          {filteredGroups.length === 0 && (
            <p className="text-[10px] text-muted-foreground italic py-1">
              Nenhuma variável encontrada.
            </p>
          )}
          {filteredGroups.map((group) => (
            <VariableGroup key={group.label} group={group} />
          ))}
        </div>
      )}
    </div>
  );
}

function VariableGroup({ group }: { group: VarGroup }) {
  return (
    <div className="space-y-1">
      <span className="text-[10px] font-semibold text-foreground uppercase tracking-wider">
        {group.label}
      </span>
      {group.vars.map((v) => (
        <VariableRow
          key={v.template}
          template={v.template}
          description={v.description}
        />
      ))}
    </div>
  );
}

function VariableRow({
  template,
  description,
}: {
  template: string;
  description: string;
}) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(template).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  }, [template]);

  return (
    <div className="flex flex-col gap-0.5 group">
      <button
        type="button"
        onClick={handleCopy}
        className="flex items-center gap-1 w-full font-mono text-[10px] bg-muted hover:bg-muted px-1.5 py-0.5 rounded text-lamp-ink transition-colors text-left min-w-0"
        title={template}
      >
        {copied ? (
          <span className="text-green-500 shrink-0">✓</span>
        ) : (
          <Copy
            size={10}
            className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        )}
        <span className="truncate">{template}</span>
      </button>
      <span
        className="text-[10px] text-muted-foreground leading-snug pl-1 line-clamp-2"
        title={description}
      >
        {description}
      </span>
    </div>
  );
}
