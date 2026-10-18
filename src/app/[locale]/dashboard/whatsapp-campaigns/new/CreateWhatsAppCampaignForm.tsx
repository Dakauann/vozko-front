"use client";

import type { AgentListItem, ModelPricingInfo } from "@/lib/agents/types";
import { DealAutomationDraft, DealAutomationSetting } from "@/components/channels/deal-automation-setting";
import { applyDealAutomation } from "@/lib/deal-automation/client";
import { useAgentRequiredVariables } from "@/lib/agents/use-agent-required-variables";
import {
  CalendarCheck,
  CaretDown,
  CaretLeft,
  CaretRight,
  DownloadSimple,
  ImageSquare,
  Plus,
  Tag,
  Trash,
  UploadSimple,
  X,
} from "@/components/icons";
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
  type ReactNode,
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
import { EmptyValue, useEmptyValue } from "@/components/elevated-design/empty-value";
import type { DashboardTableColumn } from "@/components/elevated-design/table/dashboard-table";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { Notice } from "@/components/ui/notice";
import Link from "next/link";
import TemplateEditModal from "@/components/whatsapp/TemplateEditModal";
import { ButtonDestinations } from "@/components/whatsapp/exit/ButtonDestinations";
import { CampaignExitSection } from "@/components/whatsapp/exit/CampaignExitSection";
import { SmartCampaignSection, useSmartPolicyDraft } from "@/components/whatsapp/smart/SmartCampaignSection";
import { useCampaignExit } from "@/components/whatsapp/exit/use-campaign-exit";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import { SelectionSendNote, useSelectionSendRefusalText } from "@/components/campaigns/SelectionSendNote";
import { CampaignContactList, MissingValueMark } from "@/components/campaigns/CampaignContactList";
import {
  OPEN_CONTACT_LIST_VIEW,
  onlyMissingView,
  viewShowingContact,
  type ContactListView,
} from "@/lib/campaigns/contact-list-view";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import { templateParamSlots } from "@/lib/whatsapp-templates/params";
import type { Workflow } from "@/lib/workflows/types";
import { getAgentOptionsAction, listAgentsAction } from "@/app/actions/agents";
import {
  getBusinessPhoneByIdAction,
  listBusinessPhonesAction,
} from "@/app/actions/whatsapp-business-phones";
import { listPipelinesAction } from "@/app/actions/crm-board";
import {
  getWorkflowAction,
  listWorkflowsAction,
} from "@/app/actions/workflows";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import GrainBackground from "@/components/elevated-design/grain-background";
import { readDelimitedFile } from "@/lib/csv/parse";
import { metadataKeyOf } from "@/lib/campaigns/metadata-key";
import {
  missingVariablesOf,
  missingVariablesReport,
  requiredVariablesOf,
  type MissingVariable,
  type RequiredVariable,
} from "@/lib/campaigns/required-variables";

const CSV_BATCH_SIZE = 1000;

interface ContactRow {
  id: string;
  originalIndex: number;
}

const requiredVariablePath = (variable: RequiredVariable) =>
  variable.source === "template" ? `variables.${variable.index ?? 0}` : `metadata.${variable.key}`;

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

  if (namedVars.length > 0) return namedVars;

  return templateParamSlots(template).body.map((slot) => `{{${slot}}}`);
};

