"use client";

import { useTranslations } from "next-intl";

import { ChatText } from "@/components/icons";
import { ChannelLogo } from "@/components/icons/channel-logos";
import { ScreenLoader } from "@/components/brand/screen-loader";
import { useChannelName } from "@/hooks/use-channel-name";
import { useCompactAgeText } from "@/hooks/use-compact-age";
import { useLeadTimeline } from "@/hooks/use-lead-records";
import { conversationHref, type ConversationDeepLink } from "@/lib/conversations/deep-link";
import type { EntryType } from "@/lib/conversations/types";
import { leadConversationLinks, timelineItemsOf, type LeadConversationLink } from "@/lib/leads/timeline";

interface LeadOtherConversationsProps {
  leadId: string;
  current: ConversationDeepLink;
  active: boolean;
  onOpenConversation?: (entryId: string, entryType: EntryType) => void;
}

type ContactPanelText = ReturnType<typeof useTranslations<"crmContactPanel">>;

function linkDetail(link: LeadConversationLink, t: ContactPanelText): string | null {
  if (link.line && link.campaign) return t("conversationLineAndCampaign", { line: link.line, campaign: link.campaign });
  if (link.campaign) return t("conversationCampaign", { campaign: link.campaign });
  return link.line ?? null;
}

function opensInPlace(event: React.MouseEvent): boolean {
  return event.button === 0 && !event.metaKey && !event.ctrlKey && !event.shiftKey && !event.altKey;
}

export function LeadOtherConversations({ leadId, current, active, onOpenConversation }: LeadOtherConversationsProps) {
  const t = useTranslations("crmContactPanel");
  const ageText = useCompactAgeText();
  const channelName = useChannelName();
  const query = useLeadTimeline(leadId, active);
  const links = leadConversationLinks(timelineItemsOf(query.data?.pages), current);

  return (
    <section aria-labelledby="lead-other-conversations" className="bg-card px-4 py-3">
      <h3 id="lead-other-conversations" className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-foreground">
        <ChatText weight="bold" className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
        {t("otherConversations")}
      </h3>
      {query.isPending ? (
        <ScreenLoader fit="inline" />
      ) : query.isError ? (
        <p className="text-xs text-muted-foreground">{t("otherConversationsFailed")}</p>
      ) : links.length === 0 ? (
        <p className="text-xs text-muted-foreground">{t("otherConversationsEmpty")}</p>
      ) : (
        <ul className="flex flex-col gap-1">
          {links.map((link) => {
            const channel = channelName(link.entryType) ?? link.entryType;
            const detail = linkDetail(link, t);
            return (
              <li key={`${link.entryType}:${link.entryId}`}>
                <a
                  href={conversationHref(link.entryId, link.entryType)}
                  onClick={(event) => {
                    if (!onOpenConversation || !opensInPlace(event)) return;
                    event.preventDefault();
                    onOpenConversation(link.entryId, link.entryType);
                  }}
                  className="flex items-center gap-2 rounded-[--radius] px-2 py-1.5 text-xs text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <ChannelLogo channel={link.entryType} className="h-3.5 w-3.5 shrink-0" />
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate">{t("openConversation", { channel })}</span>
                    {detail ? (
                      <span className="truncate text-2xs text-muted-foreground">{detail}</span>
                    ) : null}
                  </span>
                  <time dateTime={link.at} className="shrink-0 tabular-nums text-muted-foreground">
                    {ageText(link.at)}
                  </time>
                </a>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
