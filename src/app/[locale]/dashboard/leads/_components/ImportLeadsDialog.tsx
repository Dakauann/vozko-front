"use client";

import { useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import {
  ElevatedDialog,
  ElevatedDialogContent,
  ElevatedDialogDescription,
  ElevatedDialogFooter,
  ElevatedDialogHeader,
  ElevatedDialogTitle,
} from "@/components/elevated-design/elevated-dialog";
import {
  ElevatedSelect,
  ElevatedSelectItem,
} from "@/components/elevated-design/elevated-select";
import { CheckCircle, DownloadSimple, UploadSimple, Users } from "@/components/icons";
import { useToast } from "@/hooks/use-toast";
import {
  importLeadsAction,
  LEAD_IMPORT_MAX_ROWS,
  type LeadImportResult,
} from "@/app/actions/leads";
import { buildCsvDocument } from "@/lib/csv/csv";
import { readDelimitedFile } from "@/lib/csv/parse";
import { downloadCsv } from "@/lib/browser/download";
import {
  buildLeadImportRows,
  readLeadImportFile,
  LEAD_IMPORT_TEMPLATE_COLUMNS,
  type LeadColumnMap,
  type LeadImportFile,
} from "@/lib/leads/import";
import { cn } from "@/lib/utils";

/** How many rejected lines are listed before the rest are summarised. */
const REJECTED_PREVIEW = 15;

/** "This column is not in my file." Radix selects cannot hold an empty value. */
const NO_COLUMN = "none";

/**
 * Import contacts from a spreadsheet.
 *
 * Three states, in order: choose a file, check the mapping and the counts, see
 * what happened. The middle one is the point of the whole dialog. An import is
 * a bulk write to the CRM, and the operator should know how many contacts are
 * new, how many the workspace already had, and which lines will be skipped
 * BEFORE anything is written, not after.
 *
 * The file is read in the browser and sent as rows. It never gets uploaded:
 * this is the customer's contact list, and it does not need to leave the
 * machine to be parsed and shown back to them.
 */
export function ImportLeadsDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Fired after a successful import so the list behind the dialog catches up. */
  onImported: () => void;
}) {
  const t = useTranslations("leadsPage.import");
  const { toast } = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState<string | null>(null);
  const [file, setFile] = useState<LeadImportFile | null>(null);
  const [map, setMap] = useState<LeadColumnMap>({ number: 0, name: 1, age: null });
  const [onExisting, setOnExisting] = useState<"fill_empty" | "skip">("fill_empty");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<LeadImportResult | null>(null);

  const parsed = useMemo(
    () => (file ? buildLeadImportRows(file, map) : null),
    [file, map],
  );

  const tooManyRows = (parsed?.rows.length ?? 0) > LEAD_IMPORT_MAX_ROWS;
  const canImport = !importing && !tooManyRows && (parsed?.rows.length ?? 0) > 0;

  const reset = () => {
    setFileName(null);
    setFile(null);
    setMap({ number: 0, name: 1, age: null });
    setResult(null);
    setImporting(false);
  };

  const close = (next: boolean) => {
    if (!next) reset();
    onOpenChange(next);
  };

  const pickFile = async (picked: File) => {
    setResult(null);
    setFileName(picked.name);
    const text = await readDelimitedFile(picked);
    const read = readLeadImportFile(text);
    setFile(read);
    // The guess is a starting point the operator can correct, not a decision.
    setMap(read.guess);
  };

  const downloadTemplate = () => {
    downloadCsv(
      buildCsvDocument([
        {
          header: [...LEAD_IMPORT_TEMPLATE_COLUMNS],
          rows: [
            ["5511987654321", "Ana Maria", 34],
            ["11987654322", "Bruno Alves", ""],
          ],
        },
      ]),
      "leads-modelo.csv",
    );
  };

  const runImport = async () => {
    if (!parsed || parsed.rows.length === 0) return;
    setImporting(true);

    const { result: outcome, error } = await importLeadsAction(parsed.rows, onExisting);
    setImporting(false);

    if (error || !outcome) {
      toast({
        title: t("error.title"),
        description: error ?? t("error.generic"),
        variant: "destructive",
      });
      return;
    }

    setResult(outcome);
    onImported();
  };

  // Columns are offered by header name when the file has one, and by position
  // when it does not. "Coluna 3" is still something an operator can match
  // against the spreadsheet open beside them.
  const columnLabel = (index: number) =>
    file?.headers?.[index]?.trim() || t("mapping.column", { index: index + 1 });

  const columnOptions = Array.from({ length: file?.columnCount ?? 0 }, (_, i) => i);

  return (
    <ElevatedDialog open={open} onOpenChange={close}>
      <ElevatedDialogContent className="max-w-2xl">
        <ElevatedDialogHeader>
          <ElevatedDialogTitle>{t("title")}</ElevatedDialogTitle>
          <ElevatedDialogDescription>{t("description")}</ElevatedDialogDescription>
        </ElevatedDialogHeader>

        {result ? (
          <ImportSummary result={result} />
        ) : (
          <div className="space-y-4">
            {/* ── the file ─────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2">
              <Button
                variant="secondary"
                size="sm"
                icon={<UploadSimple weight="bold" />}
                iconVisible
                title={fileName ?? t("chooseFile")}
                onClick={() => inputRef.current?.click()}
              />
              <input
                ref={inputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                className="hidden"
                onChange={async (e) => {
                  const picked = e.target.files?.[0];
                  if (picked) await pickFile(picked);
                  // Reset so re-picking the same file fires change again.
                  e.target.value = "";
                }}
              />
              <Button
                variant="ghost"
                size="sm"
                icon={<DownloadSimple weight="bold" />}
                iconVisible
                title={t("template")}
                onClick={downloadTemplate}
              />
            </div>

            {file ? (
              <>
                {/* ── the mapping ──────────────────────────────────────── */}
                <div className="space-y-2">
                  <p className="text-sm font-medium text-foreground">
                    {t("mapping.title")}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {file.headers ? t("mapping.detected") : t("mapping.noHeader")}
                  </p>
                  <div className="grid gap-2 sm:grid-cols-3">
                    <ElevatedSelect
                      label={t("mapping.number")}
                      value={String(map.number)}
                      onValueChange={(v) => setMap({ ...map, number: Number(v) })}
                    >
                      {columnOptions.map((i) => (
                        <ElevatedSelectItem key={i} value={String(i)}>
                          {columnLabel(i)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>

                    <ElevatedSelect
                      label={t("mapping.name")}
                      value={map.name === null ? NO_COLUMN : String(map.name)}
                      onValueChange={(v) =>
                        setMap({ ...map, name: v === NO_COLUMN ? null : Number(v) })
                      }
                    >
                      <ElevatedSelectItem value={NO_COLUMN}>
                        {t("mapping.none")}
                      </ElevatedSelectItem>
                      {columnOptions.map((i) => (
                        <ElevatedSelectItem key={i} value={String(i)}>
                          {columnLabel(i)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>

                    <ElevatedSelect
                      label={t("mapping.age")}
                      value={map.age === null ? NO_COLUMN : String(map.age)}
                      onValueChange={(v) =>
                        setMap({ ...map, age: v === NO_COLUMN ? null : Number(v) })
                      }
                    >
                      <ElevatedSelectItem value={NO_COLUMN}>
                        {t("mapping.none")}
                      </ElevatedSelectItem>
                      {columnOptions.map((i) => (
                        <ElevatedSelectItem key={i} value={String(i)}>
                          {columnLabel(i)}
                        </ElevatedSelectItem>
                      ))}
                    </ElevatedSelect>
                  </div>

                  {/* Only three fields land on a lead. Saying so here stops an
                      operator hunting for the e-mail column that has nowhere to
                      go, and stops them believing it was imported silently. */}
                  <p className="text-xs text-muted-foreground">{t("mapping.onlyThese")}</p>
                </div>

                {/* ── what will happen ─────────────────────────────────── */}
                <div className="rounded-[--radius] border border-border bg-card px-3 py-2">
                  <p className="text-sm text-foreground">
                    {t("summary.counts", {
                      valid: parsed?.rows.length ?? 0,
                      invalid: parsed?.invalid ?? 0,
                      duplicates: parsed?.duplicates ?? 0,
                    })}
                  </p>

                  {tooManyRows ? (
                    <p className="mt-1 text-xs font-semibold text-destructive-ink">
                      {t("summary.tooMany", { max: LEAD_IMPORT_MAX_ROWS })}
                    </p>
                  ) : null}

                  {parsed && parsed.rejected.length > 0 ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-xs font-medium text-foreground">
                        {t("summary.rejectedTitle", { count: parsed.rejected.length })}
                      </summary>
                      <ul className="mt-2 space-y-1">
                        {parsed.rejected.slice(0, REJECTED_PREVIEW).map((item) => (
                          <li
                            key={item.line}
                            className="flex gap-2 text-2xs text-muted-foreground"
                          >
                            <span className="shrink-0 tabular-nums">#{item.line}</span>
                            <span className="min-w-0 flex-1 truncate font-mono">
                              {item.raw}
                            </span>
                            <span className="shrink-0 text-warning-ink">
                              {t(`reasons.${item.reason}`)}
                            </span>
                          </li>
                        ))}
                      </ul>
                      {parsed.rejected.length > REJECTED_PREVIEW ? (
                        <p className="mt-1 text-2xs text-muted-foreground">
                          +{parsed.rejected.length - REJECTED_PREVIEW}
                        </p>
                      ) : null}
                    </details>
                  ) : null}
                </div>

                {/* ── what to do about contacts already here ───────────── */}
                <ElevatedSelect
                  label={t("existing.label")}
                  value={onExisting}
                  onValueChange={(v) => setOnExisting(v as "fill_empty" | "skip")}
                >
                  <ElevatedSelectItem value="fill_empty">
                    {t("existing.fillEmpty")}
                  </ElevatedSelectItem>
                  <ElevatedSelectItem value="skip">
                    {t("existing.skip")}
                  </ElevatedSelectItem>
                </ElevatedSelect>
                <p className="text-xs text-muted-foreground">{t("existing.neverOverwrites")}</p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">{t("empty")}</p>
            )}
          </div>
        )}

        <ElevatedDialogFooter>
          {result ? (
            <Button variant="primary" title={t("done")} onClick={() => close(false)} />
          ) : (
            <>
              <Button
                variant="ghost"
                title={t("cancel")}
                onClick={() => close(false)}
                disabled={importing}
              />
              <Button
                variant="primary"
                title={importing ? t("importing") : t("confirm")}
                onClick={runImport}
                disabled={!canImport}
              />
            </>
          )}
        </ElevatedDialogFooter>
      </ElevatedDialogContent>
    </ElevatedDialog>
  );
}

/**
 * What the import actually did.
 *
 * Created and matched are shown as separate numbers, never summed. "500
 * importados" when 430 of them already existed is how an operator concludes the
 * import is broken and runs it three more times.
 */
function ImportSummary({ result }: { result: LeadImportResult }) {
  const t = useTranslations("leadsPage.import");

  const tiles = [
    {
      key: "created",
      label: t("result.created"),
      value: result.created,
      tone: "text-healthy-ink",
      icon: CheckCircle,
    },
    {
      key: "matched",
      label: t("result.matched"),
      value: result.matched,
      tone: "text-info-ink",
      icon: Users,
    },
  ];

  const skipped = result.invalid + result.duplicate;

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        {tiles.map((tile) => (
          <div
            key={tile.key}
            className="rounded-[--radius] border border-border bg-card p-3"
          >
            <div className="flex items-center gap-2">
              <tile.icon className={cn("h-4 w-4", tile.tone)} weight="fill" />
              <p className="truncate text-2xs font-semibold text-muted-foreground">
                {tile.label}
              </p>
            </div>
            <p className="readout mt-1 font-display text-2xl font-semibold text-foreground">
              {tile.value}
            </p>
          </div>
        ))}
      </div>

      {skipped > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t("result.skipped", {
            invalid: result.invalid,
            duplicates: result.duplicate,
          })}
        </p>
      ) : null}

      {/* Blocked contacts import like any other, but a campaign built on this
          list will not reach them. Better said now than discovered later as
          silent non-delivery. */}
      {result.blocked > 0 ? (
        <p className="text-xs text-warning-ink">
          {t("result.blocked", { count: result.blocked })}
        </p>
      ) : null}
    </div>
  );
}

export default ImportLeadsDialog;
