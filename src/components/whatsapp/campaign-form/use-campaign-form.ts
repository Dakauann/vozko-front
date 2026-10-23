"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";

import { getAgentOptionsAction, listAgentsAction } from "@/app/actions/agents";
import { listPipelinesAction } from "@/app/actions/crm-board";
import { getBusinessPhoneByIdAction, listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { getWhatsAppTemplateByIdAction, listWhatsAppTemplatesAction, updateWhatsAppTemplateHeaderMediaAction } from "@/app/actions/whatsapp-templates";
import { getWorkflowAction, listWorkflowsAction } from "@/app/actions/workflows";
import { useListRowsQuery } from "@/components/campaign-audience/use-audience-queries";
import { useCampaignAudience } from "@/components/campaign-audience/use-campaign-audience";
import type { ElevatedCommandOption } from "@/components/elevated-design/elevated-command-select";
import { useCampaignExit } from "@/components/whatsapp/exit/use-campaign-exit";
import { useSmartPolicyDraft } from "@/components/whatsapp/smart/SmartCampaignSection";
import { useAuth } from "@/contexts/auth-context";
import { usePaginatedSelect } from "@/hooks/use-paginated-select";
import type { AgentListItem, ModelPricingInfo } from "@/lib/agents/types";
import type { AudienceDraft } from "@/lib/campaign-audience/draft";
import type { RowQuery } from "@/lib/campaign-audience/types";
import { CONTACT_LIST_PAGE_SIZE } from "@/lib/campaigns/contact-list-view";
import { selectionSendControls } from "@/lib/campaigns/selection-send";
import type { SmartPolicy } from "@/lib/whatsapp-campaigns/smart";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppCampaign } from "@/lib/whatsapp-campaigns/types";
import type { ButtonChoices } from "@/lib/whatsapp-templates/exit";
import { templateParamSlots } from "@/lib/whatsapp-templates/params";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";
import type { Workflow } from "@/lib/workflows/types";

const PREVIEW_ROWS: RowQuery = { search: "", missingOnly: false, page: 1, limit: CONTACT_LIST_PAGE_SIZE };

export const DEFAULT_AI_MODEL = "openai/gpt-4o-mini";

export type ResponseMode = "agent" | "workflow";

export type CampaignFormMode = "create" | "edit";

const MEDIA_HEADERS = ["IMAGE", "VIDEO", "DOCUMENT", "GIF"];

