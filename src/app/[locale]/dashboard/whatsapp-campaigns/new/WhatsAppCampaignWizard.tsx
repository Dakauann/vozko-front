"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocale, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState, type ReactNode } from "react";
import { useWatch } from "react-hook-form";
import { toast } from "sonner";

import {
  createCampaignDraftAction,
  getCampaignDraftAction,
  isDraftActionError,
  launchCampaignDraftAction,
  reviewCampaignDraftAction,
  updateCampaignDraftAction,
  type DraftActionError,
} from "@/app/actions/campaign-drafts";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { AudienceCreateHint, CampaignAudienceStep, useCreateBlockedText } from "@/components/campaign-audience/CampaignAudienceStep";
import { SaveIndicator } from "@/components/campaign-wizard/SaveIndicator";
import { SendStep, type SendRefusal } from "@/components/campaign-wizard/SendStep";
import { campaignDraftsKey, campaignDraftsRoot, useCampaignDraftsWorkspace } from "@/components/campaign-wizard/use-campaign-drafts";
import { useDraftAutosave } from "@/components/campaign-wizard/use-draft-autosave";
import { useLaunchAnnouncer } from "@/components/campaign-wizard/use-launch-announcer";
import TourGuide from "@/components/TourGuide";
import { whatsappCampaignsTourPalette, whatsappCampaignsTourSeed, whatsappCampaignsTourSteps, wizardStepOfTour } from "@/data/tour-whatsapp-campaigns";
import { WizardFooterNext, WizardNav } from "@/components/campaign-wizard/WizardNav";
import { useSelectionSendRefusalText } from "@/components/campaigns/SelectionSendNote";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { ArrowRight, WhatsappLogo } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import {
  BusinessPhoneField,
  CampaignNameField,
  CampaignToolsFields,
  PipelineField,
  ResponseModeField,
  TemplateField,
  TemplateMediaModal,
  TemplatePreviewCard,
} from "@/components/whatsapp/campaign-form/sections";
import { useWhatsAppCampaignForm, type CampaignFormValues, type WhatsAppCampaignFormState } from "@/components/whatsapp/campaign-form/use-campaign-form";
import { CampaignExitSection } from "@/components/whatsapp/exit/CampaignExitSection";
import { LaunchFindings } from "@/components/whatsapp/launch-check/LaunchCheckDialog";
import { SmartCampaignSection } from "@/components/whatsapp/smart/SmartCampaignSection";
import { useWorkspace } from "@/contexts/workspace-context";
import { formatMicros } from "@/lib/advertising/money";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { launchRefusalOf, type OfficialDraftReview } from "@/lib/campaign-drafts/types";
import { stepOf } from "@/lib/campaign-wizard/steps";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { LAUNCH_REFUSAL_CODES, type LaunchReport } from "@/lib/whatsapp-campaigns/launch-check";
import {
  launchRefusalCodes,
  stableFingerprint,
  wizardHref,
  wizardRequestOf,
  WHATSAPP_WIZARD_STEPS,
  REVIEWED_STEPS,
  type WhatsAppCampaignDraft,
  type WhatsAppWizardRequest,
  type WhatsAppWizardState,
  type WhatsAppWizardStep,
} from "@/lib/whatsapp-campaigns/wizard";

const CHANNEL = "whatsapp";
const AUTOSAVE_DELAY_MS = 1000;

interface DraftBody {
  name: string;
  payload: { request: WhatsAppWizardRequest; state: WhatsAppWizardState };
}

function useWizardErrorText() {
  const tCampaigns = useTranslations("whatsappCampaignsPage");
  const tAudience = useTranslations("campaignAudience");
  const tShared = useTranslations("campaignWizard");
  const refusalText = useSelectionSendRefusalText();
  return useCallback(
    (error: { code?: string; error: string }, exitRefusal?: string | null) => {
      const fallback = exitRefusal ?? refusalText(error.code, error.error);
      const audience = codedErrorMessage(tAudience, { code: error.code }, fallback);
      const campaigns = codedErrorMessage(tCampaigns, { code: error.code }, audience);
      return codedErrorMessage(tShared, { code: error.code }, campaigns);
    },
    [tCampaigns, tAudience, tShared, refusalText],
  );
}

