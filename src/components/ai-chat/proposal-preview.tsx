"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { channelLabel, ChannelLogo } from "@/components/icons/channel-logos";

import { AdPreviewCard, type AdPreviewContent, type AdPreviewMedia } from "@/components/advertising/ad-preview-card";
import { useAdsFormat } from "@/components/advertising/use-ads-format";
import WhatsAppPreview from "@/components/whatsapp/WhatsAppPreview";
import type { ProposalPreview as Preview } from "@/lib/aichat/types";
import { toPreviewComponents } from "@/lib/whatsapp-templates/preview";
import type { TemplateComponent } from "@/lib/whatsapp-templates/types";

interface TemplatePreviewData {
  name: string;
  language: string;
  components: TemplateComponent[];
  headerMediaUrl?: string;
}

function TemplateProposalPreview({ data }: { data: TemplatePreviewData }) {
  return (
    <div className="mx-auto w-full max-w-sm overflow-hidden rounded-[--radius] border border-border shadow-md">
      <WhatsAppPreview
        components={toPreviewComponents(data.components ?? [], data.headerMediaUrl)}
        templateName={data.name}
        language={data.language}
      />
    </div>
  );
}

interface MessagePreviewData {
  text: string;
  channel: string;
  scheduledAt?: string;
}

function MessageProposalPreview({ data }: { data: MessagePreviewData }) {
  const t = useTranslations("aiChatPage.previews");
  const locale = useLocale();
  const when = data.scheduledAt ? new Date(data.scheduledAt) : null;
  return (
    <div className="rounded-lg border border-border bg-muted p-3">
      <p className="mb-2 flex items-center gap-1.5 text-2xs font-medium text-muted-foreground">
        <ChannelLogo channel={data.channel} className="h-3.5 w-3.5" />
        {channelLabel(data.channel) ?? data.channel}
        {when && !Number.isNaN(when.getTime()) ? (
          <span>
            {" · "}
            {t("scheduledFor", {
              when: new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(when),
            })}
          </span>
        ) : null}
      </p>
      <div className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-br-sm border border-border bg-card px-3 py-2 text-sm leading-relaxed text-foreground shadow-sm">
        {data.text}
      </div>
    </div>
  );
}

interface AdCreativePreviewData {
  pageName?: string;
  pagePictureUrl?: string;
  format?: string;
  primaryText?: string;
  headline?: string;
  description?: string;
  mediaUrl?: string;
  mediaKind?: string;
  medias?: unknown;
  cards?: unknown;
  destination?: string;
  callToAction?: string;
  displayLink?: string;
  greeting?: string;
  iceBreakers?: string[];
  dailyBudget?: number;
  currency?: string;
  fee?: number;
  feeCurrency?: string;
  accountName?: string;
}

function text(value: unknown): string | undefined {
  return typeof value === "string" && value.trim() !== "" ? value : undefined;
}

function records(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? value.filter((item): item is Record<string, unknown> => typeof item === "object" && item !== null) : [];
}

function previewMedia(url: unknown, kind: unknown): AdPreviewMedia | undefined {
  const href = text(url);
  if (!href) return undefined;
  return { kind: kind === "video" ? "video" : "image", url: href };
}

function adPreviewFromProposal(data: AdCreativePreviewData): AdPreviewContent {
  const media = previewMedia(data.mediaUrl, data.mediaKind);
  return {
    pageName: text(data.pageName) ?? "",
    pagePictureUrl: text(data.pagePictureUrl),
    format: text(data.format),
    primaryText: text(data.primaryText) ?? "",
    headline: text(data.headline),
    description: text(data.description),
    media,
    medias: records(data.medias)
      .map((item) => previewMedia(item.url, item.kind))
      .filter((item): item is AdPreviewMedia => !!item),
    cards: records(data.cards).map((card) => ({
      media: previewMedia(card.url, card.kind),
      headline: text(card.headline),
      description: text(card.description),
    })),
    destination: text(data.destination) ?? "",
    callToAction: text(data.callToAction),
    displayLink: text(data.displayLink),
    greeting: text(data.greeting),
    iceBreakers: Array.isArray(data.iceBreakers) ? data.iceBreakers.filter((item): item is string => typeof item === "string") : [],
  };
}

function AdCreativeProposalPreview({ data }: { data: AdCreativePreviewData }) {
  const t = useTranslations("aiChatPage.previews.ad");
  const fmt = useAdsFormat();
  const facts = [
    data.accountName ? { label: t("account"), value: data.accountName } : null,
    typeof data.dailyBudget === "number" && data.dailyBudget > 0 && data.currency
      ? { label: t("dailyBudget"), value: fmt.minor(data.dailyBudget, data.currency) }
      : null,
    typeof data.fee === "number" && data.feeCurrency ? { label: t("fee"), value: fmt.micros(data.fee, data.feeCurrency) } : null,
  ].filter((fact): fact is { label: string; value: string } => fact !== null);
  return (
    <div className="space-y-2">
      <div className="flex justify-center">
        <AdPreviewCard content={adPreviewFromProposal(data)} />
      </div>
      {facts.length > 0 ? (
        <dl className="grid gap-x-4 gap-y-1 rounded-lg border border-border bg-muted px-3 py-2 text-xs sm:grid-cols-3">
          {facts.map((fact) => (
            <div key={fact.label} className="min-w-0">
              <dt className="text-muted-foreground">{fact.label}</dt>
              <dd className="truncate font-semibold tabular-nums text-foreground">{fact.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
      <p className="text-2xs text-muted-foreground">{t("note")}</p>
    </div>
  );
}

const RENDERERS: Record<string, (data: unknown) => ReactNode> = {
  whatsapp_template: (data) => <TemplateProposalPreview data={data as TemplatePreviewData} />,
  message: (data) => <MessageProposalPreview data={data as MessagePreviewData} />,
  ad_creative: (data) => <AdCreativeProposalPreview data={(data ?? {}) as AdCreativePreviewData} />,
};

export function hasProposalPreview(preview: Preview | undefined): preview is Preview {
  return !!preview && preview.kind in RENDERERS;
}

export function ProposalPreview({ preview }: { preview: Preview }) {
  return <>{RENDERERS[preview.kind]?.(preview.data)}</>;
}
