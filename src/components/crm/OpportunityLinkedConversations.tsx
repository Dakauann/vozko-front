"use client";

import { useTranslations } from "next-intl";

import { ChannelTile } from "@/components/channels/channel-tile";
import { ArrowSquareOut, LinkSimpleBreak } from "@/components/icons";
import { conversationHref, isEntryType } from "@/lib/conversations/deep-link";
import type { OpportunityConversationLink } from "@/lib/crm/opportunities";

export default function OpportunityLinkedConversations({
  links,
  onUnlink,
}: {
  links: OpportunityConversationLink[];
  onUnlink: (entryId: string, entryType: string) => void;
}) {
  const tChannels = useTranslations("audience.channels");
  const channelName = (entryType: string) => (tChannels.has(entryType) ? tChannels(entryType) : entryType);

  return (
    <div className="space-y-2 border-t border-border pt-4">
      <p className="text-2xs font-semibold text-muted-foreground">Conversas vinculadas</p>
      {links.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border py-4 text-center text-xs text-muted-foreground">
          Nenhuma conversa vinculada a esta oportunidade.
        </p>
      ) : (
        links.map((link) => {
          const name = link.leadName?.trim();
          const number = link.leadNumber?.trim();
          const title = name || number || "Contato sem nome";
          const detail = [channelName(link.entryType), name ? number : ""].filter(Boolean).join(" · ");
          return (
            <div
              key={`${link.entryType}:${link.entryId}`}
              className="group flex items-center gap-2.5 rounded-lg border border-border bg-card px-3 py-2"
            >
              <ChannelTile channel={link.entryType} size="sm" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium text-foreground">{title}</p>
                <p className="truncate text-2xs text-muted-foreground">{detail}</p>
              </div>
              <a
                href={conversationHref(link.entryId, isEntryType(link.entryType) ? link.entryType : "whatsapp")}
                title="Abrir conversa"
                aria-label={`Abrir conversa com ${title}`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <ArrowSquareOut weight="bold" className="h-3.5 w-3.5" />
              </a>
              <button
                type="button"
                onClick={() => onUnlink(link.entryId, link.entryType)}
                title="Desvincular"
                aria-label={`Desvincular conversa com ${title}`}
                className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground"
              >
                <LinkSimpleBreak weight="bold" className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })
      )}
    </div>
  );
}
