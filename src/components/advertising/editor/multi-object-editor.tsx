"use client";

import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

import { getAdEditableObjectAction, isAdsError, type AdsResult } from "@/app/actions/advertising";
import { bulkApplyAdObjectsAction, bulkEditAdObjectsAction, bulkSetAdObjectsOnAction } from "@/app/actions/advertising-bulk";
import { getAdsOptionsAction } from "@/app/actions/advertising-create";
import Button from "@/components/elevated-design/button";
import { ElevatedDialog, ElevatedDialogContent } from "@/components/elevated-design/elevated-dialog";
import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { Lock, Warning } from "@/components/icons";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { useWorkspace } from "@/contexts/workspace-context";
import { useAdAccounts } from "@/hooks/use-ad-accounts";
import { toast } from "sonner";
import { Link } from "@/i18n/routing";
import { managerHref, objectEditorHref } from "@/lib/advertising/connect";
import { civilToday } from "@/lib/advertising/date-range";
import { manageBlockerKey, spendBlockerKey } from "@/lib/advertising/delivery";
import type { AdsOptions } from "@/lib/advertising/draft-types";
import { editIsEmpty, type EditForm } from "@/lib/advertising/edit";
import {
  failedOutcomes,
  mergeOutcomes,
  multiAnalysis,
  multiCrumbs,
  multiFields,
  multiLoad,
  multiObjects,
  multiProblems,
  multiSavePlan,
  planIsEmpty,
  resetGroup,
  scheduleOffered,
  statusState,
  withOutcomes,
  type LoadEntry,
  type LoadedObject,
  type MultiGroup,
  type MultiValues,
} from "@/lib/advertising/editor-multi";
import { bulkOutcomes, bulkTally, type BulkOutcome } from "@/lib/advertising/manager-bulk";
import { asTableRow, type TableRow } from "@/lib/advertising/manager-drafts";
import { editState, switchState, type ToolbarContext } from "@/lib/advertising/manager-toolbar";
import type { AdAccount, AdBulkResult, AdEditableObject, AdLevel } from "@/lib/advertising/types";

import { AdTextFields } from "../edit/ad-text-fields";
import { ObjectEditFields } from "../edit/object-edit-fields";
import { BulkResultsView } from "../manager/bulk-edit-dialog";
import { useBlockerText } from "../manager/use-blocker-text";
import { useAdsErrorText } from "../use-ads-error";
import { CardSections, Hint } from "../wizard/choice-row";
import { useAdsResource } from "../wizard/use-ads-resource";
import { MultiAnalysisFacts } from "./analysis-view";
import { EditorFooter } from "./editor-footer";
import { EditorBreadcrumb, EditorFailure, EditorShell, EditorStatusLine, EditorTree, TREE_LEVEL, type EditorTab } from "./editor-shell";
import { MixedField } from "./mixed-field";

interface SavedResults {
  rows: TableRow[];
  outcomes: BulkOutcome[];
  reload: boolean;
}

function loadObjects(metaIds: string[]): Promise<AdsResult<LoadedObject[]>> {
  return Promise.all(
    metaIds.map((metaId) =>
      getAdEditableObjectAction(metaId).then((result) =>
        isAdsError(result) ? { metaId, detail: null, message: result.error } : { metaId, detail: result.data, message: null },
      ),
    ),
  ).then((data) => ({ data }));
}

function tableRowsOf(objects: AdEditableObject[]): TableRow[] {
  return objects.map((object) => asTableRow({ ...object.row, live: null }));
}

