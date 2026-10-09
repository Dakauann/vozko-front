"use client";

import { useTranslations } from "next-intl";

import { Check, Lock, Plus } from "@/components/icons";
import { useLeadFieldDefinitions } from "@/hooks/use-lead-field-definitions";
import { normalizeKeyValueMap } from "@/lib/workflows/key-value";
import { cn } from "@/lib/utils";

export function UpdateLeadFieldKeys({
  value,
  onChange,
}: {
  value: unknown;
  onChange: (next: Record<string, string>) => void;
}) {
  const t = useTranslations("workflowsPage");
  const { definitions, loading, failed, reload } = useLeadFieldDefinitions();
  const current = normalizeKeyValueMap(value);

  return (
    <section className="space-y-2 rounded-[--radius] border border-border bg-card p-3">
      <div>
        <p className="text-xs font-medium text-foreground">{t("updateLead.keysTitle")}</p>
        <p className="mt-1 text-2xs leading-relaxed text-muted-foreground">{t("updateLead.keysHelp")}</p>
      </div>

      {failed ? (
        <div className="flex flex-wrap items-center gap-2 text-2xs text-warning-ink" role="status">
          <span>{t("updateLead.keysFailed")}</span>
          <button
            type="button"
            onClick={() => void reload()}
            className="rounded-sm font-semibold text-foreground underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            {t("updateLead.keysRetry")}
          </button>
        </div>
      ) : loading ? null : definitions.length === 0 ? (
        <p className="text-2xs text-muted-foreground">{t("updateLead.keysEmpty")}</p>
      ) : (
        <ul className="flex flex-wrap gap-1.5">
          {definitions.map((definition) => {
            const added = definition.key in current;
            const blocked = definition.sensitive;
            const Glyph = blocked ? Lock : added ? Check : Plus;
            return (
              <li key={definition.key}>
                <button
                  type="button"
                  disabled={added || blocked}
                  onClick={() => onChange({ ...current, [definition.key]: "" })}
                  title={definition.key}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-[--radius] border border-control-edge bg-card px-2 py-1 text-2xs text-foreground transition-colors duration-150",
                    "hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    "disabled:cursor-default disabled:border-border disabled:bg-muted disabled:text-muted-foreground",
                  )}
                >
                  <Glyph className="h-3 w-3 shrink-0" weight="bold" aria-hidden />
                  <span>{definition.label}</span>
                  <span className="font-mono text-muted-foreground">{definition.key}</span>
                  {blocked ? (
                    <span className="text-muted-foreground">{t("updateLead.keySensitive")}</span>
                  ) : added ? (
                    <span className="text-muted-foreground">{t("updateLead.keyAdded")}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