function stateOf(f: WhatsAppCampaignFormState, values: CampaignFormValues): WhatsAppWizardState {
  return {
    values: {
      name: values.name,
      templateId: values.templateId,
      businessPhoneId: values.businessPhoneId,
      agentId: values.agentId ?? null,
      workflowId: values.workflowId ?? null,
      enableAgentResponses: values.enableAgentResponses,
      showTemplateInCrm: values.showTemplateInCrm,
      enableAnalysis: values.enableAnalysis,
      enableAutoStaging: values.enableAutoStaging,
      enableAutoMemory: values.enableAutoMemory,
      aiModel: values.aiModel ?? "",
    },
    responseMode: f.responseMode,
    pipelineId: f.selectedPipelineId,
    dealPipelineId: f.dealPipelineId,
    templateInfoConfirmed: f.templateInfoConfirmed,
    audience: f.audience.draft,
    exit: { templateId: f.selectedTemplateId, choices: f.campaignExit.changes, acknowledged: f.campaignExit.acknowledged },
    smartPolicy: f.smartPolicy.policy,
  };
}

function ReviewNumbers({ review }: { review: OfficialDraftReview }) {
  const t = useTranslations("whatsappCampaignsPage.wizard.review");
  const locale = useLocale();
  const number = (value: number | null | undefined) => (value === null || value === undefined ? <EmptyValue /> : new Intl.NumberFormat(locale).format(value));
  const rows: [string, ReactNode][] = [
    [t("audience.matched"), number(review.audience?.matched)],
    [t("audience.sendable"), number(review.audience?.sendable)],
    [t("audience.out"), number(review.audience?.outTotal)],
  ];
  return (
    <PanelSection boxed title={t("audience.title")} description={t("audience.description")}>
      <dl className="grid gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-3">
        {rows.map(([label, value]) => (
          <div key={label} className="bg-card px-3 py-2">
            <dt className="legend">{label}</dt>
            <dd className="readout font-display text-base font-semibold text-foreground">{value}</dd>
          </div>
        ))}
      </dl>
    </PanelSection>
  );
}

interface Pending {
  key: string;
  text: string;
  step: WhatsAppWizardStep;
}

