"use client";

import { useTranslations } from "next-intl";

import { leadExitView, type LeadExitPhrase } from "@/lib/conversations/lead-exit-event";

export function LeadExitEventLine({ type, details }: { type: string; details: Record<string, string> }) {
  const t = useTranslations("leadExit.events");
  const view = leadExitView(type, details);
  if (!view) return null;

  const phrase = (value: LeadExitPhrase) => t(value.key as "refused", value.values);
  const result = phrase(view.result);
  const reasonKey = view.reason ? `reasons.${view.reason}` : null;
  const reason = view.reason && reasonKey ? (t.has(reasonKey) ? t(reasonKey as "reasons.lead_not_found") : view.reason) : null;

  return (
    <div className="mt-0.5 space-y-0.5 text-2xs">
      <p className="text-foreground">{view.trigger ? t("line", { trigger: phrase(view.trigger), result }) : result}</p>
      {reason ? <p className="text-muted-foreground">{t("reason", { reason })}</p> : null}
      {view.confirmation ? <p className="text-muted-foreground">{t(view.confirmation as "confirmation.sent")}</p> : null}
    </div>
  );
}
