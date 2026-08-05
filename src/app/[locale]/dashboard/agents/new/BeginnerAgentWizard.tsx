"use client";


import {
  ChatCircle,
  CheckCircle,
  GraduationCap,
  Lightbulb,
  Microphone,
  PaperPlaneTilt,
  Pause,
  Play,
  Robot,
  Sparkle,
} from "@/components/icons";
import { Controller, useForm } from "react-hook-form";
import {
  ElevatedStepper,
  ElevatedStepperFooter,
  type ElevatedStepperStep,
} from "@/components/elevated-design/elevated-stepper";
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
import { useToast } from "@/hooks/use-toast";
import { useTranslations } from "next-intl";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { listBusinessPhonesAction } from "@/app/actions/whatsapp-business-phones";
import { listWhatsAppTemplatesAction } from "@/app/actions/whatsapp-templates";
import type { WhatsAppBusinessPhone } from "@/lib/whatsapp-business-phones/types";
import type { WhatsAppTemplate } from "@/lib/whatsapp-templates/types";

export type AgentFieldId =
  | "name"
  | "description"
  | "messagingModel"
  | "messagingPrompt"
  | "initialMessage"
  | "businessPhoneId"
  | "whatsappTemplateId";

export interface AgentFieldDefinition {
  id: AgentFieldId;
  stepGroup: "identity" | "models" | "prompts" | "whatsapp";
  beginner: { enabled: boolean; order: number };
}

export const agentFieldDefinitions: AgentFieldDefinition[] = [
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
    id: "initialMessage",
    stepGroup: "prompts",
    beginner: { enabled: true, order: 3 },
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
    initialMessage: z.string().optional().default(""),
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
  return <p className="mt-1 text-xs font-semibold text-destructive">{message}</p>;
}

function StepHeader({
  Icon,
  title,
  intro,
  gradientFrom,
  gradientTo,
}: {
  Icon: typeof Robot;
  title: string;
  intro: string;
  gradientFrom: string;
  gradientTo: string;
}) {
  return (
    <div className="mb-6 flex items-start gap-4">
      <div
        className={`ink-plate flex h-14 w-14 shrink-0 items-center justify-center ${gradientFrom} ${gradientTo}`}
      >
        <Icon className="h-7 w-7" weight="fill" />
      </div>
      <div>
        <h2 className="text-xl font-semibold text-foreground">{title}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
      </div>
    </div>
  );
}

