"use client";

import {
  ArrowLeft,
  ArrowRight,
  CheckCircle,
  CircleNotch,
  GraduationCap,
  Lightbulb,
  Wrench,
} from "@/components/icons";
import { Controller, useForm } from "react-hook-form";
import {
  ElevatedStepFlow,
  type ElevatedStepFlowStep,
} from "@/components/elevated-design/elevated-step-flow";
import Button from "@/components/elevated-design/button";
import { Notice } from "@/components/ui/notice";
import {
  getAgentOptionsAction,
  getAgentToolsAction,
  createAgentAction,
  updateAgentAction,
} from "@/app/actions/agents";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";

import { AIModelSelector } from "@/components/elevated-design/ai-model-selector";
import type {
  Agent,
  AgentOptions,
  AgentToolDefinition,
  CreateAgentPayload,
  UpdateAgentPayload,
  ToolBinding,
} from "@/lib/agents/types";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedCommandSelect } from "@/components/elevated-design/elevated-command-select";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { useEmptyValue } from "@/components/elevated-design/empty-value";
import { toast } from "sonner";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { listWhatsAppTemplatesAction } from "@/app/actions/whatsapp-templates";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";

type AgentFieldId =
  | "name"
  | "description"
  | "messagingModel"
  | "messagingPrompt"
  | "businessPhoneId"
  | "whatsappTemplateId";

interface AgentFieldDefinition {
  id: AgentFieldId;
  stepGroup: "identity" | "models" | "prompts" | "whatsapp";
  beginner: { enabled: boolean; order: number };
}

const agentFieldDefinitions: AgentFieldDefinition[] = [
  { id: "name", stepGroup: "identity", beginner: { enabled: true, order: 1 } },
  {
    id: "description",
    stepGroup: "identity",
    beginner: { enabled: true, order: 2 },
  },
  {
    id: "messagingModel",
    stepGroup: "models",
    beginner: { enabled: true, order: 1 },
  },
  {
    id: "messagingPrompt",
    stepGroup: "prompts",
    beginner: { enabled: true, order: 2 },
  },
  {
    id: "businessPhoneId",
    stepGroup: "whatsapp",
    beginner: { enabled: true, order: 1 },
  },
  {
    id: "whatsappTemplateId",
    stepGroup: "whatsapp",
    beginner: { enabled: true, order: 2 },
  },
];

const beginnerSchema = (t: (k: string) => string) =>
  z.object({
    name: z.string().trim().min(2, t("validation.nameRequired")),
    description: z.string().optional().default(""),
    messagingModel: z.string().min(1, t("validation.messagingModelRequired")),
    messagingPrompt: z
      .string()
      .trim()
      .min(1, t("validation.messagingPromptRequired")),
    businessPhoneId: z.string().optional().default(""),
    whatsappTemplateId: z.string().optional().default(""),
  });

type BeginnerFormData = z.infer<ReturnType<typeof beginnerSchema>>;

interface BeginnerAgentWizardProps {
  mode?: "create" | "edit";
  initialAgent?: Agent;
  onSaved: (agent: Agent) => void;
  onSwitchMode?: () => void;
}

