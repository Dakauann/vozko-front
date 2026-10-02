"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  getAdEditableObjectAction,
  isAdsError,
  listAdPagesAction,
  updateAdObjectAction,
  type AdsResult,
} from "@/app/actions/advertising";
import { getAdsOptionsAction, publishMetaAdDraftAction, validateMetaAdDraftAction } from "@/app/actions/advertising-create";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { ElevatedStepper } from "@/components/elevated-design/elevated-stepper";
import { ArrowLeft, ArrowRight, Megaphone, PaperPlaneTilt, Trash, Warning } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { ADVERTISING_PATH, managerHref, pickAccountId } from "@/lib/advertising/connect";
import { civilToday } from "@/lib/advertising/date-range";
import {
  buildCreative,
  buildDraft,
  emptyWizardForm,
  parentFromRow,
  withCreativeEdit,
  withParents,
  type CreativeSource,
  type ParentSummary,
  type WizardForm,
} from "@/lib/advertising/draft";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import { withBudgetMinimum } from "@/lib/advertising/issues";
import { jobPlan, publishBlockers, publishedCampaignId, type ValidationState } from "@/lib/advertising/publish";
import type { AdAccount, AdPublishJob } from "@/lib/advertising/types";
import {
  adIndexOfIssue,
  issuesFromCreativeEdit,
  issuesFromExpected,
  stepOfIssue,
  stepsFor,
  type DraftIssue,
  type WizardStep,
} from "@/lib/advertising/wizard-issues";
import {
  clearWizard,
  readWizard,
  storedMatchesEntry,
  writeWizard,
  type StoredWizard,
  type WizardEntry,
} from "@/lib/advertising/wizard-storage";
import { formatWhen } from "@/lib/advertising/when";

import { AdPreviewPanel } from "../ad-preview-panel";
import { WizardReadinessBanner } from "../readiness";
import { useAdReadiness } from "../use-ad-readiness";
import { useAdsErrorText, type AdsErrorLike } from "../use-ads-error";
import { useAdsFormat } from "../use-ads-format";
import { AdSetStep } from "./ad-set-step";
import { AdsStep } from "./ads-step";
import { CampaignStep } from "./campaign-step";
import { DraftChoice } from "./draft-choice";
import { ObjectiveStep } from "./objective-step";
import { previewContent } from "./preview-content";
import { PublishProgress } from "./publish-progress";
import { ReviewStep } from "./review-step";
import { useAdsResource } from "./use-ads-resource";
import { usePublishJob } from "./use-publish-job";
import { WizardProvider, type WizardContextValue } from "./wizard-context";

interface Parents {
  campaign: ParentSummary | null;
  adSet: ParentSummary | null;
  ad: CreativeSource | null;
}

async function loadAd(adId: string): Promise<AdsResult<{ ad: CreativeSource; adSetId?: string; campaignId?: string }>> {
  const result = await getAdEditableObjectAction(adId);
  if (isAdsError(result)) return result;
  const { row, creative, identity } = result.data;
  if (!creative) return { error: "creative_unavailable" };
  return {
    data: {
      ad: {
        metaId: row.metaId,
        name: row.name,
        creative,
        previewUrl: row.creative?.imageUrl ?? row.creative?.thumbnailUrl,
        pageId: identity?.pageId,
        instagramUserId: identity?.instagramUserId,
      },
      adSetId: row.adSetId,
      campaignId: row.campaignId,
    },
  };
}

async function loadParents(entry: WizardEntry): Promise<AdsResult<Parents>> {
  let ad: CreativeSource | null = null;
  let adSetId = entry.adSetId;
  let campaignId = entry.campaignId;
  if (entry.adId) {
    const loaded = await loadAd(entry.adId);
    if (isAdsError(loaded)) return loaded;
    ad = loaded.data.ad;
    adSetId = loaded.data.adSetId ?? adSetId;
    campaignId = loaded.data.campaignId ?? campaignId;
  }
  let adSet: ParentSummary | null = null;
  if (adSetId) {
    const result = await getAdEditableObjectAction(adSetId);
    if (isAdsError(result)) return result;
    adSet = parentFromRow(result.data.row);
    campaignId = result.data.row.campaignId ?? campaignId;
  }
  if (!campaignId) return { data: { campaign: null, adSet, ad } };
  const result = await getAdEditableObjectAction(campaignId);
  if (isAdsError(result)) return result;
  return { data: { campaign: parentFromRow(result.data.row), adSet, ad } };
}

