"use client";

import type {
  Agent,
  AgentOptions,
  AgentToolCategory,
  AgentToolDefinition,
  AgentVariable,
  CreateAgentPayload,
  RAGConfig,
  ToolConfig,
  ToolVisibility,
  UpdateAgentPayload,
} from "@/lib/agents/types";
import { listMCPCollectionsAction } from "@/app/actions/agent-mcp";
import type { AgentMCPCollection } from "@/lib/agent-mcp/types";
import {
  CaretDown,
  CaretUp,
  ChatCircle,
  CheckCircle,
  File,
  Files,
  Gear,
  GearSix,
  ImageSquare,
  Info,
  MagnifyingGlass,
  Pause,
  Phone,
  Play,
  PlugsConnected,
  Plus,
  Sliders,
  Trash,
  UploadSimple,
  Warning,
  WhatsappLogo,
} from "@/components/icons";
import { Controller, useForm } from "react-hook-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import ElevatedSelect, {
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import {
  createAgentAction,
  getAgentOptionsAction,
  getAgentToolsAction,
  updateAgentAction,
} from "@/app/actions/agents";
import { getMediaAction, uploadMediaAction } from "@/app/actions/medias";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import Button from "@/components/elevated-design/button";
import CreateTemplateDialog from "./CreateTemplateDialog";
import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import HttpRequestConfigDialog from "./HttpRequestConfigDialog";
import { IconBox } from "@/components/elevated-design/listing-card";
import { KnowledgeBaseSelector } from "@/components/agents/KnowledgeBaseSelector";
import { apiClient } from "@/lib/api/browser-client";
import type { Media } from "@/lib/medias/types";
import { extractAgentVariableNames } from "@/lib/agents/extract-variable-names";
import { Switch } from "@/components/ui/switch";
import TemplateEditModal from "@/components/whatsapp/TemplateEditModal";
import ToolConfigDialog from "./ToolConfigDialog";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import { cn } from "@/lib/utils";
import { getBrand } from "@/config/brand";

import TourGuide from "@/components/TourGuide";
import { agentsTourSteps, agentsTourPalette, agentsTourSeed } from "@/data/tour-agents";
import {
  getBusinessPhoneByIdAction,
  listBusinessPhonesAction,
} from "@/app/actions/whatsapp-business-phones";
import {
  getWhatsAppTemplateByIdAction,
  listWhatsAppTemplatesAction,
  updateWhatsAppTemplateHeaderMediaAction,
} from "@/app/actions/whatsapp-templates";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import {
} from "@/lib/branding/ai-models";

const toolBindingSchema = z.object({
  name: z.string(),
  visibility: z.array(z.enum(["messaging", "post_conversation"])).optional(),
  config: z.record(z.string(), z.unknown()).optional(),
});

const createAgentSchema = (t: (key: string) => string) => {
  return z
    .object({
      name: z.string().trim().min(2, t("validation.nameRequired")),
      provider: z.string().min(1, t("validation.providerRequired")),
      messagingModel: z.string().min(1, t("validation.messagingModelRequired")),
      internalTools: z
        .array(toolBindingSchema)
        .min(1, t("validation.toolsRequired")),
      description: z.string().optional(),
      initialMessage: z.string().optional().default(""),
      useInitialMessage: z.boolean().default(true),
      messagingPrompt: z
        .string()
        .trim()
        .min(1, t("validation.messagingPromptRequired")),
      whatsappTemplateId: z.string().optional(),
      mediaIds: z.array(z.string()).optional(),
    })
    .superRefine((data, ctx) => {
      if (data.useInitialMessage && !data.initialMessage.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["initialMessage"],
          message: t("validation.initialMessageRequired"),
        });
      }
    });
};

type AgentFormData = z.infer<ReturnType<typeof createAgentSchema>>;

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-destructive">{message}</p>;
};

function upsertEntitiesById<T extends { id: string }>(
  current: T[],
  incoming: T[],
) {
  if (incoming.length === 0) {
    return current;
  }

  const next = new Map(current.map((item) => [item.id, item]));
  incoming.forEach((item) => {
    next.set(item.id, item);
  });
  return Array.from(next.values());
}

