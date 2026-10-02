"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";

import {
  getAdEditableObjectAction,
  getAdPublishJobAction,
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
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ElevatedStepper } from "@/components/elevated-design/elevated-stepper";
import { ArrowLeft, ArrowRight, Megaphone, PaperPlaneTilt, Trash, Warning } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { ADVERTISING_PATH, pickAccountId } from "@/lib/advertising/connect";
import { civilToday } from "@/lib/advertising/date-range";
import { jobIsTerminal, jobStatusKey } from "@/lib/advertising/delivery";
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
import { clearWizard, readWizard, storedMatchesEntry, writeWizard, type WizardEntry } from "@/lib/advertising/wizard-storage";
import { formatWhen } from "@/lib/advertising/when";

import { AdPreviewCard, type AdPreviewPlacement } from "../ad-preview-card";
import { JobStatus } from "../status-dot";
import { useAdsFormat } from "../use-ads-format";
import { AdSetStep } from "./ad-set-step";
import { AdsStep } from "./ads-step";
import { CampaignStep } from "./campaign-step";
import { ObjectiveStep } from "./objective-step";
import { previewContent } from "./preview-content";
import { ReviewStep, type ValidationState } from "./review-step";
import { useAdsResource } from "./use-ads-resource";
import { WizardProvider, type WizardContextValue } from "./wizard-context";

const JOB_POLL_MS = 2500;

interface Parents {
  campaign: ParentSummary | null;
  adSet: ParentSummary | null;
  ad: CreativeSource | null;
}