function FieldError({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="mt-1 text-xs font-semibold text-destructive-ink">{message}</p>;
}

function WizardField({
  hint,
  error,
  example,
  children,
}: {
  hint?: string;
  error?: string;
  example?: { label: string; body: string };
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      {children}
      <FieldError message={error} />
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
      {example ? (
        <p className="flex items-start gap-1.5 pt-0.5 text-xs text-muted-foreground">
          <Lightbulb className="mt-px h-3.5 w-3.5 shrink-0 text-foreground" weight="fill" aria-hidden />
          <span className="whitespace-pre-line">
            <span className="font-semibold text-foreground">{example.label}: </span>
            {example.body}
          </span>
        </p>
      ) : null}
    </div>
  );
}

export default function BeginnerAgentWizard({
  mode = "create",
  initialAgent,
  onSaved,
  onSwitchMode,
}: BeginnerAgentWizardProps) {
  const tForm = useTranslations("agents.form");
  const tWizard = useTranslations("agents.new.beginner");
  const tEdit = useTranslations("agents.edit");
  const empty = useEmptyValue();
  const [isSubmitting, startSubmitting] = useTransition();

  const [options, setOptions] = useState<AgentOptions | null>(null);
  const [tools, setTools] = useState<AgentToolDefinition[]>([]);
  const [step, setStep] = useState(0);

  const schema = useMemo(() => beginnerSchema(tForm), [tForm]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    trigger,
    formState: { errors },
  } = useForm<BeginnerFormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initialAgent?.name ?? "",
      description: initialAgent?.description ?? "",
      messagingModel: initialAgent?.messagingModel ?? "",
      messagingPrompt: initialAgent?.messagingPrompt ?? "",
      businessPhoneId: initialAgent?.businessPhoneId ?? "",
      whatsappTemplateId: initialAgent?.whatsappTemplateId ?? "",
    },
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [optsRes, toolsRes] = await Promise.all([
        getAgentOptionsAction(),
        getAgentToolsAction(),
      ]);
      if (cancelled) return;
      if (optsRes.options) {
        setOptions(optsRes.options);
        if (mode === "create") {
          setValue(
            "messagingModel",
            optsRes.options.defaults?.messagingModel ?? "",
          );
        }
      }
      if (toolsRes.tools) setTools(toolsRes.tools);
    })();
    return () => {
      cancelled = true;
    };
  }, [setValue, mode]);

  const [phones, setPhones] = useState<WhatsAppBusinessPhone[]>([]);
  const [phonesLoading, setPhonesLoading] = useState(false);
  const [phoneSearch, setPhoneSearch] = useState("");
  const [phonePage, setPhonePage] = useState(1);
  const [phoneHasMore, setPhoneHasMore] = useState(true);
  const phoneReqRef = useRef(0);

  const loadPhones = useCallback(
    async (search: string, page: number, replace: boolean) => {
      const reqId = ++phoneReqRef.current;
      setPhonesLoading(true);
      const res = await listBusinessPhonesAction({
        search: search || undefined,
        page,
        pageSize: 20,
      });
      if (reqId !== phoneReqRef.current) return;
      const next = res.phones ?? [];
      setPhones((prev) => (replace ? next : [...prev, ...next]));
      setPhoneHasMore(
        next.length >= 20 && page < (res.meta?.totalPages ?? page),
      );
      setPhonesLoading(false);
    },
    [],
  );

  useEffect(() => {
    void loadPhones("", 1, true);
  }, [loadPhones]);

  const [templates, setTemplates] = useState<WhatsAppTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [templateSearch, setTemplateSearch] = useState("");
  const [templatePage, setTemplatePage] = useState(1);
  const [templateHasMore, setTemplateHasMore] = useState(true);
  const templateReqRef = useRef(0);

  const selectedPhoneId = watch("businessPhoneId");

  const loadTemplates = useCallback(
    async (phoneId: string, search: string, page: number, replace: boolean) => {
      if (!phoneId) {
        setTemplates([]);
        return;
      }
      const reqId = ++templateReqRef.current;
      setTemplatesLoading(true);
      const res = await listWhatsAppTemplatesAction({
        businessPhoneId: phoneId,
        search: search || undefined,
        page,
        pageSize: 20,
      });
      if (reqId !== templateReqRef.current) return;
      const next = res.templates ?? [];
      setTemplates((prev) => (replace ? next : [...prev, ...next]));
      setTemplateHasMore(
        next.length >= 20 && page < (res.meta?.totalPages ?? page),
      );
      setTemplatesLoading(false);
    },
    [],
  );

  useEffect(() => {
    setTemplatePage(1);
    setTemplateSearch("");
    void loadTemplates(selectedPhoneId ?? "", "", 1, true);
  }, [selectedPhoneId, loadTemplates]);

  const messagingModelIds = useMemo(() => options?.messaging ?? [], [options]);
  const modelPricing = options?.modelPricing;

  const steps: ElevatedStepFlowStep[] = useMemo(
    () =>
      (["identity", "models", "prompts", "whatsapp", "review"] as const).map((id) => ({
        id,
        title: tWizard(`steps.${id}.title`),
        description: tWizard(`steps.${id}.intro`),
        caption: tWizard(`steps.${id}.short`),
      })),
    [tWizard],
  );

  const fieldsForStep = useMemo<Record<string, AgentFieldId[]>>(() => {
    const map: Record<string, AgentFieldId[]> = {
      identity: [],
      models: [],
      prompts: [],
      whatsapp: [],
      review: [],
    };
    agentFieldDefinitions
      .filter((f) => f.beginner.enabled)
      .sort((a, b) => a.beginner.order - b.beginner.order)
      .forEach((f) => map[f.stepGroup].push(f.id));
    return map;
  }, []);

  const goNext = async () => {
    const currentId = steps[step].id;
    const fieldsToValidate = fieldsForStep[currentId] ?? [];
    if (fieldsToValidate.length > 0) {
      const ok = await trigger(fieldsToValidate);
      if (!ok) return;
    }
    setStep((s) => Math.min(s + 1, steps.length - 1));
  };

  const goBack = () => setStep((s) => Math.max(s - 1, 0));

  const onSubmit = (data: BeginnerFormData) => {
    if (mode === "create" && tools.length === 0) {
      toast.error(tWizard("errors.toolsUnavailable.title"), { description: tWizard("errors.toolsUnavailable.description") });
      return;
    }

    let internalTools: ToolBinding[] = [];
    if (mode === "create") {
      internalTools = tools
        .filter(
          (tool) => tool.category === "agent_utility" && !tool.requiresConfig,
        )
        .map((tool) => ({
          name: tool.name,
          visibility: tool.visibility,
          config: undefined,
        }));
      if (internalTools.length === 0) {
        const fallback = tools.find((tool) => !tool.requiresConfig);
        if (fallback) {
          internalTools.push({
            name: fallback.name,
            visibility: fallback.visibility,
            config: undefined,
          });
        }
      }
    } else if (initialAgent) {
      internalTools = (initialAgent.internalTools ?? []).map((b) => ({
        name: b.name,
        visibility: b.visibility,
        config: b.config,
      }));
    }

    const phoneId = (data.businessPhoneId ?? "").trim();
    const templateId = (data.whatsappTemplateId ?? "").trim();
    internalTools = internalTools.filter(
      (b) => b.name !== "send_whatsapp_template",
    );
    if (phoneId && templateId) {
      const def = tools.find((t) => t.name === "send_whatsapp_template");
      internalTools.push({
        name: "send_whatsapp_template",
        visibility: def?.visibility,
        config: undefined,
      });
    }

    const basePayload: CreateAgentPayload = {
      name: data.name,
      description: data.description,
      provider: initialAgent?.provider ?? "platform",
      messagingModel: data.messagingModel,
      messagingPrompt: data.messagingPrompt,
      internalTools,
      isActive: initialAgent?.isActive ?? true,
      whatsappTemplateId: templateId || undefined,
      businessPhoneId: phoneId || undefined,
    };

    startSubmitting(async () => {
      if (mode === "edit" && initialAgent) {
        const payload: UpdateAgentPayload = {
          ...basePayload,
          isActive: initialAgent.isActive ?? true,
          tags: initialAgent.tags,
          metadata: initialAgent.metadata as Record<string, string> | undefined,
          mediaIds: initialAgent.mediaIds,
          avatarUrl: initialAgent.avatarUrl,
          ragEnabled: initialAgent.ragEnabled,
          ragConfig: initialAgent.ragConfig,
        };
        const res = await updateAgentAction(initialAgent.id, payload);
        if (res.error || !res.agent) {
          toast.error(tEdit("errors.updateFailed.title"), { description: res.error ?? tEdit("errors.updateFailed.description") });
          return;
        }
        toast(tEdit("success.title"), { description: tEdit("success.description") });
        onSaved(res.agent);
        return;
      }

      const result = await createAgentAction(basePayload);
      if (result.error || !result.agent) {
        toast.error(tWizard("errors.createFailed.title"), { description: result.error ?? tWizard("errors.createFailed.description") });
        return;
      }
      toast(tWizard("success.title"), { description: tWizard("success.description") });
      onSaved(result.agent);
    });
  };

  const isLast = step === steps.length - 1;
  const currentValues = watch();

  const phoneSelectOptions = useMemo(() => {
    const opts = phones.map((p) => ({
      value: p.id,
      label: p.displayPhoneNumber,
      description: p.verifiedName,
      keywords: [p.displayPhoneNumber, p.verifiedName ?? ""],
    }));
    return [
      { value: "", label: tWizard("fields.businessPhone.none") },
      ...opts,
    ];
  }, [phones, tWizard]);

  const templateSelectOptions = useMemo(() => {
    const opts = templates.map((t) => ({
      value: t.id,
      label: t.name,
      description: `${t.language} · ${t.status}`,
      keywords: [t.name, t.language, t.status],
    }));
    return [
      { value: "", label: tWizard("fields.whatsappTemplate.none") },
      ...opts,
    ];
  }, [templates, tWizard]);

  const exampleOf = (field: string) => ({
    label: tWizard("exampleLabel"),
    body: tWizard(`fields.${field}.example`),
  });

  const phoneLabel = currentValues.businessPhoneId
    ? phones.find((p) => p.id === currentValues.businessPhoneId)?.displayPhoneNumber ?? currentValues.businessPhoneId
    : "";
  const templateLabel = currentValues.whatsappTemplateId
    ? templates.find((t) => t.id === currentValues.whatsappTemplateId)?.name ?? currentValues.whatsappTemplateId
    : "";

  const summaries: Record<string, string> = {
    identity: [currentValues.name, currentValues.description].filter(Boolean).join(" · ") || empty,
    models: currentValues.messagingModel || empty,
    prompts: currentValues.messagingPrompt || empty,
    whatsapp: phoneLabel
      ? [phoneLabel, templateLabel].filter(Boolean).join(" · ")
      : tWizard("fields.businessPhone.none"),
  };

  const activeId = steps[step].id;

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        if (isLast) void handleSubmit(onSubmit)();
        else void goNext();
      }}
      noValidate
      className="w-full max-w-3xl space-y-3"
    >
      <ElevatedStepFlow
        steps={steps.map((s) => ({ ...s, summary: summaries[s.id] }))}
        currentStep={step}
        onStepClick={(i) => {
          if (i < step) setStep(i);
        }}
        editLabel={tWizard("nav.edit")}
        actions={
          <>
            <Button
              type="submit"
              variant="primary"
              title={
                isLast
                  ? mode === "edit"
                    ? tWizard("nav.submitEdit")
                    : tWizard("nav.submit")
                  : tWizard("nav.next")
              }
              icon={
                isSubmitting ? (
                  <CircleNotch className="h-4 w-4 animate-spin" />
                ) : isLast ? (
                  <CheckCircle className="h-4 w-4" weight="fill" />
                ) : (
                  <ArrowRight className="h-4 w-4" weight="bold" />
                )
              }
              iconVisible
              iconSide={isLast || isSubmitting ? "left" : "right"}
              disabled={isSubmitting}
            />
            {step > 0 ? (
              <Button
                type="button"
                variant="ghost"
                title={tWizard("nav.back")}
                icon={<ArrowLeft className="h-4 w-4" weight="bold" />}
                iconVisible
                iconSide="left"
                onClick={goBack}
                disabled={isSubmitting}
              />
            ) : null}
          </>
        }
      >
        {activeId === "identity" && (
          <div className="space-y-6">
            <WizardField
              hint={tWizard("fields.name.description")}
              error={errors.name?.message}
              example={exampleOf("name")}
            >
              <ElevatedInput
                label={tWizard("fields.name.label")}
                placeholder={tWizard("fields.name.placeholder")}
                {...register("name")}
              />
            </WizardField>

            <WizardField
              hint={tWizard("fields.description.description")}
              error={errors.description?.message}
              example={exampleOf("description")}
            >
              <ElevatedTextarea
                rows={3}
                label={tWizard("fields.description.label")}
                placeholder={tWizard("fields.description.placeholder")}
                {...register("description")}
              />
            </WizardField>
          </div>
        )}

        {activeId === "models" && (
          <WizardField
            hint={tWizard("fields.messagingModel.description")}
            error={errors.messagingModel?.message}
          >
            <Controller
              control={control}
              name="messagingModel"
              render={({ field }) => (
                <AIModelSelector
                  value={field.value}
                  onValueChange={field.onChange}
                  models={messagingModelIds}
                  modelPricing={modelPricing}
                  label={tWizard("fields.messagingModel.label")}
                />
              )}
            />
          </WizardField>
        )}

        {activeId === "prompts" && (
          <WizardField
            hint={tWizard("fields.messagingPrompt.description")}
            error={errors.messagingPrompt?.message}
            example={exampleOf("messagingPrompt")}
          >
            <ElevatedTextarea
              rows={7}
              label={tWizard("fields.messagingPrompt.label")}
              placeholder={tWizard("fields.messagingPrompt.placeholder")}
              {...register("messagingPrompt")}
            />
          </WizardField>
        )}

        {activeId === "whatsapp" && (
          <div className="space-y-6">
            <WizardField hint={tWizard("fields.businessPhone.description")}>
                <Controller
                  control={control}
                  name="businessPhoneId"
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      fullWidth
                      label={tWizard("fields.businessPhone.label")}
                      options={phoneSelectOptions}
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      searchPlaceholder={tWizard(
                        "fields.businessPhone.searchPlaceholder",
                      )}
                      emptyMessage={tWizard("fields.businessPhone.empty")}
                      isLoading={phonesLoading}
                      onSearch={(q) => {
                        setPhoneSearch(q);
                        setPhonePage(1);
                        void loadPhones(q, 1, true);
                      }}
                      onScrollEnd={() => {
                        if (!phonesLoading && phoneHasMore) {
                          const next = phonePage + 1;
                          setPhonePage(next);
                          void loadPhones(phoneSearch, next, false);
                        }
                      }}
                    />
                  )}
                />
            </WizardField>

            <WizardField
              hint={
                selectedPhoneId
                  ? tWizard("fields.whatsappTemplate.description")
                  : tWizard("fields.whatsappTemplate.requiresPhone")
              }
            >
                <Controller
                  control={control}
                  name="whatsappTemplateId"
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      fullWidth
                      label={tWizard("fields.whatsappTemplate.label")}
                      options={templateSelectOptions}
                      value={field.value}
                      onValueChange={(v) => field.onChange(v)}
                      searchPlaceholder={tWizard(
                        "fields.whatsappTemplate.searchPlaceholder",
                      )}
                      emptyMessage={
                        selectedPhoneId
                          ? tWizard("fields.whatsappTemplate.empty")
                          : tWizard("fields.whatsappTemplate.requiresPhone")
                      }
                      disabled={!selectedPhoneId}
                      isLoading={templatesLoading}
                      onSearch={(q) => {
                        setTemplateSearch(q);
                        setTemplatePage(1);
                        void loadTemplates(selectedPhoneId ?? "", q, 1, true);
                      }}
                      onScrollEnd={() => {
                        if (
                          !templatesLoading &&
                          templateHasMore &&
                          selectedPhoneId
                        ) {
                          const next = templatePage + 1;
                          setTemplatePage(next);
                          void loadTemplates(
                            selectedPhoneId,
                            templateSearch,
                            next,
                            false,
                          );
                        }
                      }}
                    />
                  )}
                />
            </WizardField>
          </div>
        )}

        {activeId === "review" && (
          <Notice
            tone="info"
            icon={<GraduationCap weight="fill" />}
            title={tWizard("review.nextStepTitle")}
          >
            <p className="text-muted-foreground">{tWizard("review.nextStepDescription")}</p>
          </Notice>
        )}
      </ElevatedStepFlow>

      {onSwitchMode ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onSwitchMode}
            className="inline-flex items-center gap-1.5 rounded-[--radius] px-2 py-1 text-xs font-medium text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Wrench className="h-3.5 w-3.5" aria-hidden />
            {tWizard("switchToPro")}
          </button>
        </div>
      ) : null}
    </form>
  );
}
