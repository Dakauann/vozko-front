"use client";

import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import { Check, Image as ImageGlyph, PencilSimple, Warning, X } from "@/components/icons";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { isRejected, rowIssues } from "@/lib/advertising/delivery";
import type { TableRow } from "@/lib/advertising/manager-drafts";
import type { AdRow } from "@/lib/advertising/types";

import { AdImage } from "../ad-image";

const ICON_BUTTON =
  "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";

function RejectionNote({ row }: { row: AdRow }) {
  const t = useTranslations("adsManager.table");
  if (!isRejected(row)) return null;
  const first = rowIssues(row)[0];
  const reason = first ? first.message || first.title : "";
  return (
    <span className="line-clamp-2 text-2xs text-destructive-ink" title={reason || undefined}>
      {reason ? t("rejectedReason", { reason }) : t("rejectedNoReason")}
    </span>
  );
}

function IssuesBadge({ row }: { row: AdRow }) {
  const t = useTranslations("adsManager.table");
  const issues = rowIssues(row);
  if (issues.length === 0) return null;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(event) => event.stopPropagation()}
            className="inline-flex items-center gap-1 rounded-[--radius] px-1 text-2xs font-semibold text-warning-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={t("issues", { count: issues.length })}
          >
            <Warning className="h-3.5 w-3.5" weight="fill" aria-hidden />
            {t("issues", { count: issues.length })}
          </button>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-xs">
          <ul className="space-y-1.5">
            {issues.map((issue, index) => (
              <li key={index} className="text-xs">
                {issue.title ? <span className="block font-semibold">{issue.title}</span> : null}
                {issue.message ? <span className="block">{issue.message}</span> : null}
              </li>
            ))}
          </ul>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

function RenameField({ name, onSave, onDone }: { name: string; onSave: (name: string) => Promise<string | null>; onDone: () => void }) {
  const t = useTranslations("adsManager.rename");
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = value.trim();
  const unchanged = trimmed === name.trim();

  const save = async () => {
    if (saving || !trimmed) return;
    if (unchanged) {
      onDone();
      return;
    }
    setSaving(true);
    setError(null);
    const failure = await onSave(trimmed);
    setSaving(false);
    if (failure) {
      setError(failure);
      return;
    }
    onDone();
  };

  return (
    <div className="space-y-1" onClick={(event) => event.stopPropagation()}>
      <div className="flex items-center gap-1">
        <input
          value={value}
          onChange={(event) => setValue(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") void save();
            if (event.key === "Escape") onDone();
          }}
          disabled={saving}
          autoFocus
          maxLength={400}
          aria-label={t("label")}
          className="h-7 min-w-0 flex-1 rounded-[--radius] border border-control-edge bg-card px-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        />
        <button type="button" className={ICON_BUTTON} onClick={() => void save()} disabled={saving || !trimmed} aria-label={t("save")} title={t("save")}>
          <Check className="h-3.5 w-3.5" weight="bold" aria-hidden />
        </button>
        <button type="button" className={ICON_BUTTON} onClick={onDone} disabled={saving} aria-label={t("cancel")} title={t("cancel")}>
          <X className="h-3.5 w-3.5" weight="bold" aria-hidden />
        </button>
      </div>
      {!trimmed ? <p className="text-2xs text-destructive-ink">{t("required")}</p> : null}
      {error ? (
        <p className="text-2xs text-destructive-ink" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function NameCell({
  row,
  openable,
  onOpen,
  canRename,
  onRename,
  actions,
}: {
  row: TableRow;
  openable: boolean;
  onOpen: () => void;
  canRename: boolean;
  onRename: (name: string) => Promise<string | null>;
  actions: ReactNode;
}) {
  const t = useTranslations("adsManager.rename");
  const tDrafts = useTranslations("adsManager.drafts");
  const [editing, setEditing] = useState(false);
  const thumbnail = row.creative?.thumbnailUrl || row.creative?.imageUrl;

  return (
    <div className="flex min-w-[240px] max-w-[380px] items-start gap-2.5">
      {row.level === "ad" ? (
        <span className="relative mt-0.5 h-9 w-9 shrink-0 overflow-hidden rounded-[--radius] bg-muted">
          {thumbnail ? (
            <AdImage src={thumbnail} />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-muted-foreground">
              <ImageGlyph className="h-4 w-4" aria-hidden />
            </span>
          )}
        </span>
      ) : null}
      <div className="flex min-w-0 flex-1 flex-col">
        {editing ? (
          <RenameField name={row.name} onSave={onRename} onDone={() => setEditing(false)} />
        ) : (
          <div className="flex min-w-0 items-center gap-1">
            {openable ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onOpen();
                }}
                title={row.name}
                className="truncate text-left text-sm font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {row.name}
              </button>
            ) : (
              <span className="truncate text-sm font-medium text-foreground" title={row.name}>
                {row.name}
              </span>
            )}
            {canRename ? (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  setEditing(true);
                }}
                aria-label={t("open", { name: row.name })}
                title={t("open", { name: row.name })}
                className={`${ICON_BUTTON} sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100`}
              >
                <PencilSimple className="h-3.5 w-3.5" aria-hidden />
              </button>
            ) : null}
          </div>
        )}
        <span className="flex items-center gap-2">
          <span className="truncate text-2xs tabular-nums text-muted-foreground">{row.draft ? tDrafts("label") : row.metaId}</span>
          <IssuesBadge row={row} />
        </span>
        <RejectionNote row={row} />
        <div className="mt-1 flex flex-wrap items-center gap-0.5 sm:opacity-0 sm:transition-opacity sm:focus-within:opacity-100 sm:group-hover:opacity-100">
          {actions}
        </div>
      </div>
    </div>
  );
}
