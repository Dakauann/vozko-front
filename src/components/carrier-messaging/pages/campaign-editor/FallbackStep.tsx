"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { ElevatedSelect, ElevatedSelectItem } from "@/components/elevated-design/elevated-select";
import { FallbackFields } from "@/components/rcs/composer/FallbackFields";
import type { CampaignDraft, CampaignFallback, CampaignWhatsAppFallback } from "@/lib/carrier-messaging/campaigns";
import type { SmsRoute } from "@/lib/sms/types";

export type WhatsAppTemplateSlot = (value: CampaignWhatsAppFallback | undefined, onChange: (next: CampaignWhatsAppFallback | undefined) => void) => ReactNode;

const NO_ROUTE = "none";

export function FallbackStep({
  draft,
  onChange,
  routes,
  smsComingSoon = false,
  whatsappTemplateSlot,
}: {
  draft: CampaignDraft;
  onChange: (draft: CampaignDraft) => void;
  routes: SmsRoute[];
  smsComingSoon?: boolean;
  whatsappTemplateSlot?: WhatsAppTemplateSlot;
}) {
  const t = useTranslations("carrierMessaging.pages.campaignEditor.fallback");
  const sms = draft.fallback.sms;
  const route = routes.find((candidate) => candidate.id === sms?.route_id) ?? null;
  const setFallback = (fallback: CampaignFallback) => onChange({ ...draft, fallback });
  const setSms = (patch: Partial<NonNullable<CampaignFallback["sms"]>>) => {
    const base = sms ?? { route_id: "", text: "", bindings: [] };
    setFallback({ ...draft.fallback, sms: { ...base, ...patch } });
  };

  const routePicker = (
    <ElevatedSelect
      label={t("route")}
      aria-label={t("route")}
      value={sms?.route_id || NO_ROUTE}
      onValueChange={(next) => {
        if (next === NO_ROUTE) {
          setFallback(draft.fallback.whatsapp ? { whatsapp: draft.fallback.whatsapp } : {});
          return;
        }
        setSms({ route_id: next });
      }}
    >
      <ElevatedSelectItem value={NO_ROUTE}>{t("noSms")}</ElevatedSelectItem>
      {routes.map((candidate) => (
        <ElevatedSelectItem key={candidate.id} value={candidate.id} disabled={!candidate.can_send}>
          {candidate.kind === "dedicated" ? t("routeDedicated", { prefix: candidate.brand_prefix, number: candidate.number }) : t("routeShared", { prefix: candidate.brand_prefix })}
        </ElevatedSelectItem>
      ))}
    </ElevatedSelect>
  );

  return (
    <FallbackFields
      smsText={sms?.text ?? ""}
      onSmsTextChange={(text) => setSms({ text })}
      bindings={sms?.bindings ?? []}
      onBindingsChange={(bindings) => setSms({ bindings })}
      whatsappTemplateSlot={whatsappTemplateSlot?.(draft.fallback.whatsapp, (whatsapp) => setFallback(whatsapp ? { ...draft.fallback, whatsapp } : withoutWhatsApp(draft.fallback)))}
      smsRouteSlot={routePicker}
      smsRouteId={route?.id}
      smsBrandPrefix={route?.brand_prefix}
      disabled={!sms?.route_id}
      smsComingSoon={smsComingSoon}
    />
  );
}

function withoutWhatsApp(fallback: CampaignFallback): CampaignFallback {
  return fallback.sms ? { sms: fallback.sms } : {};
}