function WizardBody({
  initial,
  initialStep,
  aiModels,
  modelPricing,
}: {
  initial: WhatsAppCampaignDraft | null;
  initialStep: WhatsAppWizardStep;
  aiModels: string[];
  modelPricing: ModelPricingInfo[];
}) {
  const t = useTranslations("whatsappCampaignsPage");
  const tw = useTranslations("whatsappCampaignsPage.wizard");
  const tLaunch = useTranslations("launchCheck");
  const tShared = useTranslations("campaignWizard");
  const router = useRouter();
  const client = useQueryClient();
  const locale = useLocale();
  const { can } = useWorkspace();
  const workspaceId = useCampaignDraftsWorkspace();
  const errorText = useWizardErrorText();
  const announce = useLaunchAnnouncer();
  const seedState = initial?.payload.state;
  const seed = useMemo(
    () =>
      seedState
        ? {
            values: seedState.values,
            responseMode: seedState.responseMode,
            pipelineId: seedState.pipelineId,
            dealPipelineId: seedState.dealPipelineId,
            templateInfoConfirmed: seedState.templateInfoConfirmed,
            audience: seedState.audience,
            exit: seedState.exit,
            smartPolicy: seedState.smartPolicy,
          }
        : undefined,
    [seedState],
  );
  const f = useWhatsAppCampaignForm({ mode: "create", aiModels, modelPricing, seed });
  const values = useWatch({ control: f.form.control }) as CampaignFormValues;
  const { audience, campaignExit, smartPolicy } = f;
  const blockedAudience = useCreateBlockedText(audience);

  const [draftId, setDraftId] = useState<string | null>(initial?.id ?? null);
  const [savedVersion, setSavedVersion] = useState(initial?.updatedAt ?? "");
  const [step, setStep] = useState<WhatsAppWizardStep>(initialStep);
  const [confirmed, setConfirmed] = useState(false);
  const [launching, setLaunching] = useState(false);
  const [refused, setRefused] = useState<SendRefusal[]>([]);

  const request = useMemo(
    () =>
      wizardRequestOf(f.settingsOf({ ...values, scheduledStart: null }), {
        recipients: audience.recipients ?? audience.spec,
        dealPipelineId: f.dealPipelineId,
        buttonRoutes: campaignExit.routeInputs,
      }),
    [f, values, audience.recipients, audience.spec, campaignExit.routeInputs],
  );
  const body = useMemo<DraftBody>(() => ({ name: (values.name ?? "").trim(), payload: { request, state: stateOf(f, values) } }), [request, f, values]);
  const fingerprint = useMemo(() => stableFingerprint(body), [body]);
  const [baseline] = useState(() => (initial ? stableFingerprint({ name: initial.name, payload: initial.payload }) : ""));

  const onSaved = useCallback(
    (saved: WhatsAppCampaignDraft, created: boolean) => {
      setSavedVersion(saved.updatedAt);
      if (created) {
        setDraftId(saved.id);
        router.replace(wizardHref(saved.id, step), { scroll: false });
      }
      void client.invalidateQueries({ queryKey: campaignDraftsKey(workspaceId, CHANNEL) });
    },
    [client, router, step, workspaceId],
  );

  const autosave = useDraftAutosave<DraftBody, WhatsAppCampaignDraft, DraftActionError>({
    recordId: draftId,
    baseline,
    request: body,
    fingerprint,
    named: body.name !== "",
    editable: can("whatsapp_campaigns", "create"),
    delayMs: AUTOSAVE_DELAY_MS,
    save: async (id, next) => {
      const result = id
        ? await updateCampaignDraftAction<WhatsAppWizardRequest, WhatsAppWizardState>(CHANNEL, id, next)
        : await createCampaignDraftAction<WhatsAppWizardRequest, WhatsAppWizardState>(CHANNEL, next);
      return isDraftActionError(result) ? { error: result } : { data: result.data as WhatsAppCampaignDraft };
    },
    idOf: (saved) => saved.id,
    onSaved,
  });

  const reviewKey = useMemo(() => [...campaignDraftsRoot(workspaceId), CHANNEL, draftId ?? "", "review", savedVersion] as const, [workspaceId, draftId, savedVersion]);
  const reviewing = REVIEWED_STEPS.includes(step);
  const review = useQuery({
    queryKey: reviewKey,
    enabled: draftId !== null && reviewing && !autosave.dirty,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const result = await reviewCampaignDraftAction(CHANNEL, draftId ?? "", signal);
      if (isDraftActionError(result)) throw Object.assign(new Error(result.error), { code: result.code });
      return result.data;
    },
  });
  const reviewData = review.data;
  const report = useMemo<LaunchReport | null>(() => (reviewData ? ({ ...reviewData.check, findings: reviewData.check.findings } as LaunchReport) : null), [reviewData]);

  const stepLabel = useCallback((item: WhatsAppWizardStep) => tw(`steps.${item}`), [tw]);

  const go = useCallback(
    (next: WhatsAppWizardStep) => {
      setStep(next);
      if (REVIEWED_STEPS.includes(next)) void autosave.save();
      router.replace(wizardHref(draftId, next), { scroll: false });
      if (typeof window !== "undefined") window.scrollTo?.({ top: 0, behavior: "smooth" });
    },
    [autosave, draftId, router],
  );

  const pending = useMemo<Pending[]>(() => {
    const items: Pending[] = [];
    if (!f.templateInfoConfirmed) items.push({ key: "template", text: tw("review.pending.template"), step: "message" });
    if (campaignExit.blocks) items.push({ key: "exit", text: tw("review.pending.exit"), step: "message" });
    if (smartPolicy.blocks) items.push({ key: "smart", text: tw("review.pending.smart"), step: "config" });
    if (blockedAudience) items.push({ key: "audience", text: blockedAudience, step: "audience" });
    return items;
  }, [f.templateInfoConfirmed, campaignExit.blocks, smartPolicy.blocks, blockedAudience, tw]);

  const serverBlocks = report ? report.findings.filter((finding) => finding.level === "block").length : 0;
  const unconfirmed = report !== null && report.needsConfirmation && !report.blocks && !confirmed ? 1 : 0;
  const blocking = report ? serverBlocks + unconfirmed + pending.length : null;

  const launch = async (mode: "now" | "schedule" | "ready", scheduledAt: string | null): Promise<boolean> => {
    if (!draftId) return false;
    setLaunching(true);
    setRefused([]);
    const saved = await autosave.save();
    if (!saved) {
      setLaunching(false);
      toast.error(tShared("toast.saveFirst"));
      return false;
    }
    const result = await launchCampaignDraftAction<{ id: string }>(CHANNEL, draftId, {
      mode,
      ...(scheduledAt ? { scheduledStart: scheduledAt } : {}),
      ...(confirmed && report?.fingerprint ? { confirmedFingerprint: report.fingerprint } : {}),
    });
    if (isDraftActionError(result)) {
      setLaunching(false);
      if (result.code && LAUNCH_REFUSAL_CODES.has(result.code)) {
        const codes = launchRefusalCodes({ ...launchRefusalOf(result.details), findings: result.details?.findings });
        setRefused(codes.map((code) => ({ key: code, text: tLaunch.has(`codes.${code}.title`) ? tLaunch(`codes.${code}.title`) : code })));
        setConfirmed(false);
        void client.invalidateQueries({ queryKey: reviewKey });
      } else {
        if (result.code === "selection_changed") audience.recount();
        setRefused([{ key: result.code ?? "error", text: errorText(result, campaignExit.refusal(result.code)) }]);
      }
      toast.error(tShared("toast.failed"), { description: errorText(result, campaignExit.refusal(result.code)) });
      return false;
    }
    const outcome = result.data;
    announce(outcome, (code) => errorText({ code, error: tShared("errors.generic") }));
    void client.invalidateQueries({ queryKey: campaignDraftsRoot(workspaceId), refetchType: "none" });
    router.push(`/dashboard/whatsapp-campaigns/${outcome.campaign.id}`);
    return true;
  };

  const sendable = reviewData?.audience?.sendable ?? null;
  const quote = reviewData?.quote ?? null;
  const total = quote ? formatMicros(quote.costMicros, quote.currency || "BRL", locale) : "";
  const count = sendable === null ? "" : new Intl.NumberFormat(locale).format(sendable);
  const phone = f.businessPhoneOptions.find((option) => option.value === values.businessPhoneId)?.label;
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/Sao_Paulo";
  const canCreate = can("whatsapp_campaigns", "create");
  const canStart = can("whatsapp_campaigns", "start");

  const reviewBody = (
    <div className="space-y-5" data-tour="wc-review">
      {pending.length > 0 ? (
        <Notice tone="warning" title={tw("review.pending.title")}>
          <ul className="space-y-2">
            {pending.map((item) => (
              <li key={item.key} className="flex flex-wrap items-center justify-between gap-2">
                <span>{item.text}</span>
                <Button
                  variant="secondary"
                  size="sm"
                  title={tw("review.pending.fix", { step: stepLabel(item.step) })}
                  icon={<ArrowRight className="h-3.5 w-3.5" />}
                  iconVisible
                  iconSide="right"
                  onClick={() => go(item.step)}
                />
              </li>
            ))}
          </ul>
        </Notice>
      ) : null}
      {reviewData && report ? (
        <div className="grid gap-5 xl:grid-cols-2">
          <ReviewNumbers review={reviewData} />
          <PanelSection boxed title={tw("review.check.title")} description={tw("review.check.description")} className="xl:col-span-2">
            <div className="space-y-3">
              {report.findings.length === 0 ? (
                <Notice tone="healthy" title={tw("review.check.ready")}>
                  <p>{tLaunch("description")}</p>
                </Notice>
              ) : (
                <LaunchFindings report={report} links={{ templateId: values.templateId }} confirmed={confirmed} onConfirmedChange={setConfirmed} />
              )}
            </div>
          </PanelSection>
        </div>
      ) : review.isError ? (
        <Notice tone="fault" title={tw("review.failed")}>
          <p>{errorText({ code: (review.error as { code?: string }).code, error: review.error.message })}</p>
          <Button variant="secondary" size="sm" title={tw("review.retry")} onClick={() => void review.refetch()} />
        </Notice>
      ) : (
        <ScreenLoader fit="fill" className="min-h-[320px]" label={tw("review.loading")} />
      )}
    </div>
  );

  return (
    <main className="w-full space-y-4">
      <TourGuide
        steps={whatsappCampaignsTourSteps}
        storageKey="tour_dismissed_wc_v3"
        i18nNamespace="tourWhatsappCampaigns"
        introPalette={whatsappCampaignsTourPalette}
        introSeed={whatsappCampaignsTourSeed}
        onStep={(_index, tourStep) => {
          const target = wizardStepOfTour(tourStep);
          if (target) setStep(target);
        }}
      />
      <DashboardPageHeader
        back={{ onClick: () => router.push("/dashboard/whatsapp-campaigns"), label: t("new.backButton") }}
        icon={<WhatsappLogo className="h-5 w-5" weight="fill" />}
        badge={t("new.badge")}
        title={body.name || t("new.title")}
        description={tw("description")}
        colorClass="text-healthy-ink"
        meta={<SaveIndicator state={autosave.state} dirty={autosave.dirty} named={autosave.named} editable={canCreate} errorMessage={(error: DraftActionError) => errorText(error)} />}
      />

      <WizardNav steps={WHATSAPP_WIZARD_STEPS} current={step} labelOf={stepLabel} nextLabelOf={(item) => tw(`next.${item}`)} onGo={go} enabled={draftId !== null} />

      <section aria-label={stepLabel(step)}>
        {step === "config" ? (
          <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-basic-info">
            <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("form.basicInfo.title")}</h2>
            <div className="space-y-4">
              <CampaignNameField f={f} />
              <BusinessPhoneField f={f} />
              <PipelineField f={f} />
              <ResponseModeField f={f} />
              <CampaignToolsFields f={f} />
              <SmartCampaignSection draft={smartPolicy} contacts={audience.count?.sendable ?? 0} startAt={null} />
            </div>
          </ElevatedContainer>
        ) : null}

        {step === "message" ? (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
              <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-template">
                <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("form.basicInfo.template")}</h2>
                <TemplateField f={f} />
              </ElevatedContainer>
              <TemplatePreviewCard f={f} />
            </div>
            <CampaignExitSection exit={campaignExit} templateName={f.selectedTemplate?.name ?? ""} onUseAnotherTemplate={() => f.form.setValue("templateId", "", { shouldDirty: true })} />
            <TemplateMediaModal f={f} />
          </div>
        ) : null}

        {step === "audience" ? (
          <ElevatedContainer className="rounded-lg border border-border bg-card p-6" data-tour="wc-contacts">
            <h2 className="mb-4 font-display text-xl font-semibold tracking-[0.01em] text-foreground">{t("form.contacts.audienceTitle")}</h2>
            <CampaignAudienceStep audience={audience} message={f.selectedTemplate?.components.find((component) => component.type === "BODY")?.text ?? ""} preview={<TemplatePreviewCard f={f} confirmInfo={false} />} />
            <div className="mt-4 flex justify-end">
              <AudienceCreateHint audience={audience} />
            </div>
          </ElevatedContainer>
        ) : null}

        {step === "review" ? reviewBody : null}

        {step === "send" ? (
          <div data-tour="wc-send">
            <SendStep
              timeZone={timeZone}
              scheduledAt={null}
              scheduled={false}
              blocking={blocking}
              can={{ now: canStart, schedule: canCreate, ready: canCreate }}
              startAllowed={canStart}
              launching={launching}
              refused={refused}
              notice={
                pending.length > 0 || (report?.needsConfirmation && !confirmed) ? (
                  <Button variant="secondary" size="sm" title={tw("review.pending.fix", { step: stepLabel("review") })} onClick={() => go("review")} />
                ) : null
              }
              summary={[
                { label: tw("summary.campaign"), value: body.name || <EmptyValue /> },
                { label: tw("summary.number"), value: phone ?? <EmptyValue /> },
                { label: tw("summary.template"), value: f.selectedTemplate?.name ?? <EmptyValue /> },
                { label: tw("summary.recipients"), value: sendable === null ? <EmptyValue /> : tw("summary.recipientsValue", { count }) },
              ]}
              confirm={{
                now: { title: tw("confirm.nowTitle"), body: tw("confirm.nowBody", { count, total }) },
                schedule: (iso) => ({
                  title: tw("confirm.scheduleTitle"),
                  body: tw("confirm.scheduleBody", { date: iso ? new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone }).format(new Date(iso)) : "" }),
                }),
              }}
              onLaunch={(iso) => launch(iso ? "schedule" : "now", iso)}
              onReady={() => launch("ready", null)}
            />
          </div>
        ) : null}
      </section>

      <WizardFooterNext steps={WHATSAPP_WIZARD_STEPS} current={step} nextLabelOf={(item) => tw(`next.${item}`)} onGo={go} enabled={draftId !== null} />
    </main>
  );
}

