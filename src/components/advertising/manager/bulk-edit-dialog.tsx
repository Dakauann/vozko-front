"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { isAdsError } from "@/app/actions/advertising";
import { bulkEditAdObjectsAction } from "@/app/actions/advertising-bulk";
import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedPillToggle } from "@/components/elevated-design/elevated-pill-toggle";
import ElevatedTextarea from "@/components/elevated-design/elevated-textarea";
import { CheckCircle, WarningCircle } from "@/components/icons";
import { bulkChangeOf, bulkOutcomes, bulkTally, type BulkForm, type BulkMode, type BulkOutcome } from "@/lib/advertising/manager-bulk";
import type { TableRow } from "@/lib/advertising/manager-drafts";
import type { AdBulkField, AdLevel } from "@/lib/advertising/types";

import { useAdsErrorText } from "../use-ads-error";
import { CheckRow } from "../wizard/choice-row";

export interface BulkEditRequest {
  field: AdBulkField;
  mode: BulkMode;
  rows: TableRow[];
}

const MODES: BulkMode[] = ["set", "replace"];

export function BulkResults({ rows, outcomes }: { rows: TableRow[]; outcomes: BulkOutcome[] }) {
  const t = useTranslations("adsManager.bulk");
  const names = new Map(rows.map((row) => [row.metaId, row.name]));
  return (
    <ul className="max-h-72 divide-y divide-border overflow-y-auto rounded-[--radius] border border-border">
      {outcomes.map((outcome) => (
        <li key={outcome.metaId} className="flex items-start gap-2 px-3 py-2 text-sm">
          {outcome.ok ? (
            <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-healthy-ink" weight="fill" aria-hidden />
          ) : (
            <WarningCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive-ink" weight="fill" aria-hidden />
          )}
          <span className="min-w-0 flex-1">
            <span className="block truncate text-foreground">{outcome.object?.name ?? names.get(outcome.metaId) ?? outcome.metaId}</span>
            {!outcome.ok ? <span className="block text-xs text-destructive-ink">{outcome.message ?? t("noAnswer")}</span> : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function BulkResultsView({ rows, outcomes, onClose }: { rows: TableRow[]; outcomes: BulkOutcome[]; onClose: () => void }) {
  const t = useTranslations("adsManager.bulk");
  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("resultsTitle")}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("tally", bulkTally(outcomes))}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <BulkResults rows={rows} outcomes={outcomes} />
      <ElevatedDialogFooter>
        <Button variant="primary" size="sm" title={t("close")} onClick={onClose} />
      </ElevatedDialogFooter>
    </>
  );
}

function BulkEditForm({
  request,
  level,
  saving,
  setSaving,
  onClose,
  onApplied,
}: {
  request: BulkEditRequest;
  level: AdLevel;
  saving: boolean;
  setSaving: (saving: boolean) => void;
  onClose: () => void;
  onApplied: (outcomes: BulkOutcome[]) => void;
}) {
  const t = useTranslations("adsManager.bulk");
  const tFields = useTranslations("adsManager.toolbar.fields");
  const errorText = useAdsErrorText();
  const [form, setForm] = useState<BulkForm>({ field: request.field, mode: request.mode, value: "", find: "", replace: "", matchCase: false });
  const [touched, setTouched] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcomes, setOutcomes] = useState<BulkOutcome[] | null>(null);
  const parsed = bulkChangeOf(form, level);
  const problem = "problem" in parsed ? parsed.problem : null;
  const fieldName = tFields(form.field);
  const patch = (next: Partial<BulkForm>) => setForm((current) => ({ ...current, ...next }));

  const submit = () => {
    setTouched(true);
    if ("problem" in parsed) return;
    const ids = request.rows.map((row) => row.metaId);
    setSaving(true);
    setError(null);
    void bulkEditAdObjectsAction(ids, parsed.change).then((result) => {
      setSaving(false);
      if (isAdsError(result)) {
        setError(errorText(result));
        return;
      }
      const next = bulkOutcomes(ids, result.data.results ?? []);
      setOutcomes(next);
      onApplied(next);
    });
  };

  if (outcomes) return <BulkResultsView rows={request.rows} outcomes={outcomes} onClose={onClose} />;

  return (
    <>
      <ElevatedDialogHeader>
        <ElevatedDialogTitle>{t("title", { field: fieldName })}</ElevatedDialogTitle>
        <ElevatedDialogDescription>{t("appliesTo", { count: request.rows.length })}</ElevatedDialogDescription>
      </ElevatedDialogHeader>
      <div className="space-y-4">
        <ElevatedPillToggle<BulkMode>
          aria-label={t("mode")}
          size="md"
          value={form.mode}
          onChange={(mode) => patch({ mode })}
          options={MODES.map((mode) => ({ value: mode, label: t(`modes.${mode}`) }))}
        />
        {form.mode === "set" ? (
          <div className="space-y-1">
            {form.field === "primaryText" ? (
              <ElevatedTextarea label={t("newValue", { field: fieldName })} value={form.value} onChange={(event) => patch({ value: event.target.value })} />
            ) : (
              <ElevatedInput
                label={t("newValue", { field: fieldName })}
                value={form.value}
                onChange={(event) => patch({ value: event.target.value })}
                controlSize="sm"
              />
            )}
            {touched && problem === "valueRequired" ? <p className="text-xs text-destructive-ink">{t("valueRequired")}</p> : null}
          </div>
        ) : (
          <div className="space-y-3">
            <div className="space-y-1">
              <ElevatedInput label={t("find")} value={form.find} onChange={(event) => patch({ find: event.target.value })} controlSize="sm" />
              {touched && problem === "findRequired" ? <p className="text-xs text-destructive-ink">{t("findRequired")}</p> : null}
            </div>
            <ElevatedInput label={t("replace")} value={form.replace} onChange={(event) => patch({ replace: event.target.value })} controlSize="sm" />
            <CheckRow checked={form.matchCase} onChange={(matchCase) => patch({ matchCase })} title={t("matchCase")} />
          </div>
        )}
        {problem === "fieldNotForLevel" ? <p className="text-xs text-destructive-ink">{t("fieldNotForLevel")}</p> : null}
        {error ? (
          <p className="text-sm text-destructive-ink" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <ElevatedDialogFooter>
        <Button variant="ghost" size="sm" title={t("cancel")} onClick={onClose} disabled={saving} />
        <Button variant="primary" size="sm" title={saving ? t("saving") : t("apply")} onClick={submit} disabled={saving || problem === "fieldNotForLevel"} />
      </ElevatedDialogFooter>
    </>
  );
}

export function BulkEditDialog({
  request,
  level,
  onClose,
  onApplied,
}: {
  request: BulkEditRequest | null;
  level: AdLevel;
  onClose: () => void;
  onApplied: (outcomes: BulkOutcome[]) => void;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <ElevatedDialog open={!!request} onOpenChange={(open) => !open && !saving && onClose()}>
      <ElevatedDialogContent>
        {request ? (
          <BulkEditForm
            key={`${request.field}:${request.mode}:${request.rows.map((row) => row.metaId).join(",")}`}
            request={request}
            level={level}
            saving={saving}
            setSaving={setSaving}
            onClose={onClose}
            onApplied={onApplied}
          />
        ) : null}
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}
