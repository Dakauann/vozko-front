"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import { CaretLeft, DotsThree, X } from "@/components/icons";
import { ChannelAvatar } from "@/components/channels/channel-avatar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import type { EntryType } from "@/lib/conversations/types";

interface ConversationHeaderProps {
  name: string;
  number: string;
  pictureUrl?: string;
  entryType: EntryType;
  isGroup?: boolean;
  badges: ReactNode;
  status: ReactNode;
  actions: ReactNode;
  onBack: () => void;
  onClose?: () => void;
}

const ROUND_BUTTON =
  "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground";

export default function ConversationHeader({
  name,
  number,
  pictureUrl,
  entryType,
  isGroup,
  badges,
  status,
  actions,
  onBack,
  onClose,
}: ConversationHeaderProps) {
  const t = useTranslations("crmConversationHeader");

  return (
    <div className="vz-conversation-header shrink-0 border-b border-border bg-card">
      <div className="flex min-w-0 items-center gap-2 px-3 py-2.5 sm:px-4">
        <button type="button" onClick={onBack} aria-label={t("back")} className={`${ROUND_BUTTON} lg:hidden`}>
          <CaretLeft weight="bold" className="h-4 w-4" />
        </button>

        <ChannelAvatar name={name} pictureUrl={pictureUrl} entryType={entryType} isGroup={isGroup} size="md" />

        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5">
            <p className="truncate text-sm font-semibold text-foreground">{name}</p>
            {badges}
          </div>
          <p className="truncate text-xs text-muted-foreground">{number}</p>
        </div>

        <div className="vz-conversation-header-actions shrink-0 items-center gap-2">{actions}</div>

        <span className="vz-conversation-header-more shrink-0">
          <Popover>
            <TooltipWrapper content={t("more")}>
              <PopoverTrigger asChild>
                <button type="button" aria-label={t("more")} className={ROUND_BUTTON}>
                  <DotsThree weight="bold" className="h-4 w-4" />
                </button>
              </PopoverTrigger>
            </TooltipWrapper>
            <PopoverContent align="end" className="w-auto max-w-[min(20rem,calc(100vw-2rem))] p-2">
              <div className="flex flex-wrap items-center justify-end gap-2">{actions}</div>
            </PopoverContent>
          </Popover>
        </span>

        <div className="shrink-0">{status}</div>

        {onClose ? (
          <TooltipWrapper content={t("closeHint")}>
            <button type="button" onClick={onClose} aria-label={t("close")} className={ROUND_BUTTON}>
              <X weight="bold" className="h-4 w-4" />
            </button>
          </TooltipWrapper>
        ) : null}
      </div>
    </div>
  );
}
