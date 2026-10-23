"use client";

import { useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { isEmailActionError, launchEmailCampaignAction, readyEmailCampaignAction, type EmailActionResult } from "@/app/actions/email-campaigns";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import { EnvelopeSimple } from "@/components/icons";
import { SaveIndicator } from "@/components/campaign-wizard/SaveIndicator";
import { WizardFooterNext, WizardNav } from "@/components/campaign-wizard/WizardNav";
import { Notice } from "@/components/ui/notice";
import { useWorkspace } from "@/contexts/workspace-context";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { emailCampaignKey, emailCampaignReviewKey, emailCampaignsRoot, useEmailCampaign, useEmailCampaignReview, useEmailSenders } from "@/hooks/use-email-campaigns";
import { sectionErrorCode } from "@/lib/analytics/section-query";
import { readableFields } from "@/lib/crm/custom-fields";
import type { CustomField } from "@/lib/email-design/merge-tags";
import type { Issue } from "@/lib/email-design/types";
import type { AudienceDraft } from "@/lib/campaign-audience/draft";
import { campaignRequest, draftOf, emptyDraft, requestFingerprint, type CampaignDraft } from "@/lib/email-campaigns/draft";
import { WIZARD_STEPS, wizardStepOf, type IssueFix, type WizardStep } from "@/lib/email-campaigns/review";
import { canRun, isWizardStatus, wizardHref } from "@/lib/email-campaigns/status";
import type { Campaign, LaunchIssue } from "@/lib/email-campaigns/types";

import { EmailCampaignStatusChip, useEmailErrorMessage, useEmailPermission } from "../shared";
import { useCampaignCommands } from "../use-campaign-commands";
import { ContentStep } from "./ContentStep";
import { EmailAudienceStep } from "./EmailAudienceStep";
import { AudiencePanel, CostPanel, LaunchCheckPanel, MergeTagsPanel, TestBatchPanel, useMoney } from "./ReviewPanels";
import { SendStep } from "./SendStep";
import { useCampaignAutosave } from "./use-autosave";
import { useEmailPreview } from "./use-preview";

function issuesOfReview(blocking: readonly LaunchIssue[]): Issue[] {
  return blocking.filter((issue) => issue.code === "document_invalid" || issue.code === "subject_invalid").flatMap((issue) => issue.issues ?? []);
}

interface WizardBodyProps {
  initial: Campaign | null;
  initialStep: WizardStep;
  onCreated: (campaign: Campaign) => void;
}

function WizardBody({ initial, initialStep, onCreated }: WizardBodyProps) {
  const t = useTranslations("emailCampaigns");
  const router = useRouter();
  const client = useQueryClient();
  const allowed = useEmailPermission();
  const errorMessage = useEmailErrorMessage();
  const { currentWorkspace } = useWorkspace();
  const workspaceId = currentWorkspace?.id ?? "";
  const fields = useLeadFieldDefinitions();
  const senders = useEmailSenders();

  const [campaignId, setCampaignId] = useState<string | null>(initial?.id ?? null);
  const [draft, setDraft] = useState<CampaignDraft>(() => (initial ? draftOf(initial) : emptyDraft()));
  const [baseline] = useState(() => requestFingerprint(campaignRequest(initial ? draftOf(initial) : emptyDraft())));
  const [step, setStep] = useState<WizardStep>(initialStep);
  const [launching, setLaunching] = useState(false);
  const [launchIssues, setLaunchIssues] = useState<LaunchIssue[]>([]);

  const live = useEmailCampaign(campaignId ?? "");
  const campaign = live.data ?? initial;
  const status = campaign?.status ?? "draft";
  const editable = campaign ? canRun(campaign.actions, "edit", allowed) : allowed("create");

  const onSaved = useCallback(
    (saved: Campaign, created: boolean) => {
      client.setQueryData(emailCampaignKey(workspaceId, saved.id), saved);
      if (created) {
        setCampaignId(saved.id);
        onCreated(saved);
      }
      void client.invalidateQueries({ queryKey: [...emailCampaignsRoot(workspaceId), "list"] });
    },
    [client, onCreated, workspaceId],
  );

  const autosave = useCampaignAutosave({ campaignId, baseline, draft, editable, onSaved });
  const preview = useEmailPreview(draft.document, draft.subject || undefined);

  const reviewVersion = campaign ? `${campaign.updated_at}|${campaign.status}` : "none";
  const review = useEmailCampaignReview(campaignId ?? "", campaignId !== null && step !== "content" && !autosave.dirty, reviewVersion);
  const reviewData = review.data;
  const money = useMoney(reviewData?.exchange_rate ?? null);
  const reviewFailed = review.isError ? errorMessage({ code: sectionErrorCode(review.error) }) : null;

  const customFields = useMemo<CustomField[]>(() => readableFields(fields.definitions).filter((field) => !field.sensitive).map((field) => ({ key: field.key, label: field.label })), [fields.definitions]);
  const sender = (senders.data ?? []).find((item) => item.id === draft.senderId) ?? (senders.data ?? []).find((item) => item.is_default);

  const commands = useCampaignCommands();

  const patch = useCallback((next: Partial<CampaignDraft>) => setDraft((current) => ({ ...current, ...next })), []);
  const setAudience = useCallback((audience: AudienceDraft) => patch({ audience }), [patch]);
  const refreshReview = useCallback(() => {
    if (campaignId) void client.invalidateQueries({ queryKey: emailCampaignReviewKey(workspaceId, campaignId) });
  }, [client, workspaceId, campaignId]);

  const go = useCallback(
    (next: WizardStep) => {
      setStep(next);
      if (campaignId) router.replace(wizardHref(campaignId, next), { scroll: false });
      if (typeof window !== "undefined") window.scrollTo?.({ top: 0, behavior: "smooth" });
    },
    [campaignId, router],
  );

  const fix = (target: IssueFix) => {
    if (target.kind === "step") go(target.step);
    else if (target.kind === "link") router.push(target.href);
  };

  const submit = async (run: (id: string) => Promise<EmailActionResult<Campaign>>, done: string): Promise<boolean> => {
    if (!campaignId) return false;
    setLaunching(true);
    setLaunchIssues([]);
    const ready = await autosave.save();
    if (!ready) {
      setLaunching(false);
      toast.error(t("send.saveFirst"));
      return false;
    }
    const result = await run(campaignId);
    setLaunching(false);
    if (isEmailActionError(result)) {
      const issues = Array.isArray(result.details?.issues) ? (result.details.issues as LaunchIssue[]) : [];
      setLaunchIssues(issues);
      toast.error(t("send.failed"), { description: errorMessage(result) });
      await client.invalidateQueries({ queryKey: emailCampaignKey(workspaceId, campaignId) });
      return false;
    }
    toast.success(done);
    await client.invalidateQueries({ queryKey: emailCampaignsRoot(workspaceId) });
    router.push(`/dashboard/email/campaigns/${campaignId}`);
    return true;
  };

  const launch = (scheduledAt: string | null) =>
    submit((id) => launchEmailCampaignAction(id, scheduledAt ?? undefined), scheduledAt ? t("send.scheduled") : t("send.started"));

  const leaveReady = () => submit(readyEmailCampaignAction, t("send.readied"));

  const reviewBody = reviewData ? (
    <div className="grid gap-5 xl:grid-cols-2">
      <AudiencePanel audience={reviewData.audience} />
      <MergeTagsPanel variables={reviewData.audience.variables ?? []} />
      <CostPanel review={reviewData} />
      {reviewData.test_batch > 0 ? <TestBatchPanel review={reviewData} /> : null}
      <LaunchCheckPanel review={reviewData} money={money} onFix={fix} />
    </div>
  ) : reviewFailed ? (
    <Notice tone="fault" title={t("review.failed")}>
      <p>{reviewFailed}</p>
    </Notice>
  ) : (
    <ScreenLoader fit="fill" className="min-h-[320px]" label={t("review.loading")} />
  );

  return (
    <main className="w-full space-y-4">
      <DashboardPageHeader
        icon={<EnvelopeSimple className="h-6 w-6" weight="fill" />}
        badge={campaign ? t("wizard.editTitle") : t("wizard.newTitle")}
        title={draft.name.trim() || undefined}
        description={t("wizard.description")}
        back={{ onClick: () => router.push("/dashboard/email/campaigns"), label: t("wizard.back") }}
        meta={
          <>
            {campaign ? <EmailCampaignStatusChip status={status} holdReason={campaign.hold_reason} scheduledAt={campaign.scheduled_at} /> : null}
            <SaveIndicator state={autosave.state} dirty={autosave.dirty} named={autosave.named} editable={editable} errorMessage={errorMessage} />
          </>
        }
      />

      <WizardNav
        steps={WIZARD_STEPS}
        current={step}
        labelOf={(item) => t(`wizard.steps.${item}`)}
        nextLabelOf={(item) => t(`wizard.next.${item}`)}
        onGo={go}
        enabled={campaignId !== null}
      />

      <section aria-label={t(`wizard.steps.${step}`)}>
        {step === "content" ? (
          <ContentStep
            draft={draft}
            onDraftChange={patch}
            customFields={customFields}
            campaignId={campaignId}
            readOnly={!editable}
            prepare={autosave.save}
            preview={preview}
            reviewIssues={reviewData ? issuesOfReview(reviewData.check.blocking) : []}
            reviewHints={reviewData?.check.hints ?? []}
          />
        ) : null}
        {step === "audience" ? (
          <EmailAudienceStep initial={draft.audience} subject={draft.subject} document={draft.document} readOnly={!editable} onAudienceChange={setAudience} onCounted={refreshReview} />
        ) : null}
        {step === "review" ? reviewBody : null}
        {step === "send" && campaign ? (
          <SendStep
            campaign={campaign}
            review={reviewData}
            sender={sender}
            money={money}
            canLaunch={canRun(campaign.actions, "launch", allowed)}
            canSchedule={canRun(campaign.actions, "schedule", allowed)}
            canReady={canRun(campaign.actions, "ready", allowed)}
            canUnschedule={canRun(campaign.actions, "unschedule", allowed)}
            startAllowed={allowed("start")}
            launching={launching}
            launchIssues={launchIssues}
            onLaunch={launch}
            onReady={leaveReady}
            onUnschedule={() => void commands.run("unschedule", campaign.id)}
          />
        ) : null}
      </section>

      <WizardFooterNext steps={WIZARD_STEPS} current={step} nextLabelOf={(item) => t(`wizard.next.${item}`)} onGo={go} enabled={campaignId !== null} />
    </main>
  );
}

export function EmailCampaignWizard() {
  const t = useTranslations("emailCampaigns");
  const router = useRouter();
  const params = useSearchParams();
  const requested = params.get("campaign");
  const initialStep = wizardStepOf(params.get("step"));
  const [createdId, setCreatedId] = useState<string | null>(null);
  const loadId = requested && requested !== createdId ? requested : null;
  const existing = useEmailCampaign(loadId ?? "");

  const onCreated = useCallback(
    (campaign: Campaign) => {
      setCreatedId(campaign.id);
      router.replace(wizardHref(campaign.id), { scroll: false });
    },
    [router],
  );

  const launched = loadId !== null && existing.data !== undefined && !isWizardStatus(existing.data.status) && existing.data.status !== "scheduled";

  useEffect(() => {
    if (launched && loadId) router.replace(`/dashboard/email/campaigns/${loadId}`);
  }, [launched, loadId, router]);

  if (loadId && existing.isPending) return <ScreenLoader fit="screen" />;
  if (loadId && existing.isError) {
    return (
      <main className="w-full space-y-4">
        <Notice tone="fault" title={t("wizard.loadFailed")}>
          <Button variant="secondary" size="sm" title={t("wizard.back")} link="/dashboard/email/campaigns" newTab={false} />
        </Notice>
      </main>
    );
  }
  if (launched) return <ScreenLoader fit="screen" />;

  return <WizardBody key={loadId ?? "new"} initial={loadId ? (existing.data ?? null) : null} initialStep={initialStep} onCreated={onCreated} />;
}
