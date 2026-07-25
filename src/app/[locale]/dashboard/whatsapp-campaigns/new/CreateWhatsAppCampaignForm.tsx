"use client";

import type { AgentListItem, ModelPricingInfo } from "@/lib/agents/types";
import { useAgentRequiredVariables } from "@/lib/agents/use-agent-required-variables";
import {
  CalendarCheck,
  CaretDown,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  ImageSquare,
  MagnifyingGlass,
  Plus,
  Trash,
  UploadSimple,
  Warning,
  X,
} from "@phosphor-icons/react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { cn, normalizeBrazilianPhone } from "@/lib/utils";
import {
  createWhatsAppCampaignAction,
  updateWhatsAppCampaignAction,
} from "@/app/actions/whatsapp-campaigns";
import {
  getWhatsAppTemplateByIdAction,
  listWhatsAppTemplatesAction,
  updateWhatsAppTemplateHeaderMediaAction,
} from "@/app/actions/whatsapp-templates";
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
import {
  ElevatedCommandSelect,
  type ElevatedCommandOption,
} from "@/components/elevated-design/elevated-command-select";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSwitch } from "@/components/elevated-design/elevated-switch";
import Link from "next/link";
import type { StageGroup } from "@/lib/stage-groups/types";
import TemplateEditModal from "@/components/whatsapp/TemplateEditModal";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import type { Workflow } from "@/lib/workflows/types";
import { getAgentOptionsAction, listAgentsAction } from "@/app/actions/agents";
import {
  getBusinessPhoneByIdAction,
  listBusinessPhonesAction,
} from "@/app/actions/whatsapp-business-phones";
import { listStageGroupsAction } from "@/app/actions/stage-groups";
import { listPipelinesAction } from "@/app/actions/crm-board";
import {
  getWorkflowAction,
  listWorkflowsAction,
} from "@/app/actions/workflows";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import GrainBackground from "@/components/elevated-design/grain-background";

const ITEMS_PER_PAGE = 50;
const CSV_BATCH_SIZE = 1000;

const extractTemplateVariables = (
  template: WhatsAppTemplate | undefined,
): string[] => {
  if (!template) return [];

  const positionalVars: string[] = [];
  const positionalRegex = /\{\{(\d+)\}\}/g;

  for (const component of template.components) {
    if (component.text) {
      let match;
      while ((match = positionalRegex.exec(component.text)) !== null) {
        const varIndex = parseInt(match[1], 10);
        if (varIndex > 0 && !positionalVars[varIndex - 1]) {
          positionalVars[varIndex - 1] = `{{${varIndex}}}`;
        }
      }
    }
  }

  const filteredPositional = positionalVars.filter(Boolean);
  if (filteredPositional.length > 0) {
    return filteredPositional;
  }

  const namedRegex = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;
  const seenNames = new Set<string>();
  const namedVars: string[] = [];

  for (const component of template.components) {
    if (component.text) {
      let match;
      while ((match = namedRegex.exec(component.text)) !== null) {
        const varName = match[1];
        if (!seenNames.has(varName)) {
          seenNames.add(varName);
          namedVars.push(`{{${varName}}}`);
        }
      }
    }

    if (component.buttons) {
      for (const btn of component.buttons) {
        if (btn.url) {
          let match;
          while ((match = namedRegex.exec(btn.url)) !== null) {
            const varName = match[1];
            if (!seenNames.has(varName)) {
              seenNames.add(varName);
              namedVars.push(`{{${varName}}}`);
            }
          }
        }
      }
    }
  }

  return namedVars;
};

const createWhatsAppCampaignSchema = (t: (key: string) => string) => {
  const phoneNumberSchema = z.object({
    number: z
      .string()
      .trim()
      .min(1, t("validation.numberRequired"))
      .transform((val) => normalizeBrazilianPhone(val) ?? val)
      .refine((val) => /^55\d{10,11}$/.test(val), {
        message: t("validation.numberFormat"),
      }),
    name: z
      .string()
      .trim()
      .max(120, t("validation.nameTooLong"))
      .optional()
      .or(z.literal("")),
    variables: z.array(z.string()).optional(),
    metadata: z
      .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
      .optional(),
  });

  return z
    .object({
      name: z.string().trim().min(3, t("validation.nameRequired")),
      templateId: z.string().min(1, t("validation.templateRequired")),
      businessPhoneId: z.string().min(1, t("validation.businessPhoneRequired")),
      agentId: z.string().optional().nullable(),
      workflowId: z.string().optional().nullable(),
      enableAgentResponses: z.boolean().default(false),
      preferAudio: z.boolean().default(false),
      showTemplateInCrm: z.boolean().default(false),
      enableAnalysis: z.boolean().default(false),
      enableAutoStaging: z.boolean().default(false),
      aiModel: z.string().optional().default(""),
      scheduledStart: z.string().optional().nullable(),
      phoneNumbers: z
        .array(phoneNumberSchema)
        .min(1, t("validation.contactsMin")),
    })
    .superRefine((data, ctx) => {
      if (data.phoneNumbers.length > 150000) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: t("validation.maxContactsExceeded"),
          path: ["phoneNumbers"],
        });
      }

      const seenNumbers = new Set<string>();

      data.phoneNumbers.forEach((entry, index) => {
        const normalizedNumber = entry.number.trim();
        const isDuplicate = seenNumbers.has(normalizedNumber);

        if (isDuplicate) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: t("validation.duplicateNumber"),
            path: ["phoneNumbers", index, "number"],
          });
        } else {
          seenNumbers.add(normalizedNumber);
        }
      });
    });
};

const createOrganicCampaignSchema = (t: (key: string) => string) => {
  return z.object({
    name: z.string().trim().min(3, t("validation.nameRequired")),
    templateId: z.string().optional().default(""),
    businessPhoneId: z.string().min(1, t("validation.businessPhoneRequired")),
    agentId: z.string().optional().nullable(),
    workflowId: z.string().optional().nullable(),
    enableAgentResponses: z.boolean().default(false),
    preferAudio: z.boolean().default(false),
    enableAnalysis: z.boolean().default(false),
    enableAutoStaging: z.boolean().default(false),
    aiModel: z.string().optional().default(""),
    scheduledStart: z.string().optional().nullable(),
    phoneNumbers: z
      .array(
        z.object({
          number: z.string(),
          name: z.string().optional(),
          variables: z.array(z.string()).optional(),
          metadata: z
            .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
            .optional(),
        }),
      )
      .optional()
      .default([]),
  });
};

type WhatsAppCampaignFormValues = z.infer<
  ReturnType<typeof createWhatsAppCampaignSchema>
>;

type WhatsAppCampaignFormProps = {
  mode?: "create" | "edit";
  initialCampaign?: WhatsAppCampaign | null;
  aiModels?: string[];
  modelPricing?: ModelPricingInfo[];
  organic?: boolean;
};

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-rose-500">{message}</p>;
};

interface ParsedCsvRecord {
  number: string;
  name?: string;
  variables?: string[];
  metadata?: Record<string, string | number | boolean | null>;
}

interface MetadataField {
  key: string;
  label: string;
  required?: boolean;
}

interface SkippedLine {
  line: number;
  rawContent: string;
  reason: string;
}

function mergeItemsById<T extends { id: string }>(
  previous: Record<string, T>,
  items: T[],
) {
  if (items.length === 0) {
    return previous;
  }

  const next = { ...previous };
  items.forEach((item) => {
    next[item.id] = item;
  });
  return next;
}

