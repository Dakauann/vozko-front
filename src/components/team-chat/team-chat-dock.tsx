"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";

import { useTeamChatAccess } from "@/hooks/use-team-chat";
import { closeTeamChat, useTeamChatPanel } from "@/lib/team-chat/panel";

import { NewChat } from "./new-chat";
import { ThreadList } from "./thread-list";
import { ThreadView } from "./thread-view";

export function TeamChatDock() {
  const access = useTeamChatAccess();
  const panel = useTeamChatPanel();
  if (!access.read || !panel.open) return null;
  return <Dock />;
}

function Dock() {
  const t = useTranslations("teamChat");
  const panel = useTeamChatPanel();

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !event.defaultPrevented) closeTeamChat();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <aside
      aria-label={t("title")}
      className="fixed bottom-0 right-0 top-[var(--dashboard-header-h)] z-[62] flex w-full flex-col overflow-hidden border-l border-border-strong bg-card shadow-lg sm:w-[380px]"
    >
      {panel.view === "thread" && panel.threadId ? (
        <ThreadView key={panel.threadId} threadId={panel.threadId} />
      ) : panel.view === "new" ? (
        <NewChat />
      ) : (
        <ThreadList />
      )}
    </aside>
  );
}
