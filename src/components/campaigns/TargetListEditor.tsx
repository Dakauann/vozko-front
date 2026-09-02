"use client";

import { useMemo, useState } from "react";

import { UploadSimple } from "@/components/icons";
import { detectDelimiter, readDelimitedFile, splitCells } from "@/lib/csv/parse";
import { cn } from "@/lib/utils";

/**
 * The recipient list, with per-recipient variables.
 *
 * Shared across campaign channels because importing a list is the same job on
 * every transport: paste or upload, normalise, dedupe, report what was rejected.
 * What differs is only which numbers count as valid, so the validator arrives as
 * a prop — the official channel pins Brazil, while a linked-device session
 * reaches numbers anywhere.
 *
 * Rejected rows are REPORTED, never silently dropped. An operator told "500
 * imported" when 80 were malformed has no way to find the 80, and a campaign
 * that quietly reaches 420 people is one nobody can plan around.
 */

export interface ParsedTarget {
  number: string;
  name?: string;
  variables?: string[];
}

export interface SkippedLine {
  line: number;
  raw: string;
  reason: "invalid" | "duplicate" | "missingVariables";
}

export interface ParsedTargetList {
  targets: ParsedTarget[];
  skipped: SkippedLine[];
  duplicates: number;
  invalid: number;
  missingVariables: number;
}

/**
 * Parses a pasted blob or an uploaded CSV.
 *
 * One parser for both, because operators paste a spreadsheet column as often as
 * they upload the file, and two parsers would disagree about what a quoted field
 * or a trailing separator means.
 *
 * Column order is fixed and documented in the UI: number, name, then one column
 * per variable. Inferring it from a header would be friendlier right up to the
 * first list whose header says something we did not expect.
 */
export function parseTargetList(
  raw: string,
  requiredVariables: number,
  isValidNumber: (digits: string) => boolean,
): ParsedTargetList {
  const seen = new Set<string>();
  const targets: ParsedTarget[] = [];
  const skipped: SkippedLine[] = [];
  let duplicates = 0;
  let invalid = 0;
  let missingVariables = 0;

  const lines = raw.split(/\r?\n/);
  lines.forEach((line, index) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    const cells = splitCells(trimmed, detectDelimiter(trimmed));

    const digits = (cells[0] ?? "").replace(/\D/g, "");
    if (!isValidNumber(digits)) {
      invalid += 1;
      skipped.push({ line: index + 1, raw: trimmed, reason: "invalid" });
      return;
    }
    if (seen.has(digits)) {
      duplicates += 1;
      skipped.push({ line: index + 1, raw: trimmed, reason: "duplicate" });
      return;
    }

    const name = cells[1] || undefined;
    const variables = cells.slice(2).filter((v) => v !== "");

    // A row without enough values would send a raw {{2}} to a customer, so it is
    // rejected here rather than at the API boundary where the operator has
    // already left the screen.
    if (requiredVariables > 0 && variables.length < requiredVariables) {
      missingVariables += 1;
      skipped.push({ line: index + 1, raw: trimmed, reason: "missingVariables" });
      return;
    }

    seen.add(digits);
    targets.push({ number: digits, name, variables: variables.length ? variables : undefined });
  });

  return { targets, skipped, duplicates, invalid, missingVariables };
}

export interface TargetListEditorLabels {
  title: string;
  placeholder: string;
  upload: string;
  columnsHelp: string;
  summary: (counts: {
    valid: number;
    duplicates: number;
    invalid: number;
    missingVariables: number;
  }) => string;
  skippedTitle: string;
  reasons: Record<SkippedLine["reason"], string>;
  variablesNeeded: (count: number) => string;
}

/** How many rejected lines are listed before the rest are summarised. */
const SKIPPED_PREVIEW = 20;

export function TargetListEditor({
  value,
  onChange,
  requiredVariables,
  isValidNumber,
  labels,
  disabled,
  showUploadButton = true,
}: {
  value: string;
  onChange: (raw: string, parsed: ParsedTargetList) => void;
  requiredVariables: number;
  isValidNumber: (digits: string) => boolean;
  labels: TargetListEditorLabels;
  disabled?: boolean;
  /**
   * Off when the host supplies its own Upload control.
   *
   * The official campaign puts Upload and Download in the section header rather
   * than beside the textarea, and two upload buttons on one screen is a question
   * about which one is the real one.
   */
  showUploadButton?: boolean;
}) {
  const [fileName, setFileName] = useState<string | null>(null);

  const parsed = useMemo(
    () => parseTargetList(value, requiredVariables, isValidNumber),
    [value, requiredVariables, isValidNumber],
  );

  const update = (raw: string) => {
    onChange(raw, parseTargetList(raw, requiredVariables, isValidNumber));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <label className="text-sm font-medium text-foreground">{labels.title}</label>
        {showUploadButton ? (
        <label
          className={cn(
            "inline-flex cursor-pointer items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-foreground transition-colors hover:bg-muted",
            disabled && "pointer-events-none opacity-40",
          )}
        >
          <UploadSimple className="h-3.5 w-3.5" weight="bold" />
          {fileName ?? labels.upload}
          <input
            type="file"
            accept=".csv,.txt,text/csv,text/plain"
            className="hidden"
            disabled={disabled}
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              setFileName(file.name);
              // Read in the browser rather than uploading: the list is the
              // customer's contact data, and it does not need a round trip to
              // be parsed and shown back to them.
              update(await readDelimitedFile(file));
              // Reset so re-picking the same file fires change again.
              e.target.value = "";
            }}
          />
        </label>
        ) : null}
      </div>

      <textarea
        value={value}
        onChange={(e) => update(e.target.value)}
        disabled={disabled}
        rows={8}
        placeholder={labels.placeholder}
        className="w-full resize-y rounded-[--radius] border border-border bg-background px-3 py-2 font-mono text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/40"
      />

      <p className="text-xs text-muted-foreground">{labels.columnsHelp}</p>
      {requiredVariables > 0 ? (
        <p className="text-xs font-semibold text-warning-ink">
          {labels.variablesNeeded(requiredVariables)}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        {labels.summary({
          valid: parsed.targets.length,
          duplicates: parsed.duplicates,
          invalid: parsed.invalid,
          missingVariables: parsed.missingVariables,
        })}
      </p>

      {parsed.skipped.length > 0 ? (
        <details className="rounded-[--radius] border border-border px-3 py-2">
          <summary className="cursor-pointer text-xs font-medium text-foreground">
            {labels.skippedTitle} ({parsed.skipped.length})
          </summary>
          <ul className="mt-2 space-y-1">
            {parsed.skipped.slice(0, SKIPPED_PREVIEW).map((item) => (
              <li key={item.line} className="flex gap-2 text-2xs text-muted-foreground">
                <span className="shrink-0 tabular-nums">#{item.line}</span>
                <span className="min-w-0 flex-1 truncate font-mono">{item.raw}</span>
                <span className="shrink-0 text-warning-ink">
                  {labels.reasons[item.reason]}
                </span>
              </li>
            ))}
          </ul>
          {parsed.skipped.length > SKIPPED_PREVIEW ? (
            <p className="mt-1 text-2xs text-muted-foreground">
              +{parsed.skipped.length - SKIPPED_PREVIEW}
            </p>
          ) : null}
        </details>
      ) : null}
    </div>
  );
}
