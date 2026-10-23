"use client";

import { useTranslations } from "next-intl";

import { CopyButton } from "@/app/[locale]/dashboard/links/_components/CopyButton";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip, type StatusChipTone } from "@/components/elevated-design/status-chip";
import { recordProgress, recordRows } from "@/lib/email-marketing/records";
import type { EmailDnsRecord, EmailRecordStatus } from "@/lib/email-marketing/types";

const STATUS_TONE: Record<EmailRecordStatus, StatusChipTone> = {
  verified: "healthy",
  pending: "warning",
  unknown: "muted",
};

export function DnsRecordsTable({ records, domain }: { records: EmailDnsRecord[]; domain: string }) {
  const t = useTranslations("emailMarketing.records");
  const rows = recordRows(records);
  const progress = recordProgress(records);

  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("none")}</p>;

  return (
    <div className="space-y-2">
      <p className="readout text-xs text-muted-foreground">{t("progress", { verified: progress.verified, total: progress.total })}</p>
      <div className="overflow-x-auto rounded-[--radius] border border-border">
        <table className="w-full min-w-[44rem] text-left text-sm">
          <caption className="sr-only">{t("caption", { domain })}</caption>
          <thead className="bg-muted">
            <tr className="border-b border-border-strong">
              <th scope="col" className="legend px-3 py-2 font-semibold">{t("status")}</th>
              <th scope="col" className="legend px-3 py-2 font-semibold">{t("purpose")}</th>
              <th scope="col" className="legend px-3 py-2 font-semibold">{t("type")}</th>
              <th scope="col" className="legend px-3 py-2 font-semibold">{t("host")}</th>
              <th scope="col" className="legend px-3 py-2 font-semibold">{t("value")}</th>
              <th scope="col" className="legend px-3 py-2 text-right font-semibold">{t("priority")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-b border-border align-top last:border-b-0">
                <td className="px-3 py-2.5">
                  <StatusChip tone={STATUS_TONE[row.status] ?? "muted"} label={t(`statuses.${row.status}`)} />
                </td>
                <td className="px-3 py-2.5">
                  <p className="font-medium text-foreground">{t(`purposes.${row.purpose}.name`)}</p>
                  <p className="mt-0.5 max-w-[22ch] text-xs leading-snug text-muted-foreground">{t(`purposes.${row.purpose}.caption`)}</p>
                </td>
                <td className="px-3 py-2.5">
                  <span className="rounded-[4px] border border-border bg-card px-1.5 py-0.5 font-mono text-xs text-foreground">{row.type}</span>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <div className="min-w-0">
                      <p className="break-all font-mono text-xs text-foreground">{row.host}</p>
                      <p className="mt-0.5 break-all font-mono text-2xs text-muted-foreground">{row.fullName}</p>
                    </div>
                    <CopyButton value={row.host} label={t("copyHost", { host: row.host })} copiedLabel={t("copied")} className="h-7 w-7 shrink-0" />
                  </div>
                </td>
                <td className="px-3 py-2.5">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 max-w-[36ch] break-all font-mono text-xs text-foreground">{row.value}</p>
                    <CopyButton value={row.value} label={t("copyValue", { purpose: t(`purposes.${row.purpose}.name`) })} copiedLabel={t("copied")} className="h-7 w-7 shrink-0" />
                  </div>
                </td>
                <td className="px-3 py-2.5 text-right tabular-nums text-foreground">{row.priority ?? <EmptyValue />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