function ExampleBlock({ label, body }: { label: string; body: string }) {
  return (
    <div className="mt-3 rounded-[--radius] border border-border bg-muted p-3">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-muted-foreground shadow">
          <Lightbulb className="h-4 w-4" weight="fill" />
        </div>
        <p className="text-xs font-semibold text-foreground">
          {label}
        </p>
      </div>
      <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">
        {body}
      </p>
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
  const { toast } = useToast();
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
      initialMessage: initialAgent?.initialMessage ?? "",
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
  const audioRef = useRef<HTMLAudioElement | null>(null);
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

  const steps: ElevatedStepperStep[] = useMemo(
    () => [
      {
        id: "identity",
        title: tWizard("steps.identity.title"),
        description: tWizard("steps.identity.short"),
        icon: Robot,
      },
      {
        id: "models",
        title: tWizard("steps.models.title"),
        description: tWizard("steps.models.short"),
        icon: Sparkle,
      },
      {
        id: "prompts",
        title: tWizard("steps.prompts.title"),
        description: tWizard("steps.prompts.short"),
        icon: ChatCircle,
      },
      {
        id: "whatsapp",
        title: tWizard("steps.whatsapp.title"),
        description: tWizard("steps.whatsapp.short"),
        icon: PaperPlaneTilt,
      },
      {
        id: "review",
        title: tWizard("steps.review.title"),
        description: tWizard("steps.review.short"),
        icon: CheckCircle,
      },
    ],
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
      toast({
        title: tWizard("errors.toolsUnavailable.title"),
        description: tWizard("errors.toolsUnavailable.description"),
        variant: "destructive",
      });
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

    const trimmedInitial = (data.initialMessage ?? "").trim();

    const basePayload: CreateAgentPayload = {
      name: data.name,
      description: data.description,
      provider: initialAgent?.provider ?? "platform",
      messagingModel: data.messagingModel,
      messagingPrompt: data.messagingPrompt,
      initialMessage: trimmedInitial,
      useInitialMessage: trimmedInitial.length > 0,
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
          toast({
            title: tEdit("errors.updateFailed.title"),
            description: res.error ?? tEdit("errors.updateFailed.description"),
            variant: "destructive",
          });
          return;
        }
        toast({
          title: tEdit("success.title"),
          description: tEdit("success.description"),
        });
        onSaved(res.agent);
        return;
      }

      const result = await createAgentAction(basePayload);
      if (result.error || !result.agent) {
        toast({
          title: tWizard("errors.createFailed.title"),
          description:
            result.error ?? tWizard("errors.createFailed.description"),
          variant: "destructive",
        });
        return;
      }
      toast({
        title: tWizard("success.title"),
        description: tWizard("success.description"),
      });
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

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <ElevatedStepper
        steps={steps}
        currentStep={step}
        onStepClick={(i) => i < step && setStep(i)}
        footer={
          <div className="flex items-center justify-between gap-3">
            {onSwitchMode ? (
              <button
                type="button"
                onClick={onSwitchMode}
                className="text-xs font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
              >
                {tWizard("switchToPro")}
              </button>
            ) : (
              <span />
            )}
            <ElevatedStepperFooter
              canGoBack={step > 0}
              canGoNext={true}
              isLast={isLast}
              loading={isSubmitting}
              onBack={goBack}
              onNext={goNext}
              onSubmit={handleSubmit(onSubmit)}
              labels={{
                back: tWizard("nav.back"),
                next: tWizard("nav.next"),
                submit:
                  mode === "edit"
                    ? tWizard("nav.submitEdit")
                    : tWizard("nav.submit"),
              }}
            />
          </div>
        }
      >
        {steps[step].id === "identity" && (
          <div>
            <StepHeader
              Icon={Robot}
              title={tWizard("steps.identity.title")}
              intro={tWizard("steps.identity.intro")}
              gradientFrom="ink-1"
              gradientTo=""
            />

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground">
                  {tWizard("fields.name.label")}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {tWizard("fields.name.description")}
                </p>
                <ElevatedInput
                  placeholder={tWizard("fields.name.placeholder")}
                  {...register("name")}
                />
                <FieldError message={errors.name?.message} />
                <ExampleBlock
                  label={tWizard("exampleLabel")}
                  body={tWizard("fields.name.example")}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  {tWizard("fields.description.label")}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {tWizard("fields.description.description")}
                </p>
                <ElevatedTextarea
                  rows={3}
                  placeholder={tWizard("fields.description.placeholder")}
                  {...register("description")}
                />
                <FieldError message={errors.description?.message} />
                <ExampleBlock
                  label={tWizard("exampleLabel")}
                  body={tWizard("fields.description.example")}
                />
              </div>

            </div>
          </div>
        )}

        {steps[step].id === "models" && (
          <div>
            <StepHeader
              Icon={Sparkle}
              title={tWizard("steps.models.title")}
              intro={tWizard("steps.models.intro")}
              gradientFrom="ink-4"
              gradientTo=""
            />

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground">
                  {tWizard("fields.messagingModel.label")}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {tWizard("fields.messagingModel.description")}
                </p>
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
                <FieldError message={errors.messagingModel?.message} />
              </div>
            </div>
          </div>
        )}

        {steps[step].id === "prompts" && (
          <div>
            <StepHeader
              Icon={ChatCircle}
              title={tWizard("steps.prompts.title")}
              intro={tWizard("steps.prompts.intro")}
              gradientFrom="ink-3"
              gradientTo=""
            />

            <div className="space-y-5">

              <div>
                <label className="text-sm font-medium text-foreground">
                  {tWizard("fields.messagingPrompt.label")}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {tWizard("fields.messagingPrompt.description")}
                </p>
                <ElevatedTextarea
                  rows={5}
                  placeholder={tWizard("fields.messagingPrompt.placeholder")}
                  {...register("messagingPrompt")}
                />
                <FieldError message={errors.messagingPrompt?.message} />
                <ExampleBlock
                  label={tWizard("exampleLabel")}
                  body={tWizard("fields.messagingPrompt.example")}
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  {tWizard("fields.initialMessage.label")}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {tWizard("fields.initialMessage.description")}
                </p>
                <ElevatedTextarea
                  rows={2}
                  placeholder={tWizard("fields.initialMessage.placeholder")}
                  {...register("initialMessage")}
                />
                <FieldError message={errors.initialMessage?.message} />
                <ExampleBlock
                  label={tWizard("exampleLabel")}
                  body={tWizard("fields.initialMessage.example")}
                />
              </div>
            </div>
          </div>
        )}

        {steps[step].id === "whatsapp" && (
          <div>
            <StepHeader
              Icon={PaperPlaneTilt}
              title={tWizard("steps.whatsapp.title")}
              intro={tWizard("steps.whatsapp.intro")}
              gradientFrom="ink-2"
              gradientTo=""
            />

            <div className="space-y-5">
              <div>
                <label className="text-sm font-medium text-foreground">
                  {tWizard("fields.businessPhone.label")}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {tWizard("fields.businessPhone.description")}
                </p>
                <Controller
                  control={control}
                  name="businessPhoneId"
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      fullWidth
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
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">
                  {tWizard("fields.whatsappTemplate.label")}
                </label>
                <p className="mb-2 text-xs text-muted-foreground">
                  {tWizard("fields.whatsappTemplate.description")}
                </p>
                <Controller
                  control={control}
                  name="whatsappTemplateId"
                  render={({ field }) => (
                    <ElevatedCommandSelect
                      fullWidth
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
                {!selectedPhoneId ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tWizard("fields.whatsappTemplate.requiresPhone")}
                  </p>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {steps[step].id === "review" && (
          <div>
            <StepHeader
              Icon={CheckCircle}
              title={tWizard("steps.review.title")}
              intro={tWizard("steps.review.intro")}
              gradientFrom="ink-2"
              gradientTo=""
            />

            <div className="space-y-3">
              <ReviewRow
                label={tWizard("fields.name.label")}
                value={currentValues.name || "—"}
              />
              <ReviewRow
                label={tWizard("fields.description.label")}
                value={currentValues.description || "—"}
              />
              <ReviewRow
                label={tWizard("fields.messagingModel.label")}
                value={currentValues.messagingModel || "—"}
              />
              <ReviewRow
                label={tWizard("fields.initialMessage.label")}
                value={currentValues.initialMessage || "—"}
              />
              <ReviewRow
                label={tWizard("fields.businessPhone.label")}
                value={
                  phones.find((p) => p.id === currentValues.businessPhoneId)
                    ?.displayPhoneNumber ??
                  (currentValues.businessPhoneId || "—")
                }
              />
              <ReviewRow
                label={tWizard("fields.whatsappTemplate.label")}
                value={
                  templates.find(
                    (t) => t.id === currentValues.whatsappTemplateId,
                  )?.name ??
                  (currentValues.whatsappTemplateId || "—")
                }
              />
            </div>

            <div className="mt-6 rounded-[--radius] border border-border bg-muted p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-[--radius] bg-primary text-primary-foreground shadow-lg">
                  <GraduationCap className="h-5 w-5" weight="fill" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {tWizard("review.nextStepTitle")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {tWizard("review.nextStepDescription")}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}
      </ElevatedStepper>
    </form>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-[--radius] border border-border bg-card px-4 py-3">
      <p className="text-xs font-semibold text-muted-foreground">
        {label}
      </p>
      <p className="max-w-[60%] truncate text-right text-sm text-foreground">
        {value}
      </p>
    </div>
  );
}