const createWhatsAppCampaignSchema = (
  t: (key: string) => string,
  contactsLocked = false,
) => {
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
      showTemplateInCrm: z.boolean().default(false),
      enableAnalysis: z.boolean().default(false),
      enableAutoStaging: z.boolean().default(false),
      enableAutoMemory: z.boolean().default(false),
      aiModel: z.string().optional().default(""),
      scheduledStart: z.string().optional().nullable(),
      phoneNumbers: z
        .array(phoneNumberSchema)
        .min(contactsLocked ? 0 : 1, t("validation.contactsMin")),
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

type WhatsAppCampaignFormValues = z.infer<
  ReturnType<typeof createWhatsAppCampaignSchema>
>;

type WhatsAppCampaignFormProps = {
  mode?: "create" | "edit";
  initialCampaign?: WhatsAppCampaign | null;
  aiModels?: string[];
  modelPricing?: ModelPricingInfo[];
};

const FieldError = ({ message }: { message?: string }) => {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-destructive-ink">{message}</p>;
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
        className="h-full rounded-full bg-healthy transition-all duration-300 ease-out"
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
}: WhatsAppCampaignFormProps) {
  const router = useRouter();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [isSubmitting, startSubmit] = useTransition();
  const pendingRedirectRef = useRef<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvError, setCsvError] = useState<string | null>(null);
  const [isLoadingCsv, setIsLoadingCsv] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [contactView, setContactView] = useState<ContactListView>(OPEN_CONTACT_LIST_VIEW);
  const [metadataFields, setMetadataFields] = useState<MetadataField[]>([]);
  const [newFieldKey, setNewFieldKey] = useState("");
  const [metadataEditorOpen, setMetadataEditorOpen] = useState(false);
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
  const [dealPipelineId, setDealPipelineId] = useState("");
  const templateConfirmRef = useRef<HTMLDivElement>(null);
  const [highlightTemplateConfirm, setHighlightTemplateConfirm] =
    useState(false);
  const [previewEntryIndex, setPreviewEntryIndex] = useState<number | null>(
    null,
  );
  const [aiModels, setAiModels] = useState<string[]>(aiModelsProp ?? []);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>(
    modelPricingProp ?? [],
  );
  const [loadingModels, setLoadingModels] = useState(false);
  const modelsLoadedRef = useRef(!!aiModelsProp?.length);
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
  const tContactList = useTranslations("campaignContactList");
  const emptyValue = useEmptyValue();
  const tDeals = useTranslations("dealAutomation");

  useEffect(() => {
    if (!isSubmitting && pendingRedirectRef.current) {
      const url = pendingRedirectRef.current;
      pendingRedirectRef.current = null;
      router.push(url);
      router.refresh();
    }
  }, [isSubmitting, router]);

  useEffect(() => {
    let active = true;
    listPipelinesAction("conversation").then(({ pipelines }) => {
      if (active) setPipelineOptions(pipelines ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const contentLocked =
    mode === "edit" &&
    !!initialCampaign &&
    !selectionSendControls(initialCampaign.source, initialCampaign.status).editContent;
  const refusalText = useSelectionSendRefusalText();
  const campaignSchema = useMemo(
    () => createWhatsAppCampaignSchema(t, contentLocked),
    [t, contentLocked],
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
      showTemplateInCrm: false,
      enableAnalysis: false,
      enableAutoStaging: false,
      enableAutoMemory: false,
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
  const enableAutoMemory = watch("enableAutoMemory");
  const selectedTemplateId = watch("templateId");
  const selectedBusinessPhoneId = watch("businessPhoneId");
  const selectedAgentId = watch("agentId");
  const selectedWorkflowId = watch("workflowId");
  const campaignExit = useCampaignExit({ templateId: selectedTemplateId, campaignId: initialCampaign?.id, mode, initialTemplateId: initialCampaign?.templateId });
  const smartPolicy = useSmartPolicyDraft(mode);

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

  const requiredVariables = useMemo(
    () =>
      requiredVariablesOf(
        templateVariables,
        requiredCampaignVars,
        agentRequiredVarNames.map((key) => ({ key, label: agentVarLabels[key] || key })),
      ),
    [templateVariables, requiredCampaignVars, agentRequiredVarNames, agentVarLabels],
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
        toast(t("toast.success"), { description: t("media.saved") });
        setMediaModalOpen(false);
      } else {
        toast.error(t("toast.error"), { description: result.error || t("media.saveError") });
      }
    } catch {
      toast.error(t("toast.error"), { description: t("media.saveError") });
    } finally {
      setIsSavingMedia(false);
    }
  };

  const hasMissingVariables = useCallback(
    (phoneNumber: Parameters<typeof missingVariablesOf>[0]) =>
      missingVariablesOf(phoneNumber, requiredVariables).length > 0,
    [requiredVariables],
  );

  const missingReport = useMemo(
    () =>
      missingVariablesReport(
        phoneNumbersSnapshot,
        requiredVariables,
        metadataFields.filter((f) => !f.required).map((f) => f.key),
      ),
    [phoneNumbersSnapshot, requiredVariables, metadataFields],
  );
  const missingVariablesCount = missingReport.contacts;

  const describeMissing = useCallback(
    (missing: MissingVariable) => {
      const owner =
        missing.variable.source === "workflow"
          ? t("validation.missingSourceWorkflow", {
              name: knownWorkflows[selectedWorkflowId ?? ""]?.name ?? "",
            })
          : missing.variable.source === "agent"
            ? t("validation.missingSourceAgent", {
                name: knownAgents[selectedAgentId ?? ""]?.name ?? "",
              })
            : t("validation.missingSourceTemplate");
      return { owner };
    },
    [t, knownWorkflows, selectedWorkflowId, knownAgents, selectedAgentId],
  );

  const contactRows = useMemo<ContactRow[]>(
    () => fields.map((field, originalIndex) => ({ id: field.id, originalIndex })),
    [fields],
  );

  const searchableContact = useCallback(
    (row: ContactRow) => {
      const contact = phoneNumbersSnapshot[row.originalIndex];
      return contact ? [contact.number, contact.name] : [];
    },
    [phoneNumbersSnapshot],
  );

  const isContactMissing = useCallback(
    (row: ContactRow) => hasMissingVariables(phoneNumbersSnapshot[row.originalIndex]),
    [hasMissingVariables, phoneNumbersSnapshot],
  );

  const requiredVariableByPath = useMemo(
    () => new Map(requiredVariables.map((variable) => [requiredVariablePath(variable), variable])),
    [requiredVariables],
  );

  const contactValueCell = (
    originalIndex: number,
    path: string,
    input: ReactNode,
    error: string | undefined,
  ) => {
    const required = requiredVariableByPath.get(path);
    const missing =
      required !== undefined &&
      missingVariablesOf(phoneNumbersSnapshot[originalIndex], [required]).length > 0;
    return (
      <div>
        <div className="flex items-center gap-1.5">
          {input}
          {missing ? <MissingValueMark /> : null}
        </div>
        <FieldError message={error} />
      </div>
    );
  };

  const contactValueColumns: DashboardTableColumn<ContactRow>[] = [
    ...templateVariables.map((placeholder, varIdx) => ({
      key: `variables.${varIdx}`,
      header: placeholder,
      render: ({ originalIndex }: ContactRow) =>
        contactValueCell(
          originalIndex,
          `variables.${varIdx}`,
          <ElevatedInput
            aria-label={placeholder}
            {...register(`phoneNumbers.${originalIndex}.variables.${varIdx}`)}
            controlSize="sm"
            placeholder={emptyValue}
          />,
          errors.phoneNumbers?.[originalIndex]?.variables?.[varIdx]?.message,
        ),
    })),
    ...metadataFields.map((metaField) => ({
      key: `metadata.${metaField.key}`,
      header: metaField.required ? `${metaField.label} *` : metaField.label,
      render: ({ originalIndex }: ContactRow) =>
        contactValueCell(
          originalIndex,
          `metadata.${metaField.key}`,
          <ElevatedInput
            aria-label={metaField.label}
            {...register(`phoneNumbers.${originalIndex}.metadata.${metaField.key}`)}
            controlSize="sm"
            placeholder={emptyValue}
          />,
          undefined,
        ),
    })),
  ];

  useEffect(() => {
    if (initialCampaign && mode === "edit") {
      const loadedContacts = contentLocked ? [] : (initialCampaign.phoneNumbers ?? []);
      const phoneNumbersData =
        loadedContacts.map((pn) => {
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
        });

      reset({
        name: initialCampaign.name,
        templateId: initialCampaign.templateId,
        businessPhoneId: initialCampaign.businessPhoneId || "",
        agentId: initialCampaign.agentId || null,
        workflowId: initialCampaign.workflowId || null,
        enableAgentResponses: initialCampaign.enableAgentResponses,
        showTemplateInCrm: initialCampaign.showTemplateInCrm ?? false,
        enableAnalysis: initialCampaign.enableAnalysis ?? false,
        enableAutoStaging: initialCampaign.enableAutoStaging ?? false,
        enableAutoMemory: initialCampaign.enableAutoMemory ?? false,
        aiModel: initialCampaign.aiModel ?? "",
        scheduledStart: initialCampaign.scheduledStart || null,
        phoneNumbers:
          phoneNumbersData.length > 0 || contentLocked
            ? phoneNumbersData
            : [{ number: "", name: "", variables: [], metadata: {} }],
      });

      if (initialCampaign.scheduledStart && !contentLocked) {
        setScheduleEnabled(true);
      }

      if (phoneNumbersData.length > 0) {
        replace(phoneNumbersData);
      }
    }
  }, [initialCampaign, mode, reset, replace, contentLocked]);

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
            varIndex: parseInt(varMatch[1], 10) - 1,
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
        const metadataKey = metadataKeyOf(header);
        if (!reservedHeaders.has(header) && metadataKey && !header.match(/^var\d+$/)) {
          const label = rows[0].split(delimiter)[index].trim();
          metadataColumnIndices.push({ index, key: metadataKey, label });
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

      const text = await readDelimitedFile(file);

      const {
        records: parsed,
        metadataHeaders,
        skipped,
      } = await parseCsvContentAsync(text, (progress) => {
        setLoadingProgress(progress * 0.8);
      });

      if (metadataHeaders.length > 0) {
        setMetadataFields((prev) => {
          const required = prev.filter((f) => f.required);
          const requiredKeys = new Set(required.map((f) => f.key));
          return [...required, ...metadataHeaders.filter((f) => !requiredKeys.has(f.key))];
        });
      }

      const items = parsed.map((record) => ({
        number: record.number,
        name: record.name ?? "",
        variables: record.variables ?? [],
        metadata: record.metadata ?? {},
      }));

      setLoadingProgress(90);

      replace(items);
      setContactView((view) => ({ ...view, page: 0 }));
      setCsvError(null);
      setSkippedLines(skipped);
      setSkippedLinesOpen(false);
      setSkippedPage(0);

      setLoadingProgress(100);

      const metadataFieldsCount = metadataHeaders.length;
      toast(t("toast.listLoaded"), { description: metadataFieldsCount > 0
            ? t("csv.importedWithMetadata", {
                count: items.length,
                fields: metadataFieldsCount,
              })
            : t("csv.importedCount", { count: items.length }) });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : t("csv.importError");
      setCsvError(message);
      toast.error(t("toast.csvError"), { description: message });
    } finally {
      setIsLoadingCsv(false);
      setLoadingProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  const addMetadataField = () => {
    const sanitizedKey = metadataKeyOf(newFieldKey);
    if (!sanitizedKey) return;
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
    if (mode === "create" && !templateInfoConfirmed) {
      toast.error(t("toast.validationError"), { description: t("validation.confirmTemplateFirst") });
      templateConfirmRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
      setHighlightTemplateConfirm(true);
      return;
    }

    const submitReport = missingVariablesReport(
      data.phoneNumbers ?? [],
      requiredVariables,
      metadataFields.filter((f) => !f.required).map((f) => f.key),
    );

    if (submitReport.contacts > 0) {
      toast.error(t("validation.missingVariablesTitle"), {
        description: t("validation.cannotSubmitMissingVars", {
          count: submitReport.contacts,
          variables: submitReport.variables.map((m) => m.variable.label).join(", "),
        }),
      });
      setContactView(onlyMissingView);
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
          templateId: data.templateId,
          businessPhoneId: data.businessPhoneId,
          agentId: agentResponsesEnabled ? data.agentId || null : null,
          workflowId: workflowEnabled ? data.workflowId || null : null,
          enableAgentResponses: agentResponsesEnabled,
          enableWorkflow: workflowEnabled,
          showTemplateInCrm: data.showTemplateInCrm,
          enableAnalysis: campaignToolsEnabled ? data.enableAnalysis : false,
          enableAutoStaging: campaignToolsEnabled
            ? data.enableAutoStaging
            : false,
          enableAutoMemory: campaignToolsEnabled
            ? data.enableAutoMemory
            : false,
          aiModel:
            campaignToolsEnabled &&
            (data.enableAnalysis ||
              data.enableAutoStaging ||
              data.enableAutoMemory)
              ? data.aiModel || undefined
              : undefined,
          scheduledStart:
            scheduleEnabled && data.scheduledStart
              ? data.scheduledStart
              : undefined,
          ...(selectedPipelineId ? { pipelineId: selectedPipelineId } : {}),
          ...campaignExit.fields,
          ...smartPolicy.fields,
          phoneNumbers: (data.phoneNumbers ?? []).map((pn) => {
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

        const result: {
          campaign: WhatsAppCampaign | null;
          error: string | null;
          errorCode?: string;
        } =
          mode === "edit" && initialCampaign
            ? await updateWhatsAppCampaignAction(initialCampaign.id, payload)
            : await createWhatsAppCampaignAction(payload);

        if (result.error) {
          toast.error(t("toast.error"), { description: campaignExit.refusal(result.errorCode) ?? refusalText(result.errorCode, result.error) });
        } else {
          toast(t("toast.success"), { description: mode === "edit"
                ? t("toast.campaignUpdated")
                : t("toast.campaignCreated") });

          const campaignId = result.campaign?.id;
          if (
            mode === "create" &&
            campaignId &&
            !(await applyDealAutomation(
              { entryType: "whatsapp", kind: "campaign", containerId: campaignId },
              dealPipelineId,
            ))
          ) {
            toast.error(tDeals("notAppliedTitle"), { description: tDeals("notApplied") });
          }
          const routesProblem = campaignId ? await campaignExit.saveOverrides(campaignId) : null;
          if (routesProblem) toast.error(routesProblem);
          pendingRedirectRef.current = campaignId
            ? `/dashboard/whatsapp-campaigns/${campaignId}`
            : "/dashboard/whatsapp-campaigns";
        }
      } catch (error) {
        toast.error(t("toast.error"), { description: error instanceof Error ? error.message : t("toast.unknownError") });
      }
    });
  };

  const firstErrorMessage = (node: unknown, depth = 0): string | undefined => {
    if (node == null || depth > 4) return undefined;
    if (typeof node !== "object") return undefined;
    const message = (node as { message?: unknown }).message;
    if (typeof message === "string" && message.trim()) return message;
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      if (key === "ref") continue;
      const found = firstErrorMessage(value, depth + 1);
      if (found) return found;
    }
    return undefined;
  };

  const describeFormError = (
    errors: Record<string, unknown>,
  ): { message: string; contactIndex?: number } => {
    const named: Record<string, string> = {
      name: t("validation.nameRequired"),
      templateId: t("validation.templateRequired"),
      businessPhoneId: t("validation.businessPhoneRequired"),
      agentId: t("validation.agentRequired"),
    };
    for (const [field, message] of Object.entries(named)) {
      if (errors[field]) return { message };
    }

    const phoneErrors = errors.phoneNumbers;
    if (Array.isArray(phoneErrors)) {
      const index = phoneErrors.findIndex((e) => e != null);
      const total = phoneErrors.filter((e) => e != null).length;
      if (index !== -1) {
        const entry = phoneErrors[index] as Record<
          string,
          { message?: string } | undefined
        >;
        const detail = firstErrorMessage(entry);
        const first = t("validation.contactHasError", {
          position: index + 1,
          detail: detail ?? t("validation.formHasErrors"),
        });
        return {
          message:
            total > 1
              ? `${first} ${t("validation.andMoreContacts", { count: total - 1 })}`
              : first,
          contactIndex: index,
        };
      }
    }
    const arrayMessage = (phoneErrors as { message?: string } | undefined)
      ?.message;
    if (arrayMessage) return { message: arrayMessage };

    const fields = Object.keys(errors).join(", ");
    return {
      message: fields
        ? t("validation.unknownFieldErrors", { fields })
        : t("validation.formHasErrors"),
    };
  };

  const onInvalid = (errors: Record<string, unknown>) => {
    const { message, contactIndex } = describeFormError(errors);

    toast.error(t("toast.validationError"), { description: message });

    if (contactIndex !== undefined) {
      setContactView(viewShowingContact(contactIndex));
    }
  };

  return (
    <form
      onSubmit={(event) => {
        void handleSubmit(onSubmit, onInvalid)(event).catch((error) => {
          console.error("[campaign-form] submit failed", error);
          toast.error(t("toast.validationError"), { description: t("validation.submitCrashed", {
              detail: error instanceof Error ? error.message : String(error),
            }) });
        });
      }}
      className="space-y-6"
    >
      <div
        className={cn(
          "grid gap-6 lg:items-start",
          "lg:grid-cols-[minmax(0,1fr)_360px]",
        )}
      >
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-basic-info">
          <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">
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
                    disabled={contentLocked}
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
              {contentLocked ? (
                <SelectionSendNote reason="templateLocked" className="mt-2" />
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("basicInfo.businessPhoneDescription")}
                </p>
              )}
            </div>

            <div>
              <ElevatedCommandSelect
                label={t("basicInfo.pipeline")}
                options={[
                  { value: "", label: t("basicInfo.pipelineDefault") },
                  ...pipelineOptions.map((p) => ({
                    value: p.id,
                    label: p.name,
                  })),
                ]}
                value={selectedPipelineId}
                onValueChange={setSelectedPipelineId}
                searchPlaceholder={t("basicInfo.searchPipeline")}
                emptyMessage={t("basicInfo.noPipelines")}
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("basicInfo.pipelineDescription")}
              </p>
            </div>

            <div>
              <Controller
                name="templateId"
                control={control}
                render={({ field }) => (
                  <ElevatedCommandSelect
                    label={t("basicInfo.template")}
                    value={field.value}
                    onValueChange={field.onChange}
                    disabled={contentLocked || !selectedBusinessPhoneId}
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

              {selectedTemplateMissingMedia &&
                isAdmin &&
                selectedTemplate && (
                  <Notice
                    tone="warning"
                    title={t("media.missingTitle")}
                    icon={<ImageSquare weight="fill" />}
                    className="mt-3"
                  >
                    <p>{t("media.missingDescription")}</p>
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
                    />
                  </Notice>
                )}

              {selectedTemplate && templateVariables.length > 0 && !contentLocked && (
                <div className="mt-3 rounded-lg border border-border bg-muted p-4"data-tour="wc-template-variables">
                  <h4 className="text-sm font-semibold text-foreground mb-2">
                    {t("basicInfo.templateVariables")}
                  </h4>
                  <p className="text-xs text-muted-foreground mb-3">
                    {t("basicInfo.templateVariablesDescription")}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-4">
                    {templateVariables.map((varPlaceholder, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center rounded-md bg-healthy px-2 py-1 text-xs font-medium text-healthy-foreground"
                      >
                        {varPlaceholder}
                      </span>
                    ))}
                  </div>

                  <p className="text-xs text-muted-foreground border-t border-border pt-3">
                    {t("basicInfo.templatePreviewHint")}
                  </p>
                </div>
              )}
            </div>

            <div data-tour="wc-response-mode">
              <p className="text-sm font-medium text-foreground mb-2">
                {t("basicInfo.responseMode")}
              </p>
              <div className="flex items-center gap-2 rounded-lg border border-border p-1 mb-3">
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
                        explainer={<ExplainerHint id="settings.conversationAnalysis" />}
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
                        explainer={<ExplainerHint id="settings.autoStaging" />}
                      />
                    )}
                  />
                </div>
              )}

              {campaignToolsAvailable && (
                <div>
                  <Controller
                    name="enableAutoMemory"
                    control={control}
                    render={({ field }) => (
                      <ElevatedSwitch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        label={t("basicInfo.enableAutoMemory")}
                        description={t("basicInfo.enableAutoMemoryDescription")}
                        explainer={<ExplainerHint id="settings.autoMemory" />}
                      />
                    )}
                  />
                </div>
              )}

              {campaignToolsAvailable &&
                (mode === "edit" && initialCampaign?.id ? (
                  <DealAutomationSetting
                    channel={{ entryType: "whatsapp", kind: "campaign", containerId: initialCampaign.id }}
                  />
                ) : (
                  <DealAutomationDraft value={dealPipelineId} onChange={setDealPipelineId} />
                ))}

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
                      explainer={<ExplainerHint id="campaigns.templateInCrm" />}
                    />
                  )}
                />
              </div>
            </div>

            {campaignToolsAvailable &&
              (enableAnalysis || enableAutoStaging || enableAutoMemory) && (
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

            {!contentLocked && (
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
                  explainer={<ExplainerHint id="campaigns.scheduledStart" />}
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

            {mode === "create" ? <SmartCampaignSection draft={smartPolicy} contacts={fields.length} startAt={watch("scheduledStart")} /> : null}
          </div>
        </ElevatedContainer>

        <ElevatedContainer className="rounded-lg border border-border bg-card p-5 lg:sticky lg:top-16" data-tour="wc-preview">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold text-foreground">
              {t("preview.title")}
            </h3>
            <Button
              type="button"
              variant="secondary"
              title={t("preview.swapContact")}
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
              {t("preview.selectTemplate")}
            </p>
          ) : (
            <div className="space-y-3">
              <div className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
                <p>
                  <strong>{t("preview.testContact")}</strong>{" "}
                  {previewEntry?.name?.trim() || t("noName")}
                </p>
                <p>
                  <strong>{t("preview.number")}</strong>{" "}
                  {previewEntry?.number || <EmptyValue />}
                </p>
              </div>

              <div className="bg-[#e5ddd5] rounded-[--radius] p-3">
                <div className="bg-card rounded-lg shadow-sm overflow-hidden">
                  {selectedTemplate.components.find(
                    (c) => c.type === "HEADER",
                  )?.text && (
                    <div className="px-3 py-2 border-b border-border">
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

              {contentLocked && campaignExit.verdict ? <ButtonDestinations buttons={campaignExit.verdict.buttons} overrides={campaignExit.overrides} /> : null}

              <div ref={templateConfirmRef}>
                <GrainBackground
                  palette={"alert"}
                  seed={20000}
                  className={cn(
                    "rounded-lg border p-3 transition-shadow",
                    highlightTemplateConfirm &&
                      !templateInfoConfirmed &&
                      "ring-2 ring-destructive-ink",
                  )}
                  data-tour="wc-confirm-template"
                >
                  <ElevatedSwitch
                    checked={templateInfoConfirmed}
                    onCheckedChange={(checked) => {
                      setTemplateInfoConfirmed(checked);
                      if (checked) setHighlightTemplateConfirm(false);
                    }}
                    label={t("validation.confirmTemplateLabel")}
                  />
                  {mode === "create" && !templateInfoConfirmed ? (
                    <p className="mt-2 text-xs text-destructive-ink">
                      {t("validation.confirmTemplateRequired")}
                    </p>
                  ) : null}
                </GrainBackground>
              </div>
            </div>
          )}
        </ElevatedContainer>
      </div>

      {contentLocked ? null : (
        <CampaignExitSection
          exit={campaignExit}
          templateName={selectedTemplate?.name ?? ""}
          onUseAnotherTemplate={() => setValue("templateId", "", { shouldDirty: true })}
          numbers={phoneNumbersSnapshot.map((pn) => pn.number)}
        />
      )}

      {contentLocked ? (
        <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-contacts">
          <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">
            {t("contacts.title")}
          </h2>
          <SelectionSendNote reason="contactsLocked" />
        </ElevatedContainer>
      ) : (
      <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-contacts">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-display text-xl font-semibold tracking-[0.01em] text-foreground">
            {t("contacts.title")}
          </h2>
          <div className="flex flex-wrap items-center gap-2" data-tour="wc-csv-buttons">
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
          <Notice tone="fault" className="mb-4">
            {csvError}
          </Notice>
        )}

        {skippedLines.length > 0 && (
          <Notice tone="warning" className="mb-4">
            <button
              type="button"
              className="flex w-full items-center gap-2 text-left"
              onClick={() => {
                setSkippedLinesOpen(!skippedLinesOpen);
                setSkippedPage(0);
              }}
            >
              <span className="flex-1 text-sm font-semibold text-foreground">
                {t("csv.skippedTitle", { count: skippedLines.length })}
              </span>
              <CaretDown
                className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${skippedLinesOpen ? "rotate-180" : ""}`}
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
                  <div>
                    <div className="max-h-60 space-y-1.5 overflow-y-auto">
                      {pageItems.map((sl) => (
                        <div
                          key={sl.line}
                          className="rounded-lg border border-border bg-muted px-3 py-2 text-xs text-foreground"
                        >
                          <span className="font-semibold">
                            {t("csv.skippedLineLabel", { line: sl.line })}
                          </span>{" "}
                          <span className="break-all font-mono text-muted-foreground">
                            {sl.rawContent}
                          </span>
                        </div>
                      ))}
                    </div>
                    {totalPages > 1 && (
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-xs text-muted-foreground">
                          {start + 1} →{" "}
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
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                          >
                            <CaretLeft className="h-4 w-4" weight="bold" />
                          </button>
                          <span className="text-xs text-muted-foreground">
                            {skippedPage + 1} / {totalPages.toLocaleString()}
                          </span>
                          <button
                            type="button"
                            disabled={skippedPage >= totalPages - 1}
                            onClick={() => setSkippedPage((p) => p + 1)}
                            className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-40"
                          >
                            <CaretRight className="h-4 w-4" weight="bold" />
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
          </Notice>
        )}

        {missingVariablesCount > 0 && (
            <div className="mb-4" data-tour="wc-missing-vars">
              <Notice tone="warning" title={t("validation.missingVariablesTitle")}>
                <ul className="space-y-1.5 text-foreground">
                  {missingReport.variables.map((missing) => (
                    <li key={`${missing.variable.source}:${missing.variable.key}`}>
                      <span className="font-mono font-semibold">{missing.variable.key}</span>
                      {missing.variable.label !== missing.variable.key ? ` (${missing.variable.label})` : ""}
                      {" · "}
                      {t("validation.missingVariableLine", {
                        owner: describeMissing(missing).owner,
                        count: missing.contacts,
                      })}
                      {missing.suggestion ? (
                        <span className="block text-xs">
                          {t("validation.missingVariableSuggestion", {
                            column: missing.suggestion,
                            key: missing.variable.key,
                          })}
                        </span>
                      ) : null}
                    </li>
                  ))}
                </ul>
                <button
                  type="button"
                  onClick={() => setContactView(onlyMissingView)}
                  className="text-xs font-medium text-foreground underline hover:text-muted-foreground"
                >
                  {t("validation.showMissingVariables")}
                </button>
              </Notice>
            </div>
          )}

        <CampaignContactList<ContactRow>
          rows={contactRows}
          rowKey={(row) => row.id}
          number={({ originalIndex }) => (
            <div>
              <ElevatedInput
                aria-label={tContactList("number")}
                {...register(`phoneNumbers.${originalIndex}.number`)}
                controlSize="sm"
                placeholder="558499999999"
              />
              <FieldError message={errors.phoneNumbers?.[originalIndex]?.number?.message} />
            </div>
          )}
          name={({ originalIndex }) => (
            <div>
              <ElevatedInput
                aria-label={tContactList("name")}
                {...register(`phoneNumbers.${originalIndex}.name`)}
                controlSize="sm"
                placeholder={t("contacts.namePlaceholder")}
              />
              <FieldError message={errors.phoneNumbers?.[originalIndex]?.name?.message} />
            </div>
          )}
          valueColumns={contactValueColumns}
          searchable={searchableContact}
          missing={
            requiredVariables.length > 0
              ? { count: missingVariablesCount, isMissing: isContactMissing }
              : undefined
          }
          view={contactView}
          onViewChange={setContactView}
          actions={
            <Button
              type="button"
              variant="secondary"
              size="sm"
              title={t("contacts.metadataFields")}
              icon={<Tag className="h-4 w-4" weight="bold" />}
              iconVisible
              iconSide="left"
              aria-expanded={metadataEditorOpen}
              data-tour="wc-metadata"
              onClick={() => setMetadataEditorOpen((open) => !open)}
            />
          }
          panel={
            metadataEditorOpen ? (
              <div className="flex w-full flex-wrap items-center gap-2">
                {metadataFields.map((field) => (
                  <span
                    key={field.key}
                    className="inline-flex items-center gap-1 rounded-[--radius] border border-border bg-card px-2 py-0.5 text-xs font-medium text-foreground"
                  >
                    {field.required ? `${field.label} *` : field.label}
                    {field.required ? null : (
                      <button
                        type="button"
                        aria-label={t("contacts.removeMetadataField", { label: field.label })}
                        onClick={() => removeMetadataField(field.key)}
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <X className="h-3 w-3" weight="bold" />
                      </button>
                    )}
                  </span>
                ))}
                <div className="flex min-w-0 flex-1 basis-64 items-center gap-2">
                  <ElevatedInput
                    aria-label={t("contacts.newMetadataField")}
                    placeholder={t("contacts.metadataFieldPlaceholder")}
                    value={newFieldKey}
                    onChange={(e) => setNewFieldKey(e.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      addMetadataField();
                    }}
                    controlSize="sm"
                    className="min-w-0 flex-1"
                  />
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    title={t("contacts.addField")}
                    icon={<Plus className="h-4 w-4" weight="bold" />}
                    iconVisible
                    iconSide="left"
                    onClick={addMetadataField}
                    disabled={!newFieldKey}
                  />
                </div>
              </div>
            ) : null
          }
          renderRowActions={({ originalIndex }) =>
            fields.length > 1 ? (
              <button
                type="button"
                aria-label={t("contacts.removeContact")}
                title={t("contacts.removeContact")}
                onClick={() => remove(originalIndex)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive-ink transition-colors hover:bg-muted"
              >
                <Trash className="h-4 w-4" weight="bold" />
              </button>
            ) : null
          }
        />
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
          disabled={isSubmitting || campaignExit.blocks || smartPolicy.blocks}
        />
      </div>

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