function mergeSelectedOption(
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

const ProgressBar = ({
  progress,
  label,
}: {
  progress: number;
  label: string;
}) => (
  <div className="space-y-2">
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">
        {Math.round(progress)}%
      </span>
    </div>
    <div className="h-2 w-full overflow-hidden rounded-full bg-border">
      <div
        className="h-full rounded-full bg-emerald-500 transition-all duration-300 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  </div>
);

export default function CreateWhatsAppCampaignForm({
  mode = "create",
  initialCampaign,
  aiModels: aiModelsProp,
  modelPricing: modelPricingProp,
  organic = false,
}: WhatsAppCampaignFormProps) {
  const router = useRouter();
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isSubmitting, startSubmit] = useTransition();
  const pendingRedirectRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [currentPage, setCurrentPage] = useState(0);
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);
  const [newFieldKey, setNewFieldKey] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [showOnlyMissingVars, setShowOnlyMissingVars] = useState(false);
  const [skippedLines, setSkippedLines] = useState<SkippedLine[]>([]);
  const [skippedLinesOpen, setSkippedLinesOpen] = useState(false);
  const [skippedPage, setSkippedPage] = useState(0);
  const SKIPPED_PAGE_SIZE = 50;
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [templateInfoConfirmed, setTemplateInfoConfirmed] = useState(
    mode === "edit",
  );
  const [previewEntryIndex, setPreviewEntryIndex] = useState<number | null>(
    null,
  );
  const [aiModels, setAiModels] = useState<string[]>(aiModelsProp ?? []);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>(
    modelPricingProp ?? [],
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const modelsLoadedRef = useRef(!!aiModelsProp?.length);
  const [stageGroups, setTagGroups] = useState<StageGroup[]>([]);
  const [selectedStageGroupId, setSelectedTagGroupId] = useState<string>("");
  // Conversation funnel (pipeline) this campaign routes to; editable in edit mode.
  const [pipelineOptions, setPipelineOptions] = useState<
    { id: string; name: string }[]
  >([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(
    initialCampaign?.pipelineId ?? "",
  );
  const [responseMode, setResponseMode] = useState<"agent" | "workflow">(
    initialCampaign?.workflowId ? "workflow" : "agent",
  );
  const [knownAgents, setKnownAgents] = useState<Record<string, AgentListItem>>(
    {},
  );
  const [knownBusinessPhones, setKnownBusinessPhones] = useState<
    Record<string, WhatsAppBusinessPhone>
  >({});
  const [knownTemplates, setKnownTemplates] = useState<
    Record<string, WhatsAppTemplate>
  >({});
  const [knownWorkflows, setKnownWorkflows] = useState<
    Record<string, Workflow>
  >({});
  const t = useTranslations("whatsappCampaignsPage.form");

  useEffect(() => {
    if (!isSubmitting && pendingRedirectRef.current) {
      const url = pendingRedirectRef.current;
      pendingRedirectRef.current = null;
      router.push(url);
      router.refresh();
    }
  }, [isSubmitting, router]);

  useEffect(() => {
    if (mode !== "create") return;
    listStageGroupsAction().then((result) => {
      if (!result.error) setTagGroups(result.stageGroups);
    });
  }, [mode]);

  // Load conversation funnels so an existing campaign can be (re)assigned to one.
  useEffect(() => {
    if (mode !== "edit") return;
    let active = true;
    listPipelinesAction("conversation").then(({ pipelines }) => {
      if (active) setPipelineOptions(pipelines ?? []);
    });
    return () => {
      active = false;
    };
  }, [mode]);

  const campaignSchema = useMemo(
    () =>
      organic
        ? createOrganicCampaignSchema(t)
        : createWhatsAppCampaignSchema(t),
    [t, organic],
  );

  const {
    control,
    register,
    handleSubmit,
    formState: { errors },
    watch,
    reset,
    setValue,
    getValues,
  } = useForm<WhatsAppCampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: {
      name: "",
      templateId: "",
      businessPhoneId: "",
      agentId: null,
      workflowId: null,
      enableAgentResponses: false,
      preferAudio: false,
      showTemplateInCrm: false,
      enableAnalysis: false,
      enableAutoStaging: false,
      aiModel: "",
      scheduledStart: null,
      phoneNumbers: [
        {
          number: "",
          name: "",
          variables: [],
          metadata: {},
        },
      ],
    },
  });

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "phoneNumbers",
  });

  const enableAgentResponses = watch("enableAgentResponses");
  const enableAnalysis = watch("enableAnalysis");
  const enableAutoStaging = watch("enableAutoStaging");
  const selectedTemplateId = watch("templateId");
  const selectedBusinessPhoneId = watch("businessPhoneId");
  const selectedAgentId = watch("agentId");
  const selectedWorkflowId = watch("workflowId");

  const { variables: agentRequiredVars } = useAgentRequiredVariables(
    responseMode === "agent" ? selectedAgentId : null,
  );

  const agentResponsesActive =
    responseMode === "agent" && Boolean(selectedAgentId);
  const campaignToolsAvailable = !agentResponsesActive;

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
        label: `${template.name} (${template.language})`,
        value: template.id,
        description: needsMedia ? t("media.missingMediaShort") : undefined,
      };
    },
    [t],
  );

  const mapAgentOption = useCallback(
    (agent: AgentListItem): ElevatedCommandOption => ({
      label: agent.name,
      value: agent.id,
    }),
    [],
  );

  const mapWorkflowOption = useCallback(
    (workflow: Workflow): ElevatedCommandOption => ({
      label: workflow.name,
      value: workflow.id,
    }),
    [],
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
          return { items: [], totalPages: 1 };
        }

        const result = await listWhatsAppTemplatesAction({
          status: "APPROVED",
          businessPhoneId: selectedBusinessPhoneId,
          page,
          pageSize: 20,
          search: search || undefined,
        });
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

    const workflowSelect = usePaginatedSelect<Workflow>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listWorkflowsAction({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return {
        items: result.workflows ?? [],
        totalPages: result.meta.totalPages,
      };
    }, []),
    mapOption: mapWorkflowOption,
  });

  const agentSelect = usePaginatedSelect<AgentListItem>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listAgentsAction({
        page,
        pageSize: 20,
        search: search || undefined,
      });
      return { items: result.agents ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: mapAgentOption,
  });

  useEffect(() => {
    setKnownBusinessPhones((prev) =>
      mergeItemsById(prev, businessPhoneSelect.items),
    );
  }, [businessPhoneSelect.items]);

  useEffect(() => {
    setKnownTemplates((prev) => mergeItemsById(prev, templateSelect.items));
  }, [templateSelect.items]);

  useEffect(() => {
    setKnownAgents((prev) => mergeItemsById(prev, agentSelect.items));
  }, [agentSelect.items]);

  useEffect(() => {
    setKnownWorkflows((prev) => mergeItemsById(prev, workflowSelect.items));
  }, [workflowSelect.items]);

  useEffect(() => {
    if (
      !selectedBusinessPhoneId ||
      knownBusinessPhones[selectedBusinessPhoneId]
    ) {
      return;
    }

    let active = true;
    getBusinessPhoneByIdAction(selectedBusinessPhoneId).then((result) => {
      const phone = result.phone;
      if (!active || !phone) {
        return;
      }

      setKnownBusinessPhones((prev) => ({
        ...prev,
        [phone.id]: phone,
      }));
    });

    return () => {
      active = false;
    };
  }, [selectedBusinessPhoneId, knownBusinessPhones]);

  useEffect(() => {
    if (!selectedTemplateId || knownTemplates[selectedTemplateId]) {
      return;
    }

    let active = true;
    getWhatsAppTemplateByIdAction(selectedTemplateId).then((result) => {
      const template = result.template;
      if (!active || !template) {
        return;
      }

      setKnownTemplates((prev) => ({
        ...prev,
        [template.id]: template,
      }));
    });

    return () => {
      active = false;
    };
  }, [selectedTemplateId, knownTemplates]);

  useEffect(() => {
    if (!selectedWorkflowId) {
      return;
    }

    let active = true;
    getWorkflowAction(selectedWorkflowId).then((result) => {
      const workflow = result.workflow;
      if (!active || !workflow) {
        return;
      }

      setKnownWorkflows((prev) => ({
        ...prev,
        [workflow.id]: workflow,
      }));
    });

    return () => {
      active = false;
    };
  }, [selectedWorkflowId]);

  const requiredCampaignVars = useMemo(() => {
    if (!selectedWorkflowId || responseMode !== "workflow") return [];
    const wf = knownWorkflows[selectedWorkflowId];
    return wf?.requiredCampaignVars ?? [];
  }, [selectedWorkflowId, knownWorkflows, responseMode]);

  const agentRequiredVarNames = useMemo(() => {
    return agentRequiredVars
      .filter((v) => v.required)
      .map((v) => v.name);
  }, [agentRequiredVars]);

  const agentVarLabels = useMemo(() => {
    const map: Record<string, string> = {};
    for (const v of agentRequiredVars) {
      if (v.required) {
        map[v.name] = v.description || v.name;
      }
    }
    return map;
  }, [agentRequiredVars]);

  const allRequiredKeys = useMemo(() => {
    const keys: string[] = [];
    const seen = new Set<string>();
    for (const k of requiredCampaignVars) {
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    }
    for (const k of agentRequiredVarNames) {
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    }
    return keys;
  }, [requiredCampaignVars, agentRequiredVarNames]);

  useEffect(() => {
    setMetadataFields((prev) => {
      const userFields = prev.filter((f) => !f.required);
      const requiredFields: MetadataField[] = allRequiredKeys.map((key) => ({
        key,
        label: agentVarLabels[key] || key,
        required: true,
      }));
      const requiredKeySet = new Set(allRequiredKeys);
      return [
        ...requiredFields,
        ...userFields.filter((f) => !requiredKeySet.has(f.key)),
      ];
    });
  }, [allRequiredKeys, agentVarLabels]);

  const businessPhoneOptions = useMemo(() => {
    const currentPhone = selectedBusinessPhoneId
      ? knownBusinessPhones[selectedBusinessPhoneId]
      : undefined;
    return mergeSelectedOption(
      currentPhone ? mapBusinessPhoneOption(currentPhone) : null,
      businessPhoneSelect.options,
    );
  }, [
    selectedBusinessPhoneId,
    knownBusinessPhones,
    mapBusinessPhoneOption,
    businessPhoneSelect.options,
  ]);

  const templateOptions = useMemo(() => {
    const currentTemplate = selectedTemplateId
      ? knownTemplates[selectedTemplateId]
      : undefined;
    return mergeSelectedOption(
      currentTemplate ? mapTemplateOption(currentTemplate) : null,
      templateSelect.options,
    );
  }, [
    selectedTemplateId,
    knownTemplates,
    mapTemplateOption,
    templateSelect.options,
  ]);

  const agentOptions = useMemo(() => {
    const currentAgent = selectedAgentId
      ? knownAgents[selectedAgentId]
      : undefined;
    return mergeSelectedOption(
      currentAgent ? mapAgentOption(currentAgent) : null,
      agentSelect.options,
    );
  }, [selectedAgentId, knownAgents, mapAgentOption, agentSelect.options]);

  const workflowOptions = useMemo(() => {
    const currentWorkflow = selectedWorkflowId
      ? knownWorkflows[selectedWorkflowId]
      : undefined;
    return mergeSelectedOption(
      currentWorkflow ? mapWorkflowOption(currentWorkflow) : null,
      workflowSelect.options,
    );
  }, [
    selectedWorkflowId,
    knownWorkflows,
    mapWorkflowOption,
    workflowSelect.options,
  ]);

  useEffect(() => {
    if (aiModelsProp?.length) {
      setAiModels(aiModelsProp);
      modelsLoadedRef.current = true;
    }
    if (modelPricingProp?.length) {
      setModelPricing(modelPricingProp);
    }
  }, [aiModelsProp, modelPricingProp]);

  useEffect(() => {
    if (modelsLoadedRef.current) return;
    modelsLoadedRef.current = true;
    let cancelled = false;
    setLoadingModels(true);
    getAgentOptionsAction()
      .then((result) => {
        if (cancelled || !result?.options) return;
        setAiModels(result.options.messaging ?? []);
        setModelPricing(result.options.modelPricing ?? []);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingModels(false);
      });
    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mode !== "create" || !aiModels.length) return;
    const current = getValues("aiModel");
    if (current) return;
    const preferred = "openai/gpt-4o-mini";
    const selected = aiModels.includes(preferred)
      ? preferred
      : aiModels[0] || "";
    if (selected) {
      setValue("aiModel", selected, { shouldValidate: true });
    }
  }, [aiModels, mode, getValues, setValue]);

  const [phoneNumbersSnapshot, setPhoneNumbersSnapshot] = useState(
    () => getValues("phoneNumbers") ?? [],
  );
  const phoneDebounceRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const subscription = watch((_formValues, { name }) => {
      if (!name || name.startsWith("phoneNumbers")) {
        clearTimeout(phoneDebounceRef.current);
        phoneDebounceRef.current = setTimeout(() => {
          setPhoneNumbersSnapshot([...(getValues("phoneNumbers") ?? [])]);
        }, 300);
      }
    });
    return () => {
      subscription.unsubscribe();
      clearTimeout(phoneDebounceRef.current);
    };
  }, [watch, getValues]);

  useEffect(() => {
    setPhoneNumbersSnapshot([...(getValues("phoneNumbers") ?? [])]);
  }, [fields.length, getValues]);

  const selectedTemplate = useMemo(() => {
    if (!selectedTemplateId) {
      return undefined;
    }

    return knownTemplates[selectedTemplateId];
  }, [selectedTemplateId, knownTemplates]);
  const templateVariables = useMemo(
    () => extractTemplateVariables(selectedTemplate),
    [selectedTemplate],
  );

  useEffect(() => {
    if (mode === "edit") {
      setTemplateInfoConfirmed(true);
      return;
    }
    const validIndices = phoneNumbersSnapshot
      .map((phone, idx) => ({ phone, idx }))
      .filter(({ phone }) => !!phone?.number?.trim())
      .map(({ idx }) => idx);

    if (validIndices.length === 0) {
      setPreviewEntryIndex(null);
      return;
    }

    const nextIndex =
      validIndices[Math.floor(Math.random() * validIndices.length)];
    setPreviewEntryIndex(nextIndex);
  }, [mode, selectedTemplateId, fields.length]);

  const previewEntry =
    previewEntryIndex != null
      ? phoneNumbersSnapshot[previewEntryIndex]
      : undefined;

  const previewVariables = useMemo(() => {
    if (!previewEntry?.variables) return [] as string[];

    if (Array.isArray(previewEntry.variables)) {
      return previewEntry.variables.map((value) => value ?? "");
    }

    if (typeof previewEntry.variables === "object") {
      const variableMap = previewEntry.variables as Record<string, string>;
      const values: string[] = [];
      for (let i = 0; i < templateVariables.length; i++) {
        values[i] = variableMap[String(i)] ?? "";
      }
      return values;
    }

    return [] as string[];
  }, [previewEntry, templateVariables]);

  const renderTemplateText = useCallback(
    (text?: string) => {
      if (!text) return "";
      let rendered = text;

      templateVariables.forEach((placeholder, index) => {
        const value = previewVariables[index]?.trim() || placeholder;
        rendered = rendered.split(placeholder).join(value);
        rendered = rendered.replaceAll(`{{${index + 1}}}`, value);
      });

      return rendered;
    },
    [templateVariables, previewVariables],
  );

  const selectedTemplateHasMediaHeader = useMemo(() => {
    if (!selectedTemplate) return false;
    const header = selectedTemplate.components.find((c) => c.type === "HEADER");
    return (
      header?.format !== undefined &&
      ["IMAGE", "VIDEO", "DOCUMENT", "GIF"].includes(header.format)
    );
  }, [selectedTemplate]);

  const selectedTemplateMissingMedia = useMemo(
    () => selectedTemplateHasMediaHeader && !selectedTemplate?.headerMediaUrl,
    [selectedTemplateHasMediaHeader, selectedTemplate],
  );

  const handleSaveHeaderMedia = async (headerMediaUrl: string | null) => {
    if (!selectedTemplate) return;
    setIsSavingMedia(true);
    try {
      const result = await updateWhatsAppTemplateHeaderMediaAction(
        selectedTemplate.id,
        { headerMediaUrl: headerMediaUrl ?? "" },
      );
      if (result.success) {
        setKnownTemplates((prev) => ({
          ...prev,
          [selectedTemplate.id]: {
            ...selectedTemplate,
            headerMediaUrl,
          },
        }));
        toast({
          title: t("toast.success"),
          description: t("media.saved"),
        });
        setMediaModalOpen(false);
      } else {
        toast({
          title: t("toast.error"),
          description: result.error || t("media.saveError"),
          variant: "destructive",
        });
      }
    } catch {
      toast({
        title: t("toast.error"),
        description: t("media.saveError"),
        variant: "destructive",
      });
    } finally {
      setIsSavingMedia(false);
    }
  };

  const hasMissingVariables = useCallback(
    (
      phoneNumber:
        | {
            variables?: string[] | Record<string, string>;
            metadata?: Record<string, unknown>;
          }
        | undefined,
    ) => {
      const hasTemplateVars = templateVariables.length > 0;
      const hasCampaignVars = requiredCampaignVars.length > 0;

      if (!hasTemplateVars && !hasCampaignVars) return false;
      if (!phoneNumber) return hasTemplateVars || hasCampaignVars;

      if (hasTemplateVars) {
        const vars = phoneNumber.variables;
        if (!vars) return true;

        let varsArray: (string | undefined)[];

        if (Array.isArray(vars)) {
          varsArray = vars;
        } else if (typeof vars === "object") {
          varsArray = [];
          for (let i = 0; i < templateVariables.length; i++) {
            varsArray[i] = vars[String(i)];
          }
        } else {
          return true;
        }

        for (let i = 0; i < templateVariables.length; i++) {
          const value = varsArray[i];
          if (
            value === undefined ||
            value === null ||
            (typeof value === "string" && value.trim() === "")
          ) {
            return true;
          }
        }
      }

      if (hasCampaignVars) {
        const meta = phoneNumber.metadata;
        for (const key of requiredCampaignVars) {
          const value = meta?.[key];
          if (
            value === undefined ||
            value === null ||
            (typeof value === "string" && value.trim() === "")
          ) {
            return true;
          }
        }
      }

      return false;
    },
    [templateVariables, requiredCampaignVars],
  );

  const missingVariablesCount = useMemo(() => {
    if (templateVariables.length === 0 && requiredCampaignVars.length === 0)
      return 0;
    return phoneNumbersSnapshot.filter((pn) => hasMissingVariables(pn)).length;
  }, [
    phoneNumbersSnapshot,
    templateVariables,
    requiredCampaignVars,
    hasMissingVariables,
  ]);

  const filteredFields = useMemo(() => {
    let result = fields.map((field, idx) => ({ field, originalIndex: idx }));

    if (
      showOnlyMissingVars &&
      (templateVariables.length > 0 || requiredCampaignVars.length > 0)
    ) {
      result = result.filter(({ originalIndex }) => {
        const pn = phoneNumbersSnapshot[originalIndex];
        return hasMissingVariables(pn);
      });
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter(({ originalIndex }) => {
        const pn = phoneNumbersSnapshot[originalIndex];
        if (!pn) return false;
        return (
          pn.number.toLowerCase().includes(query) ||
          (pn.name && pn.name.toLowerCase().includes(query))
        );
      });
    }

    return result;
  }, [
    fields,
    phoneNumbersSnapshot,
    showOnlyMissingVars,
    searchQuery,
    templateVariables,
    requiredCampaignVars,
    hasMissingVariables,
  ]);

  const totalPages = Math.ceil(filteredFields.length / ITEMS_PER_PAGE);
  const paginatedFields = filteredFields.slice(
    currentPage * ITEMS_PER_PAGE,
    (currentPage + 1) * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    if (initialCampaign && mode === "edit") {
      const phoneNumbersData =
        initialCampaign.phoneNumbers?.map((pn) => {
          // eslint-disable-next-line @typescript-eslint/no-unused-vars
          const { variables: _metaVars, ...cleanMetadata } = (pn.metadata ||
            {}) as Record<string, unknown>;

          return {
            number: pn.number,
            name: pn.name || "",
            variables: pn.variables || [],
            metadata: cleanMetadata as Record<
              string,
              string | number | boolean | null
            >,
          };
        }) || [];

      reset({
        name: initialCampaign.name,
        templateId: initialCampaign.templateId,
        businessPhoneId: initialCampaign.businessPhoneId || "",
        agentId: initialCampaign.agentId || null,
        workflowId: initialCampaign.workflowId || null,
        enableAgentResponses: initialCampaign.enableAgentResponses,
        preferAudio: initialCampaign.preferAudio ?? false,
        showTemplateInCrm: initialCampaign.showTemplateInCrm ?? false,
        enableAnalysis: initialCampaign.enableAnalysis ?? false,
        enableAutoStaging: initialCampaign.enableAutoStaging ?? false,
        aiModel: initialCampaign.aiModel ?? "",
        scheduledStart: initialCampaign.scheduledStart || null,
        phoneNumbers:
          phoneNumbersData.length > 0
            ? phoneNumbersData
            : [{ number: "", name: "", variables: [], metadata: {} }],
      });

      if (initialCampaign.scheduledStart) {
        setScheduleEnabled(true);
      }

      if (phoneNumbersData.length > 0) {
        replace(phoneNumbersData);
      }
    }
  }, [initialCampaign, mode, reset, replace]);

  const parseCsvContentAsync = useCallback(
    async (
      content: string,
      onProgress: (progress: number) => void,
    ): Promise<{
      records: ParsedCsvRecord[];
      metadataHeaders: MetadataField[];
      skipped: SkippedLine[];
    }> => {
      const rows = content.split(/\r?\n/).filter(Boolean);

      if (rows.length < 2) {
        throw new Error(t("csv.minimumRows"));
      }

      const detectDelimiter = (headerRow: string): string => {
        const delimiters = [",", ";", "\t", "|"];
        for (const delimiter of delimiters) {
          if (headerRow.includes(delimiter)) {
            return delimiter;
          }
        }
        return ",";
      };

      const delimiter = detectDelimiter(rows[0]);
      const headers = rows[0]
        .split(delimiter)
        .map((header) => header.trim().toLowerCase());

      let numberIndex = headers.findIndex((h) =>
        ["number", "telefone", "phone"].includes(h),
      );
      if (numberIndex === -1) {
        numberIndex = headers.findIndex((h) => h === "numero");
      }
      const nameIndex = headers.findIndex((h) => ["name", "nome"].includes(h));

      const reservedHeaders = new Set([
        "number",
        "telefone",
        "phone",
        "numero",
        "name",
        "nome",
      ]);

      const variableColumnIndices: { index: number; varIndex: number }[] = [];
      headers.forEach((header, index) => {
        const varMatch = header.match(/^var(\d+)$/);
        if (varMatch) {
          variableColumnIndices.push({
            index,
            varIndex: parseInt(varMatch[1], 10) - 1, // 0-based
          });
        }
      });
      variableColumnIndices.sort((a, b) => a.varIndex - b.varIndex);

      const metadataColumnIndices: {
        index: number;
        key: string;
        label: string;
      }[] = [];
      headers.forEach((header, index) => {
        if (
          !reservedHeaders.has(header) &&
          header.length > 0 &&
          !header.match(/^var\d+$/)
        ) {
          const sanitizedKey = header
            .replace(/\s+/g, "_")
            .replace(/[^a-z0-9_]/g, "");
          const label = rows[0].split(delimiter)[index].trim();
          metadataColumnIndices.push({ index, key: sanitizedKey, label });
        }
      });

      if (numberIndex === -1) {
        throw new Error(t("csv.columnRequired"));
      }

      const collected: ParsedCsvRecord[] = [];
      const skipped: SkippedLine[] = [];
      const duplicateCheck = new Set<string>();
      const dataRows = rows.slice(1);
      const totalRows = dataRows.length;

      for (let i = 0; i < totalRows; i += CSV_BATCH_SIZE) {
        const batch = dataRows.slice(i, i + CSV_BATCH_SIZE);

        for (let j = 0; j < batch.length; j++) {
          const line = batch[j];
          const rowIndex = i + j;
          const rawCells = line.split(delimiter).map((cell) => cell.trim());
          const cells =
            rawCells.length < headers.length
              ? [
                  ...rawCells,
                  ...Array(headers.length - rawCells.length).fill(""),
                ]
              : rawCells;
          const numberCell = cells[numberIndex] ?? "";
          const strippedNumber = numberCell.replace(/[^\d]/g, "");

          if (!strippedNumber) {
            skipped.push({
              line: rowIndex + 2,
              rawContent: line,
              reason: t("csv.skippedEmpty"),
            });
            continue;
          }

          const normalizedNumber = normalizeBrazilianPhone(strippedNumber);
          if (!normalizedNumber) {
            skipped.push({
              line: rowIndex + 2,
              rawContent: line,
              reason: t("csv.invalidNumber", {
                line: rowIndex + 2,
                number: numberCell,
              }),
            });
            continue;
          }

          if (duplicateCheck.has(normalizedNumber)) {
            continue;
          }

          duplicateCheck.add(normalizedNumber);

          const record: ParsedCsvRecord = {
            number: normalizedNumber,
          };

          if (nameIndex > -1) {
            const nameCell = cells[nameIndex] ?? "";
            record.name = nameCell.trim() || undefined;
          }

          if (variableColumnIndices.length > 0) {
            record.variables = [];
            for (const varCol of variableColumnIndices) {
              const value = cells[varCol.index] ?? "";
              record.variables[varCol.varIndex] = value.trim();
            }
            record.variables = record.variables.filter((v) => v !== undefined);
          }

          if (metadataColumnIndices.length > 0) {
            record.metadata = {};
            for (const col of metadataColumnIndices) {
              const value = cells[col.index] ?? "";
              if (value) {
                const trimmedValue = value.trim();
                if (trimmedValue.toLowerCase() === "true") {
                  record.metadata[col.key] = true;
                } else if (trimmedValue.toLowerCase() === "false") {
                  record.metadata[col.key] = false;
                } else {
                  const numValue = Number(trimmedValue);
                  if (!isNaN(numValue) && trimmedValue !== "") {
                    record.metadata[col.key] = numValue;
                  } else {
                    record.metadata[col.key] = trimmedValue;
                  }
                }
              }
            }
          }

          collected.push(record);
        }

        const progress = Math.min(((i + batch.length) / totalRows) * 100, 100);
        onProgress(progress);

        await new Promise((resolve) => setTimeout(resolve, 0));
      }

      if (!collected.length) {
        throw new Error(t("csv.noValidNumbers"));
      }

      return {
        records: collected,
        metadataHeaders: metadataColumnIndices.map((col) => ({
          key: col.key,
          label: col.label,
        })),
        skipped,
      };
    },
    [t],
  );

  const handleCsvUpload = async (
    event: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    try {
      if (file.type !== "text/csv" && !file.name.endsWith(".csv")) {
        throw new Error(t("csv.invalidFileType"));
      }

      setIsLoadingCsv(true);
      setLoadingProgress(0);

      const text = await file.text();

      const {
        records: parsed,
        metadataHeaders,
        skipped,
      } = await parseCsvContentAsync(text, (progress) => {
        setLoadingProgress(progress * 0.8);
      });

      if (metadataHeaders.length > 0) {
        setMetadataFields(metadataHeaders);
      }

      const items = parsed.map((record) => ({
        number: record.number,
        name: record.name ?? "",
        variables: record.variables ?? [],
        metadata: record.metadata ?? {},
      }));

      setLoadingProgress(90);

      replace(items);
      setCurrentPage(0);
      setCsvError(null);
      setSkippedLines(skipped);
      setSkippedLinesOpen(false);
      setSkippedPage(0);

      setLoadingProgress(100);

      const metadataFieldsCount = metadataHeaders.length;
      toast({
        title: t("toast.listLoaded"),
        description:
          metadataFieldsCount > 0
            ? t("csv.importedWithMetadata", {
                count: items.length,
                fields: metadataFieldsCount,
              })
            : t("csv.importedCount", { count: items.length }),
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("csv.importError");
      setCsvError(message);
      toast({
        title: t("toast.csvError"),
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsLoadingCsv(false);
      setLoadingProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addMetadataField = () => {
    if (!newFieldKey) return;
    const sanitizedKey = newFieldKey
      .replace(/\s+/g, "_")
      .replace(/[^a-z0-9_]/g, "");
    if (!metadataFields.find((f) => f.key === sanitizedKey)) {
      setMetadataFields([
        ...metadataFields,
        { key: sanitizedKey, label: newFieldKey },
      ]);
      setNewFieldKey("");
    }
  };

  const removeMetadataField = (key: string) => {
    setMetadataFields(
      metadataFields.filter((f) => f.key !== key || f.required),
    );
  };

  const handleDownloadCsvExample = useCallback(() => {
    const headers = ["number", "name"];
    const exampleRow = ["5584999999999", "John"];

    templateVariables.forEach((_, idx) => {
      headers.push(`var${idx + 1}`);
      exampleRow.push(`value${idx + 1}`);
    });

    metadataFields.forEach((field) => {
      headers.push(field.key);
      exampleRow.push(`example_${field.key}`);
    });

    const csvContent = [headers.join(","), exampleRow.join(",")].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "campaign_example.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [templateVariables, metadataFields]);

  const onSubmit = (data: WhatsAppCampaignFormValues) => {
    if (mode === "create" && !organic && !templateInfoConfirmed) {
      toast({
        title: t("toast.validationError"),
        description: "Confirme os dados do template antes de criar a campanha.",
        variant: "destructive",
      });
      return;
    }

    const checkMissingVars = (
      pn:
        | {
            number: string;
            name?: string;
            variables?: string[] | Record<string, string>;
            metadata?: Record<string, unknown>;
          }
        | undefined,
    ): boolean => {
      const hasTemplateVars = templateVariables.length > 0;
      const hasCampaignVars = requiredCampaignVars.length > 0;
      const hasAgentVars = agentRequiredVarNames.length > 0;

      if (!hasTemplateVars && !hasCampaignVars && !hasAgentVars) return false;
      if (!pn) return hasTemplateVars || hasCampaignVars || hasAgentVars;

      if (hasTemplateVars) {
        const vars = pn.variables;
        if (!vars) return true;

        let varsArray: (string | undefined)[];

        if (Array.isArray(vars)) {
          varsArray = vars;
        } else if (typeof vars === "object") {
          varsArray = [];
          for (let i = 0; i < templateVariables.length; i++) {
            varsArray[i] = vars[String(i)];
          }
        } else {
          return true;
        }

        for (let i = 0; i < templateVariables.length; i++) {
          const value = varsArray[i];
          if (
            value === undefined ||
            value === null ||
            (typeof value === "string" && value.trim() === "")
          ) {
            return true;
          }
        }
      }

      if (hasCampaignVars) {
        const meta = pn.metadata;
        for (const key of requiredCampaignVars) {
          const value = meta?.[key];
          if (
            value === undefined ||
            value === null ||
            (typeof value === "string" && value.trim() === "")
          ) {
            return true;
          }
        }
      }

      if (hasAgentVars) {
        const meta = pn.metadata;
        for (const key of agentRequiredVarNames) {
          const value = meta?.[key];
          if (
            value === undefined ||
            value === null ||
            (typeof value === "string" && value.trim() === "")
          ) {
            return true;
          }
        }
      }

      return false;
    };

    const missingPhones = data.phoneNumbers?.filter(checkMissingVars) ?? [];
    const hasVarsToCheck =
      templateVariables.length > 0 || requiredCampaignVars.length > 0 || agentRequiredVarNames.length > 0;
    const actualMissingCount = hasVarsToCheck ? missingPhones.length : 0;

    if (!organic && hasVarsToCheck && actualMissingCount > 0) {
      toast({
        title: t("validation.missingVariablesTitle"),
        description: t("validation.cannotSubmitMissingVars", {
          count: actualMissingCount,
        }),
        variant: "destructive",
      });
      setShowOnlyMissingVars(true);
      setCurrentPage(0);
      return;
    }

    startSubmit(async () => {
      try {
        const agentResponsesEnabled =
          responseMode === "agent" && Boolean(data.agentId);
        const workflowEnabled =
          responseMode === "workflow" && Boolean(data.workflowId);
        const campaignToolsEnabled = !agentResponsesEnabled;

        const payload = {
          name: data.name,
          ...(organic ? { type: "organic" as const } : {}),
          templateId: organic ? "" : data.templateId,
          businessPhoneId: data.businessPhoneId,
          agentId: agentResponsesEnabled ? data.agentId || null : null,
          workflowId: workflowEnabled ? data.workflowId || null : null,
          ...(selectedStageGroupId
            ? { stageGroupId: selectedStageGroupId }
            : {}),
          ...(selectedPipelineId ? { pipelineId: selectedPipelineId } : {}),
          enableAgentResponses: agentResponsesEnabled,
          enableWorkflow: workflowEnabled,
          preferAudio: agentResponsesEnabled ? data.preferAudio : false,
          showTemplateInCrm: data.showTemplateInCrm,
          enableAnalysis: campaignToolsEnabled ? data.enableAnalysis : false,
          enableAutoStaging: campaignToolsEnabled
            ? data.enableAutoStaging
            : false,
          aiModel:
            campaignToolsEnabled &&
            (data.enableAnalysis || data.enableAutoStaging)
              ? data.aiModel || undefined
              : undefined,
          scheduledStart:
            !organic && scheduleEnabled && data.scheduledStart
              ? data.scheduledStart
              : undefined,
          phoneNumbers: organic
            ? []
            : (data.phoneNumbers ?? []).map((pn) => {
                let varsArray: string[] | undefined;
                if (pn.variables) {
                  if (Array.isArray(pn.variables)) {
                    varsArray = pn.variables.filter(
                      (v) => v !== undefined && v !== null && v.trim() !== "",
                    );
                  } else if (typeof pn.variables === "object") {
                    varsArray = [];
                    const varsObj = pn.variables as Record<string, string>;
                    const keys = Object.keys(varsObj)
                      .filter((k) => !isNaN(Number(k)))
                      .sort((a, b) => Number(a) - Number(b));
                    for (const k of keys) {
                      const val = varsObj[k];
                      if (
                        val !== undefined &&
                        val !== null &&
                        val.trim() !== ""
                      ) {
                        varsArray[Number(k)] = val;
                      }
                    }
                    varsArray = varsArray.filter((v) => v !== undefined);
                  }
                }

                return {
                  number: pn.number,
                  name: pn.name || undefined,
                  variables:
                    varsArray && varsArray.length > 0 ? varsArray : undefined,
                  metadata: pn.metadata || undefined,
                };
              }),
        };

        const result =
          mode === "edit" && initialCampaign
            ? await updateWhatsAppCampaignAction(initialCampaign.id, payload)
            : await createWhatsAppCampaignAction(payload);

        if (result.error) {
          toast({
            title: t("toast.error"),
            description: result.error,
            variant: "destructive",
          });
        } else {
          toast({
            title: t("toast.success"),
            description:
              mode === "edit"
                ? t("toast.campaignUpdated")
                : t("toast.campaignCreated"),
          });

          const campaignId = result.campaign?.id;
          pendingRedirectRef.current = campaignId
            ? `/dashboard/whatsapp-campaigns/${campaignId}`
            : "/dashboard/whatsapp-campaigns";
        }
      } catch (error) {
        toast({
          title: t("toast.error"),
          description:
            error instanceof Error ? error.message : t("toast.unknownError"),
          variant: "destructive",
        });
      }
    });
  };

  const onInvalid = (errors: Record<string, unknown>) => {
    let errorMessage = t("validation.formHasErrors");

    console.log("Form errors:", errors);

    if (errors.name) {
      errorMessage = t("validation.nameRequired");
    } else if (errors.templateId) {
      errorMessage = t("validation.templateRequired");
    } else if (errors.phoneNumbers) {
      const phoneErrors = errors.phoneNumbers as unknown[];
      if (Array.isArray(phoneErrors)) {
        const firstErrorIndex = phoneErrors.findIndex((e) => e !== undefined);
        if (firstErrorIndex !== -1) {
          const phoneError = phoneErrors[firstErrorIndex] as Record<
            string,
            { message?: string }
          >;
          if (phoneError?.number?.message) {
            errorMessage = phoneError.number.message;
          }
        }
      }
    }

    toast({
      title: t("toast.validationError"),
      description: errorMessage,
      variant: "destructive",
    });
  };

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} className="space-y-6">
      <div
        className={cn(
          "grid gap-6 lg:items-start",
          !organic && "lg:grid-cols-[minmax(0,1fr)_360px]",
        )}
      >
        <ElevatedContainer className="border border-border/70 bg-card/95 p-6" data-tour="wc-basic-info">
          <h2 className="mb-4 text-xl font-bold text-foreground">
            {t("basicInfo.title")}
          </h2>

          <div className="space-y-4">
            <div>
              <ElevatedInput
                label={t("basicInfo.campaignName")}
                {...register("name")}
                controlSize="default"
                placeholder={t("basicInfo.campaignNamePlaceholder")}
              />
              <FieldError message={errors.name?.message} />
            </div>

            <div data-tour="wc-phone-template">
              <Controller
                name="businessPhoneId"
                control={control}
                render={({ field }) => (
                  <ElevatedCommandSelect
                    label={t("basicInfo.businessPhone")}
                    value={field.value}
                    onValueChange={(val) => {
                      field.onChange(val);
                      setValue("templateId", "", { shouldDirty: true });
                    }}
                    options={businessPhoneOptions}
                    searchPlaceholder={t("basicInfo.searchBusinessPhone")}
                    emptyMessage={t("basicInfo.noBusinessPhones")}
                    onSearch={businessPhoneSelect.onSearch}
                    onScrollEnd={businessPhoneSelect.onScrollEnd}
                    onOpenChange={businessPhoneSelect.onOpenChange}
                    isLoading={businessPhoneSelect.isLoading}
                  />
                )}
              />
              <FieldError message={errors.businessPhoneId?.message} />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("basicInfo.businessPhoneDescription")}
              </p>
            </div>

            {mode === "create" && stageGroups.length > 0 && (
              <div>
                <ElevatedCommandSelect
                  label={t("basicInfo.StageGroup")}
                  options={[
                    { value: "", label: t("basicInfo.defaultTags") },
                    ...stageGroups.map((tg) => ({
                      value: tg.id,
                      label: `${tg.name} (${tg.items.length})`,
                    })),
                  ]}
                  value={selectedStageGroupId}
                  onValueChange={setSelectedTagGroupId}
                  searchPlaceholder={t("basicInfo.searchTagGroup")}
                  emptyMessage={t("basicInfo.noTagGroupFound")}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("basicInfo.tagGroupDescription")}
                </p>
              </div>
            )}

            {/* Funnel (conversation pipeline) for an existing campaign. */}
            {mode === "edit" && (
              <div>
                <ElevatedCommandSelect
                  label="Funil de atendimento"
                  options={[
                    { value: "", label: "Funil padrão do workspace" },
                    ...pipelineOptions.map((p) => ({
                      value: p.id,
                      label: p.name,
                    })),
                  ]}
                  value={selectedPipelineId}
                  onValueChange={setSelectedPipelineId}
                  searchPlaceholder="Buscar funil..."
                  emptyMessage="Nenhum funil encontrado"
                />
                <p className="mt-1 text-xs text-muted-foreground">
                  Define em qual funil as conversas desta campanha entram e por
                  quais etapas passam. Vazio usa o funil padrão do workspace.
                </p>
              </div>
            )}

            {!organic && (
              <div>
                <Controller
                  name="templateId"
                  control={control}
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      label={t("basicInfo.template")}
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedBusinessPhoneId}
                      options={templateOptions}
                      searchPlaceholder={t("basicInfo.searchTemplate")}
                      emptyMessage={
                        !selectedBusinessPhoneId
                          ? t("basicInfo.selectPhoneFirst")
                          : templateSelect.isLoading
                            ? t("basicInfo.loadingTemplates")
                            : t("basicInfo.noTemplates")
                      }
                      onSearch={templateSelect.onSearch}
                      onScrollEnd={templateSelect.onScrollEnd}
                      onOpenChange={templateSelect.onOpenChange}
                      isLoading={templateSelect.isLoading}
                    />
                  )}
                />
                <FieldError message={errors.templateId?.message} />

                {/* Warning: selected template is missing header media */}
                {selectedTemplateMissingMedia &&
                  isAdmin &&
                  selectedTemplate && (
                    <div className="mt-3 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4">
                      <div className="flex items-start gap-3">
                        <ImageSquare
                          className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5"
                          weight="fill"
                        />
                        <div className="flex-1">
                          <h4 className="text-sm font-semibold text-amber-800">
                            {t("media.missingTitle")}
                          </h4>
                          <p className="text-xs text-amber-700 mt-1">
                            {t("media.missingDescription")}
                          </p>
                          <Button
                            type="button"
                            variant="secondary"
                            title={t("media.configureButton")}
                            icon={
                              <ImageSquare className="h-4 w-4" weight="bold" />
                            }
                            iconVisible
                            iconSide="left"
                            onClick={() => setMediaModalOpen(true)}
                            className="mt-3"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                {/* Show template variables info when a template is selected */}
                {selectedTemplate && templateVariables.length > 0 && (
                  <div className="mt-3 rounded-lg border border-emerald-500/20 bg-emerald-50 p-4" data-tour="wc-template-variables">
                    <h4 className="text-sm font-semibold text-emerald-800 mb-2">
                      {t("basicInfo.templateVariables")}
                    </h4>
                    <p className="text-xs text-emerald-700 mb-3">
                      {t("basicInfo.templateVariablesDescription")}
                    </p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {templateVariables.map((varPlaceholder, idx) => (
                        <span
                          key={idx}
                          className="inline-flex items-center rounded-md bg-emerald-500 px-2 py-1 text-xs font-medium text-white"
                        >
                          {varPlaceholder}
                        </span>
                      ))}
                    </div>

                    <p className="text-xs text-emerald-700 border-t border-emerald-500/20 pt-3">
                      A prévia do template fica no painel da direita com um
                      contato aleatório desta campanha.
                    </p>
                  </div>
                )}
              </div>
            )}

            <div data-tour="wc-response-mode">
              <p className="text-sm font-medium text-foreground mb-2">
                {t("basicInfo.responseMode")}
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border/60 p-1 mb-3">
                <button
                  type="button"
                  onClick={() => {
                    setResponseMode("agent");
                    setValue("workflowId", null);
                    setValue("enableAgentResponses", true);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    responseMode === "agent"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("basicInfo.modeAgent")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setResponseMode("workflow");
                    setValue("agentId", null);
                    setValue("enableAgentResponses", false);
                    setValue("preferAudio", false);
                  }}
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    responseMode === "workflow"
                      ? "bg-foreground text-background shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {t("basicInfo.modeWorkflow")}
                </button>
              </div>

              {responseMode === "agent" && (
                <div className="space-y-3" data-tour="wc-agent-settings">
                  <Controller
                    name="agentId"
                    control={control}
                    render={({ field }) => (
                      <ElevatedCommandSelect
                        label={t("basicInfo.agent")}
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        options={agentOptions}
                        searchPlaceholder={t("basicInfo.searchAgent")}
                        emptyMessage={t("basicInfo.noAgents")}
                        onSearch={agentSelect.onSearch}
                        onScrollEnd={agentSelect.onScrollEnd}
                        onOpenChange={agentSelect.onOpenChange}
                        isLoading={agentSelect.isLoading}
                      />
                    )}
                  />
                  <FieldError message={errors.agentId?.message} />

                  <Controller
                    name="preferAudio"
                    control={control}
                    render={({ field }) => (
                      <ElevatedSwitch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label={t("basicInfo.preferAudio")}
                        description={t("basicInfo.preferAudioDescription")}
                      />
                    )}
                  />
                </div>
              )}

              {responseMode === "workflow" && (
                <div className="space-y-3">
                  <Controller
                    name="workflowId"
                    control={control}
                    render={({ field }) => (
                      <ElevatedCommandSelect
                        label={t("basicInfo.workflow")}
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        options={workflowOptions}
                        searchPlaceholder={t("basicInfo.searchWorkflow")}
                        emptyMessage={
                          workflowSelect.isLoading
                            ? t("basicInfo.loadingWorkflows")
                            : t("basicInfo.noWorkflows")
                        }
                        onSearch={workflowSelect.onSearch}
                        onScrollEnd={workflowSelect.onScrollEnd}
                        onOpenChange={workflowSelect.onOpenChange}
                        isLoading={workflowSelect.isLoading}
                      />
                    )}
                  />
                </div>
              )}
            </div>

            {(campaignToolsAvailable || !organic) && (
              <div className="grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
                {campaignToolsAvailable && (
                  <div data-tour="wc-analysis">
                    <Controller
                      name="enableAnalysis"
                      control={control}
                      render={({ field }) => (
                        <ElevatedSwitch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          label={t("basicInfo.enableAnalysis")}
                          description={t("basicInfo.enableAnalysisDescription")}
                        />
                      )}
                    />
                  </div>
                )}

                {campaignToolsAvailable && (
                  <div>
                    <Controller
                      name="enableAutoStaging"
                      control={control}
                      render={({ field }) => (
                        <ElevatedSwitch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          label={t("basicInfo.enableAutoStaging")}
                          description={t("basicInfo.enableAutoTaggingDescription")}
                        />
                      )}
                    />
                  </div>
                )}

                {!organic && (
                  <div data-tour="wc-show-template-in-crm">
                    <Controller
                      name="showTemplateInCrm"
                      control={control}
                      render={({ field }) => (
                        <ElevatedSwitch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          label={t("basicInfo.showTemplateInCrm")}
                          description={t("basicInfo.showTemplateInCrmDescription")}
                        />
                      )}
                    />
                  </div>
                )}
              </div>
            )}

            {campaignToolsAvailable &&
              (enableAnalysis || enableAutoStaging) && (
                <div>
                  <Controller
                    name="aiModel"
                    control={control}
                    render={({ field }) => (
                      <AIModelSelector
                        label={t("aiModel")}
                        value={field.value || ""}
                        onValueChange={field.onChange}
                        models={aiModels}
                        modelPricing={modelPricing}
                        disabled={loadingModels || aiModels.length === 0}
                      />
                    )}
                  />
                  <p className="text-xs text-muted-foreground mt-2">
                    {t("aiModelDescription")}
                  </p>
                </div>
              )}

            {!organic && (
              <div data-tour="wc-schedule">
                <div className="flex items-center gap-3 mb-2">
                  <ElevatedSwitch
                    onCheckedChange={(checked) => {
                      setScheduleEnabled(checked);
                      if (!checked) {
                        setValue("scheduledStart", null);
                      }
                    }}
                    label={t("basicInfo.scheduleToggle")}
                  />
                </div>
                <p className="text-xs text-muted-foreground mb-3">
                  {t("basicInfo.scheduleDescription")}
                </p>

                {scheduleEnabled && (
                  <div>
                    <Controller
                      name="scheduledStart"
                      control={control}
                      render={({ field }) => {
                        const toLocalDatetime = (
                          iso: string | null | undefined,
                        ) => {
                          if (!iso) return "";
                          const date = new Date(iso);
                          if (isNaN(date.getTime())) return "";
                          const pad = (n: number) => String(n).padStart(2, "0");
                          return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
                        };

                        const now = new Date();
                        const minDate = new Date(now.getTime() + 5 * 60 * 1000);
                        const maxDate = new Date(now);
                        maxDate.setFullYear(maxDate.getFullYear() + 1);

                        return (
                          <ElevatedInput
                            icon={
                              <CalendarCheck
                                className="h-5 w-5"
                                weight="fill"
                              />
                            }
                            label={t("basicInfo.scheduledStartLabel")}
                            type="datetime-local"
                            value={toLocalDatetime(field.value)}
                            onChange={(e) => {
                              const val = e.target.value;
                              if (!val) {
                                field.onChange(null);
                                return;
                              }
                              const date = new Date(val);
                              field.onChange(date.toISOString());
                            }}
                            min={toLocalDatetime(minDate.toISOString())}
                            max={toLocalDatetime(maxDate.toISOString())}
                            controlSize="default"
                          />
                        );
                      }}
                    />
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {t("basicInfo.scheduleHint")}
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>
        </ElevatedContainer>

        {!organic && (
          <ElevatedContainer className="border border-border/70 bg-card/95 p-5 lg:sticky lg:top-20" data-tour="wc-preview">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-foreground">
                Prévia do template
              </h3>
              <Button
                type="button"
                variant="secondary"
                title="Trocar contato"
                onClick={() => {
                  const validIndices = phoneNumbersSnapshot
                    .map((phone, idx) => ({ phone, idx }))
                    .filter(({ phone }) => !!phone?.number?.trim())
                    .map(({ idx }) => idx);
                  if (!validIndices.length) return;
                  const nextIndex =
                    validIndices[
                      Math.floor(Math.random() * validIndices.length)
                    ];
                  setPreviewEntryIndex(nextIndex);
                }}
              />
            </div>

            {!selectedTemplate ? (
              <p className="text-sm text-muted-foreground">
                Selecione um template para visualizar a mensagem.
              </p>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
                  <p>
                    <strong>Contato de teste:</strong>{" "}
                    {previewEntry?.name?.trim() || t("noName")}
                  </p>
                  <p>
                    <strong>Número:</strong> {previewEntry?.number || "-"}
                  </p>
                </div>

                <div className="bg-[#e5ddd5] rounded-xl p-3">
                  <div className="bg-card rounded-lg shadow-sm overflow-hidden">
                    {selectedTemplate.components.find(
                      (c) => c.type === "HEADER",
                    )?.text && (
                      <div className="px-3 py-2 bg-muted border-b border-border">
                        <p className="text-sm font-semibold text-foreground whitespace-pre-wrap">
                          {renderTemplateText(
                            selectedTemplate.components.find(
                              (c) => c.type === "HEADER",
                            )?.text,
                          )}
                        </p>
                      </div>
                    )}

                    <div className="px-3 py-2">
                      <p className="text-sm text-foreground whitespace-pre-wrap">
                        {renderTemplateText(
                          selectedTemplate.components.find(
                            (c) => c.type === "BODY",
                          )?.text,
                        )}
                      </p>
                    </div>

                    {selectedTemplate.components.find(
                      (c) => c.type === "FOOTER",
                    )?.text && (
                      <div className="px-3 py-1">
                        <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                          {renderTemplateText(
                            selectedTemplate.components.find(
                              (c) => c.type === "FOOTER",
                            )?.text,
                          )}
                        </p>
                      </div>
                    )}

                    {selectedTemplate.components.find(
                      (c) => c.type === "BUTTONS",
                    )?.buttons?.length ? (
                      <div className="border-t border-border">
                        {selectedTemplate.components
                          .find((c) => c.type === "BUTTONS")
                          ?.buttons?.map((button, index) => (
                            <div
                              key={index}
                              className="w-full px-3 py-2 text-sm font-medium text-[#00a884] text-center border-b border-border last:border-b-0"
                            >
                              {button.text}
                            </div>
                          ))}
                      </div>
                    ) : null}
                  </div>
                </div>

                <GrainBackground
                  palette={"alert"}
                  seed={20000}
                  className="rounded-lg border p-3"
                  data-tour="wc-confirm-template"
                >
                  <ElevatedSwitch
                    checked={templateInfoConfirmed}
                    onCheckedChange={setTemplateInfoConfirmed}
                    label="Confirmo que revisei os dados do template acima"
                  />
                </GrainBackground>
              </div>
            )}
          </ElevatedContainer>
        )}
      </div>

      {!organic && (
        <ElevatedContainer className="border border-border/70 bg-card/95 p-6" data-tour="wc-contacts">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-bold text-foreground">
              {t("contacts.title")}
            </h2>
            <div className="flex items-center gap-2" data-tour="wc-csv-buttons">
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="secondary"
                title={t("contacts.downloadExample")}
                icon={<DownloadSimple className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={handleDownloadCsvExample}
              />
              <Button
                type="button"
                variant="secondary"
                title={t("contacts.uploadCsv")}
                icon={<UploadSimple className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={() => fileInputRef.current?.click()}
                disabled={isLoadingCsv}
              />
              <Button
                type="button"
                variant="secondary"
                title={t("contacts.addContact")}
                icon={<Plus className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={() =>
                  append({ number: "", name: "", variables: [], metadata: {} })
                }
              />
            </div>
          </div>

          {isLoadingCsv && (
            <div className="mb-4">
              <ProgressBar
                progress={loadingProgress}
                label={t("contacts.importing")}
              />
            </div>
          )}

          {csvError && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 p-3">
              <p className="text-sm text-rose-600">{csvError}</p>
            </div>
          )}

          {/* Skipped lines warning */}
          {skippedLines.length > 0 && (
            <div className="mb-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3">
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => {
                  setSkippedLinesOpen(!skippedLinesOpen);
                  setSkippedPage(0);
                }}
              >
                <Warning
                  className="h-5 w-5 flex-shrink-0 text-amber-600"
                  weight="bold"
                />
                <span className="flex-1 text-sm font-semibold text-amber-800">
                  {t("csv.skippedTitle", { count: skippedLines.length })}
                </span>
                <CaretDown
                  className={`h-4 w-4 text-amber-600 transition-transform duration-200 ${skippedLinesOpen ? "rotate-180" : ""}`}
                  weight="bold"
                />
              </button>
              {skippedLinesOpen &&
                (() => {
                  const totalPages = Math.ceil(
                    skippedLines.length / SKIPPED_PAGE_SIZE,
                  );
                  const start = skippedPage * SKIPPED_PAGE_SIZE;
                  const pageItems = skippedLines.slice(
                    start,
                    start + SKIPPED_PAGE_SIZE,
                  );
                  return (
                    <div className="mt-3">
                      <div className="max-h-60 space-y-1.5 overflow-y-auto">
                        {pageItems.map((sl) => (
                          <div
                            key={sl.line}
                            className="rounded-lg bg-amber-500 px-3 py-2 text-xs text-white"
                          >
                            <span className="font-semibold">
                              {t("csv.skippedLineLabel", { line: sl.line })}
                            </span>{" "}
                            <span className="break-all font-mono text-amber-700">
                              {sl.rawContent}
                            </span>
                          </div>
                        ))}
                      </div>
                      {totalPages > 1 && (
                        <div className="mt-2 flex items-center justify-between">
                          <span className="text-xs text-amber-700">
                            {start + 1}–
                            {Math.min(
                              start + SKIPPED_PAGE_SIZE,
                              skippedLines.length,
                            )}{" "}
                            / {skippedLines.length.toLocaleString()}
                          </span>
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              disabled={skippedPage === 0}
                              onClick={() => setSkippedPage((p) => p - 1)}
                              className="rounded p-1 text-amber-700 hover:bg-amber-500/20 disabled:opacity-40"
                            >
                              <CaretLeft className="h-4 w-4" weight="bold" />
                            </button>
                            <span className="text-xs text-amber-700">
                              {skippedPage + 1} / {totalPages.toLocaleString()}
                            </span>
                            <button
                              type="button"
                              disabled={skippedPage >= totalPages - 1}
                              onClick={() => setSkippedPage((p) => p + 1)}
                              className="rounded p-1 text-amber-700 hover:bg-amber-500/20 disabled:opacity-40"
                            >
                              <CaretRight className="h-4 w-4" weight="bold" />
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}
            </div>
          )}

          {/* Missing variables warning */}
          {(templateVariables.length > 0 || requiredCampaignVars.length > 0) &&
            missingVariablesCount > 0 && (
              <div className="mb-4 rounded-lg border border-amber-500/20 bg-amber-500/10 p-4" data-tour="wc-missing-vars">
                <div className="flex items-start gap-3">
                  <Warning
                    className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5"
                    weight="bold"
                  />
                  <div className="flex-1">
                    <h4 className="text-sm font-semibold text-amber-800">
                      {t("validation.missingVariablesTitle")}
                    </h4>
                    <p className="text-sm text-amber-700 mt-1">
                      {t("validation.missingVariablesDescription", {
                        count: missingVariablesCount,
                      })}
                    </p>
                    <button
                      type="button"
                      onClick={() => {
                        setShowOnlyMissingVars(true);
                        setCurrentPage(0);
                      }}
                      className="mt-2 text-sm font-medium text-amber-800 hover:text-amber-900 underline"
                    >
                      {t("validation.showMissingVariables")}
                    </button>
                  </div>
                </div>
              </div>
            )}

          {/* Search and filter */}
          <div className="mb-4 flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <MagnifyingGlass
                className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground"
                weight="bold"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(0);
                }}
                placeholder={t("contacts.searchPlaceholder")}
                className="w-full pl-9 pr-4 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-muted-foreground"
                >
                  <X className="h-4 w-4" weight="bold" />
                </button>
              )}
            </div>

            {(templateVariables.length > 0 ||
              requiredCampaignVars.length > 0) && (
              <button
                type="button"
                onClick={() => {
                  setShowOnlyMissingVars(!showOnlyMissingVars);
                  setCurrentPage(0);
                }}
                className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  showOnlyMissingVars
                    ? "bg-amber-500 border-amber-600 text-white"
                    : "bg-card border-border text-muted-foreground hover:bg-muted"
                }`}
              >
                <Warning
                  className="h-4 w-4"
                  weight={showOnlyMissingVars ? "fill" : "bold"}
                />
                {t("contacts.filterMissingVars")}
                {missingVariablesCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 text-xs font-bold rounded-full bg-amber-200 text-amber-800">
                    {missingVariablesCount}
                  </span>
                )}
              </button>
            )}
          </div>

          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {t("contacts.total")}: <strong>{fields.length}</strong>
              {(searchQuery || showOnlyMissingVars) && (
                <span className="ml-2 text-muted-foreground">
                  ({t("contacts.showing")} {filteredFields.length})
                </span>
              )}
            </p>
            {(searchQuery || showOnlyMissingVars) && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery("");
                  setShowOnlyMissingVars(false);
                  setCurrentPage(0);
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {t("contacts.clearFilters")}
              </button>
            )}
          </div>

          {metadataFields.length > 0 && (
            <div className="mb-4 space-y-2" data-tour="wc-metadata">
              <h3 className="text-sm font-semibold text-foreground">
                {t("contacts.metadataFields")}
              </h3>
              <div className="flex flex-wrap gap-2">
                {metadataFields.map((field) => (
                  <div
                    key={field.key}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 ${
                      field.required ? "bg-amber-50" : "bg-emerald-50"
                    }`}
                  >
                    <span
                      className={`text-sm ${field.required ? "text-amber-700 font-medium" : "text-emerald-700"}`}
                    >
                      {field.label}
                      {field.required ? " *" : ""}
                    </span>
                    {!field.required && (
                      <button
                        type="button"
                        onClick={() => removeMetadataField(field.key)}
                        className="text-emerald-600 hover:text-emerald-800"
                      >
                        <X className="h-3 w-3" weight="bold" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mb-4 flex items-center gap-2">
            <ElevatedInput
              label={t("contacts.newMetadataField")}
              value={newFieldKey}
              onChange={(e) => setNewFieldKey(e.target.value)}
              controlSize="sm"
              placeholder={t("contacts.metadataFieldPlaceholder")}
            />
            <Button
              type="button"
              variant="secondary"
              title={t("contacts.addField")}
              icon={<Plus className="h-4 w-4" weight="bold" />}
              iconVisible
              onClick={addMetadataField}
              disabled={!newFieldKey}
            />
          </div>

          <div className="space-y-3">
            {paginatedFields.map(({ field, originalIndex }, index) => {
              const hasVariables = templateVariables.length > 0;
              const hasMetadata = metadataFields.length > 0;
              const isMissingVars =
                (hasVariables || requiredCampaignVars.length > 0) &&
                hasMissingVariables(phoneNumbersSnapshot[originalIndex] || {});

              const numberSpan =
                hasVariables || hasMetadata ? "col-span-3" : "col-span-5";
              const nameSpan =
                hasVariables || hasMetadata ? "col-span-2" : "col-span-6";
              const variablesSpan = hasVariables
                ? hasMetadata
                  ? "col-span-3"
                  : "col-span-6"
                : "";
              const metadataSpan = hasMetadata
                ? hasVariables
                  ? "col-span-3"
                  : "col-span-4"
                : "";

              return (
                <div
                  key={field.id}
                  className={`grid grid-cols-12 gap-3 items-start rounded-lg p-2 -mx-2 ${
                    isMissingVars
                      ? "bg-amber-500/10 border border-amber-500/20"
                      : ""
                  }`}
                >
                  <div className={numberSpan}>
                    <ElevatedInput
                      label={index === 0 ? t("contacts.number") : undefined}
                      {...register(`phoneNumbers.${originalIndex}.number`)}
                      controlSize="sm"
                      placeholder="558499999999"
                    />
                    <FieldError
                      message={
                        errors.phoneNumbers?.[originalIndex]?.number?.message
                      }
                    />
                  </div>
                  <div className={nameSpan}>
                    <ElevatedInput
                      label={index === 0 ? t("contacts.name") : undefined}
                      {...register(`phoneNumbers.${originalIndex}.name`)}
                      controlSize="sm"
                      placeholder={t("contacts.namePlaceholder")}
                    />
                  </div>
                  {hasVariables && (
                    <div className={variablesSpan}>
                      <div className="flex gap-2">
                        {templateVariables.map((varPlaceholder, varIdx) => (
                          <ElevatedInput
                            key={`var-${varIdx}`}
                            label={index === 0 ? varPlaceholder : undefined}
                            {...register(
                              `phoneNumbers.${originalIndex}.variables.${varIdx}`,
                            )}
                            controlSize="sm"
                            placeholder={varPlaceholder}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  {hasMetadata && (
                    <div className={metadataSpan}>
                      <div className="flex gap-2">
                        {metadataFields.map((metaField) => (
                          <ElevatedInput
                            key={metaField.key}
                            label={index === 0 ? metaField.label : undefined}
                            {...register(
                              `phoneNumbers.${originalIndex}.metadata.${metaField.key}`,
                            )}
                            controlSize="sm"
                            placeholder={metaField.label}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="col-span-1 flex items-end justify-end">
                    {fields.length > 1 && (
                      <button
                        type="button"
                        onClick={() => remove(originalIndex)}
                        className="flex h-9 w-9 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-50"
                      >
                        <Trash className="h-4 w-4" weight="bold" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                disabled={currentPage === 0}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CaretLeft className="h-4 w-4" weight="bold" />
                {t("contacts.previous")}
              </button>
              <span className="text-sm text-muted-foreground">
                {t("contacts.page", {
                  current: currentPage + 1,
                  total: totalPages,
                })}
              </span>
              <button
                type="button"
                onClick={() =>
                  setCurrentPage((p) => Math.min(totalPages - 1, p + 1))
                }
                disabled={currentPage === totalPages - 1}
                className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t("contacts.next")}
                <CaretRight className="h-4 w-4" weight="bold" />
              </button>
            </div>
          )}
        </ElevatedContainer>
      )}

      <div className="flex items-center justify-between" data-tour="wc-submit">
        <Link href="/dashboard/whatsapp-campaigns">
          <Button type="button" variant="ghost" title={t("actions.cancel")} />
        </Link>
        <Button
          type="submit"
          variant="primary"
          title={mode === "edit" ? t("actions.update") : t("actions.create")}
          disabled={
            isSubmitting ||
            (mode === "create" && !organic && !templateInfoConfirmed)
          }
        />
      </div>

      {/* Template Header Media Edit Modal */}
      {selectedTemplate && isAdmin && (
        <TemplateEditModal
          isOpen={mediaModalOpen}
          onClose={() => setMediaModalOpen(false)}
          template={selectedTemplate}
          onSave={handleSaveHeaderMedia}
          isSaving={isSavingMedia}
        />
      )}
    </form>
  );
}
