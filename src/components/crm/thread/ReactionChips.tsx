"use client";

import { useLocale, useTranslations } from "next-intl";

import TooltipWrapper from "@/components/ui/tooltip-wrapper";
import { useAssignableMembers } from "@/hooks/use-assignable-members";
import { groupReactions, reactorOf, type ReactionGroup, type Reactor } from "@/lib/conversations/reactions";
import type { ConversationMessage } from "@/lib/conversations/types";
import { cn } from "@/lib/utils";

import { useThreadRow } from "./thread-context";

const CHIP =
  "inline-flex items-center gap-1 rounded-full border border-border bg-card px-1.5 py-0.5 text-xs leading-none shadow-sm";

function useReactorLabel(): (reactor: Reactor) => string {
  const t = useTranslations("crmMessage.reactions");
  return (reactor) => {
    if (reactor.kind === "self") return t("you");
    if (reactor.kind === "name") return reactor.name;
    return reactor.kind === "team" ? t("team") : t("contact");
  };
}

function ReactionChip({ group, names, onToggle }: { group: ReactionGroup; names: string; onToggle?: () => void }) {
  const t = useTranslations("crmMessage.reactions");
  const summary = t("summary", { emoji: group.emoji, names });
  const content = (
    <>
      <span aria-hidden>{group.emoji}</span>
      {group.count > 1 ? <span aria-hidden className="tabular-nums text-muted-foreground">{group.count}</span> : null}
    </>
  );
  return (
    <TooltipWrapper content={summary}>
      {onToggle ? (
        <button
          type="button"
          aria-label={summary}
          onClick={onToggle}
          className={cn(CHIP, "transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring")}
        >
          {content}
        </button>
      ) : (
        <span role="img" aria-label={summary} className={CHIP}>
          {content}
        </span>
      )}
    </TooltipWrapper>
  );
}

function ReactionChipList({ message, groups, own }: { message: ConversationMessage; groups: ReactionGroup[]; own: boolean }) {
  const t = useTranslations("crmMessage.reactions");
  const locale = useLocale();
  const { conversation, messageActions } = useThreadRow();
  const { names: memberNames } = useAssignableMembers(true);
  const labelOf = useReactorLabel();
  const people = {
    selfId: messageActions.selfId,
    memberNames,
    contactName: conversation.lead_name || conversation.lead_number || "",
  };
  const list = new Intl.ListFormat(locale, { style: "long", type: "conjunction" });
  const canReact = messageActions.actionsFor(message).react;

  return (
    <div
      role="group"
      aria-label={t("group")}
      data-edge={own ? "start" : "end"}
      className={cn(
        "absolute bottom-0 z-10 flex translate-y-1/2 flex-nowrap gap-1",
        own ? "left-2" : "right-2",
      )}
    >
      {groups.map((group) => (
        <ReactionChip
          key={group.emoji}
          group={group}
          names={list.format(group.reactions.map((reaction) => labelOf(reactorOf(reaction, people))))}
          onToggle={canReact ? () => messageActions.react(message, group.emoji) : undefined}
        />
      ))}
    </div>
  );
}

export function ReactionChips({ message, own }: { message: ConversationMessage; own: boolean }) {
  const groups = groupReactions(message.reactions);
  if (groups.length === 0) return null;
  return <ReactionChipList message={message} groups={groups} own={own} />;
}
