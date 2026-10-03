"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { ArrowRight, ChartBar, ChartLine, Table } from "@/components/icons";
import { reportTemplateHref } from "@/lib/advertising/connect";
import type { AdReportTemplate, AdReportView } from "@/lib/advertising/types";

import { useReportOptions } from "./use-report-options";

const VIEW_ICONS: Record<AdReportView, typeof Table> = { pivot: Table, trend: ChartLine, bars: ChartBar };

export function useTemplateText() {
  const t = useTranslations("adsReports.templates");
  return (key: string) => {
    const known = t.has(`${key}.title`);
    return {
      title: known ? t(`${key}.title`) : t("unknown.title"),
      description: known ? t(`${key}.description`) : t("unknown.description"),
    };
  };
}

function TemplateCard({ template, accountId }: { template: AdReportTemplate; accountId: string }) {
  const t = useTranslations("adsReports.templates");
  const text = useTemplateText()(template.key);
  const Icon = VIEW_ICONS[template.definition.view] ?? Table;
  return (
    <li className="flex flex-col gap-3 rounded-[--radius] border border-border bg-card p-4 shadow-sm">
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[--radius] bg-muted text-muted-foreground" aria-hidden>
          <Icon className="h-4 w-4" weight="bold" />
        </span>
        <div className="min-w-0 space-y-1">
          <p className="text-sm font-semibold text-foreground">{text.title}</p>
          <p className="text-xs text-muted-foreground">{text.description}</p>
        </div>
      </div>
      <div>
        <Button
          variant="secondary"
          size="sm"
          title={t("open")}
          icon={<ArrowRight className="h-3.5 w-3.5" weight="bold" />}
          iconVisible
          iconSide="right"
          link={reportTemplateHref(template.key, accountId)}
        />
      </div>
    </li>
  );
}

export function ReportTemplates({ accountId }: { accountId: string }) {
  const t = useTranslations("adsReports.templates");
  const options = useReportOptions(true);

  return (
    <section aria-labelledby="report-templates-title" className="space-y-3">
      <h2 id="report-templates-title" className="font-display text-base font-semibold text-foreground">
        {t("title")}
      </h2>
      {options.status === "loading" || options.status === "idle" ? (
        <div className="space-y-3">
          {[0, 1, 2].map((index) => (
            <div key={index} className="h-28 animate-pulse rounded-[--radius] bg-muted" />
          ))}
        </div>
      ) : null}
      {options.status === "error" ? <p className="text-sm text-destructive-ink">{t("failed", { message: options.message })}</p> : null}
      {options.status === "ready" ? (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
          {options.data.templates.map((template) => (
            <TemplateCard key={template.key} template={template} accountId={accountId} />
          ))}
        </ul>
      ) : null}
    </section>
  );
}