function stepReady(step: WizardStep, form: WizardForm): boolean {
  switch (step) {
    case "objective":
      if (!form.accountId) return false;
      if (form.mode === "new") return !!form.objective;
      return form.mode === "campaign" ? !!form.campaignParent : !!form.adSetParent;
    case "campaign":
      return form.campaignName.trim() !== "";
    case "adSet":
      return !!form.destination && !!form.goal && form.targeting.locations.length > 0;
  }
  return true;
}

export function AdWizard() {
  const t = useTranslations("adsWizard");
  const router = useRouter();
  const searchParams = useSearchParams();
  const { can, permissionsLoading, currentWorkspace } = useWorkspace();
  const canCreate = !permissionsLoading && can("ads", "create");
  const entry: WizardEntry = useMemo(
    () => ({
      accountId: searchParams.get("accountId") ?? searchParams.get("account"),
      adId: searchParams.get("adId"),
      campaignId: searchParams.get("campaignId"),
      adSetId: searchParams.get("adSetId"),
    }),
    [searchParams],
  );
  const accountsState = useAdAccounts({ enabled: canCreate, requested: entry.accountId });
  const options = useAdsResource(canCreate ? "ads-options" : null, getAdsOptionsAction);
  const hasParents = !!entry.adId || !!entry.campaignId || !!entry.adSetId;
  const parents = useAdsResource<Parents>(
    canCreate && hasParents ? `parents:${entry.adId}:${entry.campaignId}:${entry.adSetId}` : null,
    () => loadParents(entry),
  );
  const accounts = accountsState.accounts;
  const workspaceId = currentWorkspace?.id ?? "";

  const header = (
    <DashboardPageHeader
      badge={entry.adId ? t("editTitle") : t("title")}
      description={entry.adId ? t("editDescription") : t("description")}
      icon={<Megaphone className="h-6 w-6" />}
      back={{ onClick: () => router.push(ADVERTISING_PATH), label: t("back") }}
    />
  );

  const shell = (body: ReactNode) => (
    <div className="w-full space-y-6">
      {header}
      {body}
    </div>
  );

  if (permissionsLoading || (canCreate && (accountsState.loading || options.status === "loading" || parents.status === "loading"))) {
    return shell(<div className="h-64 animate-pulse rounded-[--radius] bg-muted" />);
  }
  if (!canCreate) return shell(<p className="text-sm text-muted-foreground">{t("noAccess")}</p>);
  const failure = accountsState.error ?? (options.status === "error" ? options.message : null);
  if (failure || options.status !== "ready") {
    return shell(
      <p className="flex items-center gap-2 text-sm text-destructive-ink">
        <Warning className="h-4 w-4" />
        {failure ?? t("optionsError")}
      </p>,
    );
  }
  if (accounts.length === 0) {
    return shell(
      <div className="space-y-2 rounded-[--radius] border border-border bg-card p-6 shadow-sm">
        <p className="font-display text-base font-semibold text-foreground">{t("noAccountTitle")}</p>
        <p className="text-sm text-muted-foreground">{t("noAccountBody")}</p>
        <Button variant="secondary" title={t("back")} onClick={() => router.push(ADVERTISING_PATH)} />
      </div>,
    );
  }

  const parentError = parents.status === "error" ? parents.message : null;
  const loadedParents = parents.status === "ready" ? parents.data : null;
  const accountId = pickAccountId(
    accounts.map((account) => account.id),
    entry.accountId,
    accountsState.selected?.id,
  );

  return (
    <WizardBody
      key={`${workspaceId}:${entry.accountId}:${entry.adId}:${entry.campaignId}:${entry.adSetId}`}
      header={header}
      workspaceId={workspaceId}
      accounts={accounts}
      options={options.data}
      onAccountUpdated={accountsState.replace}
      entry={entry}
      parentError={parentError}
      initial={() => {
        const empty = emptyWizardForm(accountId ?? "");
        const campaign = loadedParents?.campaign ?? null;
        const adSet = loadedParents?.adSet ?? null;
        const fresh = loadedParents?.ad ? withCreativeEdit(empty, campaign, adSet, loadedParents.ad) : withParents(empty, campaign, adSet);
        return { fresh, stored: workspaceId ? readWizard(workspaceId) : null };
      }}
      canGenerate={canCreate}
    />
  );
}

