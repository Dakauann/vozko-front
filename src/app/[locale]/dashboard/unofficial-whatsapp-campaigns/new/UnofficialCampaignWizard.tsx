"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useFormatter, useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
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
import { SaveIndicator } from "@/components/campaign-wizard/SaveIndicator";
import { SendStep, type SendMode, type SendRefusal } from "@/components/campaign-wizard/SendStep";
import { campaignDraftsRoot, useCampaignDraftsWorkspace } from "@/components/campaign-wizard/use-campaign-drafts";
import { useDraftAutosave, type DraftSaveResult } from "@/components/campaign-wizard/use-draft-autosave";
import { useLaunchAnnouncer } from "@/components/campaign-wizard/use-launch-announcer";
import { WizardFooterNext, WizardNav } from "@/components/campaign-wizard/WizardNav";
import { ChannelTile } from "@/components/channels/channel-tile";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import ElevatedContainer from "@/components/elevated-design/elevated-container";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { Notice } from "@/components/ui/notice";
import { DEFAULT_SEND_DELAY_MS } from "@/components/unofficial-whatsapp/campaign-pacing-panel";
import { useWorkspace } from "@/contexts/workspace-context";
import type { ModelPricingInfo } from "@/lib/agents/types";
import { codedErrorMessage } from "@/lib/api/coded-error";
import { launchRefusalOf, type DraftLaunchResult, type DraftSaveRequest } from "@/lib/campaign-drafts/types";
import { stepNeighbours, stepOf } from "@/lib/campaign-wizard/steps";
import type { GroupPrefill } from "@/lib/unofficial-whatsapp-campaigns/group-audience";
import type { UnofficialWhatsAppCampaign } from "@/lib/unofficial-whatsapp-campaigns/types";
import { LAUNCH_REFUSAL_CODES } from "@/lib/whatsapp-campaigns/launch-check";
import { browserTimezone } from "@/lib/working-hours/types";

import {
  emptySeed,
  seedFromDraft,
  wizardRequest,
  WIZARD_STEPS,
  type UnofficialCampaignDraft,
  type WizardRequest,
  type WizardState,
  type WizardStep,
} from "./campaign-form-model";
import { BasicFields, GroupsAudience, LeadsAudience, MessageFields, MessagePreview, ResponseFields } from "./campaign-form-sections";
import { useUnofficialCampaignForm } from "./use-unofficial-campaign-form";
import { blockingOf, WizardReview } from "./WizardReview";

const CHANNEL = "unofficial_whatsapp" as const;
const AUTOSAVE_DELAY_MS = 1000;
const LIST_PATH = "/dashboard/unofficial-whatsapp-campaigns";

type DraftBody = DraftSaveRequest<WizardRequest, WizardState>;

async function storeDraft(id: string | null, body: DraftBody): Promise<DraftSaveResult<UnofficialCampaignDraft, DraftActionError>> {
  const result = id ? await updateCampaignDraftAction(CHANNEL, id, body) : await createCampaignDraftAction(CHANNEL, body);
  return isDraftActionError(result) ? { error: result } : { data: result.data };
}

const draftIdOf = (draft: UnofficialCampaignDraft) => draft.id;

function wizardHref(id: string, step: WizardStep): string {
  return `${LIST_PATH}/new?draft=${encodeURIComponent(id)}&step=${step}`;
}

interface WizardProps {
  aiModels: string[];
  modelPricing: ModelPricingInfo[];
  groupPrefill: GroupPrefill | null;
}

