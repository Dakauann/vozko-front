"use client";

import type { ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";

import { channelLabel, ChannelLogo } from "@/components/icons/channel-logos";

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

const RENDERERS: Record<string, (data: unknown) => ReactNode> = {
  whatsapp_template: (data) => <TemplateProposalPreview data={data as TemplatePreviewData} />,
  message: (data) => <MessageProposalPreview data={data as MessagePreviewData} />,
};

export function hasProposalPreview(preview: Preview | undefined): preview is Preview {
  return !!preview && preview.kind in RENDERERS;
}

export function ProposalPreview({ preview }: { preview: Preview }) {
  return <>{RENDERERS[preview.kind]?.(preview.data)}</>;
}