export const extractTemplateVariables = (template: WhatsAppTemplate | undefined): string[] => {
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

const createWhatsAppCampaignSchema = (t: (key: string) => string) =>
  z.object({
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
  });

export type CampaignFormValues = z.infer<ReturnType<typeof createWhatsAppCampaignSchema>>;

export const EMPTY_CAMPAIGN_VALUES: CampaignFormValues = {
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
};

export interface CampaignExitSeed {
  templateId: string;
  choices: ButtonChoices;
  acknowledged: boolean;
}

export interface CampaignFormSeed {
  values?: Partial<CampaignFormValues>;
  responseMode?: ResponseMode;
  pipelineId?: string;
  dealPipelineId?: string;
  templateInfoConfirmed?: boolean;
  audience?: Partial<AudienceDraft>;
  exit?: CampaignExitSeed;
  smartPolicy?: SmartPolicy | null;
}

function mergeItemsById<T extends { id: string }>(previous: Record<string, T>, items: T[]) {
  if (items.length === 0) {
    return previous;
  }

  const next = { ...previous };
  items.forEach((item) => {
    next[item.id] = item;
  });
  return next;
}

function mergeSelectedOption(selectedOption: ElevatedCommandOption | null, options: ElevatedCommandOption[]) {
  if (!selectedOption) {
    return options;
  }

  return options.some((option) => option.value === selectedOption.value) ? options : [selectedOption, ...options];
}

export interface CampaignFormOptions {
  mode: CampaignFormMode;
  initialCampaign?: WhatsAppCampaign | null;
  aiModels?: string[];
  modelPricing?: ModelPricingInfo[];
  seed?: CampaignFormSeed;
}

export function useWhatsAppCampaignForm({ mode, initialCampaign, aiModels: aiModelsProp, modelPricing: modelPricingProp, seed }: CampaignFormOptions) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const t = useTranslations("whatsappCampaignsPage.form");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [mediaModalOpen, setMediaModalOpen] = useState(false);
  const [isSavingMedia, setIsSavingMedia] = useState(false);
  const [templateInfoConfirmed, setTemplateInfoConfirmed] = useState(mode === "edit" || seed?.templateInfoConfirmed === true);
  const [dealPipelineId, setDealPipelineId] = useState(seed?.dealPipelineId ?? "");
  const [previewEntryIndex, setPreviewEntryIndex] = useState<number | null>(null);
  const [aiModels, setAiModels] = useState<string[]>(aiModelsProp ?? []);
  const [modelPricing, setModelPricing] = useState<ModelPricingInfo[]>(modelPricingProp ?? []);
  const [loadingModels, setLoadingModels] = useState(false);
  const modelsLoadedRef = useRef(!!aiModelsProp?.length);
  const [pipelineOptions, setPipelineOptions] = useState<{ id: string; name: string }[]>([]);
  const [selectedPipelineId, setSelectedPipelineId] = useState<string>(seed?.pipelineId ?? initialCampaign?.pipelineId ?? "");
  const [responseMode, setResponseMode] = useState<ResponseMode>(seed?.responseMode ?? (initialCampaign?.workflowId ? "workflow" : "agent"));
  const [knownAgents, setKnownAgents] = useState<Record<string, AgentListItem>>({});
  const [knownBusinessPhones, setKnownBusinessPhones] = useState<Record<string, WhatsAppBusinessPhone>>({});
  const [knownTemplates, setKnownTemplates] = useState<Record<string, WhatsAppTemplate>>({});
  const [knownWorkflows, setKnownWorkflows] = useState<Record<string, Workflow>>({});

  useEffect(() => {
    let active = true;
    listPipelinesAction("conversation").then(({ pipelines }) => {
      if (active) setPipelineOptions(pipelines ?? []);
    });
    return () => {
      active = false;
    };
  }, []);

  const editingSettings = mode === "edit";
  const contentLocked = editingSettings && !!initialCampaign && !selectionSendControls(initialCampaign.source, initialCampaign.status).editContent;
  const campaignSchema = useMemo(() => createWhatsAppCampaignSchema(t), [t]);

  const form = useForm<CampaignFormValues>({
    resolver: zodResolver(campaignSchema),
    defaultValues: { ...EMPTY_CAMPAIGN_VALUES, ...seed?.values },
  });
  const { watch, reset, setValue, getValues } = form;

  const enableAnalysis = watch("enableAnalysis");
  const enableAutoStaging = watch("enableAutoStaging");
  const enableAutoMemory = watch("enableAutoMemory");
  const selectedTemplateId = watch("templateId");
  const selectedBusinessPhoneId = watch("businessPhoneId");
  const selectedAgentId = watch("agentId");
  const selectedWorkflowId = watch("workflowId");
  const campaignExit = useCampaignExit({ templateId: selectedTemplateId, campaignId: initialCampaign?.id, mode, initialTemplateId: initialCampaign?.templateId, initial: seed?.exit });
  const smartPolicy = useSmartPolicyDraft(mode, seed?.smartPolicy ?? null);
  const audienceFields = useMemo(
    () => ({
      ...(selectedTemplateId ? { templateId: selectedTemplateId } : {}),
      ...(selectedBusinessPhoneId ? { businessPhoneId: selectedBusinessPhoneId } : {}),
      ...(responseMode === "workflow" && selectedWorkflowId ? { workflowId: selectedWorkflowId } : {}),
      ...(responseMode === "agent" && selectedAgentId ? { agentId: selectedAgentId } : {}),
    }),
    [selectedTemplateId, selectedBusinessPhoneId, responseMode, selectedWorkflowId, selectedAgentId],
  );
  const audience = useCampaignAudience({ channel: "whatsapp", fields: audienceFields, scope: selectedTemplateId, initial: seed?.audience });

  const agentResponsesActive = responseMode === "agent" && Boolean(selectedAgentId);
  const campaignToolsAvailable = !agentResponsesActive;

  const mapBusinessPhoneOption = useCallback(
    (phone: WhatsAppBusinessPhone): ElevatedCommandOption => ({
      label: phone.verifiedName ? `${phone.verifiedName} (${phone.displayPhoneNumber})` : phone.displayPhoneNumber,
      value: phone.id,
    }),
    [],
  );

  const mapTemplateOption = useCallback(
    (template: WhatsAppTemplate): ElevatedCommandOption => {
      const header = template.components.find((component) => component.type === "HEADER");
      const needsMedia = header?.format && MEDIA_HEADERS.includes(header.format) && !template.headerMediaUrl;

      return {
        label: `${template.name} (${template.language})`,
        value: template.id,
        description: needsMedia ? t("media.missingMediaShort") : undefined,
      };
    },
    [t],
  );

  const mapAgentOption = useCallback((agent: AgentListItem): ElevatedCommandOption => ({ label: agent.name, value: agent.id }), []);

  const mapWorkflowOption = useCallback((workflow: Workflow): ElevatedCommandOption => ({ label: workflow.name, value: workflow.id }), []);

  const businessPhoneSelect = usePaginatedSelect<WhatsAppBusinessPhone>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listBusinessPhonesAction({ status: "CONNECTED", page, pageSize: 20, search: search || undefined });
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
        return { items: result.templates ?? [], totalPages: result.meta.totalPages };
      },
      [selectedBusinessPhoneId],
    ),
    mapOption: mapTemplateOption,
    enabled: Boolean(selectedBusinessPhoneId),
  });

  const workflowSelect = usePaginatedSelect<Workflow>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listWorkflowsAction({ page, pageSize: 20, search: search || undefined });
      return { items: result.workflows ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: mapWorkflowOption,
  });

  const agentSelect = usePaginatedSelect<AgentListItem>({
    fetchFn: useCallback(async (page: number, search: string) => {
      const result = await listAgentsAction({ page, pageSize: 20, search: search || undefined });
      return { items: result.agents ?? [], totalPages: result.meta.totalPages };
    }, []),
    mapOption: mapAgentOption,
  });

  useEffect(() => {
    setKnownBusinessPhones((prev) => mergeItemsById(prev, businessPhoneSelect.items));
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
    if (!selectedBusinessPhoneId || knownBusinessPhones[selectedBusinessPhoneId]) {
      return;
    }

    let active = true;
    getBusinessPhoneByIdAction(selectedBusinessPhoneId).then((result) => {
      const phone = result.phone;
      if (!active || !phone) {
        return;
      }

      setKnownBusinessPhones((prev) => ({ ...prev, [phone.id]: phone }));
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

      setKnownTemplates((prev) => ({ ...prev, [template.id]: template }));
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

      setKnownWorkflows((prev) => ({ ...prev, [workflow.id]: workflow }));
    });

    return () => {
      active = false;
    };
  }, [selectedWorkflowId]);

  const businessPhoneOptions = useMemo(() => {
    const currentPhone = selectedBusinessPhoneId ? knownBusinessPhones[selectedBusinessPhoneId] : undefined;
    return mergeSelectedOption(currentPhone ? mapBusinessPhoneOption(currentPhone) : null, businessPhoneSelect.options);
  }, [selectedBusinessPhoneId, knownBusinessPhones, mapBusinessPhoneOption, businessPhoneSelect.options]);

  const templateOptions = useMemo(() => {
    const currentTemplate = selectedTemplateId ? knownTemplates[selectedTemplateId] : undefined;
    return mergeSelectedOption(currentTemplate ? mapTemplateOption(currentTemplate) : null, templateSelect.options);
  }, [selectedTemplateId, knownTemplates, mapTemplateOption, templateSelect.options]);

  const agentOptions = useMemo(() => {
    const currentAgent = selectedAgentId ? knownAgents[selectedAgentId] : undefined;
    return mergeSelectedOption(currentAgent ? mapAgentOption(currentAgent) : null, agentSelect.options);
  }, [selectedAgentId, knownAgents, mapAgentOption, agentSelect.options]);

  const workflowOptions = useMemo(() => {
    const currentWorkflow = selectedWorkflowId ? knownWorkflows[selectedWorkflowId] : undefined;
    return mergeSelectedOption(currentWorkflow ? mapWorkflowOption(currentWorkflow) : null, workflowSelect.options);
  }, [selectedWorkflowId, knownWorkflows, mapWorkflowOption, workflowSelect.options]);

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
  }, []);

  useEffect(() => {
    if (mode !== "create" || !aiModels.length) return;
    const current = getValues("aiModel");
    if (current) return;
    const selected = aiModels.includes(DEFAULT_AI_MODEL) ? DEFAULT_AI_MODEL : aiModels[0] || "";
    if (selected) {
      setValue("aiModel", selected, { shouldValidate: true });
    }
  }, [aiModels, mode, getValues, setValue]);

  const selectedTemplate = useMemo(() => (selectedTemplateId ? knownTemplates[selectedTemplateId] : undefined), [selectedTemplateId, knownTemplates]);
  const templateVariables = useMemo(() => extractTemplateVariables(selectedTemplate), [selectedTemplate]);

  const previewListId = audience.draft.source === "list" ? audience.draft.listId : null;
  const previewRows = useListRowsQuery("whatsapp", previewListId, audience.context, PREVIEW_ROWS).data?.items;
  const previewRowCount = previewRows?.length ?? 0;

  const pickPreviewEntry = useCallback(() => {
    setPreviewEntryIndex(previewRowCount > 0 ? Math.floor(Math.random() * previewRowCount) : null);
  }, [previewRowCount]);

  useEffect(() => {
    if (mode === "edit") {
      setTemplateInfoConfirmed(true);
      return;
    }
    pickPreviewEntry();
  }, [mode, selectedTemplateId, pickPreviewEntry]);

  const previewEntry = previewEntryIndex != null ? previewRows?.[previewEntryIndex] : undefined;
  const previewVariables = useMemo(() => previewEntry?.variables ?? [], [previewEntry]);

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
    return header?.format !== undefined && MEDIA_HEADERS.includes(header.format);
  }, [selectedTemplate]);

  const selectedTemplateMissingMedia = useMemo(() => selectedTemplateHasMediaHeader && !selectedTemplate?.headerMediaUrl, [selectedTemplateHasMediaHeader, selectedTemplate]);

  const handleSaveHeaderMedia = async (headerMediaUrl: string | null) => {
    if (!selectedTemplate) return;
    setIsSavingMedia(true);
    try {
      const result = await updateWhatsAppTemplateHeaderMediaAction(selectedTemplate.id, { headerMediaUrl: headerMediaUrl ?? "" });
      if (result.success) {
        setKnownTemplates((prev) => ({ ...prev, [selectedTemplate.id]: { ...selectedTemplate, headerMediaUrl } }));
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

  useEffect(() => {
    if (initialCampaign && mode === "edit") {
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
      });

      if (initialCampaign.scheduledStart && !contentLocked) {
        setScheduleEnabled(true);
      }
    }
  }, [initialCampaign, mode, reset, contentLocked]);

  const settingsOf = useCallback(
    (data: CampaignFormValues) => {
      const agentResponsesEnabled = responseMode === "agent" && Boolean(data.agentId);
      const workflowEnabled = responseMode === "workflow" && Boolean(data.workflowId);
      const campaignToolsEnabled = !agentResponsesEnabled;
      return {
        name: data.name,
        templateId: data.templateId,
        businessPhoneId: data.businessPhoneId,
        agentId: agentResponsesEnabled ? data.agentId || null : null,
        workflowId: workflowEnabled ? data.workflowId || null : null,
        enableAgentResponses: agentResponsesEnabled,
        enableWorkflow: workflowEnabled,
        showTemplateInCrm: data.showTemplateInCrm,
        enableAnalysis: campaignToolsEnabled ? data.enableAnalysis : false,
        enableAutoStaging: campaignToolsEnabled ? data.enableAutoStaging : false,
        enableAutoMemory: campaignToolsEnabled ? data.enableAutoMemory : false,
        aiModel: campaignToolsEnabled && (data.enableAnalysis || data.enableAutoStaging || data.enableAutoMemory) ? data.aiModel || undefined : undefined,
        scheduledStart: scheduleEnabled && data.scheduledStart ? data.scheduledStart : undefined,
        ...(selectedPipelineId ? { pipelineId: selectedPipelineId } : {}),
        ...campaignExit.fields,
        ...smartPolicy.fields,
      };
    },
    [responseMode, scheduleEnabled, selectedPipelineId, campaignExit.fields, smartPolicy.fields],
  );

  const chooseResponseMode = useCallback(
    (next: ResponseMode) => {
      setResponseMode(next);
      if (next === "agent") {
        setValue("workflowId", null);
        setValue("enableAgentResponses", true);
      } else {
        setValue("agentId", null);
        setValue("enableAgentResponses", false);
      }
    },
    [setValue],
  );


  return {
    mode,
    form,
    isAdmin,
    initialCampaign: initialCampaign ?? null,
    editingSettings,
    contentLocked,
    scheduleEnabled,
    setScheduleEnabled,
    mediaModalOpen,
    setMediaModalOpen,
    isSavingMedia,
    handleSaveHeaderMedia,
    templateInfoConfirmed,
    confirmTemplate: setTemplateInfoConfirmed,
    dealPipelineId,
    setDealPipelineId,
    aiModels,
    modelPricing,
    loadingModels,
    pipelineOptions,
    selectedPipelineId,
    setSelectedPipelineId,
    responseMode,
    chooseResponseMode,
    enableAnalysis,
    enableAutoStaging,
    enableAutoMemory,
    selectedTemplateId,
    selectedBusinessPhoneId,
    campaignExit,
    smartPolicy,
    audience,
    campaignToolsAvailable,
    businessPhoneSelect,
    templateSelect,
    workflowSelect,
    agentSelect,
    businessPhoneOptions,
    templateOptions,
    agentOptions,
    workflowOptions,
    selectedTemplate,
    templateVariables,
    pickPreviewEntry,
    previewEntry,
    renderTemplateText,
    selectedTemplateMissingMedia,
    settingsOf,
  };
}

export type WhatsAppCampaignFormState = ReturnType<typeof useWhatsAppCampaignForm>;
