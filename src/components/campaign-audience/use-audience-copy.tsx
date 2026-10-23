"use client";

import { useCallback, type ReactNode } from "react";
import { useTranslations } from "next-intl";

import {
  BellSlash,
  Broadcast,
  Clock,
  Copy,
  EnvelopeSimple,
  Globe,
  Hourglass,
  LinkBreak,
  Question,
  Trash,
  Phone,
  Prohibit,
  Wallet,
  Warning,
  WhatsappLogo,
  X,
} from "@/components/icons";
import { useFieldSourceLabel } from "@/components/leads/sends/send-copy";
import { codedErrorMessage, type CodedError } from "@/lib/api/coded-error";
import { SKIP_REASONS as CARRIER_SKIP_REASONS } from "@/lib/carrier-messaging/campaigns";
import { LITERAL_AUDIENCE_SOURCE, type AudienceChannel, type AudienceCount, type BindableField, type VariableCount } from "@/lib/campaign-audience/types";
import { SKIP_REASONS as EMAIL_SKIP_REASONS } from "@/lib/email-campaigns/types";
import { CONTACT_TAGS } from "@/lib/email-design/merge-tags";
import { LEAD_FIELD_SOURCES, reasonRows, skipRowsOf, type SendReviewSkipRow } from "@/lib/leads/sends";

const ICON = "size-3.5";

export const OUT_REASON_ICONS: Record<string, ReactNode> = {
  no_identity: <WhatsappLogo className={ICON} aria-hidden />,
  no_phone: <Phone className={ICON} aria-hidden />,
  no_email: <EnvelopeSimple className={ICON} aria-hidden />,
  invalid_address: <X className={ICON} aria-hidden />,
  duplicate: <Copy className={ICON} aria-hidden />,
  blocked: <Prohibit className={ICON} aria-hidden />,
  suppressed: <Prohibit className={ICON} aria-hidden />,
  opted_out: <BellSlash className={ICON} aria-hidden />,
  unsubscribed: <BellSlash className={ICON} aria-hidden />,
  cooldown: <Hourglass className={ICON} aria-hidden />,
  frequency_cap: <Hourglass className={ICON} aria-hidden />,
  missing_variable: <Warning className={ICON} aria-hidden />,
  already_in_running_campaign: <Broadcast className={ICON} aria-hidden />,
  over_cap: <Wallet className={ICON} aria-hidden />,
  balance: <Wallet className={ICON} aria-hidden />,
  bad_address: <LinkBreak className={ICON} aria-hidden />,
  no_mail_domain: <Globe className={ICON} aria-hidden />,
  domain_unknown: <Question className={ICON} aria-hidden />,
  domain_checking: <Hourglass className={ICON} aria-hidden />,
  disposable: <Trash className={ICON} aria-hidden />,
  inactive: <Clock className={ICON} aria-hidden />,
};

const EMAIL_FIELD_PREFIX = "field.";

export function isEmailChannel(channel: AudienceChannel): boolean {
  return channel === "email";
}

export function slotTag(variable: Pick<VariableCount, "name">): string {
  return `{{${variable.name}}}`;
}

export function useSlotName() {
  const t = useTranslations("campaignAudience.step.slot");
  return useCallback((variable: Pick<VariableCount, "name" | "header">) => (variable.header ? t("headerSlot", { tag: slotTag(variable) }) : slotTag(variable)), [t]);
}

export function useSlotLabel(variables: readonly VariableCount[]) {
  const name = useSlotName();
  return useCallback((key: string) => name(variables.find((variable) => variable.key === key) ?? { name: key, header: false }), [name, variables]);
}

export function useAudienceSourceLabel(channel: AudienceChannel, fields: readonly BindableField[]) {
  const tTags = useTranslations("emailEditor.mergeTags.tags");
  const tBindings = useTranslations("leadSends.bindings");
  const fieldLabel = useFieldSourceLabel(fields);
  return useCallback(
    (key: string, source?: string): string => {
      if (!isEmailChannel(channel)) return fieldLabel(source ?? LITERAL_AUDIENCE_SOURCE);
      if ((CONTACT_TAGS as readonly string[]).includes(key)) return tTags(key);
      const fieldKey = key.startsWith(EMAIL_FIELD_PREFIX) ? key.slice(EMAIL_FIELD_PREFIX.length) : key;
      return tBindings("custom", { label: fields.find((field) => field.key === fieldKey)?.label ?? fieldKey });
    },
    [channel, fields, fieldLabel, tTags, tBindings],
  );
}

export function useMissingFieldText(channel: AudienceChannel, fields: readonly BindableField[]) {
  const t = useTranslations("campaignAudience.step.variables.missingField");
  return useCallback(
    (key: string, source?: string): string => {
      if (isEmailChannel(channel)) {
        if ((CONTACT_TAGS as readonly string[]).includes(key)) return t(`email.${key}`);
        const fieldKey = key.startsWith(EMAIL_FIELD_PREFIX) ? key.slice(EMAIL_FIELD_PREFIX.length) : key;
        return t("custom", { label: fields.find((field) => field.key === fieldKey)?.label ?? fieldKey });
      }
      if (source && Object.hasOwn(LEAD_FIELD_SOURCES, source)) return t(LEAD_FIELD_SOURCES[source as keyof typeof LEAD_FIELD_SOURCES]);
      const custom = source ? fields.find((field) => field.source === source) : undefined;
      return custom ? t("custom", { label: custom.label ?? custom.key ?? custom.column }) : t("value");
    },
    [channel, fields, t],
  );
}

function excludedVariables(count: AudienceCount) {
  return count.variables
    .filter((variable) => variable.policy === "exclude" && /^\d+$/.test(variable.key))
    .map((variable) => ({ slot: Number(variable.key), name: variable.name, count: variable.missing, ...(variable.source ? { source: variable.source } : {}) }));
}

export function outRowsOf(channel: AudienceChannel, count: AudienceCount): SendReviewSkipRow[] {
  if (channel === "email") return reasonRows(count.out, EMAIL_SKIP_REASONS);
  if (channel === "carrier") return reasonRows(count.out, CARRIER_SKIP_REASONS);
  return skipRowsOf(count.out, excludedVariables(count));
}

export function useOutRowLabel(channel: AudienceChannel): ((row: SendReviewSkipRow) => ReactNode) | undefined {
  const reasonText = useOutReasonText(channel);
  const label = useCallback((row: SendReviewSkipRow) => reasonText(row.reason), [reasonText]);
  return channel === "email" || channel === "carrier" ? label : undefined;
}

export function useOutReasonText(channel: AudienceChannel) {
  const tEmail = useTranslations("emailCampaigns.skip");
  const tCarrier = useTranslations("carrierMessaging.skipReasons");
  const tSends = useTranslations("leadSends.review.skipped");
  return useCallback(
    (reason: string): string => {
      const t = channel === "email" ? tEmail : channel === "carrier" ? tCarrier : tSends;
      return t.has(reason) ? t(reason) : tSends("other");
    },
    [channel, tEmail, tCarrier, tSends],
  );
}

export function useAudienceErrorText() {
  const t = useTranslations("campaignAudience");
  return useCallback((error: CodedError) => codedErrorMessage(t, error, t("step.errorFallback")), [t]);
}