function WizardBody({ aiModels, modelPricing, groupPrefill, initialDraft, initialStep }: WizardProps & { initialDraft: UnofficialCampaignDraft | null; initialStep: WizardStep | null }) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const tWizard = useTranslations("campaignWizard");
  const tCheck = useTranslations("launchCheck");
  const announce = useLaunchAnnouncer();
  const format = useFormatter();
  const router = useRouter();
  const client = useQueryClient();
  const workspaceId = useCampaignDraftsWorkspace();
  const { can } = useWorkspace();
  const canCreate = can("unofficial_whatsapp_campaigns", "create");
  const canStart = can("unofficial_whatsapp_campaigns", "start");

  const [restored] = useState(() => (initialDraft ? seedFromDraft(initialDraft, DEFAULT_SEND_DELAY_MS) : { seed: emptySeed(groupPrefill, DEFAULT_SEND_DELAY_MS), step: "config" as WizardStep }));
  const [baseline] = useState(() => (initialDraft ? JSON.stringify({ name: initialDraft.name, payload: initialDraft.payload }) : ""));
  const [draftId, setDraftId] = useState<string | null>(initialDraft?.id ?? null);
  const [step, setStep] = useState<WizardStep>(initialStep ?? restored.step);
  const [launching, setLaunching] = useState(false);
  const [refused, setRefused] = useState<SendRefusal[]>([]);

  const prefillIgnored = initialDraft !== null && groupPrefill !== null && restored.seed.audience !== "groups";
  const campaignForm = useUnofficialCampaignForm({ mode: "create", seed: restored.seed, groupPrefill: prefillIgnored ? null : groupPrefill });
  const { form, isGroups, pickedGroups, responseMode, leadsAudience, seedOutcome, dealPipelineId, numberUnusable, messageGate, audienceGate, payload, refusalOf, selectedInstance } = campaignForm;
  const values = form.watch();

  const body = useMemo<DraftBody>(() => {
    const request = wizardRequest(payload(values), dealPipelineId);
    const state: WizardState = { step, responseMode, pickedGroups, audienceDraft: leadsAudience.draft, seed: seedOutcome };
    return { name: request.name, payload: { request, state } };
  }, [payload, values, dealPipelineId, step, responseMode, pickedGroups, leadsAudience.draft, seedOutcome]);
  const fingerprint = useMemo(() => JSON.stringify(body), [body]);
  const requestFingerprint = useMemo(() => JSON.stringify(body.payload.request), [body]);

  const onSaved = useCallback(
    (saved: UnofficialCampaignDraft, created: boolean) => {
      if (created) {
        setDraftId(saved.id);
        router.replace(wizardHref(saved.id, step), { scroll: false });
      }
      void client.invalidateQueries({ queryKey: campaignDraftsRoot(workspaceId) });
    },
    [client, router, step, workspaceId],
  );

  const autosave = useDraftAutosave({
    recordId: draftId,
    baseline,
    request: body,
    fingerprint,
    named: body.name !== "",
    editable: canCreate,
    delayMs: AUTOSAVE_DELAY_MS,
    save: storeDraft,
    idOf: draftIdOf,
    onSaved,
  });

  const errorMessage = useCallback((error: DraftActionError) => codedErrorMessage(tWizard, error, error.error || tWizard("errors.generic")), [tWizard]);

  const reviewing = step === "review" || step === "send";
  const review = useQuery({
    queryKey: ["unofficial-campaign-draft-review", workspaceId, draftId, requestFingerprint],
    enabled: reviewing && draftId !== null && !autosave.dirty,
    refetchOnWindowFocus: false,
    queryFn: async ({ signal }) => {
      const result = await reviewCampaignDraftAction(CHANNEL, draftId ?? "", signal);
      if (isDraftActionError(result)) throw new Error(errorMessage(result));
      return result.data;
    },
  });

  const configGate = async (): Promise<string | null> => {
    const valid = await form.trigger(["name", "instanceId"]);
    if (!valid) {
      const errors = form.formState.errors;
      return errors.name?.message ?? errors.instanceId?.message ?? t("form.nameRequired");
    }
    if (numberUnusable) return t("wizard.gate.numberUnusable");
    return null;
  };

  const gateOf = async (from: WizardStep): Promise<string | null> => {
    if (from === "config") return configGate();
    if (from === "message") return messageGate();
    if (from === "audience") return audienceGate();
    if (from === "review") return review.data ? null : t("wizard.gate.review");
    return null;
  };

  const go = async (target: WizardStep) => {
    const from = WIZARD_STEPS.indexOf(step);
    const to = WIZARD_STEPS.indexOf(target);
    for (const passed of WIZARD_STEPS.slice(from, Math.max(from, to))) {
      const reason = await gateOf(passed);
      if (reason) {
        toast.error(t("wizard.gate.title"), { description: reason });
        return;
      }
    }
    if (target === "review" || target === "send") await autosave.save();
    setStep(target);
    if (draftId) router.replace(wizardHref(draftId, target), { scroll: false });
    if (typeof window !== "undefined") window.scrollTo?.({ top: 0, behavior: "smooth" });
  };

  const launch = async (mode: SendMode, scheduledAt: string | null): Promise<boolean> => {
    if (!draftId) return false;
    setLaunching(true);
    setRefused([]);
    const saved = await autosave.save();
    if (!saved) {
      setLaunching(false);
      toast.error(tWizard("toast.saveFirst"));
      return false;
    }
    const result = await launchCampaignDraftAction<UnofficialWhatsAppCampaign>(CHANNEL, draftId, { mode, ...(scheduledAt ? { scheduledStart: scheduledAt } : {}) });
    setLaunching(false);
    if (isDraftActionError(result)) {
      if (result.code && LAUNCH_REFUSAL_CODES.has(result.code)) {
        const details = launchRefusalOf(result.details);
        setRefused([...details.blocks, ...details.confirms].map((code) => ({ key: code, text: tCheck.has(`codes.${code}.title`) ? tCheck(`codes.${code}.title`) : code })));
        void review.refetch();
      } else if (result.code === "selection_changed") {
        leadsAudience.recount();
      }
      toast.error(tWizard("toast.failed"), { description: codedErrorMessage(tWizard, result, refusalOf(result.code, result.error)) });
      return false;
    }
    finish(result.data);
    return true;
  };

  const finish = (outcome: DraftLaunchResult<UnofficialWhatsAppCampaign>) => {
    announce(outcome, (code) => (tCheck.has(`codes.${code}.title`) ? tCheck(`codes.${code}.title`) : null));
    void client.invalidateQueries({ queryKey: campaignDraftsRoot(workspaceId) });
    router.push(`${LIST_PATH}/${outcome.campaign?.id ?? ""}`);
  };

  const reviewData = review.data;
  const sendable = reviewData?.audience?.sendable ?? null;
  const summary = [
    { label: t("wizard.summary.campaign"), value: values.name.trim() || <EmptyValue /> },
    { label: t("wizard.summary.sender"), value: isGroups ? t("table.senderPerGroup") : (selectedInstance?.displayName || selectedInstance?.phoneNumber || <EmptyValue />) },
    {
      label: t("wizard.summary.audience"),
      value: sendable === null ? <EmptyValue /> : isGroups ? t("wizard.review.groupsValue", { count: sendable }) : t("wizard.review.leadsValue", { count: sendable }),
    },
    { label: t("wizard.summary.variants"), value: String(campaignForm.message.bodies.length) },
  ];
  const timeZone = browserTimezone();

  const labelOf = (item: WizardStep) => t(`wizard.steps.${item}`);
  const nextLabelOf = (item: WizardStep) => t(`wizard.next.${item}`);
  const { next } = stepNeighbours(WIZARD_STEPS, step);
  const disabled = launching || !canCreate;

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        back={{ onClick: () => router.push(LIST_PATH), label: t("form.back") }}
        icon={<ChannelTile channel="unofficial_whatsapp" size="sm" />}
        badge={t("new.badge")}
        title={values.name.trim() || t("new.title")}
        description={t("wizard.description")}
        colorClass="text-healthy-ink"
        meta={<SaveIndicator state={autosave.state} dirty={autosave.dirty} named={autosave.named} editable={canCreate} errorMessage={errorMessage} />}
      />

      <WizardNav steps={WIZARD_STEPS} current={step} labelOf={labelOf} nextLabelOf={nextLabelOf} onGo={(target) => void go(target)} enabled={draftId !== null} />

      {prefillIgnored ? (
        <Notice tone="info">
          <p>{t("wizard.prefillIgnored")}</p>
        </Notice>
      ) : null}

      <section aria-label={labelOf(step)}>
        {step === "config" ? (
          <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
            <div className="space-y-4">
              <BasicFields form={campaignForm} />
              <ResponseFields form={campaignForm} aiModels={aiModels} modelPricing={modelPricing} disabled={disabled} showSchedule={false} />
            </div>
          </ElevatedContainer>
        ) : null}

        {step === "message" ? (
          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start">
            <ElevatedContainer className="rounded-lg border border-border bg-card p-6">
              <MessageFields form={campaignForm} disabled={disabled} divided={false} />
            </ElevatedContainer>
            <MessagePreview form={campaignForm} />
          </div>
        ) : null}

        {step === "audience" ? isGroups ? <GroupsAudience form={campaignForm} disabled={disabled} /> : <LeadsAudience form={campaignForm} disabled={disabled} /> : null}

        {step === "review" ? (
          reviewData ? (
            <WizardReview review={reviewData} isGroups={isGroups} picked={pickedGroups} />
          ) : review.isError ? (
            <Notice tone="fault" title={t("wizard.review.failed")}>
              <p>{review.error.message}</p>
            </Notice>
          ) : (
            <ScreenLoader fit="fill" className="min-h-[320px]" label={t("wizard.review.loading")} />
          )
        ) : null}

        {step === "send" ? (
          <SendStep
            timeZone={timeZone}
            scheduledAt={null}
            scheduled={false}
            blocking={blockingOf(reviewData)}
            can={{ now: canStart, schedule: canCreate, ready: canCreate }}
            startAllowed={canStart}
            launching={launching}
            refused={refused}
            summary={summary}
            confirm={{
              now: { title: t("wizard.confirm.nowTitle"), body: t("wizard.confirm.nowBody", { count: sendable ?? 0 }) },
              schedule: (iso) => ({
                title: t("wizard.confirm.scheduleTitle"),
                body: t("wizard.confirm.scheduleBody", { date: iso ? format.dateTime(new Date(iso), { dateStyle: "short", timeStyle: "short", timeZone }) : "" }),
              }),
            }}
            onLaunch={(iso) => launch(iso ? "schedule" : "now", iso)}
            onReady={() => launch("ready", null)}
          />
        ) : null}
      </section>

      {next ? <WizardFooterNext steps={WIZARD_STEPS} current={step} nextLabelOf={nextLabelOf} onGo={(target) => void go(target)} enabled={draftId !== null} /> : null}
      {draftId === null ? <p className="text-right text-2xs text-muted-foreground">{t("wizard.nameFirst")}</p> : null}
    </main>
  );
}

