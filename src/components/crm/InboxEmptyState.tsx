"use client";

import { useTranslations } from "next-intl";

import { ChatCircleDots, MagnifyingGlass } from "@/components/icons";
import { NoDepartmentNotice } from "@/components/dashboard/NoDepartmentNotice";
import type { InboxEmptyState as EmptyState } from "@/lib/conversations/inbox-empty";

interface InboxEmptyStateProps {
  state: EmptyState;
  noConversationsText: string;
  onClearSearch: () => void;
  onClearFilters: () => void;
  onShowActive: () => void;
}

export function InboxEmptyState({ state, noConversationsText, onClearSearch, onClearFilters, onShowActive }: InboxEmptyStateProps) {
  const t = useTranslations("liveChat.inbox.empty");
  const narrowed = state.kind === "search" || state.kind === "filters";
  const Icon = narrowed ? MagnifyingGlass : ChatCircleDots;
  const actions = {
    clearSearch: { label: t("clearSearch"), run: onClearSearch },
    clearFilters: { label: t("clearFilters"), run: onClearFilters },
    showActive: { label: t("showActive"), run: onShowActive },
  };
  const action = state.action ? actions[state.action] : null;

  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-[--radius] bg-muted">
        <Icon weight="duotone" className="h-7 w-7 text-muted-foreground" aria-hidden />
      </div>
      {state.kind === "department" ? (
        <NoDepartmentNotice compact />
      ) : (
        <p className="text-sm text-muted-foreground">{state.kind === "none" ? noConversationsText : t(state.kind)}</p>
      )}
      {action ? (
        <button
          type="button"
          onClick={action.run}
          className="rounded-[--radius] text-xs font-medium text-healthy-ink hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
