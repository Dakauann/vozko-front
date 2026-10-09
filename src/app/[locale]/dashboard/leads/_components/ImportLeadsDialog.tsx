"use client";

import { useRef, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogBody,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { Check, DownloadSimple, FileCsv, UploadSimple } from "@/components/icons";
import { ImportCountsSummary } from "@/components/leads/imports/ImportCountsSummary";
import { ImportMappingList } from "@/components/leads/imports/ImportMappingList";
import {
  EMPTY_SEED_DRAFT,
  ImportSeedOptions,
  seedDraftOf,
  seedScriptBlocks,
  seedScriptOf,
  type SeedDraft,
} from "@/components/leads/imports/ImportSeedOptions";
import {
  importErrorColumn,
  importErrorMessage,
  importFailureLabel,
  isMappingRefusal,
  type ImportTranslator,
} from "@/components/leads/imports/import-messages";
import { useLeadImportLimits, useLeadImportTracker, useTrackedImport } from "@/components/leads/imports/use-lead-imports";
import { Notice as SystemNotice } from "@/components/ui/notice";
import { ProgressTrack } from "@/components/ui/progress-panel";
import {
  downloadLeadImportRejectionsAction,
  dryRunLeadImportAction,
  startLeadImportAction,
  uploadLeadImportAction,
} from "@/app/actions/lead-imports";
import type { CodedRefusal } from "@/lib/api/coded-error";
import {
  assignImportField,
  defaultImportPolicy,
  importColumnsBody,
  importIssueTotal,
  initialImportMapping,
  isLeadImportActive,
  LEAD_IMPORT_ACCEPT,
  leadImportPercent,
  leadImportStep,
  type LeadImportJob,
  type LeadImportLimits,
  type LeadImportPolicy,
  type LeadImportStep,
} from "@/lib/leads/imports";
import { downloadLeadImportTemplate } from "@/lib/leads/template";
import { cn } from "@/lib/utils";

interface ImportDraft {
  jobId: string;
  mapping: string[];
  policy: LeadImportPolicy;
  seed: SeedDraft;
  dirty: boolean;
}

type Busy = "upload" | "dryRun" | "start" | "download" | null;

const STEP_ORDER: LeadImportStep[] = ["file", "columns", "importing"];

function draftFor(job: LeadImportJob): ImportDraft {
  const seedInbox = job.options.seedInbox && (job.settings?.seedInbox ?? false);
  const scripted = seedInbox && job.options.seedConversations && (job.settings?.seedConversations ?? false);
  const stored = scripted ? job.settings?.seedScript : undefined;
  return {
    jobId: job.id,
    mapping: initialImportMapping(job),
    policy: defaultImportPolicy(job),
    seed: {
      ...EMPTY_SEED_DRAFT,
      ...(stored ? seedDraftOf(stored) : {}),
      seedInbox,
      seedConversations: scripted,
      savedScript: !scripted || stored ? null : job.status === "failed" ? "stale" : "kept",
    },
    dirty: false,
  };
}

function staleSeed(seed: SeedDraft): SeedDraft {
  return seed.savedScript === "kept" ? { ...seed, savedScript: "stale" } : seed;
}

export function ImportLeadsDialog({
  open,
  onOpenChange,
  jobId,
  onJobIdChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  jobId: string | null;
  onJobIdChange: (id: string | null) => void;
}) {
  const t = useTranslations("leadsPage.import") as unknown as ImportTranslator;
  const format = useFormatter();
  const locale = useLocale();
  const tracker = useLeadImportTracker();
  const tracked = useTrackedImport(tracker, jobId);
  const limits = useLeadImportLimits(tracker);
  const job = tracked?.job ?? null;
  const inputRef = useRef<HTMLInputElement>(null);

  const [busy, setBusy] = useState<Busy>(null);
  const [refused, setRefused] = useState<{ jobId: string | null; error: CodedRefusal } | null>(null);
  const [draft, setDraft] = useState<ImportDraft | null>(null);

  if (job && draft?.jobId !== job.id) setDraft(draftFor(job));
  const current = job && draft?.jobId === job.id ? draft : null;

  const n = (value: number) => format.number(value);
  const errorContext = {
    headers: job?.preview.headers ?? [],
    fields: job?.fields ?? [],
    formatNumber: n,
    limits,
  };
  const describe = (error: CodedRefusal) => importErrorMessage(t, error, errorContext);
  const refusal = refused && refused.jobId === jobId ? refused.error : null;
  const setRefusal = (error: CodedRefusal | null) => setRefused(error ? { jobId, error } : null);

  const step: LeadImportStep | "loading" | "gone" =
    !jobId || !tracked ? "file" : tracked.gone ? "gone" : job ? leadImportStep(job) : "loading";

  const analyzing = job?.status === "analyzing";
  const editable = step === "columns" && !analyzing && busy === null;

  const refuse = (error: CodedRefusal, inline: boolean) => {
    setRefusal(error);
    if (!inline) toast.error(t("errorTitle"), { description: describe(error) });
  };

  const edit = (patch: Partial<ImportDraft>) => {
    if (!current || !editable) return;
    setDraft({ ...current, ...patch, seed: staleSeed(patch.seed ?? current.seed), dirty: true });
    setRefusal(null);
  };

  const pickFile = async (file: File) => {
    setBusy("upload");
    setRefusal(null);
    const outcome = await uploadLeadImportAction(file);
    setBusy(null);
    if ("error" in outcome) {
      refuse(outcome.error, false);
      return;
    }
    tracker.track(outcome.job);
    onJobIdChange(outcome.job.id);
  };

  const simulate = async () => {
    if (!job || !current) return;
    setBusy("dryRun");
    setRefusal(null);
    const script = seedScriptOf(current.seed, job.options);
    const outcome = await dryRunLeadImportAction(job.id, {
      columns: importColumnsBody(current.mapping),
      onExisting: current.policy,
      seedInbox: job.options.seedInbox && current.seed.seedInbox,
      ...(script ? { seedConversations: script } : {}),
    });
    setBusy(null);
    if ("error" in outcome) {
      refuse(outcome.error, isMappingRefusal(outcome.error));
      return;
    }
    setDraft({ ...current, dirty: false });
    tracker.track(outcome.job);
  };

  const start = async () => {
    if (!job) return;
    setBusy("start");
    setRefusal(null);
    const outcome = await startLeadImportAction(job.id);
    setBusy(null);
    if ("error" in outcome) {
      refuse(outcome.error, false);
      return;
    }
    tracker.track(outcome.job);
  };

  const downloadRejections = async () => {
    if (!job) return;
    setBusy("download");
    const { error } = await downloadLeadImportRejectionsAction(job.id, locale);
    setBusy(null);
    if (error) toast.error(t("rejections.failed"), { description: describe(error) });
  };

  const restart = () => {
    setRefusal(null);
    onJobIdChange(null);
  };

  const changeFile = () => {
    if (job) tracker.forget(job.id);
    restart();
  };

  const simulated = Boolean(job && current && job.status === "analyzed" && job.dryRun && !current.dirty);
  const nothingMapped = Boolean(current && importColumnsBody(current.mapping).length === 0);
  const scriptBlocks = Boolean(job && current && seedScriptBlocks(current.seed, job.options));
  const failedBeforeStart = job?.status === "failed" && !job.startedAt;
  const stepIndex = step === "done" ? STEP_ORDER.length : Math.max(0, STEP_ORDER.indexOf(step === "loading" || step === "gone" ? "file" : step));

  const footer = () => {
    if (step === "file" || step === "loading" || step === "gone") {
      return (
        <>
          {step === "gone" ? <Button variant="secondary" title={t("another")} onClick={restart} /> : null}
          <Button variant="ghost" title={t("cancel")} onClick={() => onOpenChange(false)} disabled={busy === "upload"} />
        </>
      );
    }
    if (step === "columns" && job) {
      const primary = simulated ? (
        <Button
          variant="primary"
          title={busy === "start" ? t("start.starting") : t("start.action", { count: job.dryRun?.rows ?? job.totalRows })}
          onClick={start}
          disabled={busy !== null}
        />
      ) : (
        <Button
          variant="primary"
          title={analyzing || busy === "dryRun" ? t("dryRun.running") : job.dryRun || failedBeforeStart ? t("dryRun.again") : t("dryRun.run")}
          onClick={simulate}
          disabled={busy !== null || analyzing || nothingMapped || scriptBlocks}
        />
      );
      return (
        <>
          <Button variant="ghost" title={t("changeFile")} onClick={changeFile} disabled={busy !== null} />
          <Button variant="ghost" title={analyzing ? t("closeBackground") : t("close")} onClick={() => onOpenChange(false)} />
          {primary}
        </>
      );
    }
    if (step === "importing" && job && isLeadImportActive(job.status)) {
      return <Button variant="secondary" title={t("closeBackground")} onClick={() => onOpenChange(false)} />;
    }
    return (
      <>
        <Button variant="ghost" title={t("another")} onClick={restart} />
        <Button variant="primary" title={t("done")} onClick={() => onOpenChange(false)} />
      </>
    );
  };

  return (
    <ElevatedDialog open={open} onOpenChange={onOpenChange}>
      <ElevatedDialogContent className="max-w-4xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
          <ImportSteps current={stepIndex} />
        </ElevatedDialogHeader>

        <ElevatedDialogBody>
          {step === "file" ? (
            <FileStep
              uploading={busy === "upload"}
              limits={limits}
              onChoose={() => inputRef.current?.click()}
              error={refusal ? describe(refusal) : null}
            />
          ) : null}
          <input
            ref={inputRef}
            type="file"
            accept={LEAD_IMPORT_ACCEPT}
            className="sr-only"
            tabIndex={-1}
            aria-hidden
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void pickFile(file);
            }}
          />

          {step === "loading" ? (
            tracked?.pollError ? (
              <PollNotice onRetry={() => jobId && tracker.retry(jobId)} />
            ) : (
              <p className="text-sm text-muted-foreground" role="status">
                {t("file.loading")}
              </p>
            )
          ) : null}

          {step === "gone" ? (
            <Notice
              tone="warning"
              text={limits ? t("gone", { days: limits.retentionDays }) : t("goneNoLimit")}
            />
          ) : null}

          {job && current && step !== "file" && step !== "loading" && step !== "gone" ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
              <div className="space-y-3">
                <div className="flex min-w-0 items-center gap-2 text-sm text-foreground">
                  <FileCsv className="h-4 w-4 shrink-0 text-muted-foreground" weight="fill" aria-hidden />
                  <span className="truncate font-medium">{job.fileName}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {t("file.rows", { count: job.totalRows })}
                  </span>
                </div>
                <ImportMappingList
                  job={job}
                  mapping={current.mapping}
                  onAssign={(index, field) => edit({ mapping: assignImportField(current.mapping, index, field, job.fields) })}
                  errorColumn={importErrorColumn(refusal)}
                  disabled={!editable}
                />
              </div>

              <div className="space-y-4">
                {step === "columns" ? (
                  <>
                    <div className="space-y-1.5">
                      <ElevatedSelect
                        label={t("existing.label")}
                        value={current.policy}
                        onValueChange={(value) => edit({ policy: value as LeadImportPolicy })}
                        disabled={!editable}
                      >
                        <ElevatedSelectItem
                          value="fill_empty"
                          disabled={!job.options.fillEmpty}
                          description={job.options.fillEmpty ? undefined : t("existing.fillEmptyLocked")}
                        >
                          {t("existing.fillEmpty")}
                        </ElevatedSelectItem>
                        <ElevatedSelectItem value="skip">{t("existing.skip")}</ElevatedSelectItem>
                      </ElevatedSelect>
                      <p className="text-xs text-muted-foreground">
                        {job.options.fillEmpty ? t("existing.neverOverwrites") : t("existing.fillEmptyLocked")}
                      </p>
                    </div>

                    <ImportSeedOptions
                      options={job.options}
                      draft={current.seed}
                      onChange={(seed) => edit({ seed })}
                      disabled={!editable}
                      maxSeeded={limits?.maxSeededConversations ?? null}
                    />

                    {nothingMapped ? <p className="text-xs text-warning-ink">{t("mapping.nothingMapped")}</p> : null}

                    {refusal ? <Notice tone="fault" text={describe(refusal)} /> : null}

                    {failedBeforeStart ? (
                      <Notice tone="fault" title={t("failure.title")} text={importFailureLabel(t, job.failureCode)} />
                    ) : null}

                    {analyzing ? (
                      <ProgressBlock
                        title={t("dryRun.running")}
                        detail={t("dryRun.analyzing", { processed: n(job.processed), total: n(job.totalRows) })}
                        percent={leadImportPercent(job)}
                        label={t("progress.label")}
                      />
                    ) : null}

                    {job.dryRun && job.status === "analyzed" ? (
                      <section className="space-y-2" aria-live="polite">
                        <div className="flex items-baseline justify-between gap-2">
                          <h3 className="text-sm font-semibold text-foreground">{t("dryRun.title")}</h3>
                          <span className="text-xs text-muted-foreground">{t("dryRun.help")}</span>
                        </div>
                        <ImportCountsSummary counts={job.dryRun} tense="planned" />
                        {current.dirty ? <Notice tone="warning" text={t("dryRun.stale")} /> : null}
                      </section>
                    ) : null}
                  </>
                ) : null}

                {tracked?.pollError ? <PollNotice onRetry={() => tracker.retry(job.id)} /> : null}

                {step === "importing" ? (
                  <>
                    {isLeadImportActive(job.status) ? (
                      <ProgressBlock
                        title={t("progress.title")}
                        detail={t("progress.rows", { processed: n(job.processed), total: n(job.totalRows) })}
                        stage={job.stage && t.has(`progress.stages.${job.stage}`) ? t(`progress.stages.${job.stage}`) : undefined}
                        percent={leadImportPercent(job)}
                        label={t("progress.label")}
                      />
                    ) : (
                      <Notice tone="fault" title={t("failure.title")} text={importFailureLabel(t, job.failureCode)} />
                    )}
                    {job.result ? <ImportCountsSummary counts={job.result} tense="done" /> : null}
                    {job.result && !isLeadImportActive(job.status) ? (
                      <RejectionsNotice
                        count={importIssueTotal(job.result)}
                        busy={busy === "download"}
                        onDownload={downloadRejections}
                      />
                    ) : null}
                  </>
                ) : null}

                {step === "done" && job.result ? (
                  <>
                    <section className="space-y-2" aria-live="polite">
                      <h3 className="flex items-center gap-2 text-sm font-semibold text-foreground">
                        <Check className="h-4 w-4 text-healthy-ink" weight="bold" aria-hidden />
                        {t("toast.done", { file: job.fileName })}
                      </h3>
                      <ImportCountsSummary counts={job.result} tense="done" finished placement={job.placement} />
                    </section>
                    <SeedOutcome job={job} />
                    <RejectionsNotice
                      count={importIssueTotal(job.result)}
                      busy={busy === "download"}
                      onDownload={downloadRejections}
                    />
                  </>
                ) : null}
              </div>
            </div>
          ) : null}
        </ElevatedDialogBody>

        <ElevatedDialogFooter>{footer()}</ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