export function UnofficialCampaignWizard(props: WizardProps) {
  const t = useTranslations("unofficialWhatsappCampaigns");
  const tShared = useTranslations("campaignWizard");
  const params = useSearchParams();
  const requested = params.get("draft");
  const requestedStep = params.get("step");
  const [loadId] = useState(requested);
  const draft = useQuery({
    queryKey: ["unofficial-campaign-draft", loadId],
    enabled: loadId !== null,
    refetchOnWindowFocus: false,
    staleTime: Infinity,
    queryFn: async ({ signal }) => {
      const result = await getCampaignDraftAction<WizardRequest, WizardState>(CHANNEL, loadId ?? "", signal);
      if (isDraftActionError(result)) throw new Error(result.code ?? result.error);
      return result.data;
    },
  });

  if (loadId && draft.isPending) return <ScreenLoader fit="screen" />;
  if (loadId && draft.isError) {
    return (
      <main className="w-full space-y-4">
        <Notice tone="fault" title={tShared("loadFailed")}>
          <Button variant="secondary" size="sm" title={t("form.back")} link={LIST_PATH} newTab={false} />
        </Notice>
      </main>
    );
  }
  const initialStep = requestedStep ? stepOf(WIZARD_STEPS, requestedStep, "config") : null;
  return <WizardBody key={loadId ?? "new"} {...props} initialDraft={loadId ? (draft.data ?? null) : null} initialStep={initialStep} />;
}