export function WhatsAppCampaignWizard({ aiModels, modelPricing }: { aiModels: string[]; modelPricing: ModelPricingInfo[] }) {
  const t = useTranslations("whatsappCampaignsPage");
  const tShared = useTranslations("campaignWizard");
  const params = useSearchParams();
  const requested = params.get("draft");
  const initialStep = stepOf(WHATSAPP_WIZARD_STEPS, params.get("step"), "config");
  const workspaceId = useCampaignDraftsWorkspace();
  const [loadId] = useState(requested);
  const existing = useQuery({
    queryKey: [...campaignDraftsRoot(workspaceId), CHANNEL, loadId ?? "", "open"],
    enabled: loadId !== null && workspaceId !== "",
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const result = await getCampaignDraftAction<WhatsAppWizardRequest, WhatsAppWizardState>(CHANNEL, loadId ?? "", signal);
      if (isDraftActionError(result)) throw new Error(result.code ?? result.error);
      return result.data as WhatsAppCampaignDraft;
    },
  });

  if (loadId && existing.isPending) return <ScreenLoader fit="screen" />;
  if (loadId && existing.isError) {
    return (
      <main className="w-full space-y-4">
        <Notice tone="fault" title={tShared("loadFailed")}>
          <Button variant="secondary" size="sm" title={t("new.backButton")} link="/dashboard/whatsapp-campaigns" newTab={false} />
        </Notice>
      </main>
    );
  }
  return <WizardBody key={loadId ?? "new"} initial={loadId ? (existing.data ?? null) : null} initialStep={loadId ? initialStep : "config"} aiModels={aiModels} modelPricing={modelPricing} />;
}
