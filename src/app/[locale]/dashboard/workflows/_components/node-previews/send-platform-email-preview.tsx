"use client";

import { useTranslations } from "next-intl";

import { EnvelopeSimple } from "@/components/icons";
import { platformEmailSummary } from "@/lib/workflows/platform-email-node";

export function SendPlatformEmailPreview({ config }: { config: Record<string, unknown> }) {
  const t = useTranslations("workflowsPage.platformEmailNode");
  const summary = platformEmailSummary(config);
  const body = summary.mode === "design" ? summary.designName || t("design") : summary.body;
  return (
    <div className="px-2 py-2" data-testid="send-platform-email-preview">
      <div className="overflow-hidden rounded-lg border border-border bg-background">
        <div className="flex items-center gap-1.5 border-b border-border px-2 py-1">
          <EnvelopeSimple size={12} weight="fill" className="text-primary-ink" />
          <span className="min-w-0 flex-1 truncate text-2xs font-medium text-foreground/70">
            {summary.senderName || t("defaultSender")}
          </span>
        </div>
        <div className="px-2 py-1.5">
          <p className="truncate text-2xs font-semibold text-foreground/80">{summary.subject || t("noSubject")}</p>
          <p className="truncate text-2xs text-muted-foreground">{t("to", { to: summary.to || t("leadEmail") })}</p>
          <p className="mt-0.5 line-clamp-2 text-2xs leading-snug text-foreground/60">{body || t("empty")}</p>
        </div>
      </div>
    </div>
  );
}