function prependSelectedOption(
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

const FormErrorSummary = ({
  errors,
  t,
}: {
  errors: Record<string, unknown>;
  t: (key: string) => string;
}) => {
  const errorKeys = Object.keys(errors);
  if (errorKeys.length === 0) return null;

  const fieldLabels: Record<string, string> = {
    name: t("labels.name"),
    provider: t("labels.provider"),
    messagingModel: t("labels.messagingModel"),
    initialMessage: t("labels.initialMessage"),
    messagingPrompt: t("labels.messagingPrompt"),
    internalTools: t("sections.tools.title"),
  };

  return (
    <div className="rounded-[--radius] border border-rose-300 bg-destructive/10 dark:bg-rose-950/30 dark:border-rose-800 px-5 py-4 space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2 text-destructive dark:text-destructive">
        <Warning weight="fill" className="h-5 w-5 flex-shrink-0" />
        <p className="text-sm font-semibold">
          {t("validation.formErrorTitle")}
        </p>
      </div>
      <ul className="list-disc list-inside space-y-0.5 text-xs text-destructive dark:text-destructive pl-1">
        {errorKeys.map((key) => {
          const err = errors[key] as { message?: string } | undefined;
          const label = fieldLabels[key] || key;
          return (
            <li key={key}>
              <span className="font-medium">{label}</span>
              {err?.message ? `: ${err.message}` : ""}
            </li>
          );
        })}
      </ul>
    </div>
  );
};

interface AvailableToolRowProps {
  tool: AgentToolDefinition;
  disabled?: boolean;
  onAdd: () => void;
  t: (key: string) => string;
}

// Compact row for the "Available" panel: scan-and-add affordance.
const AvailableToolRow = ({ tool, disabled, onAdd, t }: AvailableToolRowProps) => {
  const requiresConfig = tool.requiresConfig === true;
  const description = tool.displayDescription || tool.description;
  const name = tool.displayName || tool.name;

  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={disabled}
      aria-label={`${t("tools.add")}, ${name}`}
      className={cn(
        "group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors",
        "hover:bg-muted focus-visible:bg-muted focus-visible:outline-none",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors group-hover:bg-muted group-hover:text-lamp-ink">
        <PlugsConnected weight="fill" className="h-4 w-4" aria-hidden="true" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm font-medium text-foreground">
            {name}
          </span>
          {requiresConfig && (
            <Gear
              weight="fill"
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label={t("tools.configurable")}
            />
          )}
        </span>
        {description && (
          <span className="mt-0.5 block truncate text-xs text-muted-foreground">
            {description}
          </span>
        )}
      </span>
      <span
        aria-hidden="true"
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-border text-muted-foreground transition-colors group-hover:border-primary group-hover:bg-primary group-hover:text-primary-foreground"
      >
        <Plus weight="bold" className="h-4 w-4" />
      </span>
    </button>
  );
};

interface SelectedToolItemProps {
  tool: AgentToolDefinition;
  currentVisibility?: ToolVisibility[];
  currentConfig?: ToolConfig;
  disabled?: boolean;
  onRemove: () => void;
  onVisibilityChange: (visibility: ToolVisibility[]) => void;
  onConfigureClick: () => void;
  t: (key: string) => string;
}

// Rich item for the "Selected" panel: the per-tool configuration surface
// (visibility, config status, parameters).
const SelectedToolItem = ({
  tool,
  currentVisibility,
  currentConfig,
  disabled,
  onRemove,
  onVisibilityChange,
  onConfigureClick,
  t,
}: SelectedToolItemProps) => {
  const [showParameters, setShowParameters] = useState(false);

  const name = tool.displayName || tool.name;
  const description = tool.displayDescription || tool.description;
  const parameterEntries = Object.entries(tool.parameters ?? {});
  const requiredParameters = new Set(tool.required ?? []);
  const toolDefaultVisibility = tool.visibility ?? ["messaging"];
  const effectiveVisibility = currentVisibility ?? toolDefaultVisibility;

  const requiresConfig = tool.requiresConfig === true;
  const hasConfig = currentConfig && Object.keys(currentConfig).length > 0;
  const requiredConfigFields = new Set(tool.requiredConfig ?? []);
  const isConfigComplete =
    !requiresConfig ||
    (hasConfig &&
      Array.from(requiredConfigFields).every(
        (field) =>
          currentConfig?.[field] !== undefined &&
          currentConfig?.[field] !== null &&
          currentConfig?.[field] !== "",
      ));

  const toggleVisibility = (vis: ToolVisibility) => {
    const isEnabled = effectiveVisibility.includes(vis);
    if (isEnabled && effectiveVisibility.length === 1) return; // keep at least one
    const next = isEnabled
      ? effectiveVisibility.filter((v) => v !== vis)
      : [...effectiveVisibility, vis];
    onVisibilityChange(next as ToolVisibility[]);
  };

  return (
    <li className="px-3 py-3">
      <div className="flex items-start gap-3">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-muted text-lamp-ink">
          <PlugsConnected weight="fill" className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="truncate text-sm font-medium text-foreground">
                  {name}
                </span>
                {requiresConfig && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-medium text-lamp-ink">
                    <Gear weight="fill" className="h-3 w-3" />
                    {t("tools.configurable")}
                  </span>
                )}
              </div>
              {description && (
                <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onRemove}
              disabled={disabled}
              aria-label={`${t("tools.remove")}, ${name}`}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500/40 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Trash weight="bold" className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* Visibility. Only "messaging" is user-controllable: post_conversation
              is decided by the tool itself (the wrap-up analysis job picks its
              tools by name, not by this flag), so exposing it as a toggle
              suggested a control that does not exist. The value is still carried
              through untouched on save. */}
          {toolDefaultVisibility.includes("messaging") && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-[11px] font-medium text-muted-foreground">
                {t("tools.availability")}
              </span>
              <button
                type="button"
                onClick={() => toggleVisibility("messaging")}
                aria-pressed={effectiveVisibility.includes("messaging")}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-2 py-1 text-xs font-medium transition-colors",
                  effectiveVisibility.includes("messaging")
                    ? "border border-healthy bg-healthy text-white"
                    : "border border-border bg-muted text-muted-foreground hover:border-healthy/50 hover:text-foreground",
                )}
              >
                <ChatCircle className="h-3 w-3" weight="fill" aria-hidden="true" />
                {t("tools.messaging")}
              </button>
            </div>
          )}

          {/* Configuration status */}
          {requiresConfig && (
            <div
              className={cn(
                "flex items-center justify-between gap-3 rounded-lg border px-3 py-2",
                isConfigComplete
                  ? "border-healthy/25 bg-healthy/10"
                  : "border-warning/25 bg-warning/10",
              )}
            >
              <span className="flex items-center gap-1.5 text-xs font-medium">
                {isConfigComplete ? (
                  <>
                    <CheckCircle weight="fill" className="h-4 w-4 text-healthy" />
                    <span className="text-healthy">{t("tools.configComplete")}</span>
                  </>
                ) : (
                  <>
                    <Warning weight="fill" className="h-4 w-4 text-warning" />
                    <span className="text-warning">{t("tools.configRequired")}</span>
                  </>
                )}
              </span>
              <button
                type="button"
                onClick={onConfigureClick}
                className="inline-flex shrink-0 items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-medium text-foreground shadow-sm transition-colors hover:border-primary hover:text-lamp-ink"
              >
                <Gear weight="fill" className="h-3.5 w-3.5" />
                {isConfigComplete ? t("tools.editConfig") : t("tools.configure")}
              </button>
            </div>
          )}

          {/* Parameters (collapsed by default) */}
          {parameterEntries.length > 0 && (
            <div>
              <button
                type="button"
                onClick={() => setShowParameters((v) => !v)}
                aria-expanded={showParameters}
                className="inline-flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                <Info weight="fill" className="h-3.5 w-3.5" />
                {t("tools.expectedParameters")} ({parameterEntries.length})
                {showParameters ? (
                  <CaretUp weight="bold" className="h-3 w-3" />
                ) : (
                  <CaretDown weight="bold" className="h-3 w-3" />
                )}
              </button>
              {showParameters && (
                <ul className="mt-2 space-y-2 rounded-lg border border-border bg-muted p-3 text-sm">
                  {parameterEntries.map(([key, parameter]) => (
                    <li key={key} className="flex flex-col gap-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-medium text-foreground">
                          {parameter?.displayName || key}
                        </span>
                        <span className="rounded bg-border px-1.5 py-0.5 text-[11px] text-muted-foreground">
                          {parameter?.type ?? "string"}
                        </span>
                        {requiredParameters.has(key) && (
                          <span className="rounded bg-warning/15 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                            {t("tools.required")}
                          </span>
                        )}
                      </div>
                      {(parameter?.displayDescription || parameter?.description) && (
                        <span className="text-xs text-muted-foreground">
                          {parameter.displayDescription || parameter.description}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
      </div>
    </li>
  );
};

interface CreateNewAgentFormProps {
  mode?: "create" | "edit";
  initialAgent?: Agent | null;
}

export default function CreateNewAgentForm({
  mode = "create",
  initialAgent,
}: CreateNewAgentFormProps) {
  const [options, setOptions] = useState<AgentOptions | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(true);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const [tools, setTools] = useState<AgentToolDefinition[]>([]);
  const [loadingTools, setLoadingTools] = useState(true);
  const [toolsError, setToolsError] = useState<string | null>(null);

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesError, setTemplatesError] = useState<string | null>(null);
  const [createTemplateDialogOpen, setCreateTemplateDialogOpen] =
    useState(false);
  const [templateMediaModalOpen, setTemplateMediaModalOpen] = useState(false);
  const [isSavingTemplateMedia, setIsSavingTemplateMedia] = useState(false);

  const [businessPhones, setBusinessPhones] = useState<WhatsAppBusinessPhone[]>(
    [],
  );
  const [selectedBusinessPhoneId, setSelectedBusinessPhoneId] =
    useState<string>("");

  const [toolsSearch, setToolsSearch] = useState("");
  const [toolsCategory, setToolsCategory] = useState<AgentToolCategory | "all">(
    "all",
  );

  const [agentMedias, setAgentMedias] = useState<Media[]>([]);
  const [isUploadingMedia, setIsUploadingMedia] = useState(false);
  const [loadingMedias, setLoadingMedias] = useState(false);
  const [pendingMediaFiles, setPendingMediaFiles] = useState<
    { file: File; description: string }[]
  >([]);
  const [mediaDialogOpen, setMediaDialogOpen] = useState(false);
  const mediaInputRef = useRef<HTMLInputElement>(null);

  const [selectedKnowledgeBaseIds, setSelectedKnowledgeBaseIds] = useState<
    string[]
  >([]);

  const [ragEnabled, setRagEnabled] = useState<boolean>(
    initialAgent?.ragEnabled ?? false,
  );

  const [ragConfigOpen, setRagConfigOpen] = useState(false);
  const [ragConfig, setRagConfig] = useState<RAGConfig>(
    () => initialAgent?.ragConfig ?? {},
  );

  const [mcpCollections, setMcpCollections] = useState<AgentMCPCollection[]>([]);
  const [selectedMCPIds, setSelectedMCPIds] = useState<string[]>(() => initialAgent?.mcpCollectionIds ?? []);

  const [toolConfigDialogOpen, setToolConfigDialogOpen] = useState(false);
  const [configuringTool, setConfiguringTool] =
    useState<AgentToolDefinition | null>(null);

  const audioRef = useRef<HTMLAudioElement | null>(null);


  const [agentVariables, setAgentVariables] = useState<AgentVariable[]>(
    () => initialAgent?.variables ?? [],
  );

  const previousProviderRef = useRef<string | null>(null);
  const optionsLoadedRef = useRef(false);
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isSubmitting, startSubmit] = useTransition();
  const [activeTab, setActiveTab] = useState("geral");
  const t = useTranslations("agents.form");
  const tRef = useRef(t);
  tRef.current = t;

  const agentSchema = useMemo(() => createAgentSchema(t), [t]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitted },
    setValue,
    watch,
    reset,
    getValues,
  } = useForm<AgentFormData>({
    resolver: zodResolver(agentSchema),
    defaultValues: {
      name: initialAgent?.name ?? "",
      provider: "platform",
      messagingModel: initialAgent?.messagingModel ?? "",
      internalTools: initialAgent?.internalTools ?? [],
      description: initialAgent?.description ?? "",
      initialMessage: initialAgent?.initialMessage ?? "",
      useInitialMessage: initialAgent?.useInitialMessage ?? true,
      messagingPrompt: initialAgent?.messagingPrompt ?? "",
      whatsappTemplateId: initialAgent?.whatsappTemplateId ?? "",
      mediaIds: initialAgent?.mediaIds ?? [],
    },
  });

  const selectedWhatsAppTemplateId = watch("whatsappTemplateId");

  const watchedMessagingPrompt = watch("messagingPrompt") ?? "";
  const watchedInitialMessage = watch("initialMessage") ?? "";

  useEffect(() => {
    const detected = extractAgentVariableNames(
      watchedMessagingPrompt,
      watchedInitialMessage,
    );
    if (detected.length === 0) return;

    setAgentVariables((prev) => {
      const existing = new Map(prev.map((v) => [v.name, v]));
      let changed = false;
      const merged = [...prev];
      for (const name of detected) {
        if (!existing.has(name)) {
          merged.push({ name, description: "", defaultValue: "" });
          changed = true;
        }
      }
      return changed ? merged : prev;
    });
  }, [watchedMessagingPrompt, watchedInitialMessage]);

  const mapBusinessPhoneOption = useCallback(
    (phone: WhatsAppBusinessPhone): ElevatedCommandOption => ({
      label: phone.verifiedName
        ? `${phone.verifiedName} (${phone.displayPhoneNumber})`
        : phone.displayPhoneNumber,
      value: phone.id,
    }),
    [],
  );

  const mapTemplateOption = useCallback(
    (template: WhatsAppTemplate): ElevatedCommandOption => {
      const header = template.components.find(
        (component) => component.type === "HEADER",
      );
      const needsMedia =
        header?.format &&
        ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(header.format) &&
        !template.headerMediaUrl;

      return {
        label: template.name,
        value: template.id,
        description: needsMedia
          ? `${template.language}, ${t("templateMedia.missingMediaShort")}`
          : template.language,
        icon: <WhatsappLogo className="h-4 w-4 text-healthy" weight="fill" />,
      };
    },
    [t],
  );

  const businessPhoneSelect = usePaginatedSelect<WhatsAppBusinessPhone>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listBusinessPhonesAction({
        status: "CONNECTED",
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.phones ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: mapBusinessPhoneOption,
  });

  const templateSelect = usePaginatedSelect<WhatsAppTemplate>({
    fetchFn: useCallback(
      async (page: number, search: string) => {
        if (!selectedBusinessPhoneId) {
          setTemplatesError(null);
          return { items: [], totalPages: 1 };
        }

        const result = await listWhatsAppTemplatesAction({
          status: "APPROVED",
          businessPhoneId: selectedBusinessPhoneId,
          page,
          pageSize: 20,
          search: search || undefined,
        });

        setTemplatesError(result.error ?? null);
        return {
          items: result.templates ?? [],
          totalPages: result.meta.totalPages,
        };
      },
      [selectedBusinessPhoneId],
    ),
    mapOption: mapTemplateOption,
    enabled: Boolean(selectedBusinessPhoneId),
  });

  const loadingBusinessPhones = businessPhoneSelect.isLoading;
  const loadingTemplates = templateSelect.isLoading;

  useEffect(() => {
    setBusinessPhones((prev) =>
      upsertEntitiesById(prev, businessPhoneSelect.items),
    );
  }, [businessPhoneSelect.items]);

  useEffect(() => {
    setTemplates((prev) => upsertEntitiesById(prev, templateSelect.items));
  }, [templateSelect.items]);

  useEffect(() => {
    if (mode === "edit" && initialAgent?.businessPhoneId) {
      setSelectedBusinessPhoneId(initialAgent.businessPhoneId);
    }
  }, [mode, initialAgent?.businessPhoneId]);

  useEffect(() => {
    listMCPCollectionsAction().then((res) => {
      if ("error" in res && res.error) return;
      setMcpCollections(res.items ?? []);
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (
      !selectedBusinessPhoneId ||
      businessPhones.some((phone) => phone.id === selectedBusinessPhoneId)
    ) {
      return;
    }

    let active = true;
    getBusinessPhoneByIdAction(selectedBusinessPhoneId).then((result) => {
      const phone = result.phone;
      if (!active || !phone) {
        return;
      }

      setBusinessPhones((prev) => upsertEntitiesById(prev, [phone]));
    });

    return () => {
      active = false;
    };
  }, [selectedBusinessPhoneId, businessPhones]);

  useEffect(() => {
    if (
      !selectedWhatsAppTemplateId ||
      templates.some((template) => template.id === selectedWhatsAppTemplateId)
    ) {
      return;
    }

    let active = true;
    getWhatsAppTemplateByIdAction(selectedWhatsAppTemplateId).then((result) => {
      const template = result.template;
      if (!active || !template) {
        return;
      }

      setTemplates((prev) => upsertEntitiesById(prev, [template]));
    });

    return () => {
      active = false;
    };
  }, [selectedWhatsAppTemplateId, templates]);

  const businessPhoneOptions = useMemo(() => {
    const currentPhone = businessPhones.find(
      (phone) => phone.id === selectedBusinessPhoneId,
    );

    return [
      { label: t("placeholders.noPhoneSelected"), value: "" },
      ...prependSelectedOption(
        currentPhone ? mapBusinessPhoneOption(currentPhone) : null,
        businessPhoneSelect.options,
      ),
    ];
  }, [
    businessPhones,
    selectedBusinessPhoneId,
    t,
    mapBusinessPhoneOption,
    businessPhoneSelect.options,
  ]);

  const templateOptions = useMemo(() => {
    const currentTemplate = templates.find(
      (template) => template.id === selectedWhatsAppTemplateId,
    );

    return [
      { label: t("placeholders.noTemplateSelected"), value: "" },
      ...prependSelectedOption(
        currentTemplate ? mapTemplateOption(currentTemplate) : null,
        templateSelect.options,
      ),
    ];
  }, [
    templates,
    selectedWhatsAppTemplateId,
    t,
    mapTemplateOption,
    templateSelect.options,
  ]);

  const initialAgentIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (
      mode === "edit" &&
      initialAgent &&
      initialAgent.id !== initialAgentIdRef.current
    ) {
      initialAgentIdRef.current = initialAgent.id;
      reset({
        name: initialAgent.name ?? "",
        provider: "platform",
        messagingModel: initialAgent.messagingModel ?? "",
        internalTools: initialAgent.internalTools ?? [],
        description: initialAgent.description ?? "",
        initialMessage: initialAgent.initialMessage ?? "",
        useInitialMessage: initialAgent.useInitialMessage ?? true,
        messagingPrompt: initialAgent.messagingPrompt ?? "",
        whatsappTemplateId: initialAgent.whatsappTemplateId ?? "",
        mediaIds: initialAgent.mediaIds ?? [],
      });
      setRagConfig(initialAgent.ragConfig ?? {});
      setAgentVariables(initialAgent.variables ?? []);
      previousProviderRef.current = initialAgent.provider ?? null;
    }
  }, [mode, initialAgent, reset]);

  useEffect(() => {
    if (mode !== "edit" || !initialAgent?.mediaIds?.length) return;

    let active = true;

    async function loadExistingMedia() {
      setLoadingMedias(true);
      try {
        const mediaPromises = initialAgent!.mediaIds.map((id) =>
          getMediaAction(id),
        );
        const mediaResults = await Promise.all(mediaPromises);

        if (!active) return;

        const validMedias = mediaResults.filter(
          (media): media is Media => media !== null,
        );
        setAgentMedias(validMedias);
      } catch {
        if (!active) return;
        console.error("Failed to load existing media");
      } finally {
        if (active) {
          setLoadingMedias(false);
        }
      }
    }

    loadExistingMedia();

    return () => {
      active = false;
    };
  }, [mode, initialAgent]);

  useEffect(() => {
    if (mode !== "edit" || !initialAgent?.id) return;

    let active = true;

    async function loadLinkedKnowledgeBases() {
      try {
        const { data, error } = await apiClient<{
          knowledgeBases?: { id: string }[];
        }>(`/agents/${initialAgent!.id}/knowledge-bases`);
        if (error || !data) return;
        if (!active) return;

        const linkedKbs = data.knowledgeBases || [];
        setSelectedKnowledgeBaseIds(linkedKbs.map((kb) => kb.id));
      } catch {
        if (!active) return;
        console.error("Failed to load linked knowledge bases");
      }
    }

    loadLinkedKnowledgeBases();

    return () => {
      active = false;
    };
  }, [mode, initialAgent]);

  useEffect(() => {
    if (optionsLoadedRef.current) return;
    let active = true;

    async function loadOptions() {
      setLoadingOptions(true);
      try {
        const { options: fetchedOptions, error } =
          await getAgentOptionsAction();
        if (!active) return;

        if (!fetchedOptions) {
          setOptions(null);
          setOptionsError(error ?? tRef.current("loading.optionsError"));
          return;
        }

        setOptions(fetchedOptions);
        setOptionsError(null);
        optionsLoadedRef.current = true;

        const currentValues = getValues();
        const providersList = fetchedOptions.providers ?? [];
        const messagingList = fetchedOptions.messaging ?? [];
        const defaultMessagingFromDefaults =
          fetchedOptions.defaults?.messagingModel ?? "";
        const preferredDefaultModel = "openai/gpt-4o-mini";

        const defaultProvider =
          currentValues.provider || providersList[0]?.id || "";
        const preferredMessagingExists = messagingList.includes(
          preferredDefaultModel,
        );
        const defaultMessaging =
          currentValues.messagingModel ||
          (mode === "create" && preferredMessagingExists
            ? preferredDefaultModel
            : "") ||
          defaultMessagingFromDefaults ||
          messagingList[0] ||
          "";

        if (defaultProvider !== currentValues.provider) {
          setValue("provider", defaultProvider);
        }
        if (defaultMessaging !== currentValues.messagingModel) {
          setValue("messagingModel", defaultMessaging);
        }

        previousProviderRef.current = defaultProvider || null;
      } catch {
        if (!active) return;
        setOptions(null);
        setOptionsError(tRef.current("loading.optionsError"));
        previousProviderRef.current = null;
      } finally {
        if (active) {
          setLoadingOptions(false);
        }
      }
    }

    loadOptions();

    return () => {
      active = false;
    };
  }, [getValues, setValue]);

  useEffect(() => {
    let active = true;

    async function loadTools() {
      setLoadingTools(true);
      try {
        const { tools: fetchedTools, error } = await getAgentToolsAction();

        if (!active) return;

        if (error) {
          setTools([]);
          setToolsError(error || t("sections.mcp.failedToLoadTools"));
          return;
        }

        setTools(fetchedTools ?? []);
        setToolsError(null);
      } catch {
        if (!active) return;
        setTools([]);
        setToolsError(t("sections.mcp.failedToLoadTools"));
      } finally {
        if (active) {
          setLoadingTools(false);
        }
      }
    }

    loadTools();

    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleTemplateCreated = (template: WhatsAppTemplate) => {
    setTemplates((prev) => upsertEntitiesById(prev, [template]));
    setValue("whatsappTemplateId", template.id, {
      shouldDirty: true,
      shouldValidate: true,
    });
    setCreateTemplateDialogOpen(false);
  };

  const selectedWhatsAppTemplate = useMemo(
    () => templates.find((t) => t.id === selectedWhatsAppTemplateId),
    [templates, selectedWhatsAppTemplateId],
  );

  const selectedTemplateHasMediaHeader = useMemo(() => {
    if (!selectedWhatsAppTemplate) return false;
    const header = selectedWhatsAppTemplate.components.find(
      (c) => c.type === "HEADER",
    );
    return (
      header?.format !== undefined &&
      ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(header.format)
    );
  }, [selectedWhatsAppTemplate]);

  const selectedTemplateMissingMedia = useMemo(
    () =>
      selectedTemplateHasMediaHeader &&
      !selectedWhatsAppTemplate?.headerMediaUrl,
    [selectedTemplateHasMediaHeader, selectedWhatsAppTemplate],
  );

  const handleSaveTemplateHeaderMedia = async (
    headerMediaUrl: string | null,
  ) => {
    if (!selectedWhatsAppTemplate) return;
    setIsSavingTemplateMedia(true);
    try {
      const result = await updateWhatsAppTemplateHeaderMediaAction(
        selectedWhatsAppTemplate.id,
        { headerMediaUrl: headerMediaUrl ?? "" },
      );
      if (result.success) {
        setTemplates((prev) =>
          prev.map((tpl) =>
            tpl.id === selectedWhatsAppTemplate.id
              ? { ...tpl, headerMediaUrl }
              : tpl,
          ),
        );
        toast({
          title: t("templateMedia.saved"),
          description: t("templateMedia.savedDescription"),
        });
        setTemplateMediaModalOpen(false);
      } else {
        toast({
          title: t("templateMedia.saveError"),
          description: result.error || t("templateMedia.saveErrorDescription"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("templateMedia.saveError"),
        description: t("templateMedia.saveErrorDescription"),
        variant: "destructive",
      });
    } finally {
      setIsSavingTemplateMedia(false);
    }
  };

  const filteredTools = useMemo(() => {
    return tools.filter((tool) => {
      const searchLower = toolsSearch.toLowerCase();
      const matchesSearch =
        (tool.displayName || tool.name).toLowerCase().includes(searchLower) ||
        tool.name.toLowerCase().includes(searchLower) ||
        (tool.displayDescription || tool.description)
          .toLowerCase()
          .includes(searchLower);
      const matchesCategory =
        toolsCategory === "all" || tool.category === toolsCategory;
      return matchesSearch && matchesCategory;
    });
  }, [tools, toolsSearch, toolsCategory]);

  const selectedProvider = watch("provider");
  const selectedMessagingModel = watch("messagingModel");
  const selectedInternalTools = watch("internalTools");

  // Split the catalog into the two panels: "Available" honours the search +
  // category filter; "Selected" always shows every bound tool (it's the config
  // surface), in stable catalog order so rows don't jump while you tune them.
  const availableTools = useMemo(
    () =>
      filteredTools.filter(
        (tool) =>
          !(selectedInternalTools ?? []).some((b) => b.name === tool.name),
      ),
    [filteredTools, selectedInternalTools],
  );
  const selectedToolList = useMemo(
    () =>
      tools.filter((tool) =>
        (selectedInternalTools ?? []).some((b) => b.name === tool.name),
      ),
    [tools, selectedInternalTools],
  );

  const messagingModels = useMemo(() => options?.messaging ?? [], [options]);

  const pricingData = useMemo(() => options?.modelPricing ?? [], [options]);


  useEffect(() => {
    if (!options) return;

    if (!messagingModels.length) {
      if (selectedMessagingModel) {
        setValue("messagingModel", "", { shouldValidate: true });
      }
      return;
    }

    if (
      !selectedMessagingModel ||
      !messagingModels.includes(selectedMessagingModel)
    ) {
      setValue("messagingModel", messagingModels[0], {
        shouldValidate: true,
      });
    }
  }, [messagingModels, options, selectedMessagingModel, setValue]);


  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);

  const normalizeOptional = (value?: string | null) => {
    if (!value) return undefined;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : undefined;
  };

  const handleToggleTool = (tool: AgentToolDefinition) => {
    const currentTools = getValues("internalTools") ?? [];
    const existingToolIndex = currentTools.findIndex(
      (t) => t.name === tool.name,
    );
    const alreadySelected = existingToolIndex >= 0;
    const toolDefaultVisibility = tool.visibility ?? ["messaging"];

    if (alreadySelected) {
      const nextTools = currentTools.filter((t) => t.name !== tool.name);
      setValue("internalTools", nextTools, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else {
      const needsConfiguration =
        tool.requiresConfig === true && tool.configSchema;

      if (needsConfiguration) {
        setConfiguringTool(tool);
        setToolConfigDialogOpen(true);
      } else {
        const nextTools = [
          ...currentTools,
          { name: tool.name, visibility: toolDefaultVisibility },
        ];
        setValue("internalTools", nextTools, {
          shouldDirty: true,
          shouldValidate: true,
        });
      }
    }
  };

  const handleOpenToolConfig = (tool: AgentToolDefinition) => {
    setConfiguringTool(tool);
    setToolConfigDialogOpen(true);
  };

  const handleSaveToolConfig = (config: ToolConfig) => {
    if (!configuringTool) return;

    const currentTools = getValues("internalTools") ?? [];
    const existingToolIndex = currentTools.findIndex(
      (t) => t.name === configuringTool.name,
    );
    const toolDefaultVisibility = configuringTool.visibility ?? ["messaging"];

    if (existingToolIndex >= 0) {
      const nextTools = currentTools.map((t, idx) =>
        idx === existingToolIndex ? { ...t, config } : t,
      );
      setValue("internalTools", nextTools, {
        shouldDirty: true,
        shouldValidate: true,
      });
    } else {
      const nextTools = [
        ...currentTools,
        {
          name: configuringTool.name,
          visibility: toolDefaultVisibility,
          config,
        },
      ];
      setValue("internalTools", nextTools, {
        shouldDirty: true,
        shouldValidate: true,
      });
    }

    setConfiguringTool(null);
  };

  const handleVisibilityChange = (
    toolName: string,
    newVisibility: ToolVisibility[],
  ) => {
    const currentTools = getValues("internalTools") ?? [];
    const nextTools = currentTools.map((t) =>
      t.name === toolName ? { ...t, visibility: newVisibility } : t,
    );

    setValue("internalTools", nextTools, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const handleFilesSelected = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const allowedExtensions = [
      "pdf",
      "doc",
      "docx",
      "txt",
      "png",
      "jpg",
      "jpeg",
      "webp",
    ];
    const fileArray = Array.from(files);
    const invalidFiles: string[] = [];
    const validFiles: File[] = [];

    for (const file of fileArray) {
      const fileExtension = file.name.split(".").pop()?.toLowerCase();
      if (!allowedExtensions.includes(fileExtension || "")) {
        invalidFiles.push(file.name);
      } else {
        validFiles.push(file);
      }
    }

    if (invalidFiles.length > 0) {
      toast({
        title: t("media.invalidFile"),
        description: invalidFiles.join(", "),
        variant: "destructive",
      });
    }

    if (validFiles.length === 0) return;

    setPendingMediaFiles(
      validFiles.map((file) => ({
        file,
        description: file.name.replace(/\.[^/.]+$/, ""), // Remove extension as default description
      })),
    );
    setMediaDialogOpen(true);

    if (mediaInputRef.current) {
      mediaInputRef.current.value = "";
    }
  };

  const handlePendingDescriptionChange = (
    index: number,
    description: string,
  ) => {
    setPendingMediaFiles((prev) =>
      prev.map((item, i) => (i === index ? { ...item, description } : item)),
    );
  };

  const handleRemovePendingFile = (index: number) => {
    setPendingMediaFiles((prev) => prev.filter((_, i) => i !== index));
    if (pendingMediaFiles.length === 1) {
      setMediaDialogOpen(false);
    }
  };

  const handleConfirmMediaUpload = async () => {
    if (pendingMediaFiles.length === 0) return;

    setMediaDialogOpen(false);
    setIsUploadingMedia(true);

    try {
      const uploads: Media[] = [];

      for (const { file, description } of pendingMediaFiles) {
        const formData = new FormData();
        formData.append("media", file);
        formData.append(
          "mediaType",
          file.type.startsWith("image/") ? "image" : "document",
        );
        formData.append("description", description || file.name);

        const response = await uploadMediaAction(formData);

        if (response.error) {
          throw new Error(response.error);
        }

        if (response.mediaId && response.mediaUrl) {
          uploads.push({
            id: response.mediaId,
            url: response.mediaUrl,
            previewUrl: response.mediaPreviewUrl ?? response.mediaUrl,
            description: description || file.name,
            createdAt: new Date().toISOString(),
            type: file.type.startsWith("image/") ? "image" : "document",
          });
        }
      }

      setAgentMedias((prev) => [...prev, ...uploads]);

      const currentIds = getValues("mediaIds") ?? [];
      setValue("mediaIds", [...currentIds, ...uploads.map((m) => m.id)], {
        shouldDirty: true,
        shouldValidate: true,
      });

      toast({
        title: t("media.uploadSuccess"),
        description: t("media.uploadSuccessDescription", {
          count: uploads.length,
        }),
      });
    } catch (error) {
      toast({
        title: t("media.uploadError"),
        description:
          error instanceof Error
            ? error.message
            : t("media.uploadErrorGeneric"),
        variant: "destructive",
      });
    } finally {
      setIsUploadingMedia(false);
      setPendingMediaFiles([]);
    }
  };

  const handleRemoveMedia = (mediaId: string) => {
    setAgentMedias((prev) => prev.filter((m) => m.id !== mediaId));
    setValue(
      "mediaIds",
      (getValues("mediaIds") ?? []).filter((id) => id !== mediaId),
      { shouldDirty: true, shouldValidate: true },
    );
  };

  const variableNamePattern = /^\w+$/;

  const onSubmit = (data: AgentFormData) => {
    startSubmit(async () => {
      const validVars = agentVariables.filter((v) => v.name.trim());
      for (const v of validVars) {
        if (!variableNamePattern.test(v.name.trim())) {
          toast({
            title: t("sections.variables.title"),
            description: t("sections.variables.invalidName", { name: v.name }),
            variant: "destructive",
          });
          return;
        }
      }
      const seenNames = new Set<string>();
      for (const v of validVars) {
        const lower = v.name.trim().toLowerCase();
        if (seenNames.has(lower)) {
          toast({
            title: t("sections.variables.title"),
            description: t("sections.variables.duplicateName", { name: v.name }),
            variant: "destructive",
          });
          return;
        }
        seenNames.add(lower);
      }
      if (validVars.length > 50) {
        toast({
          title: t("sections.variables.title"),
          description: t("sections.variables.tooMany"),
          variant: "destructive",
        });
        return;
      }
      const basePayload = {
        name: data.name.trim(),
        initialMessage: data.initialMessage.trim(),
        useInitialMessage: data.useInitialMessage,
        messagingPrompt: data.messagingPrompt.trim(),
        messagingModel: data.messagingModel,
        provider: data.provider,
        internalTools: data.internalTools,
        whatsappTemplateId: data.whatsappTemplateId || undefined,
        businessPhoneId: selectedBusinessPhoneId || undefined,
        mediaIds: data.mediaIds?.length ? data.mediaIds : undefined,
        ragEnabled: ragEnabled && selectedKnowledgeBaseIds.length > 0,
        ...(ragEnabled &&
        selectedKnowledgeBaseIds.length > 0 &&
        Object.keys(ragConfig).length > 0
          ? { ragConfig }
          : {}),
      };

      if (selectedMCPIds.length > 0) {
        (basePayload as any).mcpCollectionIds = selectedMCPIds;
      }

      if (agentVariables.filter((v) => v.name.trim()).length > 0) {
        (basePayload as any).variables = agentVariables.filter((v) => v.name.trim());
      }

      const description = normalizeOptional(data.description);
      if (description) {
        (basePayload as CreateAgentPayload).description = description;
      }

      let result: {
        agent: Agent | null;
        error: string | null;
        errorCode: string | null;
      };

      const maxRetries = 3;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        if (mode === "edit" && initialAgent) {
          const updatePayload: UpdateAgentPayload = {
            ...basePayload,
            isActive: initialAgent.isActive ?? true,
          };
          result = await updateAgentAction(initialAgent.id, updatePayload);
        } else {
          result = await createAgentAction(basePayload as CreateAgentPayload);
        }

        const isProviderError =
          result.error?.toLowerCase().includes("provider") ||
          result.error?.toLowerCase().includes("unavailable") ||
          result.error?.toLowerCase().includes("failed dependency") ||
          result.errorCode === "AGENT_PROVIDER_UNAVAILABLE";

        if (!result.error || !isProviderError || attempt >= maxRetries) {
          break;
        }

        await new Promise((resolve) => setTimeout(resolve, attempt * 1000));
      }

      const { agent, error, errorCode } = result!;

      if (error || !agent) {
        const i18nKey = errorCode
          ? (`toast.errorCodes.${errorCode}` as const)
          : null;
        const description =
          (i18nKey && t.has(i18nKey) ? t(i18nKey) : null) ??
          error ??
          (mode === "edit" ? t("toast.updateError") : t("toast.createError"));

        toast({
          title:
            mode === "edit"
              ? t("toast.updateErrorTitle")
              : t("toast.createErrorTitle"),
          description,
          variant: "destructive",
        });
        return;
      }

      toast({
        title:
          mode === "edit" ? t("toast.updateSuccess") : t("toast.createSuccess"),
        description: t("toast.successDescription", { name: agent.name }),
      });

      try {
        await apiClient(`/agents/${agent.id}/knowledge-bases`, {
          method: "PUT",
          body: JSON.stringify({
            knowledgeBaseIds: selectedKnowledgeBaseIds,
          }),
        });
      } catch {
        console.error("Failed to sync knowledge base links");
      }

      const redirectUrl = `/dashboard/agents/${agent.id}`;
      setTimeout(() => {
        router.push(redirectUrl);
        router.refresh();
      }, 0);
    });
  };

  const formRef = useRef<HTMLFormElement>(null);

  const scrollToFirstError = useCallback(() => {
    setTimeout(() => {
      const firstError = formRef.current?.querySelector(
        "[data-error-summary], .text-destructive",
      );
      if (firstError) {
        firstError.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }, []);

  const submitDisabled =
    isSubmitting || loadingOptions || !!optionsError || !options;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(onSubmit, () => scrollToFirstError())}
      className="w-full space-y-10 rounded-[--radius] border border-border bg-card p-8 shadow-xl shadow-slate-900/5"
    >
      <TourGuide
        steps={agentsTourSteps}
        storageKey="tour_dismissed_agents_v2"
        i18nNamespace="tourAgents"
        introPalette={agentsTourPalette}
        introSeed={agentsTourSeed}
onStep={(_index, step) => {
           const tab = (step.data as any)?._tab;
           if (tab) setActiveTab(tab);
        }}
      />
      {optionsError ? (
        <div className="rounded-[--radius] border border-destructive bg-destructive px-4 py-3 text-sm text-white">
          {optionsError}
        </div>
      ) : null}

      {toolsError ? (
        <div className="rounded-[--radius] border border-warning bg-warning px-4 py-3 text-sm text-white">
          {toolsError}
        </div>
      ) : null}

      {isSubmitted && Object.keys(errors).length > 0 && (
        <div data-error-summary>
          <FormErrorSummary errors={errors} t={t} />
        </div>
      )}

      <div data-tour="agents-tabs" className="flex gap-1 p-1 rounded-[--radius] bg-muted border border-border mb-4">
        {(["geral", "conversa", "habilidades", "conhecimento", "whatsapp"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={cn(
              "flex-1 px-3 py-2 rounded-[--radius] text-sm font-medium transition-colors",
              activeTab === tab
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t(`tabs.${tab}`)}
          </button>
        ))}
      </div>

      <div className={activeTab === "geral" ? "" : "hidden"}>
      <section className="space-y-6" data-tour="agents-general">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {t("sections.main.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sections.main.description")}
          </p>
        </div>

        {loadingOptions && !optionsError ? (
          <p className="text-sm text-muted-foreground">
            {t("loading.options")}
          </p>
        ) : null}

        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2">
            <ElevatedInput
              {...register("name")}
              label={t("labels.name")}
              placeholder={t("placeholders.name")}
              controlSize="lg"
            />
            <FieldError message={errors.name?.message} />
          </div>


          <div>
            <Controller
              control={control}
              name="messagingModel"
              render={({ field }) => (
                <AIModelSelector
                  label={t("labels.messagingModel")}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={loadingOptions || !messagingModels.length}
                  models={messagingModels}
                  modelPricing={pricingData}
                />
              )}
            />
            <FieldError message={errors.messagingModel?.message} />
          </div>

          <div className="md:col-span-2">
            <ElevatedTextarea
              {...register("description")}
              label={t("labels.description")}
              placeholder={t("placeholders.description")}
              rows={3}
            />
            <FieldError message={errors.description?.message} />
          </div>
        </div>
      </section>
      </div>

      <div className={activeTab === "conversa" ? "" : "hidden"}>
      <section className="space-y-6" data-tour="agents-experience">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {t("sections.experience.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sections.experience.description")}
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="md:col-span-2 space-y-3">
            <Controller
              control={control}
              name="useInitialMessage"
              render={({ field }) => (
                <div className="flex items-start justify-between gap-4 rounded-[--radius] border border-border bg-muted px-4 py-3">
                  <div className="space-y-0.5">
                    <p className="text-sm font-medium text-foreground">
                      {t("labels.useInitialMessage")}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t("hints.useInitialMessage")}
                    </p>
                  </div>
                  <Switch
                    checked={field.value ?? true}
                    onCheckedChange={field.onChange}
                    aria-label={t("labels.useInitialMessage")}
                  />
                </div>
              )}
            />
            <ElevatedTextarea
              {...register("initialMessage")}
              label={t("labels.initialMessage")}
              placeholder={t("placeholders.initialMessage")}
              rows={3}
              disabled={!(watch("useInitialMessage") ?? true)}
            />
            <FieldError message={errors.initialMessage?.message} />
          </div>

          <div>
            <ElevatedTextarea
              {...register("messagingPrompt")}
              label={t("labels.messagingPrompt")}
              placeholder={t("placeholders.messagingPrompt")}
              rows={4}
            />
            <FieldError message={errors.messagingPrompt?.message} />
          </div>

        </div>
      </section>
      </div>

      <div className={activeTab === "conversa" ? "" : "hidden"}>
      <section className="space-y-6" data-tour="agents-variables">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <GearSix className="h-5 w-5 text-orange-500" weight="fill" />
            {t("sections.variables.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sections.variables.description")}
          </p>
        </div>

        {agentVariables.length === 0 ? (
          <button
            type="button"
            onClick={() => setAgentVariables([{ name: "", description: "", defaultValue: "" }])}
            className="w-full rounded-[--radius] border border-dashed border-border bg-muted px-4 py-3 text-sm text-muted-foreground hover:border-border hover:bg-muted transition-colors"
          >
            + {t("sections.variables.addVariable")}
          </button>
        ) : (
          <div className="space-y-2">
            {agentVariables.map((v, i) => {
              const isInvalidName = v.name.trim() !== "" && !/^\w+$/.test(v.name.trim());
              const isDuplicate = v.name.trim() !== "" && agentVariables.some((other, j) => j !== i && other.name.trim().toLowerCase() === v.name.trim().toLowerCase());
              return (
                <div key={i} className="flex items-start gap-2">
                  <div className="w-32 flex-shrink-0">
                    <ElevatedInput
                      value={v.name}
                      onChange={(e) => {
                        const next = [...agentVariables];
                        next[i] = { ...next[i], name: e.target.value };
                        setAgentVariables(next);
                      }}
                      placeholder="name"
                      variant="outline"
                      controlSize="sm"
                      inputClassName={`bg-card text-xs font-mono ${isInvalidName || isDuplicate ? "border-destructive" : ""}`}
                      error={isInvalidName ? t("sections.variables.invalidName", { name: v.name }) : isDuplicate ? t("sections.variables.duplicateName", { name: v.name }) : undefined}
                    />
                  </div>
                  <ElevatedInput
                    value={v.description}
                    onChange={(e) => {
                      const next = [...agentVariables];
                      next[i] = { ...next[i], description: e.target.value };
                      setAgentVariables(next);
                    }}
                    placeholder={t("sections.variables.descriptionPlaceholder")}
                    variant="outline"
                    controlSize="sm"
                    className="flex-1"
                    inputClassName="bg-card text-xs"
                  />
                  <ElevatedInput
                    value={v.defaultValue}
                    onChange={(e) => {
                      const next = [...agentVariables];
                      next[i] = { ...next[i], defaultValue: e.target.value };
                      setAgentVariables(next);
                    }}
                    placeholder={t("sections.variables.defaultPlaceholder")}
                    variant="outline"
                    controlSize="sm"
                    className="w-32 flex-shrink-0"
                    inputClassName="bg-card text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const next = agentVariables.filter((_, idx) => idx !== i);
                      setAgentVariables(next);
                    }}
                    className="mt-1.5 rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <Trash weight="bold" className="h-3.5 w-3.5" />
                  </button>
                </div>
              );
            })}
            <button
              type="button"
              onClick={() => setAgentVariables([...agentVariables, { name: "", description: "", defaultValue: "" }])}
              className="w-full rounded-[--radius] border border-dashed border-border bg-muted px-4 py-2.5 text-sm text-muted-foreground hover:border-border hover:bg-muted transition-colors"
            >
              + {t("sections.variables.addVariable")}
            </button>
          </div>
        )}
      </section>
      </div>

      <div className={activeTab === "whatsapp" ? "" : "hidden"}>
        <section className="space-y-6" data-tour="agents-whatsapp">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <WhatsappLogo className="h-5 w-5 text-green-500" weight="fill" />
              {t("sections.whatsapp.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sections.whatsapp.description")}
          </p>
        </div>

        {templatesError ? (
          <div className="rounded-[--radius] border border-warning bg-warning px-4 py-3 text-sm text-white">
            {templatesError}
          </div>
        ) : null}

        <div className="mb-4">
          <ElevatedCommandSelect
            label={t("labels.businessPhone")}
            value={selectedBusinessPhoneId}
            onValueChange={(val) => {
              setSelectedBusinessPhoneId(val);
              setValue("whatsappTemplateId", "", { shouldDirty: true });
            }}
            disabled={loadingBusinessPhones}
            searchPlaceholder={t("placeholders.searchBusinessPhone")}
            emptyMessage={t("placeholders.noBusinessPhones")}
            options={businessPhoneOptions}
            onSearch={businessPhoneSelect.onSearch}
            onScrollEnd={businessPhoneSelect.onScrollEnd}
            onOpenChange={businessPhoneSelect.onOpenChange}
            isLoading={businessPhoneSelect.isLoading}
          />
        </div>

        <div className="flex items-end gap-3">
          <div className="flex-1">
            <Controller
              control={control}
              name="whatsappTemplateId"
              render={({ field }) => (
                <ElevatedCommandSelect
                  label={t("labels.whatsappTemplate")}
                  value={field.value ?? ""}
                  onValueChange={field.onChange}
                  disabled={!selectedBusinessPhoneId || loadingTemplates}
                  searchPlaceholder={t("placeholders.searchTemplate")}
                  emptyMessage={
                    !selectedBusinessPhoneId
                      ? t("placeholders.selectPhoneFirst")
                      : t("placeholders.noTemplates")
                  }
                  options={templateOptions}
                  onSearch={templateSelect.onSearch}
                  onScrollEnd={templateSelect.onScrollEnd}
                  onOpenChange={templateSelect.onOpenChange}
                  isLoading={templateSelect.isLoading}
                />
              )}
            />
          </div>
          {isAdmin && (
            <button
              type="button"
              onClick={() => setCreateTemplateDialogOpen(true)}
              disabled={!selectedBusinessPhoneId}
              className="flex items-center gap-2 rounded-[--radius] border border-healthy bg-healthy px-4 py-3 text-sm font-semibold text-white transition-all hover:bg-healthy hover:border-green-700 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-healthy disabled:hover:border-healthy"
            >
              <Plus className="h-4 w-4" weight="bold" />
              {t("buttons.createTemplate")}
            </button>
          )}
        </div>

        {/* Warning: selected template is missing header media */}
        {selectedTemplateMissingMedia &&
          isAdmin &&
          selectedWhatsAppTemplate && (
            <div className="rounded-lg border border-warning/20 bg-warning/10 p-4">
              <div className="flex items-start gap-3">
                <ImageSquare
                  className="h-5 w-5 text-warning flex-shrink-0 mt-0.5"
                  weight="fill"
                />
                <div className="flex-1">
                  <h4 className="text-sm font-semibold text-amber-800">
                    {t("templateMedia.missingTitle")}
                  </h4>
                  <p className="text-xs text-warning mt-1">
                    {t("templateMedia.missingDescription")}
                  </p>
                  <Button
                    type="button"
                    variant="secondary"
                    title={t("templateMedia.configureButton")}
                    icon={<ImageSquare className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    onClick={() => setTemplateMediaModalOpen(true)}
                    className="mt-3"
                  />
                </div>
              </div>
            </div>
          )}
      </section>
      </div>

      <div className={activeTab === "habilidades" ? "" : "hidden"}>
      <section className="space-y-6" data-tour="agents-abilities">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground">
            {t("sections.tools.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sections.tools.description")}
          </p>
        </div>
        {loadingTools ? (
          <p className="text-sm text-muted-foreground a">
            {t("loading.tools")}
          </p>
        ) : null}

        {!loadingTools && !tools.length && !toolsError ? (
          <p className="rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            {t("tools.noTools")}
          </p>
        ) : null}

        {!loadingTools &&
          tools.length > 0 &&
          (() => {
            const categories: {
              label: string;
              value: AgentToolCategory | "all";
            }[] = [
              { label: t("tools.categories.all"), value: "all" },
              { label: t("tools.categories.utility"), value: "agent_utility" },
              { label: t("tools.categories.messaging"), value: "messaging" },
              { label: t("tools.categories.actions"), value: "agent_action" },
              { label: t("tools.categories.payment"), value: "payment" },
            ];
            const isFiltering =
              toolsSearch.trim() !== "" || toolsCategory !== "all";

            return (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Available, left on desktop, below on mobile */}
                <div className="order-2 flex flex-col overflow-hidden rounded-[--radius] border border-border bg-card lg:order-1">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("tools.available")}
                    </h3>
                    <span className="inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-[--radius] bg-muted px-2 text-xs font-semibold text-muted-foreground">
                      {availableTools.length}
                    </span>
                  </div>
                  <div className="space-y-3 border-b border-border px-3 py-3">
                    <ElevatedInput
                      value={toolsSearch}
                      onChange={(e) => setToolsSearch(e.target.value)}
                      label={t("tools.searchPlaceholder")}
                      icon={<MagnifyingGlass className="h-4 w-4" />}
                    />
                    <div className="flex flex-wrap gap-1.5">
                      {categories.map((cat) => (
                        <button
                          type="button"
                          key={cat.value}
                          onClick={() => setToolsCategory(cat.value)}
                          aria-pressed={toolsCategory === cat.value}
                          className={cn(
                            "rounded-lg px-2.5 py-1 text-xs font-medium transition-colors",
                            toolsCategory === cat.value
                              ? "bg-muted text-lamp-ink"
                              : "text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {cat.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto lg:max-h-[26rem]">
                    {availableTools.length === 0 ? (
                      <div className="flex flex-col items-center justify-center gap-1 px-4 py-12 text-center">
                        <p className="text-sm font-medium text-foreground">
                          {isFiltering
                            ? t("tools.noResults")
                            : t("tools.allAdded")}
                        </p>
                        {isFiltering && (
                          <p className="text-xs text-muted-foreground">
                            {t("tools.noResultsHint")}
                          </p>
                        )}
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {availableTools.map((tool) => (
                          <li key={tool.name}>
                            <AvailableToolRow
                              tool={tool}
                              disabled={loadingTools}
                              onAdd={() => handleToggleTool(tool)}
                              t={t}
                            />
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>

                {/* Selected, right on desktop, top on mobile */}
                <div className="order-1 flex flex-col overflow-hidden rounded-[--radius] border border-border bg-card lg:order-2">
                  <div className="flex items-center justify-between gap-3 border-b border-border bg-muted px-4 py-3">
                    <h3 className="text-sm font-semibold text-foreground">
                      {t("tools.selected")}
                    </h3>
                    <span
                      className={cn(
                        "inline-flex h-6 min-w-[1.5rem] items-center justify-center rounded-full px-2 text-xs font-semibold",
                        selectedToolList.length > 0
                          ? "bg-muted text-lamp-ink"
                          : "bg-muted text-muted-foreground",
                      )}
                    >
                      {selectedToolList.length}
                    </span>
                  </div>
                  <div className="flex-1 overflow-y-auto lg:max-h-[33.5rem]">
                    {selectedToolList.length === 0 ? (
                      <div className="flex h-full flex-col items-center justify-center gap-2 px-6 py-12 text-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          <PlugsConnected weight="fill" className="h-5 w-5" />
                        </span>
                        <p className="text-sm font-medium text-foreground">
                          {t("tools.emptySelectedTitle")}
                        </p>
                        <p className="max-w-[34ch] text-xs text-muted-foreground">
                          {t("tools.emptySelected")}
                        </p>
                      </div>
                    ) : (
                      <ul className="divide-y divide-border">
                        {selectedToolList.map((tool) => {
                          const binding = selectedInternalTools?.find(
                            (b) => b.name === tool.name,
                          );
                          return (
                            <SelectedToolItem
                              key={tool.name}
                              tool={tool}
                              currentVisibility={binding?.visibility}
                              currentConfig={binding?.config}
                              disabled={loadingTools}
                              onRemove={() => handleToggleTool(tool)}
                              onVisibilityChange={(visibility) =>
                                handleVisibilityChange(tool.name, visibility)
                              }
                              onConfigureClick={() => handleOpenToolConfig(tool)}
                              t={t}
                            />
                          );
                        })}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            );
          })()}
        <FieldError message={errors.internalTools?.message} />
      </section>
      </div>

      <div className={activeTab === "conhecimento" ? "" : "hidden"}>
      <section className="space-y-6">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <File className="h-5 w-5 text-lamp-ink" weight="fill" />
            {t("sections.media.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sections.media.description")}
          </p>
        </div>

        <div className="space-y-4">
          <input
            ref={mediaInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp"
            multiple
            className="hidden"
            onChange={(e) => handleFilesSelected(e.target.files)}
          />

          <button
            type="button"
            onClick={() => mediaInputRef.current?.click()}
            disabled={isUploadingMedia}
            className={cn(
              "flex w-full items-center justify-center gap-3 rounded-[--radius] border border-dashed p-6 transition-all",
              isUploadingMedia
                ? "border-border bg-muted cursor-not-allowed"
                : "border-foreground/20 bg-card hover:border-primary hover:bg-muted cursor-pointer",
            )}
          >
            {isUploadingMedia ? (
              <>
                <div className="h-5 w-5 animate-spin rounded-full border border-rule-strong border-t-transparent" />
                <span className="text-sm font-medium text-muted-foreground">
                  {t("media.uploading")}
                </span>
              </>
            ) : (
              <>
                <UploadSimple
                  className="h-6 w-6 text-muted-foreground"
                  weight="bold"
                />
                <div className="text-center">
                  <p className="text-sm font-medium text-foreground">
                    {t("media.dropzone")}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {t("media.allowedFormats")}
                  </p>
                </div>
              </>
            )}
          </button>

          {loadingMedias ? (
            <p className="text-sm text-muted-foreground">
              {t("loading.media")}
            </p>
          ) : null}

          {agentMedias.length > 0 && (
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {agentMedias.map((media) => (
                <div
                  key={media.id}
                  className="group relative flex items-center gap-3 rounded-[--radius] border border-border bg-card p-3 transition-all hover:border-foreground/20 hover:shadow-md"
                >
                  {media.type === "image" ? (
                    <div className="h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-muted">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={media.previewUrl || media.url}
                        alt={media.description}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  ) : (
                    <IconBox color="primary" size="md">
                      <File weight="fill" />
                    </IconBox>
                  )}

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {media.description}
                    </p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {media.type}
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemoveMedia(media.id)}
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive text-white opacity-0 transition-all hover:bg-destructive group-hover:opacity-100"
                  >
                    <Trash className="h-4 w-4" weight="bold" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="space-y-6" data-tour="agents-knowledge">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
            <Files className="h-5 w-5 text-purple-500" weight="fill" />
            {t("sections.knowledgeBases.title")}
          </h2>
          <p className="text-sm text-muted-foreground">
            {t("sections.knowledgeBases.description")}
          </p>
        </div>
        <KnowledgeBaseSelector
          selectedIds={selectedKnowledgeBaseIds}
          onChange={setSelectedKnowledgeBaseIds}
        />
        {selectedKnowledgeBaseIds.length > 0 && (
          <div className="flex items-center justify-between rounded-[--radius] border border-border bg-muted px-4 py-3">
            <div>
              <p className="text-sm font-medium text-foreground">{t("sections.knowledgeBases.ragToggleLabel")}</p>
              <p className="text-xs text-muted-foreground">{t("sections.knowledgeBases.ragToggleDescription")}</p>
            </div>
            <Switch checked={ragEnabled} onCheckedChange={setRagEnabled} />
          </div>
        )}
        {ragEnabled && selectedKnowledgeBaseIds.length > 0 && (
          <div className="rounded-[--radius] border border-border bg-muted p-4 space-y-4">
            <button
              type="button"
              onClick={() => setRagConfigOpen(!ragConfigOpen)}
              className="flex items-center gap-2 text-sm font-medium text-foreground"
            >
              <Play
                weight="fill"
                className={cn("h-3 w-3 transition-transform", ragConfigOpen && "rotate-90")}
              />
              {t("sections.knowledgeBases.ragConfig.title", { defaultValue: "Advanced RAG Settings" })}
            </button>
            {ragConfigOpen && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("sections.knowledgeBases.ragConfig.maxCharacters", { defaultValue: "Max Characters" })}</label>
                  <input
                    type="range"
                    min={500}
                    max={20000}
                    step={500}
                    value={ragConfig.maxCharacters ?? 5000}
                    onChange={(e) => setRagConfig((p) => ({ ...p, maxCharacters: Number(e.target.value) }))}
                    className="w-full"
                  />
                  <p className="text-xs text-muted-foreground">{ragConfig.maxCharacters ?? 5000}</p>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {mcpCollections.length > 0 && (
        <section className="space-y-4" data-tour="agents-mcp">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground flex items-center gap-2">
              <svg className="h-5 w-5 text-warning" viewBox="0 0 24 24" fill="currentColor"><path d="M20.5 11H19V7c0-1.1-.9-2-2-2h-4V3.5C13 2.12 11.88 1 10.5 1S8 2.12 8 3.5V5H4c-1.1 0-1.99.9-1.99 2v3.8H3.5c1.49 0 2.7 1.21 2.7 2.7s-1.21 2.7-2.7 2.7H2V20c0 1.1.9 2 2 2h3.8v-1.5c0-1.49 1.21-2.7 2.7-2.7 1.49 0 2.7 1.21 2.7 2.7V22H17c1.1 0 2-.9 2-2v-4h1.5c1.38 0 2.5-1.12 2.5-2.5S21.88 11 20.5 11z"/></svg>
              {t("sections.mcp.title")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {t("sections.mcp.description")}
            </p>
          </div>
          <div className="rounded-[--radius] border border-border bg-muted p-3 space-y-1">
            {mcpCollections.map((col) => {
              const checked = selectedMCPIds.includes(col.id);
              return (
                <label key={col.id} className="flex items-center gap-3 px-2 py-1.5 rounded-lg hover:bg-muted transition-colors cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => setSelectedMCPIds(prev => checked ? prev.filter(id => id !== col.id) : [...prev, col.id])}
                    className="h-4 w-4 rounded border-zinc-300 text-lamp-ink focus:ring-ring"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{col.name}</p>
                    {col.description && (
                      <p className="text-xs text-muted-foreground truncate">{col.description}</p>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">{t("sections.mcp.toolsCount", { count: col.members.length })}</span>
                </label>
              );
            })}
          </div>
        </section>
      )}
      {mcpCollections.length === 0 && !loadingTools && (
        <section className="space-y-2">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-foreground">
              {t("sections.mcp.title")}
            </h2>
          </div>
          <p className="rounded-[--radius] border border-border bg-muted px-4 py-3 text-sm text-muted-foreground">
            {t("sections.mcp.noServers")}
          </p>
        </section>
      )}
      </div>

      <div data-tour="agents-actions" className="flex flex-wrap items-center justify-end gap-3">
        <Button
          type="button"
          variant="ghost"
          title={t("buttons.cancel")}
          onClick={() => router.push("/dashboard/agents")}
          disabled={isSubmitting}
        />
        <Button
          type="submit"
          variant="action"
          title={
            isSubmitting
              ? t("buttons.saving")
              : mode === "edit"
                ? t("buttons.update")
                : t("buttons.create")
          }
          disabled={submitDisabled}
        />
      </div>

      {isAdmin && (
        <CreateTemplateDialog
          open={createTemplateDialogOpen}
          onOpenChange={setCreateTemplateDialogOpen}
          onTemplateCreated={handleTemplateCreated}
          businessPhoneId={selectedBusinessPhoneId}
        />
      )}

      {selectedWhatsAppTemplate && isAdmin && (
        <TemplateEditModal
          isOpen={templateMediaModalOpen}
          onClose={() => setTemplateMediaModalOpen(false)}
          template={selectedWhatsAppTemplate}
          onSave={handleSaveTemplateHeaderMedia}
          isSaving={isSavingTemplateMedia}
        />
      )}

      <Dialog open={mediaDialogOpen} onOpenChange={setMediaDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>{t("media.dialogTitle")}</DialogTitle>
            <DialogDescription>
              {t("media.dialogDescription")}
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto space-y-4 py-4">
            {pendingMediaFiles.map((item, index) => (
              <div
                key={index}
                className="flex items-start gap-4 rounded-[--radius] border border-border bg-muted p-4"
              >
                {item.file.type.startsWith("image/") ? (
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={URL.createObjectURL(item.file)}
                      alt={item.file.name}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <IconBox color="primary" size="lg">
                    <File weight="fill" />
                  </IconBox>
                )}

                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-foreground truncate">
                    {item.file.name}
                  </p>
                  <ElevatedInput
                    value={item.description}
                    onChange={(e) =>
                      handlePendingDescriptionChange(index, e.target.value)
                    }
                    label={t("media.descriptionLabel")}
                    placeholder={t("media.descriptionPlaceholder")}
                    controlSize="sm"
                  />
                </div>

                <button
                  type="button"
                  onClick={() => handleRemovePendingFile(index)}
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-destructive text-white transition-all hover:bg-destructive"
                >
                  <Trash className="h-4 w-4" weight="bold" />
                </button>
              </div>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="ghost"
              title={t("buttons.cancel")}
              onClick={() => {
                setMediaDialogOpen(false);
                setPendingMediaFiles([]);
              }}
            />
            <Button
              type="button"
              variant="action"
              title={t("media.uploadButton")}
              onClick={handleConfirmMediaUpload}
              disabled={pendingMediaFiles.length === 0}
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Use specialized dialog for http_request tool, generic for others */}
      {configuringTool?.name === "http_request" ? (
        <HttpRequestConfigDialog
          open={toolConfigDialogOpen}
          onOpenChange={setToolConfigDialogOpen}
          tool={configuringTool}
          existingConfig={
            selectedInternalTools?.find((t) => t.name === configuringTool.name)
              ?.config
          }
          onSave={handleSaveToolConfig}
        />
      ) : (
        <ToolConfigDialog
          open={toolConfigDialogOpen}
          onOpenChange={setToolConfigDialogOpen}
          tool={configuringTool}
          existingConfig={
            configuringTool
              ? selectedInternalTools?.find(
                  (t) => t.name === configuringTool.name,
                )?.config
              : undefined
          }
          onSave={handleSaveToolConfig}
        />
      )}
    </form>
  );
}