function WizardBody({
  header,
  workspaceId,
  accounts,
  onAccountUpdated,
  options,
  entry,
  parentError,
  initial,
  canGenerate,
}: {
  header: ReactNode;
  workspaceId: string;
  accounts: AdAccount[];
  options: AdsOptions;
  entry: WizardEntry;
  parentError: string | null;
  initial: () => { fresh: WizardForm; stored: StoredWizard | null };
  canGenerate: boolean;
  onAccountUpdated: (account: AdAccount) => void;
}) {
  const t = useTranslations("adsWizard");
  const fmt = useAdsFormat();
  const router = useRouter();
  const errorText = useAdsErrorText();
  const [start] = useState(() => {
    const { fresh, stored } = initial();
    const usable = stored && storedMatchesEntry(stored, entry) && accounts.some((account) => account.id === stored.form.accountId);
    return { fresh, stored: usable ? stored : null };
  });
  const [pendingDraft, setPendingDraft] = useState<StoredWizard | null>(start.stored);
  const [form, setForm] = useState<WizardForm>(start.fresh);
  const [stepId, setStepId] = useState<WizardStep>(stepsFor(start.fresh.mode)[0]);
  const [restoredAt, setRestoredAt] = useState("");
  const [activeAd, setActiveAd] = useState(0);
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<AdsErrorLike | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [now] = useState(() => new Date());

  const account = accounts.find((candidate) => candidate.id === form.accountId);
  const readiness = useAdReadiness(account, onAccountUpdated);
  const pages = useAdsResource(form.accountId ? `pages:${form.accountId}` : null, () => listAdPagesAction(form.accountId));
  const page = pages.status === "ready" ? pages.data.find((candidate) => candidate.pageId === form.pageId) : undefined;
  const today = account ? civilToday(account.timezone, now) : null;
  const steps = stepsFor(form.mode);
  const step = steps.includes(stepId) ? stepId : steps[0];
  const editing = form.mode === "creative";
  const stepIndex = steps.indexOf(step);

  const draftFor = (target: WizardForm) => {
    const owner = accounts.find((candidate) => candidate.id === target.accountId);
    return buildDraft(target, { timezone: owner?.timezone ?? "", currency: owner?.currency ?? "" });
  };
  const draft = draftFor(form);
  const editedCreative = editing && form.ads[0] ? buildCreative(form.ads[0], form.destination) : null;
  const draftKey = JSON.stringify(editedCreative ?? draft);
  const issues: DraftIssue[] = validation.status === "done" ? validation.issues : [];
  const blockers = publishBlockers(readiness.readiness, validation, draftKey);
  const existingCampaignId = form.campaignParent?.metaId;

  const finishPublish = useCallback(
    (published: AdPublishJob) => {
      clearWizard(workspaceId);
      router.push(
        managerHref({
          accountId: published.adAccountId,
          campaignId: publishedCampaignId(published, existingCampaignId),
          published: true,
          jobId: published.id,
        }),
      );
    },
    [workspaceId, router, existingCampaignId],
  );
  const { job, start: followJob, reset: resetJob, pollError, retryPoll } = usePublishJob(finishPublish);
  const canPublish = editing ? !!editedCreative && !publishing : blockers.length === 0 && !job && !publishing;

  useEffect(() => {
    if (!workspaceId || job || pendingDraft) return;
    writeWizard(workspaceId, form, step);
  }, [workspaceId, form, step, job, pendingDraft]);

  const update = (change: (current: WizardForm) => WizardForm) => setForm(change);
  const patch = (changes: Partial<WizardForm>) => setForm((current) => ({ ...current, ...changes }));

  const validateDraft = (target: WizardForm) => {
    const targetDraft = draftFor(target);
    const key = JSON.stringify(targetDraft);
    setValidation({ status: "validating" });
    void validateMetaAdDraftAction(targetDraft).then((result) => {
      if (isAdsError(result)) {
        if (result.expected) {
          setValidation({ status: "done", key, issues: issuesFromExpected(result.expected), fee: null });
          return;
        }
        setValidation({ status: "failed", message: errorText(result), code: result.code });
        return;
      }
      setValidation({ status: "done", key, issues: withBudgetMinimum(result.data.issues ?? [], result.data.budgetMinimum), fee: result.data.fee ?? null });
    });
  };

  const validate = () => validateDraft(form);

  const goTo = (target: WizardStep, adIndex: number | null = null) => {
    setStepId(target);
    if (adIndex !== null) setActiveAd(adIndex);
    const current = validation.status === "done" && validation.key === draftKey;
    if (target === "review" && !current && !editing) validate();
  };

  const goToIndex = (index: number) => goTo(steps[Math.max(0, Math.min(steps.length - 1, index))]);

  const continueDraft = () => {
    if (!pendingDraft) return;
    const restored = pendingDraft.form;
    setForm(restored);
    setStepId(pendingDraft.step);
    setRestoredAt(pendingDraft.savedAt);
    setPendingDraft(null);
    if (pendingDraft.step === "review" && restored.mode !== "creative") validateDraft(restored);
  };

  const startOver = () => {
    clearWizard(workspaceId);
    setPendingDraft(null);
  };

  const showIssues = (found: DraftIssue[], key: string) => {
    setValidation({ status: "done", key, issues: found, fee: null });
    const first = found[0];
    if (first) goTo(stepOfIssue(first.field, form.mode), adIndexOfIssue(first.field));
  };

  const publish = () => {
    if (!canPublish) return;
    setPublishing(true);
    setPublishError(null);
    const key = draftKey;
    void publishMetaAdDraftAction(draft).then((result) => {
      setPublishing(false);
      if (isAdsError(result)) {
        if (result.expected) {
          showIssues(issuesFromExpected(result.expected), key);
          return;
        }
        setPublishError(result);
        return;
      }
      followJob(result.data);
    });
  };

  const saveCreative = () => {
    if (!editedCreative || !canPublish) return;
    setPublishing(true);
    setPublishError(null);
    const key = draftKey;
    void updateAdObjectAction(form.editAdId, { creative: editedCreative }).then((result) => {
      setPublishing(false);
      if (isAdsError(result)) {
        if (result.expected) {
          showIssues(issuesFromCreativeEdit(result.expected), key);
          return;
        }
        setPublishError(result);
        return;
      }
      clearWizard(workspaceId);
      router.push(managerHref({ accountId: form.accountId, campaignId: existingCampaignId }));
    });
  };

  const backToDraft = () => {
    resetJob();
    validate();
  };

  const discard = () => {
    clearWizard(workspaceId);
    setForm(start.fresh);
    setStepId(stepsFor(start.fresh.mode)[0]);
    setActiveAd(0);
    setValidation({ status: "idle" });
    setRestoredAt("");
    setConfirmDiscard(false);
  };

  const context: WizardContextValue = {
    form,
    patch,
    update,
    account,
    accounts,
    options,
    pages,
    page,
    issues,
    today,
    canGenerate,
  };

  if (pendingDraft) {
    return (
      <div className="w-full space-y-6">
        {header}
        <DraftChoice stored={pendingDraft} accounts={accounts} onContinue={continueDraft} onStartOver={startOver} />
      </div>
    );
  }

  const footer = job ? (
    <PublishProgress
      job={job}
      plan={jobPlan(form)}
      pollError={pollError}
      onRetryPoll={retryPoll}
      onBackToDraft={backToDraft}
      onOpenJobs={() => router.push(managerHref({ accountId: job.adAccountId, jobs: true }))}
    />
  ) : (
    <div className="space-y-2">
      {publishError ? <p className="text-sm text-destructive-ink">{errorText(publishError)}</p> : null}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          title={t("previous")}
          icon={<ArrowLeft className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          disabled={stepIndex === 0 || publishing}
          onClick={() => goToIndex(stepIndex - 1)}
        />
        {step === "review" ? (
          <Button
            variant="primary"
            title={
              editing
                ? publishing
                  ? t("savingCreative")
                  : t("saveCreative")
                : publishing
                  ? t("publishing")
                  : form.keepPaused
                    ? t("publishPaused")
                    : t("publish")
            }
            icon={<PaperPlaneTilt className="h-4 w-4" />}
            iconVisible
            iconSide="left"
            disabled={!canPublish}
            onClick={editing ? saveCreative : publish}
          />
        ) : (
          <Button
            variant="primary"
            title={t("next")}
            icon={<ArrowRight className="h-4 w-4" />}
            iconVisible
            iconSide="right"
            disabled={!stepReady(step, form)}
            onClick={() => goToIndex(stepIndex + 1)}
          />
        )}
      </div>
    </div>
  );

  const previewAd = form.ads[Math.min(activeAd, form.ads.length - 1)];

  return (
    <WizardProvider value={context}>
      <div className="w-full space-y-6">
        {header}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {restoredAt ? t("restored", { when: formatWhen(restoredAt, fmt.tag) }) : t("autosave")}
          </p>
          {!job ? (
            <Button
              variant="ghost"
              size="sm"
              title={t("discard")}
              icon={<Trash className="h-4 w-4" />}
              iconVisible
              iconSide="left"
              onClick={() => setConfirmDiscard(true)}
            />
          ) : null}
        </div>
        {account && !editing ? <WizardReadinessBanner account={account} state={readiness} canCreate={canGenerate} /> : null}
        {parentError ? (
          <p className="flex items-center gap-2 text-sm text-destructive-ink">
            <Warning className="h-4 w-4" />
            {parentError === "creative_unavailable" ? t("creativeUnavailable") : t("parentError", { message: parentError })}
          </p>
        ) : null}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <ElevatedStepper
            steps={steps.map((id) => ({ id, title: t(`steps.${id}`) }))}
            currentStep={stepIndex}
            onStepClick={(index) => {
              if (!job && index < stepIndex) goToIndex(index);
            }}
            footer={footer}
          >
            {step === "objective" ? <ObjectiveStep /> : null}
            {step === "campaign" ? <CampaignStep /> : null}
            {step === "adSet" ? <AdSetStep /> : null}
            {step === "ads" ? <AdsStep active={activeAd} onActive={setActiveAd} /> : null}
            {step === "review" ? (
              <ReviewStep validation={validation} blockers={editing ? [] : blockers} onRevalidate={validate} onGoTo={goTo} />
            ) : null}
          </ElevatedStepper>
          <aside className="lg:sticky lg:top-16 lg:self-start">
            <AdPreviewPanel
              content={previewContent(form, previewAd, page)}
              title={
                form.ads.length > 1
                  ? t("previewAd", { index: Math.min(activeAd, form.ads.length - 1) + 1, total: form.ads.length })
                  : t("previewTitle")
              }
            />
          </aside>
        </div>
      </div>
      {confirmDiscard ? (
        <ElevatedDialog open onOpenChange={(open) => !open && setConfirmDiscard(false)}>
          <ElevatedDialogContent className="max-w-md">
            <ElevatedDialogHeader>
              <ElevatedDialogTitle>{t("discardTitle")}</ElevatedDialogTitle>
              <ElevatedDialogDescription>{t("discardBody")}</ElevatedDialogDescription>
            </ElevatedDialogHeader>
            <ElevatedDialogFooter>
              <Button variant="secondary" title={t("cancel")} onClick={() => setConfirmDiscard(false)} />
              <Button variant="destructive" title={t("discardConfirm")} onClick={discard} />
            </ElevatedDialogFooter>
          </ElevatedDialogContent>
        </ElevatedDialog>
      ) : null}
    </WizardProvider>
  );
}
