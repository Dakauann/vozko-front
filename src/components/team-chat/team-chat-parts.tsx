"use client";

import { useTranslations } from "next-intl";

import { UsersThree } from "@/components/icons";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { initials } from "@/lib/format/initials";
import { otherMember } from "@/lib/team-chat/messages";
import type { TeamChatMessage, TeamChatThread } from "@/lib/team-chat/types";
import { cn } from "@/lib/utils";

export const ICON_BUTTON =
  "inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[--radius] text-muted-foreground transition-colors hover:bg-accent-hover hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40";

export const BADGE = "inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none tabular-nums text-primary-foreground";

export function PersonAvatar({ name, picture, className }: { name: string; picture?: string; className?: string }) {
  return (
    <Avatar aria-hidden className={cn("h-8 w-8 border border-border", className)}>
      {picture ? <AvatarImage src={picture} alt="" className="object-cover" referrerPolicy="no-referrer" /> : null}
      <AvatarFallback delayMs={picture ? 400 : 0} className="text-2xs font-semibold text-muted-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

export function ThreadAvatar({ thread, me, className }: { thread: TeamChatThread; me: string; className?: string }) {
  const other = otherMember(thread, me);
  if (other) return <PersonAvatar name={other.name} picture={other.picture} className={className} />;
  return (
    <span aria-hidden className={cn("tile-neutral flex h-8 w-8 shrink-0 items-center justify-center", className)}>
      <UsersThree className="h-4 w-4" />
    </span>
  );
}

export function useSystemLine() {
  const t = useTranslations("teamChat.system");
  return (message: TeamChatMessage, thread: TeamChatThread | undefined, me: string): string => {
    const nameOf = (id: string) => (id === me ? t("you") : (thread?.members.find((m) => m.user_id === id)?.name ?? t("someone")));
    const actor = nameOf(message.author_id);
    const subjects = message.subject_ids.map(nameOf).join(", ");
    switch (message.event) {
      case "created":
        return t("created", { name: actor, title: message.body });
      case "renamed":
        return t("renamed", { name: actor, title: message.body });
      case "members_added":
        return t("membersAdded", { name: actor, people: subjects });
      case "member_removed":
        return t("memberRemoved", { name: actor, people: subjects });
      case "member_left":
        return t("memberLeft", { name: actor });
      default:
        return t("changed", { name: actor });
    }
  };
}

export function useThreadPreview() {
  const t = useTranslations("teamChat.list");
  const systemLine = useSystemLine();
  return (thread: TeamChatThread, me: string): string => {
    const last = thread.last_message;
    if (!last) return t("noMessages");
    if (last.kind === "system") return systemLine(last, thread, me);
    if (last.deleted_at) return t("deleted");
    if (last.author_id === me) return t("mine", { body: last.body });
    return thread.kind === "group" ? t("theirs", { name: last.author_name, body: last.body }) : last.body;
  };
}
