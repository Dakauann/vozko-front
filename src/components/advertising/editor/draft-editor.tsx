"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import { getAdsOptionsAction, validateMetaAdDraftAction } from "@/app/actions/advertising-create";
import { deleteAdDraftAction, getAdDraftAction, publishAdDraftAction } from "@/app/actions/advertising-drafts";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { ArrowClockwise, Copy, PaperPlaneTilt, Plus, Trash, Warning, WarningCircle } from "@/components/icons";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { managerHref } from "@/lib/advertising/connect";
import { buildDraft, type WizardForm } from "@/lib/advertising/draft";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import { draftAnalysis } from "@/lib/advertising/editor-analysis";
import { formFromDraft } from "@/lib/advertising/editor-form";
import { draftEditable, draftStatus, validationKey, type SaveFailure } from "@/lib/advertising/editor-status";
import {
  AD_SET_NODE,
  CAMPAIGN_NODE,
  adNode,
  canAddAdTo,
  fitNode,
  neighbourNode,
  nodeAfterRemoval,
  nodeHasIssues,
  nodeKey,
  nodeOfIssue,
  sameNode,
  startNode,
  withAdAdded,
  withAdDuplicated,
  withAdRemoved,
  type EditorNode,
} from "@/lib/advertising/editor-tree";
import { withBudgetMinimum } from "@/lib/advertising/issues";
import { jobPlan, publishBlockers, type ValidationState } from "@/lib/advertising/publish";
import type { AdAccount, AdSavedDraft } from "@/lib/advertising/types";
import { issuesFromExpected } from "@/lib/advertising/wizard-issues";

import { AdPreviewPanel } from "../ad-preview-panel";
import { CollapsibleNotice } from "../collapsible-notice";
import { WizardReadinessBanner } from "../readiness";
import { useAdReadiness } from "../use-ad-readiness";
import { useAdsErrorText, type AdsErrorLike } from "../use-ads-error";
import { AdSetStep } from "../wizard/ad-set-step";
import { AdStep } from "../wizard/ad-step";
import { CampaignStep } from "../wizard/campaign-step";
import { CardSections } from "../wizard/choice-row";
import { AdSetParentFacts, CampaignParentFacts } from "../wizard/parent-facts";
import { previewContent } from "../wizard/preview-content";
import { IssueLinks, useNodeLabel } from "../wizard/publish-check";
import { useAdsResource } from "../wizard/use-ads-resource";
import { usePublishJob } from "../wizard/use-publish-job";
import { useWizardLabels } from "../wizard/use-wizard-labels";
import { WizardProvider, useWizard, useWizardValue } from "../wizard/wizard-context";
import { DraftAnalysisView } from "./analysis-view";
import { AdDestinationPreview } from "./destination-preview";
import { EditorFooter } from "./editor-footer";
import { EditorBreadcrumb, EditorShell, EditorStatusLine, EditorTree, type EditorTab, type TreeEntry } from "./editor-shell";
import { PublishDialog } from "./publish-dialog";
import { useDraftAutosave, type AutosaveState } from "./use-draft-autosave";
import { useDraftExtras, type DraftExtras } from "./use-draft-form-context";

type Conflict = Exclude<SaveFailure, "other">;

type EditorDialog = "publish" | "close" | "discard" | null;

function Message({ children, tone = "muted" }: { children: ReactNode; tone?: "muted" | "error" }) {
  return (
    <p className={tone === "error" ? "flex items-center gap-2 text-sm text-destructive-ink" : "text-sm text-muted-foreground"}>
      {tone === "error" ? <Warning className="h-4 w-4" aria-hidden /> : null}
      {children}
    </p>
  );
}