function managerPath(accountId: string): string {
  return `${ADVERTISING_PATH}?account=${encodeURIComponent(accountId)}&jobs=1`;
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
  const accounts = useMemo(() => accountsState.accounts.filter((account) => account.canSpend), [accountsState.accounts]);
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
  initial: () => { fresh: WizardForm; stored: ReturnType<typeof readWizard> };
  canGenerate: boolean;
}) {
  const t = useTranslations("adsWizard");
  const fmt = useAdsFormat();
  const router = useRouter();
  const [start] = useState(() => {
    const { fresh, stored } = initial();
    const usable = stored && storedMatchesEntry(stored, entry) && accounts.some((account) => account.id === stored.form.accountId);
    return usable
      ? { form: stored.form, step: stored.step, restoredAt: stored.savedAt, fresh }
      : { form: fresh, step: "objective" as WizardStep, restoredAt: "", fresh };
  });
  const [form, setForm] = useState<WizardForm>(start.form);
  const [stepId, setStepId] = useState<WizardStep>(start.step);
  const [restoredAt, setRestoredAt] = useState(start.restoredAt);
  const [activeAd, setActiveAd] = useState(0);
  const [placement, setPlacement] = useState<AdPreviewPlacement>("feed");
  const [validation, setValidation] = useState<ValidationState>({ status: "idle" });
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [job, setJob] = useState<AdPublishJob | null>(null);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [now] = useState(() => new Date());

  const account = accounts.find((candidate) => candidate.id === form.accountId);
  const pages = useAdsResource(form.accountId ? `pages:${form.accountId}` : null, () => listAdPagesAction(form.accountId));
  const page = pages.status === "ready" ? pages.data.find((candidate) => candidate.pageId === form.pageId) : undefined;
  const today = account ? civilToday(account.timezone, now) : null;
  const steps = stepsFor(form.mode);
  const step = steps.includes(stepId) ? stepId : steps[0];
  const editing = form.mode === "creative";
  const stepIndex = steps.indexOf(step);

  const draft = buildDraft(form, { timezone: account?.timezone ?? "", currency: account?.currency ?? "" });
  const editedCreative = editing && form.ads[0] ? buildCreative(form.ads[0], form.destination) : null;
  const draftKey = JSON.stringify(editedCreative ?? draft);
  const validated = validation.status === "done" && validation.key === draftKey;
  const stale = validation.status === "done" && !validated;
  const issues: DraftIssue[] = validation.status === "done" ? validation.issues : [];
  const canPublish = editing
    ? !!editedCreative && !publishing
    : validated && issues.length === 0 && !!validation.fee && !job && !publishing;

  useEffect(() => {
    if (!workspaceId || job) return;
    writeWizard(workspaceId, form, step);
  }, [workspaceId, form, step, job]);

  const jobId = job?.id ?? null;
  const jobDone = job ? jobIsTerminal(job.status) : true;

  useEffect(() => {
    if (!jobId || jobDone) return;
    const timer = window.setInterval(() => {
      void getAdPublishJobAction(jobId).then((result) => {
        if (isAdsError(result)) return;
        setJob(result.data);
        if (jobStatusKey(result.data.status) === "PUBLISHED") router.push(managerPath(result.data.adAccountId));
      });
    }, JOB_POLL_MS);
    return () => window.clearInterval(timer);
  }, [jobId, jobDone, router]);

  const update = (change: (current: WizardForm) => WizardForm) => setForm(change);
  const patch = (changes: Partial<WizardForm>) => setForm((current) => ({ ...current, ...changes }));

  const validate = () => {
    const key = draftKey;
    setValidation({ status: "validating" });
    void validateMetaAdDraftAction(draft).then((result) => {
      if (isAdsError(result)) {
        if (result.expected) {
          setValidation({ status: "done", key, issues: issuesFromExpected(result.expected), fee: null });
          return;
        }
        setValidation({ status: "failed", message: result.error });
        return;
      }
      setValidation({ status: "done", key, issues: result.data.issues ?? [], fee: result.data.fee ?? null });
    });
  };

  const goTo = (target: WizardStep, adIndex: number | null = null) => {
    setStepId(target);
    if (adIndex !== null) setActiveAd(adIndex);
    if (target === "review" && !validated && !editing) validate();
  };

  const goToIndex = (index: number) => goTo(steps[Math.max(0, Math.min(steps.length - 1, index))]);

  const publish = () => {
    if (!canPublish) return;
    setPublishing(true);
    setPublishError(null);
    const key = draftKey;
    void publishMetaAdDraftAction(draft).then((result) => {
      setPublishing(false);
      if (isAdsError(result)) {
        if (result.expected) {
          const found = issuesFromExpected(result.expected);
          setValidation({ status: "done", key, issues: found, fee: null });
          const first = found[0];
          if (first) goTo(stepOfIssue(first.field, form.mode), adIndexOfIssue(first.field));
          return;
        }
        setPublishError(result.error);
        return;
      }
      clearWizard(workspaceId);
      setJob(result.data);
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
          const found = issuesFromCreativeEdit(result.expected);
          setValidation({ status: "done", key, issues: found, fee: null });
          const first = found[0];
          if (first) goTo(stepOfIssue(first.field, form.mode), adIndexOfIssue(first.field));
          return;
        }
        setPublishError(result.error);
        return;
      }
      clearWizard(workspaceId);
      router.push(`${ADVERTISING_PATH}?account=${encodeURIComponent(form.accountId)}`);
    });
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

  const footer = job ? (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{t("job.title")}</span>
        <JobStatus status={job.status} />
      </div>
      {jobStatusKey(job.status) === "NEEDS_REVIEW" ? <p className="text-xs text-warning-ink">{t("job.needsReview")}</p> : null}
      {job.errorMessage ? <p className="text-xs text-destructive-ink">{job.errorMessage}</p> : null}
      {!jobIsTerminal(job.status) ? <p className="text-xs text-muted-foreground">{t("job.running")}</p> : null}
      <Button variant="secondary" title={t("job.openManager")} onClick={() => router.push(managerPath(job.adAccountId))} />
    </div>
  ) : (
    <div className="space-y-2">
      {publishError ? <p className="text-sm text-destructive-ink">{publishError}</p> : null}
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
            {step === "review" ? <ReviewStep validation={validation} stale={stale} onRevalidate={validate} onGoTo={goTo} /> : null}
          </ElevatedStepper>
          <aside className="space-y-3 lg:sticky lg:top-16 lg:self-start">
            <div className="flex items-center justify-between gap-2">
              <p className="legend">
                {form.ads.length > 1
                  ? t("previewAd", { index: Math.min(activeAd, form.ads.length - 1) + 1, total: form.ads.length })
                  : t("previewTitle")}
              </p>
              <ElevatedPillToggle<AdPreviewPlacement>
                size="sm"
                value={placement}
                onChange={setPlacement}
                options={[
                  { value: "feed", label: t("placement.feed") },
                  { value: "story", label: t("placement.story") },
                ]}
              />
            </div>
            <AdPreviewCard content={previewContent(form, previewAd, page)} placement={placement} />
            <p className="text-2xs text-muted-foreground">{t("previewNote")}</p>
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