function ImportSteps({ current }: { current: number }) {
  const t = useTranslations("leadsPage.import");
  return (
    <ol className="mt-1 flex flex-wrap items-center gap-2 text-xs" aria-label={t("title")}>
      {STEP_ORDER.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step} className="flex items-center gap-2" aria-current={active ? "step" : undefined}>
            {index > 0 ? <span aria-hidden className="h-px w-6 bg-border-strong" /> : null}
            <span
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full text-2xs font-semibold tabular-nums",
                done
                  ? "border border-control-edge bg-muted text-foreground"
                  : active
                    ? "border border-primary-edge bg-primary text-primary-foreground"
                    : "border border-control-edge text-muted-foreground",
              )}
            >
              {done ? <Check className="h-3 w-3" weight="bold" aria-hidden /> : index + 1}
            </span>
            <span className={cn(active || done ? "font-medium text-foreground" : "text-muted-foreground")}>
              {t(`steps.${step}`)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

function FileStep({
  uploading,
  limits,
  onChoose,
  error,
}: {
  uploading: boolean;
  limits: LeadImportLimits | null;
  onChoose: () => void;
  error: string | null;
}) {
  const t = useTranslations("leadsPage.import");
  const format = useFormatter();
  return (
    <div className="space-y-4">
      <div className="flex flex-col items-start gap-3 rounded-[--radius] border border-dashed border-control-edge bg-card px-4 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            icon={<UploadSimple weight="bold" />}
            iconVisible
            title={uploading ? t("file.uploading") : t("file.choose")}
            onClick={onChoose}
            disabled={uploading}
          />
          <Button
            variant="ghost"
            size="sm"
            icon={<DownloadSimple weight="bold" />}
            iconVisible
            title={t("template")}
            onClick={downloadLeadImportTemplate}
          />
        </div>
        {limits ? (
          <p className="text-xs text-muted-foreground">
            {t("file.limits", { megabytes: format.number(limits.maxMegabytes), rows: format.number(limits.maxRows) })}
          </p>
        ) : null}
        <p className="text-xs text-muted-foreground">{t("file.templateHint")}</p>
      </div>
      {error ? <Notice tone="fault" text={error} /> : null}
    </div>
  );
}

function Notice({ tone, title, text }: { tone: "info" | "warning" | "fault"; title?: string; text: string }) {
  return (
    <SystemNotice tone={tone} title={title}>
      <p>{text}</p>
    </SystemNotice>
  );
}

function PollNotice({ onRetry }: { onRetry: () => void }) {
  const t = useTranslations("leadsPage.import");
  return (
    <div className="flex flex-wrap items-center gap-2" role="status">
      <Notice tone="warning" text={t("pollFailed")} />
      <Button variant="secondary" size="sm" title={t("retry")} onClick={onRetry} />
    </div>
  );
}

function ProgressBlock({
  title,
  detail,
  stage,
  percent,
  label,
}: {
  title: string;
  detail: string;
  stage?: string;
  percent: number;
  label: string;
}) {
  return (
    <div className="space-y-1.5" aria-live="polite">
      <div className="flex items-baseline justify-between gap-3 text-sm">
        <span className="font-semibold text-foreground">{title}</span>
        <span className="readout tabular-nums text-muted-foreground">{detail}</span>
      </div>
      <ProgressTrack label={label} percent={percent} />
      {stage ? <p className="text-2xs text-muted-foreground">{stage}</p> : null}
    </div>
  );
}

function RejectionsNotice({ count, busy, onDownload }: { count: number; busy: boolean; onDownload: () => void }) {
  const t = useTranslations("leadsPage.import");
  if (count <= 0) return null;
  return (
    <div className="space-y-2">
      <Notice tone="info" text={t("rejections.notice", { count })} />
      <Button
        variant="secondary"
        size="sm"
        icon={<DownloadSimple weight="bold" />}
        iconVisible
        title={busy ? t("rejections.downloading") : t("rejections.download")}
        onClick={onDownload}
        disabled={busy}
      />
    </div>
  );
}

function SeedOutcome({ job }: { job: LeadImportJob }) {
  const t = useTranslations("leadsPage.import") as unknown as ImportTranslator;
  const seed = job.seed;
  if (!seed) return null;
  const lines: { key: string; text: string; warn: boolean }[] = [];
  if (seed.error) lines.push({ key: "error", text: t.has(`seed.errors.${seed.error}`) ? t(`seed.errors.${seed.error}`) : t("generic"), warn: true });
  else if (seed.queued > 0) lines.push({ key: "queued", text: t("seed.queued", { count: seed.queued }), warn: false });
  if (seed.scriptError) {
    lines.push({
      key: "scriptError",
      text: t.has(`seed.errors.${seed.scriptError}`) ? t(`seed.errors.${seed.scriptError}`) : t("generic"),
      warn: true,
    });
  } else if (seed.scriptedQueued) {
    lines.push({ key: "scripted", text: t("seed.scriptedQueued", { count: seed.scriptedQueued }), warn: false });
  }
  if (seed.unconfirmed) lines.push({ key: "unconfirmed", text: t("seed.unconfirmed", { count: seed.unconfirmed }), warn: true });
  if (lines.length === 0) return null;
  return (
    <div className="space-y-1">
      {lines.map((line) => (
        <p key={line.key} className={cn("text-xs", line.warn ? "text-warning-ink" : "text-muted-foreground")}>
          {line.text}
        </p>
      ))}
    </div>
  );
}

export default ImportLeadsDialog;
