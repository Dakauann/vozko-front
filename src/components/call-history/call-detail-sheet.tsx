"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { DownloadSimple, PhoneIncoming, PhoneOutgoing, SpinnerGap, Waveform, WhatsappLogo, XCircle } from "@/components/icons";
import Button from "@/components/elevated-design/button";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import {
  ElevatedSheet,
  ElevatedSheetContent,
  ElevatedSheetDescription,
  ElevatedSheetHeader,
  ElevatedSheetTitle,
} from "@/components/elevated-design/elevated-sheet";
import { CallOutcomeBadge } from "@/components/call-history/call-outcome-badge";
import { CallTimeline } from "@/components/call-history/call-timeline";
import { getCallAction } from "@/app/actions/call-history";
import { formatCallDuration } from "@/hooks/use-call-clock";
import { Link } from "@/i18n/routing";
import { contactLabel } from "@/lib/call-history/format";
import type { CallDetail } from "@/lib/call-history/types";
import { formatPhoneForDisplay } from "@/lib/phone/display";

interface Loaded {
  callId: string;
  call?: CallDetail;
  error?: string;
}

interface CallDetailSheetProps {
  callId: string | null;
  onOpenChange: (open: boolean) => void;
  chargeLabel: (micros: number | undefined) => string;
}

export function CallDetailSheet({ callId, onOpenChange, chargeLabel }: CallDetailSheetProps) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!callId) return;
    let cancelled = false;
    void getCallAction(callId).then((result) => {
      if (!cancelled) setLoaded({ callId, call: result.call, error: result.error });
    });
    return () => {
      cancelled = true;
    };
  }, [callId, attempt]);

  const current = loaded?.callId === callId ? loaded : null;

  return (
    <ElevatedSheet open={callId !== null} onOpenChange={onOpenChange}>
      <ElevatedSheetContent side="right" className="w-full overflow-y-auto sm:max-w-[520px]">
        {!current ? (
          <SheetMessage icon={<SpinnerGap className="h-6 w-6 animate-spin text-muted-foreground" aria-hidden />} />
        ) : current.call ? (
          <CallDetailBody call={current.call} chargeLabel={chargeLabel} />
        ) : (
          <SheetMessage
            icon={<XCircle className="h-7 w-7 text-destructive-ink" weight="fill" aria-hidden />}
            error={current.error}
            onRetry={() => {
              setLoaded(null);
              setAttempt((value) => value + 1);
            }}
          />
        )}
      </ElevatedSheetContent>
    </ElevatedSheet>
  );
}

function SheetMessage({ icon, error, onRetry }: { icon: ReactNode; error?: string; onRetry?: () => void }) {
  const t = useTranslations("callHistory.detail");
  return (
    <div role={error ? "alert" : "status"} className="flex h-full min-h-60 flex-col items-center justify-center gap-3 p-6 text-center">
      <ElevatedSheetTitle className="sr-only">{t("title")}</ElevatedSheetTitle>
      {icon}
      {error ? (
        <>
          <p className="text-sm font-medium text-foreground">{t("loadFailed")}</p>
          <p className="text-xs text-muted-foreground">{error}</p>
          {onRetry ? <Button variant="secondary" title={t("retry")} onClick={onRetry} /> : null}
        </>
      ) : (
        <p className="text-sm text-muted-foreground">{t("loading")}</p>
      )}
    </div>
  );
}

function CallDetailBody({ call, chargeLabel }: { call: CallDetail; chargeLabel: (micros: number | undefined) => string }) {
  const t = useTranslations("callHistory");
  const format = useFormatter();
  const contact = contactLabel(call.contact);
  const DirectionIcon = call.direction === "inbound" ? PhoneIncoming : PhoneOutgoing;

  return (
    <div className="flex flex-col gap-6 pb-6">
      <ElevatedSheetHeader>
        <div className="flex items-start gap-3 pr-10">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-foreground">
            {call.channel === "whatsapp" ? <WhatsappLogo className="h-5 w-5" aria-hidden /> : <DirectionIcon className="h-5 w-5" aria-hidden />}
          </span>
          <div className="min-w-0">
            <ElevatedSheetTitle className="truncate">{call.contact.name ?? formatPhoneForDisplay(contact.title)}</ElevatedSheetTitle>
            <ElevatedSheetDescription>
              {[
                contact.subtitle ? formatPhoneForDisplay(contact.subtitle) : null,
                `${t(`directions.${call.direction}`)} · ${t(`channels.${call.channel}`)}`,
                format.dateTime(new Date(call.startedAt), { dateStyle: "medium", timeStyle: "short" }),
              ]
                .filter(Boolean)
                .join(" · ")}
            </ElevatedSheetDescription>
            {call.contact.leadId ? (
              <Link href={`/dashboard/leads/${call.contact.leadId}`} className="mt-1 inline-block text-xs font-medium text-primary-ink hover:underline">
                {t("detail.openContact")}
              </Link>
            ) : null}
          </div>
        </div>
      </ElevatedSheetHeader>

      <dl className="grid grid-cols-2 gap-x-4 gap-y-3 px-6 sm:grid-cols-3">
        <Fact label={t("detail.result")}>
          <CallOutcomeBadge outcome={call.outcome} />
        </Fact>
        <Fact label={t("detail.talk")}>
          <span className="readout tabular-nums">{call.talkSeconds > 0 ? formatCallDuration(call.talkSeconds) : <EmptyValue />}</span>
        </Fact>
        <Fact label={t("detail.ring")}>
          <span className="readout tabular-nums">{formatCallDuration(call.ringSeconds)}</span>
        </Fact>
        <Fact label={t("detail.charge")}>{chargeLabel(call.charge?.amountMicros)}</Fact>
        <Fact label={call.direction === "inbound" ? t("detail.from") : t("detail.placedBy")}>
          {call.direction === "inbound" ? formatPhoneForDisplay(call.contact.number) : call.placedBy?.name || <EmptyValue />}
        </Fact>
        <Fact label={t("detail.answeredBy")}>{call.answeredBy?.name || <EmptyValue />}</Fact>
      </dl>

      {call.handlers.length > 1 ? (
        <section className="px-6">
          <h3 className="legend">{t("detail.handlers")}</h3>
          <p className="mt-1.5 text-sm text-foreground">{call.handlers.map((person) => person.name || t("timeline.someone")).join(" → ")}</p>
        </section>
      ) : null}

      <section className="px-6" aria-labelledby="call-timeline-title">
        <h3 id="call-timeline-title" className="legend mb-3">
          {t("detail.timeline")}
        </h3>
        <CallTimeline entries={call.timeline} direction={call.direction} />
      </section>

      {call.recording ? (
        <section className="mx-6 rounded-[--radius] border border-border bg-card p-4" aria-labelledby="call-recording-title">
          <div className="flex items-center justify-between gap-3">
            <h3 id="call-recording-title" className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <Waveform className="h-4 w-4 text-primary-ink" aria-hidden />
              {t("detail.recording")}
            </h3>
            <a
              href={call.recording.url}
              download
              className="inline-flex items-center gap-1.5 text-xs font-medium text-primary-ink hover:underline"
            >
              <DownloadSimple className="h-3.5 w-3.5" aria-hidden />
              {t("detail.download")}
            </a>
          </div>
          <audio controls preload="none" src={call.recording.url} className="mt-3 w-full" aria-labelledby="call-recording-title" />
        </section>
      ) : null}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="legend">{label}</dt>
      <dd className="mt-1 truncate text-sm text-foreground">{children}</dd>
    </div>
  );
}
