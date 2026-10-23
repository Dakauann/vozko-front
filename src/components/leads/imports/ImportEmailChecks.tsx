"use client";

import { useFormatter, useTranslations } from "next-intl";

import ElevatedSwitch from "@/components/elevated-design/elevated-switch";
import { ExplainerHint } from "@/components/explainers/ExplainerHint";
import { LEAD_IMPORT_EMAIL_VERDICTS, type LeadImportCounts, type LeadImportEmailFixes, type LeadImportEmailVerdict } from "@/lib/leads/imports";
import { cn } from "@/lib/utils";

const VERDICT_MARK: Record<LeadImportEmailVerdict, string> = {
  valid: "bg-healthy",
  typo: "bg-warning",
  role: "bg-warning",
  suppressed: "bg-destructive",
  bad_address: "bg-destructive",
  no_mail_domain: "bg-destructive",
  disposable: "bg-destructive",
  domain_unknown: "bg-warning",
  domain_pending: "bg-warning",
  inactive: "bg-warning",
};

export function ImportEmailSummary({ counts }: { counts: LeadImportCounts }) {
  const t = useTranslations("leadsPage.import");
  const format = useFormatter();
  const emails = counts.emails ?? {};
  const rows = LEAD_IMPORT_EMAIL_VERDICTS.map((verdict) => ({ verdict, count: emails[verdict] ?? 0 })).filter((row) => row.count > 0);
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  if (total === 0) return null;
  return (
    <section className="space-y-2 rounded-[--radius] border border-border bg-card px-3.5 py-3" aria-label={t("emails.title")}>
      <div className="flex items-baseline justify-between gap-3">
        <h4 className="text-xs font-semibold text-foreground">{t("emails.title")}</h4>
        <span className="readout text-2xs tabular-nums text-muted-foreground">{t("emails.checked", { count: format.number(total) })}</span>
      </div>
      <dl className="grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-xs">
        {rows.map((row) => (
          <div key={row.verdict} className="contents">
            <dt className="flex min-w-0 items-center gap-2 text-muted-foreground">
              <span className={cn("size-2 shrink-0 rounded-full", VERDICT_MARK[row.verdict])} aria-hidden />
              <span className="truncate">{t(`emails.verdicts.${row.verdict}`)}</span>
            </dt>
            <dd className="readout text-right font-semibold tabular-nums text-foreground">{format.number(row.count)}</dd>
          </div>
        ))}
      </dl>
      <p className="text-2xs leading-relaxed text-muted-foreground">{t("emails.free")}</p>
    </section>
  );
}

export function ImportEmailChoices({
  counts,
  value,
  onChange,
  disabled = false,
}: {
  counts: LeadImportCounts;
  value: LeadImportEmailFixes;
  onChange: (next: LeadImportEmailFixes) => void;
  disabled?: boolean;
}) {
  const t = useTranslations("leadsPage.import");
  const format = useFormatter();
  const typos = counts.emailFixable?.typos ?? 0;
  const undeliverable = counts.emailFixable?.undeliverable ?? 0;
  if (typos === 0 && undeliverable === 0) return null;
  return (
    <div className="space-y-3">
      {typos > 0 ? (
        <ElevatedSwitch
          checked={value.fixEmailTypos}
          disabled={disabled}
          onCheckedChange={(fixEmailTypos) => onChange({ ...value, fixEmailTypos })}
          label={t("emails.fixTypos", { count: format.number(typos) })}
          description={t("emails.fixTyposHint")}
          explainer={<ExplainerHint id="email.fixImportTypos" />}
        />
      ) : null}
      {undeliverable > 0 ? (
        <ElevatedSwitch
          checked={value.dropUndeliverableEmails}
          disabled={disabled}
          onCheckedChange={(dropUndeliverableEmails) => onChange({ ...value, dropUndeliverableEmails })}
          label={t("emails.dropUndeliverable", { count: format.number(undeliverable) })}
          description={t("emails.dropUndeliverableHint")}
          explainer={<ExplainerHint id="email.dropUndeliverableImport" />}
        />
      ) : null}
    </div>
  );
}
