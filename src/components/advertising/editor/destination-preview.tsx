"use client";

import { useTranslations } from "next-intl";

import { listLeadFormsAction } from "@/app/actions/advertising-forms";

import { ChannelAvatarImage } from "@/components/channels/channel-avatar-image";
import { DeviceMobile, Globe, InstagramLogo, Lock, MessengerLogo, ThumbsUp, WhatsappLogo } from "@/components/icons";
import { destinationView, formPreviewState, type ChatChannel } from "@/lib/advertising/editor-destination";
import type { LeadForm } from "@/lib/advertising/forms";
import type { AdPage } from "@/lib/advertising/types";

import type { AdPreviewContent } from "../ad-preview-card";
import { FormPreview } from "../forms/form-preview";
import { readyData, useAdsResource } from "../wizard/use-ads-resource";

const CHANNEL_ICONS: Record<ChatChannel, typeof WhatsappLogo> = {
  whatsapp: WhatsappLogo,
  messenger: MessengerLogo,
  instagram: InstagramLogo,
};

function Note({ children }: { children: string }) {
  return <p className="rounded-[--radius] border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">{children}</p>;
}

function ChatDestination({
  channel,
  greeting,
  iceBreakers,
  pageName,
  pagePictureUrl,
}: {
  channel: ChatChannel;
  greeting: string;
  iceBreakers: string[];
  pageName: string;
  pagePictureUrl?: string;
}) {
  const t = useTranslations("adsEditor.destination");
  const tPreview = useTranslations("adsWizard.preview");
  const ChannelIcon = CHANNEL_ICONS[channel];
  const name = pageName || tPreview("pageFallback");
  return (
    <figure className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label={t(`chat.${channel}`)}>
      <header className="flex items-center gap-2.5 border-b border-border px-3 py-2.5">
        <ChannelAvatarImage url={pagePictureUrl} name={name} seed={pageName || "page"} className="size-8" textClassName="text-2xs" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">{name}</p>
          <p className="flex items-center gap-1 text-2xs text-muted-foreground">
            <ChannelIcon className="h-3 w-3" aria-hidden />
            {t(`chat.${channel}`)}
          </p>
        </div>
      </header>
      <div className="min-h-48 space-y-3 bg-muted px-3 py-4">
        <p className="legend">{tPreview("conversationStart")}</p>
        {greeting ? (
          <p className="w-fit max-w-[85%] whitespace-pre-wrap break-words rounded-lg rounded-bl-sm border border-border bg-card px-3 py-2 text-xs text-foreground">
            {greeting}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">{t("chatNoGreeting")}</p>
        )}
        {iceBreakers.length > 0 ? (
          <ul className="flex flex-col items-end gap-1.5">
            {iceBreakers.map((breaker, index) => (
              <li key={`${index}-${breaker}`} className="rounded-full border border-control-edge bg-card px-3 py-1 text-2xs font-medium text-foreground">
                {breaker}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <figcaption className="border-t border-border px-3 py-2 text-2xs text-muted-foreground">{t("chatHint")}</figcaption>
    </figure>
  );
}

function WebsiteDestination({ link, address }: { link: string; address: string }) {
  const t = useTranslations("adsEditor.destination");
  if (!link) return <Note>{t("websiteEmpty")}</Note>;
  return (
    <figure className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border border-border bg-card shadow-sm" aria-label={t("website")}>
      <div className="flex items-center gap-2 border-b border-border bg-muted px-3 py-2">
        <Lock className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="truncate text-xs text-foreground">{address}</span>
      </div>
      <div className="flex min-h-40 flex-col items-center justify-center gap-2 px-4 py-6 text-center">
        <Globe className="h-6 w-6 text-muted-foreground" aria-hidden />
        <p className="break-all text-xs text-muted-foreground">{link}</p>
      </div>
      <figcaption className="border-t border-border px-3 py-2 text-2xs text-muted-foreground">{t("websiteHint")}</figcaption>
    </figure>
  );
}

export function DestinationPreview({
  content,
  leadForm,
  page,
}: {
  content: AdPreviewContent;
  leadForm?: LeadForm | null;
  page?: AdPage;
}) {
  const t = useTranslations("adsEditor.destination");
  const view = destinationView(content.destination, content);
  switch (view.kind) {
    case "chat":
      return (
        <ChatDestination
          channel={view.channel}
          greeting={view.greeting}
          iceBreakers={view.iceBreakers}
          pageName={content.pageName}
          pagePictureUrl={content.pagePictureUrl}
        />
      );
    case "form":
      if (leadForm && page) return <FormPreview state={formPreviewState(leadForm)} page={page} />;
      return <Note>{view.formId ? t("formLoading") : t("formEmpty")}</Note>;
    case "website":
      return <WebsiteDestination link={view.link} address={view.address} />;
    case "app":
      return (
        <div className="space-y-2 text-center">
          <DeviceMobile className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <Note>{t("app")}</Note>
        </div>
      );
    case "post":
      return (
        <div className="space-y-2 text-center">
          <ThumbsUp className="mx-auto h-6 w-6 text-muted-foreground" aria-hidden />
          <Note>{t("post")}</Note>
        </div>
      );
  }
  return <Note>{t("none")}</Note>;
}

export function AdDestinationPreview({ content, accountId, page }: { content: AdPreviewContent; accountId: string; page?: AdPage }) {
  const formId = content.destination === "ON_AD" ? (content.leadFormId ?? "") : "";
  const pageId = page?.pageId ?? "";
  const forms = useAdsResource(formId && pageId ? `forms:${accountId}:${pageId}` : null, () => listLeadFormsAction(accountId, pageId));
  const leadForm = (readyData(forms) ?? []).find((candidate) => candidate.metaId === formId) ?? null;
  return <DestinationPreview content={content} leadForm={leadForm} page={page} />;
}
