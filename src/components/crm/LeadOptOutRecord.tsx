"use client";

import { useFormatter, useTranslations } from "next-intl";

import { BellSlash } from "@/components/icons";
import { instantOf } from "@/lib/leads/detail";
import type { LeadCardOptOut } from "@/lib/leads/types";

const SOURCES = new Set(["manual", "conversation_request", "button_reply", "workflow", "ai_agent", "elo", "keyword", "api"]);
const EVIDENCE_TYPES = new Set(["message", "button_reply", "note", "form_submission", "import_line"]);

export function LeadOptOutRecord({
  record,
  legacyLine,
  onRegrant,
}: {
  record: LeadCardOptOut | undefined;
  legacyLine: string | null;
  onRegrant?: () => void;
}) {
  const t = useTranslations("leadExit.contact");
  const tLead = useTranslations("crmContactPanel.lead");
  const format = useFormatter();
  const when = (iso: string | undefined) => {
    const at = instantOf(iso);
    return at ? format.dateTime(at, { dateStyle: "short", timeStyle: "short" }) : null;
  };

  const leftAt = when(record?.at);
  const confirmedAt = when(record?.confirmationSentAt);
  const excerpt = record?.excerpt?.trim();
  const evidence = excerpt
    ? t("evidence", { excerpt })
    : record?.evidenceType && EVIDENCE_TYPES.has(record.evidenceType)
      ? t(`evidenceType.${record.evidenceType}` as "evidenceType.note")
      : null;

  return (
    <span className="inline-flex flex-col items-end gap-0.5 text-right">
      <span className="inline-flex items-center gap-1 text-muted-foreground">
        <BellSlash className="h-3 w-3" aria-hidden />
        {tLead("optedOut")}
      </span>
      {record ? (
        <>
          {leftAt ? <span className="text-foreground">{t("leftAt", { date: leftAt })}</span> : null}
          <span className="text-muted-foreground">{t(`how.${SOURCES.has(record.source) ? record.source : "other"}` as "how.other")}</span>
          {evidence ? <span className="break-words text-muted-foreground">{evidence}</span> : null}
          {confirmedAt ? <span className="text-muted-foreground">{t("confirmationSent", { date: confirmedAt })}</span> : null}
        </>
      ) : legacyLine ? (
        <span className="text-muted-foreground">{legacyLine}</span>
      ) : null}
      {onRegrant ? (
        <button
          type="button"
          onClick={onRegrant}
          className="mt-0.5 rounded-[--radius] text-xs font-medium text-primary-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {t("regrant")}
        </button>
      ) : null}
    </span>
  );
}