function LoadFailure({ accountId, message, entries }: { accountId: string; message: string; entries: LoadEntry[] }) {
  const t = useTranslations("adsEditor.multi");
  return (
    <div className="space-y-3">
      <EditorFailure message={message} />
      <ul className="divide-y divide-border rounded-[--radius] border border-border">
        {entries.map((entry) => (
          <li key={entry.metaId} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <Link href={objectEditorHref(accountId, entry.metaId)} className="font-medium text-primary-ink hover:underline">
              {entry.name ?? entry.metaId}
            </Link>
            {entry.ok ? null : <span className="text-xs text-destructive-ink">{entry.message ?? t("notLoaded")}</span>}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function MultiObjectEditor({ metaIds, accountId }: { metaIds: string[]; accountId: string }) {
  const t = useTranslations("adsEditor");
  const tBulk = useTranslations("adsManager.bulk");
  const router = useRouter();
  const { can, permissionsLoading } = useWorkspace();
  const canRead = !permissionsLoading && can("ads", "read");
  const [results, setResults] = useState<SavedResults | null>(null);
  const accountsState = useAdAccounts({ enabled: canRead, requested: accountId });
  const options = useAdsResource(canRead ? "ads-options" : null, getAdsOptionsAction);
  const loaded = useAdsResource(canRead ? `objects:${metaIds.join(",")}` : null, () => loadObjects(metaIds));
  const closeHref = managerHref({ accountId });

  const finished = (rows: TableRow[], outcomes: BulkOutcome[]) => {
    const tally = bulkTally(outcomes);
    if (tally.failed === 0) {
      toast(tBulk("switched", tally));
      router.push(closeHref);
      return;
    }
    setResults({ rows, outcomes, reload: true });
  };

  const switched = (rows: TableRow[], outcomes: BulkOutcome[]) => {
    if (bulkTally(outcomes).failed > 0) setResults({ rows, outcomes, reload: false });
  };

  const closeResults = () => {
    if (results?.reload) loaded.reload();
    setResults(null);
  };

  const dialog = (
    <ElevatedDialog open={!!results} onOpenChange={(open) => !open && closeResults()}>
      <ElevatedDialogContent>{results ? <BulkResultsView rows={results.rows} outcomes={results.outcomes} onClose={closeResults} /> : null}</ElevatedDialogContent>
    </ElevatedDialog>
  );

  const content = (() => {
    if (permissionsLoading) return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
    if (!canRead) return <p className="text-sm text-muted-foreground">{t("noAccess")}</p>;
    const failed = accountsState.error ?? [options, loaded].map((resource) => (resource.status === "error" ? resource.message : null)).find(Boolean);
    if (failed) return <EditorFailure message={t("loadFailed", { message: failed })} />;
    if (accountsState.loading || options.status !== "ready" || loaded.status !== "ready") {
      return <div className="h-64 animate-pulse rounded-[--radius] bg-muted" />;
    }
    const account = accountsState.accounts.find((candidate) => candidate.id === accountId);
    if (!account) return <EditorFailure message={t("accountMissing")} />;
    const load = multiLoad(loaded.data);
    if (load.kind === "failed") {
      return <LoadFailure accountId={account.id} message={t(load.reason === "level" ? "multi.levelMismatch" : "multi.loadFailed")} entries={load.entries} />;
    }
    return (
      <MultiEditorBody
        account={account}
        options={options.data}
        level={load.level}
        initial={load.objects}
        onClose={() => router.push(closeHref)}
        onFinished={finished}
        onSwitched={switched}
      />
    );
  })();

  return (
    <>
      {content}
      {dialog}
    </>
  );
}

function MultiEditorBody({
  account,
  options,
  level,
  initial,
  onClose,
  onFinished,
  onSwitched,
}: {
  account: AdAccount;
  options: AdsOptions;
  level: AdLevel;
  initial: AdEditableObject[];
  onClose: () => void;
  onFinished: (rows: TableRow[], outcomes: BulkOutcome[]) => void;
  onSwitched: (rows: TableRow[], outcomes: BulkOutcome[]) => void;
}) {
  const t = useTranslations("adsEditor.multi");
  const tManager = useTranslations("adsManager");
  const tEdit = useTranslations("adsManager.edit");
  const errorText = useAdsErrorText();
  const { can, permissionsLoading } = useWorkspace();
  const catalog = options.placements ?? {};
  const [details, setDetails] = useState(initial);
  const [first] = useState<MultiValues>(() => {
    const [object] = multiObjects(initial, account.timezone, catalog, account.currency);
    return { form: object.form, text: object.text };
  });
  const [values, setValues] = useState<MultiValues>(first);
  const [opened, setOpened] = useState<MultiGroup[]>([]);
  const [tab, setTab] = useState<EditorTab>("edit");
  const [eachOpen, setEachOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [today] = useState(() => civilToday(account.timezone, new Date()) ?? "");

  const allowed = (action: "update" | "start" | "stop") => !permissionsLoading && can("ads", action);
  const manageBlocker = manageBlockerKey(account);
  const blockerText = useBlockerText(manageBlocker === null ? null : tManager(`manageBlocker.${manageBlocker}`));
  const rows = tableRowsOf(details);
  const metaIds = rows.map((row) => row.metaId);
  const context: ToolbarContext = {
    level,
    selected: rows,
    permissions: { canCreate: false, canUpdate: allowed("update"), canDelete: false, canStart: allowed("start"), canStop: allowed("stop") },
    manageBlocked: manageBlocker !== null,
    spendBlocked: spendBlockerKey(account) !== null,
  };
  const editAccess = editState(context);
  const disabled = !editAccess.enabled || saving;

  const objects = multiObjects(details, account.timezone, catalog, account.currency);
  const fields = multiFields(level, objects);
  const input = { level, fields, opened, first, current: values, timezone: account.timezone, currency: account.currency };
  const plan = multiSavePlan(input);
  const problems = multiProblems(input);
  const status = statusState(details.map((object) => object.row));
  const each = t(`each.${level}`);

  const updateForm = (changes: Partial<EditForm>) => setValues((current) => ({ ...current, form: { ...current.form, ...changes } }));
  const open = (group: MultiGroup) => setOpened((current) => (current.includes(group) ? current : [...current, group]));
  const keep = (group: MultiGroup) => {
    setOpened((current) => current.filter((candidate) => candidate !== group));
    setValues((current) => resetGroup(group, current, first));
  };
  const discard = () => {
    setOpened([]);
    setValues(first);
  };

  const slot = (group: MultiGroup, control: ReactNode) => (
    <MixedField
      field={fields.find((field) => field.group === group)}
      opened={opened.includes(group)}
      disabled={disabled}
      eachLabel={each}
      onOpen={() => open(group)}
      onKeep={() => keep(group)}
    >
      {control}
    </MixedField>
  );

  const outcomesOf = (result: AdsResult<{ results: AdBulkResult[] }>): BulkOutcome[] =>
    isAdsError(result) ? failedOutcomes(metaIds, errorText(result)) : bulkOutcomes(metaIds, result.data.results ?? []);

  const save = async () => {
    if (disabled || problems.length > 0 || planIsEmpty(plan)) return;
    setSaving(true);
    const runs: BulkOutcome[][] = [];
    try {
      if (!editIsEmpty(plan.edit)) runs.push(outcomesOf(await bulkApplyAdObjectsAction(metaIds, plan.edit)));
      for (const change of plan.changes) runs.push(outcomesOf(await bulkEditAdObjectsAction(metaIds, change)));
    } finally {
      setSaving(false);
    }
    onFinished(rows, mergeOutcomes(metaIds, runs));
  };

  const switchAll = (on: boolean) => {
    if (switching || !switchState(context, on).enabled) return;
    setSwitching(true);
    void bulkSetAdObjectsOnAction(metaIds, on).then((result) => {
      setSwitching(false);
      const outcomes = outcomesOf(result);
      setDetails((current) => withOutcomes(current, outcomes));
      onSwitched(rows, outcomes);
    });
  };

  const switchButton = (on: boolean) => {
    const state = switchState(context, on);
    const reason = blockerText(state);
    return (
      <TooltipWrapper content={reason ?? ""} enabled={!!reason}>
        <span>
          <Button
            variant="ghost"
            size="sm"
            title={t(on ? "activateAll" : "deactivateAll")}
            disabled={!state.enabled || switching}
            onClick={() => switchAll(on)}
          />
        </span>
      </TooltipWrapper>
    );
  };

  const statusControl = (() => {
    if (status.kind === "mixed") {
      return (
        <span className="inline-flex flex-wrap items-center gap-2">
          <span className="font-medium text-foreground">{t("mixedStatus")}</span>
          {switchButton(true)}
          {switchButton(false)}
        </span>
      );
    }
    const target = !status.value;
    const reason = blockerText(switchState(context, target));
    return (
      <TooltipWrapper content={reason ?? ""} enabled={!!reason}>
        <span className="inline-flex items-center gap-2">
          <ElevatedSwitch
            checked={status.value}
            disabled={!switchState(context, target).enabled || switching}
            onCheckedChange={() => switchAll(target)}
            aria-label={t(target ? "activateAll" : "deactivateAll")}
          />
          <span className="font-medium text-foreground">{t(status.value ? "allOn" : "allOff")}</span>
        </span>
      </TooltipWrapper>
    );
  })();

  const crumbs = multiCrumbs(details.map((object) => object.row)).map((crumb) => ({
    key: crumb.level,
    label: t(`crumbs.${crumb.level}`, { count: crumb.count }),
    current: crumb.level === level,
  }));

  const entries = details.map((object) => ({
    key: object.row.metaId,
    level: TREE_LEVEL[level],
    label: object.row.name || object.row.metaId,
    selected: true,
  }));

  const notice = (
    <div className="space-y-2 rounded-[--radius] border border-border bg-muted/40 px-3 py-2 text-sm">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-foreground">{t(`appliesTo.${level}`, { count: details.length })}</p>
        <button type="button" onClick={() => setEachOpen((current) => !current)} aria-expanded={eachOpen} className="font-semibold text-primary-ink hover:underline">
          {t(`editEach.${level}`)}
        </button>
      </div>
      {eachOpen ? (
        <ul className="flex flex-wrap gap-x-4 gap-y-1">
          {details.map((object) => (
            <li key={object.row.metaId}>
              <Link href={objectEditorHref(account.id, object.row.metaId)} className="text-primary-ink hover:underline">
                {object.row.name || object.row.metaId}
              </Link>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );

  const [firstObject] = objects;
  const accessReason = blockerText(editAccess);
  const empty = planIsEmpty(plan);

  const body =
    tab === "analyze" ? (
      <section className="rounded-[--radius] border border-border bg-card p-5 shadow-sm">
        <MultiAnalysisFacts facts={multiAnalysis(details, account.timezone)} currency={account.currency} />
      </section>
    ) : (
      <CardSections>
        {accessReason ? (
          <Hint tone="warning" icon={<Lock className="h-3.5 w-3.5" aria-hidden />}>
            {accessReason}
          </Hint>
        ) : null}
        <ObjectEditFields
          idKey="multi"
          level={level}
          form={values.form}
          update={updateForm}
          disabled={disabled}
          problems={problems}
          expected={{}}
          account={account}
          catalog={catalog}
          goal={firstObject.detail.row.optimizationGoal ?? ""}
          destination={firstObject.detail.row.destinationType ?? ""}
          minimum={null}
          today={today}
          lifetime={scheduleOffered(objects)}
          scheduleCleared={first.form.schedule.length > 0 && values.form.schedule.length === 0}
          slot={slot}
        />
        {level === "ad" ? (
          <AdTextFields
            values={values.text}
            disabled={disabled}
            onChange={(field, value) => setValues((current) => ({ ...current, text: { ...current.text, [field]: value } }))}
            slot={slot}
          />
        ) : null}
      </CardSections>
    );

  return (
    <EditorShell
      breadcrumb={<EditorBreadcrumb crumbs={crumbs} />}
      status={<EditorStatusLine status={null} detail={statusControl} />}
      tab={tab}
      onTab={setTab}
      notice={notice}
      tree={<EditorTree entries={entries} label={t("treeLabel")} />}
      footer={
        <EditorFooter
          onClose={onClose}
          onBack={null}
          onNext={null}
          terms={false}
          status={
            problems.length > 0 ? (
              <span className="flex items-center gap-1.5 text-sm text-destructive-ink" role="alert">
                <Warning className="h-4 w-4" aria-hidden />
                {t("fixFields")}
              </span>
            ) : null
          }
          secondary={<Button variant="ghost" title={tEdit("discard")} onClick={discard} disabled={saving || (empty && opened.length === 0)} />}
          finish={
            <Button
              variant="primary"
              title={saving ? tEdit("saving") : tEdit("save")}
              onClick={() => void save()}
              disabled={disabled || problems.length > 0 || empty}
            />
          }
        />
      }
    >
      {body}
    </EditorShell>
  );
}
