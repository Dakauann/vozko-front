"use client";

import { useTranslations } from "next-intl";

import { Warning } from "@/components/icons";

export function ComposerUnresolvedVariables({ names }: { names: readonly string[] }) {
  const t = useTranslations("crmComposer.variables");
  if (names.length === 0) return null;
  return (
    <div role="status" className="flex flex-wrap items-center gap-1.5 px-2 pb-1.5 text-2xs text-foreground">
      <Warning weight="fill" aria-hidden className="h-3.5 w-3.5 flex-shrink-0 text-warning-ink" />
      <span>{t("unresolved")}</span>
      {names.map((name) => (
        <code key={name} className="rounded-[--radius] border border-border bg-muted px-1 py-px font-mono text-2xs text-foreground">
          {`{{${name}}}`}
        </code>
      ))}
    </div>
  );
}
