"use client";

import { useId } from "react";
import { useTranslations } from "next-intl";

import { Plus, Trash, Warning } from "@/components/icons";
import { cn } from "@/lib/utils";
import { MAX_ALLOWED_ORIGINS, checkOrigins } from "@/lib/webchat/types";

export function AllowedOriginsEditor({
  rows,
  onChange,
  disabled = false,
  showListIssue = false,
}: {
  rows: string[];
  onChange: (rows: string[]) => void;
  disabled?: boolean;
  showListIssue?: boolean;
}) {
  const t = useTranslations("webchat.origins");
  const baseId = useId();
  const check = checkOrigins(rows);
  const canAdd = !disabled && rows.length < MAX_ALLOWED_ORIGINS;

  const update = (index: number, value: string) => onChange(rows.map((row, i) => (i === index ? value : row)));
  const remove = (index: number) => {
    const next = rows.filter((_, i) => i !== index);
    onChange(next.length > 0 ? next : [""]);
  };

  return (
    <div className="space-y-3">
      <ul className="space-y-2">
        {rows.map((row, index) => {
          const issue = row.trim() === "" ? null : check.rowIssues[index];
          const inputId = `${baseId}-${index}`;
          const hintId = `${inputId}-hint`;
          return (
            <li key={index} className="space-y-1">
              <div className="flex items-center gap-2">
                <label htmlFor={inputId} className="sr-only">
                  {t("rowLabel", { index: index + 1 })}
                </label>
                <input
                  id={inputId}
                  type="url"
                  inputMode="url"
                  autoComplete="off"
                  spellCheck={false}
                  placeholder={t("placeholder")}
                  value={row}
                  disabled={disabled}
                  onChange={(e) => update(index, e.target.value)}
                  aria-invalid={issue !== null}
                  aria-describedby={issue ? hintId : undefined}
                  className={cn(
                    "h-10 w-full min-w-0 rounded-[--radius] border bg-background px-3 font-mono text-sm text-foreground",
                    "placeholder:font-sans placeholder:text-foreground/55",
                    "transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    issue ? "border-destructive/60" : "border-border focus:border-primary/60",
                    disabled && "opacity-60",
                  )}
                />
                {!disabled && (rows.length > 1 || row !== "") && (
                  <button
                    type="button"
                    onClick={() => remove(index)}
                    title={t("remove")}
                    aria-label={t("remove")}
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-destructive-ink"
                  >
                    <Trash className="h-4 w-4" />
                  </button>
                )}
              </div>
              {issue && (
                <p id={hintId} className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
                  <Warning weight="fill" className="mt-px size-3.5 shrink-0 text-destructive-ink" />
                  {t(`issue.${issue}`)}
                </p>
              )}
            </li>
          );
        })}
      </ul>

      {showListIssue && check.listIssue && (
        <p role="alert" className="flex items-start gap-1.5 text-xs leading-relaxed text-foreground">
          <Warning weight="fill" className="mt-px size-3.5 shrink-0 text-destructive-ink" />
          {check.listIssue === "required" ? t("required") : t("tooMany", { max: MAX_ALLOWED_ORIGINS })}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => onChange([...rows, ""])}
          disabled={!canAdd}
          className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Plus weight="bold" className="h-3.5 w-3.5" />
          {t("add")}
        </button>
        <span className="text-2xs tabular-nums text-muted-foreground">
          {t("count", { count: check.origins.length, max: MAX_ALLOWED_ORIGINS })}
        </span>
      </div>

      <p className="text-xs leading-relaxed text-muted-foreground">{t("rules")}</p>
    </div>
  );
}
