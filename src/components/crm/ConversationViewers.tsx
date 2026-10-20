"use client";

import { useTranslations } from "next-intl";

import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { useConversationPresence } from "@/hooks/use-conversation-presence";
import type { EntryType } from "@/lib/conversations/types";
import type { EntryViewer } from "@/lib/conversations/viewers";

const SHOWN_VIEWERS = 3;

function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  return words
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export function ConversationViewers({ entryId, entryType }: { entryId: string; entryType: EntryType }) {
  const { viewers } = useConversationPresence(entryId, entryType);
  return viewers.length > 0 ? <ViewerAvatars viewers={viewers} /> : null;
}

function ViewerAvatars({ viewers }: { viewers: EntryViewer[] }) {
  const t = useTranslations("crmMessage.presence");
  const shown = viewers.slice(0, SHOWN_VIEWERS);
  const hidden = viewers.length - shown.length;

  return (
    <div role="group" aria-label={t("viewers")} className="flex shrink-0 items-center -space-x-1.5">
      {shown.map((viewer) => {
        const label = t("viewing", { name: viewer.name || t("someone") });
        return (
          <TooltipWrapper key={viewer.user_id} content={label}>
            <span
              role="img"
              aria-label={label}
              className="flex size-6 items-center justify-center rounded-full bg-muted text-2xs font-semibold text-foreground ring-2 ring-card"
            >
              {initialsOf(viewer.name) || "?"}
            </span>
          </TooltipWrapper>
        );
      })}
      {hidden > 0 ? (
        <span className="flex size-6 items-center justify-center rounded-full bg-muted text-2xs font-semibold tabular-nums text-muted-foreground ring-2 ring-card">
          +{hidden}
        </span>
      ) : null}
    </div>
  );
}
