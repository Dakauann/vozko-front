"use client";

import { useTranslations } from "next-intl";

import { ChatsCircle } from "@/components/icons";
import { useTeamChatAccess, useTeamChatRealtime, useTeamChatSummary } from "@/hooks/use-team-chat";
import { unreadBadgeLabel } from "@/lib/notifications/types";
import { toggleTeamChat, useTeamChatPanel } from "@/lib/team-chat/panel";
import { cn } from "@/lib/utils";

export function TeamChatButton() {
  const access = useTeamChatAccess();
  if (!access.read) return null;
  return <Launcher />;
}

function Launcher() {
  const t = useTranslations("teamChat");
  const summary = useTeamChatSummary(true);
  const panel = useTeamChatPanel();
  useTeamChatRealtime(true);

  const unread = summary.data?.unread_messages ?? 0;
  const badge = unreadBadgeLabel(unread, false);
  const label = badge ? `${t("title")}, ${t("unread", { count: unread })}` : t("title");

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={panel.open}
      title={t("title")}
      onClick={toggleTeamChat}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        panel.open && "bg-muted text-foreground",
      )}
    >
      <ChatsCircle className="h-4 w-4" />
      {badge ? (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground ring-2 ring-sidebar"
        >
          {badge}
        </span>
      ) : null}
    </button>
  );
}
