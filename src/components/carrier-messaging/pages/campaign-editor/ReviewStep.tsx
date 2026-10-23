"use client";

import { useCallback, useState, type ReactNode } from "react";
import { useFormatter, useTranslations } from "next-intl";

import { estimateCarrierCampaignAction, testCarrierCampaignAction } from "@/app/actions/carrier-messaging";
import { AudienceCountFigures } from "@/components/campaign-audience/AudienceCountPanel";
import { CarrierChannelChip } from "@/components/carrier-messaging/shared/CarrierLabels";
import Button from "@/components/elevated-design/button";
import ElevatedInput from "@/components/elevated-design/elevated-input";
import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { EmptyValue } from "@/components/elevated-design/empty-value";
import { CircleNotch, PaperPlaneTilt } from "@/components/icons";
import { DetailRow, DetailRows } from "@/components/leads/detail/DetailRow";
import { Notice } from "@/components/ui/notice";
import type { CodedRefusal } from "@/lib/api/coded-error";
import type { AudienceCreateState } from "@/lib/campaign-audience/draft";
import type { BindableField } from "@/lib/campaign-audience/types";
import type { AudienceConfirmation, CampaignDraft } from "@/lib/carrier-messaging/campaigns";
import type { LeadSelection } from "@/lib/leads/actions";
import type { CarrierMessage } from "@/lib/carrier-messaging/settings";
import { useCarrierRefusalText } from "@/components/carrier-messaging/shared/use-carrier-error-text";
import { useMicrosMoney } from "@/lib/carrier-messaging/use-micros-money";

import { AudienceConfirm } from "./AudienceConfirm";
import { audienceCount } from "./editor-state";
import { useLoaded } from "@/lib/carrier-messaging/use-loaded";

const COUNTED: AudienceCreateState = { ready: true };
const NO_FIELDS: readonly BindableField[] = [];