export function DraftEditor({ draftId }: { draftId: string }) {
  const t = useTranslations("adsEditor");
  const { can, permissionsLoading } = useWorkspace();
  const canCreate = !permissionsLoading && can("ads", "create");
  const saved = useAdsResource(canCreate ? `draft:${draftId}` : null, () => getAdDraftAction(draftId));
  const savedDraft = saved.status === "ready" ? saved.data : null;
  const accountsState = useAdAccounts({
    enabled: canCreate,
    requested: savedDraft?.adAccountId ?? null,
  });
  const options = useAdsResource(canCreate ? "ads-options" : null, getAdsOptionsAction);
  const extras = useDraftExtras(savedDraft);
  const [conflict, setConflict] = useState<Conflict | null>(null);

  const onConflict = useCallback(
    (failure: Conflict) => {
      setConflict(failure);
      saved.reload();
    },
    [saved],
  );

  if (permissionsLoading) return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
  if (!canCreate) return <Message>{t("noAccess")}</Message>;
  if (saved.status === "error") return <Message tone="error">{t("draftMissing", { message: saved.message })}</Message>;
  const failure = accountsState.error ?? (options.status === "error" ? options.message : null) ?? (extras.status === "error" ? extras.message : null);
  if (failure) return <Message tone="error">{t("loadFailed", { message: failure })}</Message>;
  if (!savedDraft || accountsState.loading || options.status !== "ready" || extras.status !== "ready") {
    return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
  }
  const account = accountsState.accounts.find((candidate) => candidate.id === savedDraft.adAccountId);
  if (!account) return <Message tone="error">{t("accountMissing")}</Message>;

  return (
    <DraftEditorBody
      key={`${savedDraft.id}:${savedDraft.version}:${savedDraft.state}`}
      saved={savedDraft}
      extras={extras.data}
      account={account}
      accounts={accountsState.accounts}
      options={options.data}
      conflict={conflict}
      onConflict={onConflict}
      onAccountUpdated={accountsState.replace}
    />
  );
}

function DraftLevel({ node }: { node: EditorNode }) {
  const { form } = useWizard();
  if (node.level === "campaign") return form.mode === "new" ? <CampaignStep /> : <CampaignParentFacts />;
  if (node.level === "adSet") return form.mode === "adSet" ? <AdSetParentFacts /> : <AdSetStep />;
  return <AdStep index={node.index} />;
}

function AutosaveText({ state, error, onRetry }: { state: AutosaveState; error: string | null; onRetry: () => void }) {
  const t = useTranslations("adsEditor.autosave");
  if (state !== "error") return <span>{t(state)}</span>;
  return (
    <span className="inline-flex flex-wrap items-center gap-2 text-destructive-ink">
      {t("error", { message: error ?? "" })}
      <button type="button" onClick={onRetry} className="inline-flex items-center gap-1 font-semibold text-primary-ink hover:underline">
        <ArrowClockwise className="h-3.5 w-3.5" aria-hidden />
        {t("retry")}
      </button>
    </span>
  );
}

function treeLabel(form: WizardForm, node: EditorNode, fallback: string): string {
  if (node.level === "campaign") return (form.mode === "new" ? form.campaignName : form.campaignParent?.name)?.trim() || fallback;
  if (node.level === "adSet") return (form.mode === "adSet" ? form.adSetParent?.name : form.adSetName)?.trim() || fallback;
  return form.ads[node.index]?.name.trim() || fallback;
}

