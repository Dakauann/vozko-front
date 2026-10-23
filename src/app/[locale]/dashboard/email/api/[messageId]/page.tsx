"use client";

import type { ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { useParams, useRouter } from "next/navigation";

import { ScreenLoader } from "@/components/brand/screen-loader";
import { DashboardPageHeader } from "@/components/dashboard/DashboardPageHeader";
import { PanelSection } from "@/components/dashboard/PanelSection";
import { useEmailError } from "@/components/email-marketing/use-email-error";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { StatusChip } from "@/components/elevated-design/status-chip";
import { EnvelopeSimple } from "@/components/icons";
import { Notice } from "@/components/ui/notice";
import { useEmailLogEntry } from "@/hooks/use-email-api";
import { EMAIL_API_PATH, logStatusTone } from "@/lib/email-api/presentation";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0 space-y-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm text-foreground">{children}</dd>
    </div>
  );
}

export default function EmailLogEntryPage() {
  const t = useTranslations("emailApi");
  const format = useFormatter();
  const describe = useEmailError();
  const router = useRouter();
  const params = useParams<{ messageId: string }>();
  const entry = useEmailLogEntry(params.messageId ?? "");
  const date = (value: string) => format.dateTime(new Date(value), { dateStyle: "short", timeStyle: "medium" });

  if (entry.isPending) return <ScreenLoader fit="screen" />;

  return (
    <main className="w-full space-y-6">
      <DashboardPageHeader
        icon={<EnvelopeSimple weight="fill" />}
        badge={t("detail.title")}
        description={entry.data?.subject ?? t("detail.description")}
        back={{ onClick: () => router.push(EMAIL_API_PATH), label: t("detail.back") }}
      />

      {entry.isError ? (
        <Notice tone="fault" title={t("detail.loadFailed")}>
          <p>{describe(entry.error)}</p>
          <Button variant="outline" size="sm" title={t("detail.retry")} onClick={() => void entry.refetch()} />
        </Notice>
      ) : null}

      {entry.data ? (
        <>
          <PanelSection title={t("detail.summary")} actions={<StatusChip tone={logStatusTone(entry.data.status)} label={t(`log.statuses.${entry.data.status}`)} />}>
            <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Field label={t("detail.to")}>
                <span className="font-mono text-xs">{entry.data.to}</span> <span className="text-muted-foreground">({t(`log.roles.${entry.data.role}`)})</span>
              </Field>
              <Field label={t("detail.from")}>
                <span className="font-mono text-xs">{entry.data.from}</span>
              </Field>
              <Field label={t("detail.subject")}>{entry.data.subject}</Field>
              <Field label={t("detail.created")}>
                <span className="tabular-nums">{date(entry.data.created_at)}</span>
              </Field>
              <Field label={t("detail.lastEvent")}>
                {entry.data.last_event && entry.data.last_event_at ? (
                  <span>
                    {t.has(`events.${entry.data.last_event}`) ? t(`events.${entry.data.last_event}`) : entry.data.last_event} · <span className="tabular-nums">{date(entry.data.last_event_at)}</span>
                  </span>
                ) : (
                  <EmptyValue />
                )}
              </Field>
              <Field label={t("detail.refusal")}>{entry.data.error_code ? describe({ code: entry.data.error_code }) : <EmptyValue />}</Field>
              <Field label={t("detail.idempotencyKey")}>
                <span className="font-mono text-xs">{entry.data.idempotency_key}</span>
              </Field>
              <Field label={t("detail.origin")}>{t(`detail.origins.${entry.data.origin}`)}</Field>
              <Field label={t("detail.tags")}>
                {Object.keys(entry.data.tags).length === 0 ? (
                  <EmptyValue />
                ) : (
                  <span className="flex flex-wrap gap-1">
                    {Object.entries(entry.data.tags).map(([name, value]) => (
                      <StatusChip key={name} tone="outline" label={`${name}: ${value}`} />
                    ))}
                  </span>
                )}
              </Field>
            </dl>
          </PanelSection>

          <PanelSection title={t("detail.timeline")} description={t("detail.timelineDescription")}>
            {entry.data.events.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t("detail.noEvents")}</p>
            ) : (
              <ol className="space-y-3 border-l border-border pl-4">
                {entry.data.events.map((event, index) => (
                  <li key={`${event.kind}-${event.occurred_at}-${index}`} className="relative">
                    <span aria-hidden="true" className="absolute -left-[21px] top-1.5 h-2 w-2 rounded-full bg-primary" />
                    <p className="text-sm font-medium text-foreground">
                      {t.has(`events.${event.kind}`) ? t(`events.${event.kind}`) : event.kind}
                      {event.is_bot ? <span className="ml-2 text-xs font-normal text-muted-foreground">{t("detail.bot")}</span> : null}
                    </p>
                    <p className="text-xs text-muted-foreground tabular-nums">{date(event.occurred_at)}</p>
                    {event.link ? <p className="truncate font-mono text-xs text-muted-foreground">{event.link}</p> : null}
                  </li>
                ))}
              </ol>
            )}
          </PanelSection>
        </>
      ) : null}
    </main>
  );
}