function Tile({ label, value, hint }: { label: string; value: ReactNode; hint?: ReactNode }) {
  return (
    <div className="rounded-[--radius] border border-border bg-card px-3 py-3">
      <p className="legend">{label}</p>
      <p className="mt-1 font-display text-xl font-semibold tabular-nums text-foreground">{value}</p>
      {hint ? <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

interface AudienceConfirmationProps {
  audience: LeadSelection | null;
  confirmed: AudienceConfirmation | null;
  onConfirm: (confirmation: AudienceConfirmation | null) => void;
  refreshKey: number;
}

function Estimate({ campaignId, usesRoute, confirmation }: { campaignId: string; usesRoute: boolean; confirmation: AudienceConfirmationProps }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.review");
  const format = useFormatter();
  const money = useMicrosMoney();
  const refusalText = useCarrierRefusalText();
  const load = useCallback((signal: AbortSignal) => estimateCarrierCampaignAction(campaignId, signal), [campaignId]);
  const estimate = useLoaded(load, String(confirmation.refreshKey));
  const price = (micros: number) => money(micros) ?? <EmptyValue />;

  if (estimate.status === "loading") {
    return (
      <p role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleNotch aria-hidden className="h-4 w-4 animate-spin" />
        {t("estimating")}
      </p>
    );
  }
  if (estimate.status === "failed") {
    return (
      <Notice tone="fault" title={t("estimateFailed")}>
        <p>{refusalText(estimate.error)}</p>
        <Button variant="secondary" size="sm" title={t("retry")} onClick={estimate.reload} />
      </Notice>
    );
  }
  const data = estimate.data;
  return (
    <div className="space-y-3">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Tile label={t("recipients")} value={format.number(data.recipients)} hint={t("messages", { count: data.messages, formatted: format.number(data.messages) })} />
        <Tile label={t("expected")} value={price(data.expected_micros)} hint={t("perRecipient", { price: money(data.per_recipient_micros) ?? "" })} />
        <Tile
          label={t("worstCase")}
          value={price(data.worst_case_micros)}
          hint={data.worst_case_segments ? t("worstCaseSegments", { count: data.worst_case_segments }) : t("worstCaseHint")}
        />
        <Tile label={t("readiness")} value={data.ready.sender && (!usesRoute || data.ready.route) ? t("ready") : t("notReady")} />
      </div>
      {data.count ? <AudienceCountFigures channel="carrier" source="leads" count={data.count} lines={null} loading={false} createState={COUNTED} fields={NO_FIELDS} /> : null}
      <AudienceConfirm key={confirmation.refreshKey} audience={confirmation.audience} estimate={data} confirmed={confirmation.confirmed} onConfirm={confirmation.onConfirm} />
      {data.shortfall_micros > 0 ? (
        <Notice tone="warning" title={t("shortfallTitle", { amount: money(data.shortfall_micros) ?? "" })}>
          <p>{t("shortfallHint")}</p>
        </Notice>
      ) : null}
      {!data.ready.sender ? (
        <Notice tone="fault" title={t("senderNotReady")}>
          <p>{t("senderNotReadyHint")}</p>
        </Notice>
      ) : null}
      {usesRoute && !data.ready.route ? (
        <Notice tone="fault" title={t("routeNotReady")}>
          <p>{t("routeNotReadyHint")}</p>
        </Notice>
      ) : null}
    </div>
  );
}

function TestSend({ campaignId, variants }: { campaignId: string; variants: readonly string[] }) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.review");
  const refusalText = useCarrierRefusalText();
  const [phone, setPhone] = useState("");
  const [variant, setVariant] = useState(0);
  const [sending, setSending] = useState(false);
  const [outcome, setOutcome] = useState<{ message: CarrierMessage } | { refusal: CodedRefusal } | null>(null);

  const send = async () => {
    setSending(true);
    setOutcome(null);
    const answer = await testCarrierCampaignAction(campaignId, phone.trim(), variant);
    setSending(false);
    setOutcome(answer.error ? { refusal: answer.error } : { message: answer.data });
  };

  return (
    <div className="space-y-3 rounded-[--radius] border border-border bg-card p-4">
      <div>
        <p className="text-sm font-semibold text-foreground">{t("testTitle")}</p>
        <p className="text-xs text-muted-foreground">{t("testHint")}</p>
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <ElevatedInput label={t("testPhone")} type="tel" inputMode="tel" value={phone} onChange={(event) => setPhone(event.target.value)} className="max-w-xs" />
        {variants.length > 1 ? (
          <ElevatedSelect label={t("testVariant")} aria-label={t("testVariant")} value={String(variant)} onValueChange={(next) => setVariant(Number(next))}>
            {variants.map((name, index) => (
              <ElevatedSelectItem key={index} value={String(index)}>
                {name}
              </ElevatedSelectItem>
            ))}
          </ElevatedSelect>
        ) : null}
        <Button
          variant="outline"
          title={sending ? t("testSending") : t("testSend")}
          icon={sending ? <CircleNotch className="h-4 w-4 animate-spin" /> : <PaperPlaneTilt className="h-4 w-4" />}
          iconVisible
          iconSide="left"
          disabled={sending || phone.trim() === ""}
          onClick={() => void send()}
        />
      </div>
      {outcome && "message" in outcome ? (
        <Notice tone="healthy" title={t("testSent")}>
          <p>{t("testStatus", { status: outcome.message.status })}</p>
        </Notice>
      ) : null}
      {outcome && "refusal" in outcome ? (
        <Notice tone="fault" title={t("testFailed")}>
          <p>{refusalText(outcome.refusal)}</p>
        </Notice>
      ) : null}
    </div>
  );
}

export function ReviewStep({
  campaignId,
  draft,
  senderName,
  confirmation,
  onConfirm,
  refreshKey,
}: {
  campaignId: string;
  draft: CampaignDraft;
  senderName: string | null;
  confirmation: AudienceConfirmation | null;
  onConfirm: (confirmation: AudienceConfirmation | null) => void;
  refreshKey: number;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.review");
  const tShared = useTranslations("carrierMessaging");
  const format = useFormatter();
  const count = audienceCount(draft.audience);
  const variantNames = draft.variants.map((variant, index) => variant.name.trim() || t("variantFallback", { index: index + 1 }));
  const usesRoute = draft.channel === "sms" || Boolean(draft.fallback.sms);
  const fallback = [draft.fallback.whatsapp ? tShared("channels.whatsapp") : null, draft.fallback.sms ? tShared("channels.sms") : null].filter(Boolean).join(" · ");

  return (
    <div className="space-y-6">
      <DetailRows>
        <DetailRow label={t("rows.name")}>{draft.name.trim() || <EmptyValue />}</DetailRow>
        <DetailRow label={t("rows.channel")}>
          <CarrierChannelChip channel={draft.channel} />
        </DetailRow>
        <DetailRow label={t("rows.sender")}>{senderName ?? <EmptyValue />}</DetailRow>
        <DetailRow label={t("rows.kind")}>{tShared(`campaignKinds.${draft.kind}`)}</DetailRow>
        <DetailRow label={t("rows.variants")}>{draft.variants.length > 1 ? t("abVariants", { names: format.list(variantNames, { type: "conjunction" }) }) : t("oneMessage")}</DetailRow>
        {draft.channel === "rcs" ? <DetailRow label={t("rows.fallback")}>{fallback || t("noFallback")}</DetailRow> : null}
        <DetailRow label={t("rows.audience")}>{draft.audience ? (count === null ? t("audienceLater") : format.number(count)) : <EmptyValue />}</DetailRow>
      </DetailRows>
      <section className="space-y-3">
        <p className="legend">{t("costTitle")}</p>
        <Estimate campaignId={campaignId} usesRoute={usesRoute} confirmation={{ audience: draft.audience, confirmed: confirmation, onConfirm, refreshKey }} />
      </section>
      <TestSend campaignId={campaignId} variants={variantNames} />
    </div>
  );
}