function DraftEditorBody({
  saved,
  extras,
  account,
  accounts,
  options,
  conflict,
  onConflict,
  onAccountUpdated,
}: {
  saved: AdSavedDraft;
  extras: DraftExtras;
  account: AdAccount;
  accounts: AdAccount[];
  options: AdsOptions;
  conflict: Conflict | null;
  onConflict: (failure: Conflict) => void;
  onAccountUpdated: (account: AdAccount) => void;
}) {
  const t = useTranslations("adsEditor");
  const tAds = useTranslations("adsWizard.ads");
  const tWizard = useTranslations("adsWizard");
  const tCreate = useTranslations("adsCreate");
  const router = useRouter();
  const errorText = useAdsErrorText();
  const labels = useWizardLabels();
  const nodeLabel = useNodeLabel();
  const context = { timezone: account.timezone, currency: account.currency };
  const [start] = useState(() => formFromDraft(saved.draft, { ...context, ...extras }));
  const [form, setForm] = useState<WizardForm>(start);
  const [selected, setSelected] = useState<EditorNode>(() => startNode(start));
  const [tab, setTab] = useState<EditorTab>("edit");
  const [serverState, setServerState] = useState<string>(saved.state);
  const [validation, setValidation] = useState<ValidationState>({
    status: "idle",
  });
  const [dialog, setDialog] = useState<EditorDialog>(null);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<AdsErrorLike | null>(null);
  const [discardError, setDiscardError] = useState<string | null>(null);

  const finishPublish = useCallback(
    (published: { id: string; adAccountId: string }) =>
      router.push(
        managerHref({
          accountId: published.adAccountId,
          published: true,
          jobId: published.id,
        }),
      ),
    [router],
  );
  const followed = saved.state === "publishing" ? (saved.job ?? null) : null;
  const { job, start: followJob, reset: resetJob, pollError, retryPoll } = usePublishJob(finishPublish, followed);
  const status = draftStatus(serverState, job);
  const editable = draftEditable(serverState, job);

  const draft = buildDraft(form, context);
  const key = validationKey(draft);
  const autosave = useDraftAutosave({
    draftId: saved.id,
    draft,
    version: saved.version,
    enabled: editable,
    onConflict,
  });
  const readiness = useAdReadiness(account, onAccountUpdated);
  const issues = validation.status === "done" ? validation.issues : [];
  const blockers = publishBlockers(readiness.readiness, validation, key);
  const value = useWizardValue({
    form,
    setForm,
    account,
    accounts,
    options,
    issues,
    canGenerate: editable,
  });
  const node = fitNode(selected, form);
  const objective = labels.objective(form.objective || form.campaignParent?.objective);
  const managerLink = managerHref({ accountId: account.id });

  const goTo = (target: EditorNode) => {
    setSelected(target);
    setTab("edit");
  };

  const validate = () => {
    const checked = buildDraft(form, context);
    const checkedKey = validationKey(checked);
    setValidation({ status: "validating" });
    void validateMetaAdDraftAction(checked).then((result) => {
      if (isAdsError(result)) {
        if (result.expected) {
          setValidation({
            status: "done",
            key: checkedKey,
            issues: issuesFromExpected(result.expected),
            fee: null,
          });
          return;
        }
        setValidation({
          status: "failed",
          message: errorText(result),
          code: result.code,
        });
        return;
      }
      setValidation({
        status: "done",
        key: checkedKey,
        issues: withBudgetMinimum(result.data.issues ?? [], result.data.budgetMinimum),
        fee: result.data.fee ?? null,
      });
    });
  };

  const openPublish = async () => {
    setPublishError(null);
    setDialog("publish");
    if (await autosave.flush()) validate();
  };

  const syncVersion = async () => {
    const latest = await getAdDraftAction(saved.id);
    if (!isAdsError(latest)) autosave.adoptVersion(latest.data.version);
  };

  const publish = async () => {
    if (blockers.length > 0 || publishing || !editable) return;
    setPublishing(true);
    setPublishError(null);
    const savedOk = await autosave.flush();
    if (!savedOk) {
      setPublishing(false);
      return;
    }
    const result = await publishAdDraftAction(saved.id, autosave.savedVersion());
    setPublishing(false);
    if (isAdsError(result)) {
      await syncVersion();
      if (result.code === "draft_publishing") {
        onConflict("publishing");
        return;
      }
      if (result.expected) {
        const found = issuesFromExpected(result.expected);
        setValidation({ status: "done", key, issues: found, fee: null });
        const first = found[0] ? nodeOfIssue(found[0].field) : null;
        if (first) {
          setDialog(null);
          goTo(first);
        }
        return;
      }
      setPublishError(result);
      return;
    }
    setServerState("publishing");
    followJob(result.data);
  };

  const backToDraft = () => {
    resetJob();
    setServerState("failed");
    void syncVersion();
    validate();
  };

  const leave = async () => {
    if (editable) await autosave.flush();
    router.push(managerLink);
  };

  const discard = async () => {
    setDiscardError(null);
    const result = await deleteAdDraftAction(saved.id);
    if (isAdsError(result)) {
      if (result.code === "draft_publishing") onConflict("publishing");
      setDiscardError(errorText(result));
      return;
    }
    router.push(managerLink);
  };

  const addAd = () => {
    const index = form.ads.length;
    setForm((current) => withAdAdded(current, tCreate("names.ad", { objective })));
    goTo(adNode(index));
  };

  const duplicate = (index: number) => {
    setForm((current) => withAdDuplicated(current, index, tAds("copySuffix")));
    goTo(adNode(index + 1));
  };

  const remove = (index: number) => {
    setForm((current) => withAdRemoved(current, index));
    setSelected((current) => nodeAfterRemoval(current, index));
  };

  const adding = editable && canAddAdTo(form);
  const addAction = {
    key: "add",
    label: t("tree.addAd"),
    icon: <Plus className="h-4 w-4" aria-hidden />,
    disabled: !adding,
    onSelect: addAd,
  };
  const entries: TreeEntry[] = [
    {
      key: nodeKey(CAMPAIGN_NODE),
      level: "campaign",
      label: treeLabel(form, CAMPAIGN_NODE, t("levels.campaign")),
      selected: sameNode(node, CAMPAIGN_NODE),
      flagged: nodeHasIssues(issues, CAMPAIGN_NODE),
      onSelect: () => goTo(CAMPAIGN_NODE),
    },
    {
      key: nodeKey(AD_SET_NODE),
      level: "adSet",
      label: treeLabel(form, AD_SET_NODE, t("levels.adSet")),
      selected: sameNode(node, AD_SET_NODE),
      flagged: nodeHasIssues(issues, AD_SET_NODE),
      onSelect: () => goTo(AD_SET_NODE),
      actions: [addAction],
    },
    ...form.ads.map((ad, index) => ({
      key: ad.id,
      level: "ad" as const,
      label: treeLabel(form, adNode(index), nodeLabel(adNode(index))),
      selected: sameNode(node, adNode(index)),
      flagged: nodeHasIssues(issues, adNode(index)),
      onSelect: () => goTo(adNode(index)),
      actions: [
        {
          key: "duplicate",
          label: t("tree.duplicateAd"),
          icon: <Copy className="h-4 w-4" aria-hidden />,
          disabled: !adding,
          onSelect: () => duplicate(index),
        },
        addAction,
        {
          key: "delete",
          label: t("tree.deleteAd"),
          icon: <Trash className="h-4 w-4" aria-hidden />,
          disabled: !editable || form.ads.length <= 1,
          destructive: true,
          onSelect: () => remove(index),
        },
      ],
    })),
  ];

  const crumbNodes = node.level === "ad" ? [CAMPAIGN_NODE, AD_SET_NODE, node] : [CAMPAIGN_NODE, AD_SET_NODE];
  const crumbs = crumbNodes.map((crumb) => ({
    key: nodeKey(crumb),
    label: treeLabel(form, crumb, nodeLabel(crumb)),
    current: sameNode(crumb, node),
    onSelect: () => goTo(crumb),
  }));

  const back = neighbourNode(form, node, -1);
  const next = neighbourNode(form, node, 1);
  const ad = node.level === "ad" ? form.ads[node.index] : undefined;
  const content = ad ? previewContent(form.destination, ad, value.page) : null;
  const jobView = job
    ? {
        job,
        plan: jobPlan(form),
        pollError,
        onRetryPoll: retryPoll,
        onBackToDraft: backToDraft,
        onOpenJobs: () => router.push(managerHref({ accountId: job.adAccountId, jobs: true })),
      }
    : null;

  const notice = (
    <>
      {conflict ? (
        <p className="flex items-center gap-2 rounded-[--radius] border border-border bg-muted px-3 py-2 text-sm text-foreground" role="status">
          <WarningCircle className="h-4 w-4 shrink-0 text-warning-ink" aria-hidden />
          {t(`conflicts.${conflict}`)}
        </p>
      ) : null}
      {editable ? <WizardReadinessBanner account={account} state={readiness} canCreate /> : null}
      {issues.length > 0 && dialog !== "publish" ? (
        <CollapsibleNotice
          icon={<Warning className="h-5 w-5 shrink-0 text-destructive-ink" aria-hidden />}
          title={t("issuesTitle", { count: issues.length })}
          tone="neutral"
          role="alert"
        >
          <IssueLinks issues={issues} onGoTo={goTo} />
        </CollapsibleNotice>
      ) : null}
      {status === "publishing" && !job ? <p className="text-sm text-muted-foreground">{t("publishingNote")}</p> : null}
      {serverState === "failed" && !job && saved.job?.errorMessage ? (
        <p className="flex items-center gap-2 text-sm text-destructive-ink" role="status">
          <Warning className="h-4 w-4 shrink-0" aria-hidden />
          {t("failedNote", {
            message: errorText({
              error: saved.job.errorMessage,
              code: saved.job.errorCode,
            }),
          })}
        </p>
      ) : null}
    </>
  );

  return (
    <WizardProvider value={value}>
      <EditorShell
        breadcrumb={<EditorBreadcrumb crumbs={crumbs} />}
        status={<EditorStatusLine status={status} />}
        tab={tab}
        onTab={setTab}
        notice={notice}
        tree={<EditorTree entries={entries} label={t("tree.label")} />}
        aside={
          tab === "edit" && content ? (
            <AdPreviewPanel
              content={content}
              title={
                form.ads.length > 1
                  ? tWizard("previewAd", {
                      index: node.level === "ad" ? node.index + 1 : 1,
                      total: form.ads.length,
                    })
                  : undefined
              }
              destination={<AdDestinationPreview content={content} accountId={account.id} page={value.page} />}
            />
          ) : undefined
        }
        footer={
          <EditorFooter
            onClose={() => (editable ? setDialog("close") : router.push(managerLink))}
            onBack={back ? () => goTo(back) : null}
            onNext={next && !job ? () => goTo(next) : null}
            status={editable ? <AutosaveText state={autosave.state} error={autosave.error} onRetry={autosave.retry} /> : null}
            secondary={
              editable ? (
                <Button
                  variant="ghost"
                  title={t("footer.discard")}
                  icon={<Trash className="h-4 w-4" />}
                  iconVisible
                  iconSide="left"
                  onClick={() => setDialog("discard")}
                />
              ) : null
            }
            finish={
              <Button
                variant="primary"
                title={tWizard("publish")}
                icon={<PaperPlaneTilt className="h-4 w-4" />}
                iconVisible
                iconSide="left"
                disabled={!editable && !job}
                onClick={() => (job ? setDialog("publish") : void openPublish())}
              />
            }
          />
        }
      >
        {tab === "analyze" ? (
          <DraftAnalysisView sections={draftAnalysis(form, account.currency, value.page?.name ?? "")} currency={account.currency} onOpen={goTo} />
        ) : (
          <CardSections>
            <fieldset disabled={!editable} className="min-w-0 space-y-4">
              <DraftLevel key={nodeKey(node)} node={node} />
            </fieldset>
          </CardSections>
        )}
      </EditorShell>

      <PublishDialog
        readiness={{ account, state: readiness, canCreate: true }}
        open={dialog === "publish"}
        onOpenChange={(open) => setDialog(open ? "publish" : null)}
        validation={validation}
        blockers={blockers}
        ads={form.ads.length}
        keepPaused={form.keepPaused}
        onKeepPaused={(keepPaused) => setForm((current) => ({ ...current, keepPaused }))}
        onRevalidate={() => void openPublish()}
        onGoTo={(target) => {
          setDialog(null);
          goTo(target);
        }}
        onPublish={() => void publish()}
        publishing={publishing}
        publishError={publishError}
        saveError={autosave.error}
        jobView={jobView}
      />

      <ElevatedDialog open={dialog === "close"} onOpenChange={(open) => setDialog(open ? "close" : null)}>
        <ElevatedDialogContent className="max-w-md">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{t("closeDialog.title")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>{t("closeDialog.body")}</ElevatedDialogDescription>
          </ElevatedDialogHeader>
          <ElevatedDialogFooter>
            <Button variant="secondary" title={t("footer.close")} onClick={() => void leave()} />
            <Button variant="primary" title={tWizard("publish")} onClick={() => void openPublish()} />
          </ElevatedDialogFooter>
        </ElevatedDialogContent>
      </ElevatedDialog>

      <ElevatedDialog open={dialog === "discard"} onOpenChange={(open) => setDialog(open ? "discard" : null)}>
        <ElevatedDialogContent className="max-w-md">
          <ElevatedDialogHeader>
            <ElevatedDialogTitle>{tWizard("discardTitle")}</ElevatedDialogTitle>
            <ElevatedDialogDescription>{tWizard("discardBody")}</ElevatedDialogDescription>
          </ElevatedDialogHeader>
          {discardError ? <p className="text-sm text-destructive-ink">{discardError}</p> : null}
          <ElevatedDialogFooter>
            <Button variant="secondary" title={tWizard("cancel")} onClick={() => setDialog(null)} />
            <Button variant="destructive" title={tWizard("discardConfirm")} onClick={() => void discard()} />
          </ElevatedDialogFooter>
        </ElevatedDialogContent>
      </ElevatedDialog>
    </WizardProvider>
  );
}
