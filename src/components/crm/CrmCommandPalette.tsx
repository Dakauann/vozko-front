"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { ChannelAvatar } from "@/components/channels/channel-avatar";
import { HighlightedText } from "@/components/crm/highlighted-text";
import { KeyChords } from "@/components/crm/KeyChords";
import { CommandDialog, CommandGroup, CommandInput, CommandItem, CommandList, CommandShortcut } from "@/components/ui/command";
import { HIGHLIGHT_MIN_LENGTH } from "@/lib/conversations/highlight";
import { inboxEntryKey } from "@/lib/conversations/inbox-hold";
import type { EntryType, InboxEntry, WsSearchInboxPayload } from "@/lib/conversations/types";
import { CRM_SHORTCUT_NAMESPACE, bindingFor, type ShortcutId } from "@/lib/keyboard/crm-bindings";
import type { CrmViewMode } from "@/lib/crm/view-mode";

const SEARCH_DELAY_MS = 250;
const RECENT_LIMIT = 6;
const RESULT_LIMIT = 8;

export interface ConversationCommand {
  id: ShortcutId;
  run: () => void;
}

export interface ViewCommand {
  mode: CrmViewMode;
  label: string;
}

interface CrmCommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recent: InboxEntry[];
  searchResults: InboxEntry[] | null;
  searching: boolean;
  onSearch: (filters: WsSearchInboxPayload) => void;
  onEndSearch: () => void;
  onOpenConversation: (entryId: string, entryType: EntryType) => void;
  commands: ConversationCommand[];
  views: ViewCommand[];
  currentView: CrmViewMode;
  onSwitchView: (mode: CrmViewMode) => void;
}

export function CrmCommandPalette({
  open,
  onOpenChange,
  recent,
  searchResults,
  searching,
  onSearch,
  onEndSearch,
  onOpenConversation,
  commands,
  views,
  currentView,
  onSwitchView,
}: CrmCommandPaletteProps) {
  const t = useTranslations("crmCommandPalette");
  const tShortcuts = useTranslations(CRM_SHORTCUT_NAMESPACE);
  const [query, setQuery] = useState("");
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchedRef = useRef(false);
  const restoresFocusRef = useRef(true);

  useEffect(
    () => () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    },
    [],
  );

  const term = query.trim();
  const searchesServer = term.length >= HIGHLIGHT_MIN_LENGTH;
  const conversations = searchesServer ? (searchResults ?? []).slice(0, RESULT_LIMIT) : recent.slice(0, RECENT_LIMIT);

  const changeQuery = (next: string) => {
    setQuery(next);
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    if (next.trim().length < HIGHLIGHT_MIN_LENGTH) return;
    searchTimerRef.current = setTimeout(() => {
      searchedRef.current = true;
      onSearch({ query: next.trim(), page: 1, page_size: RESULT_LIMIT });
    }, SEARCH_DELAY_MS);
  };

  const close = (next: boolean) => {
    if (next) {
      onOpenChange(true);
      return;
    }
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    setQuery("");
    if (searchedRef.current) onEndSearch();
    searchedRef.current = false;
    onOpenChange(false);
  };

  const closeThen = (action: () => void) => {
    restoresFocusRef.current = false;
    close(false);
    setTimeout(action, 0);
  };

  return (
    <CommandDialog
      open={open}
      onOpenChange={close}
      title={t("title")}
      description={t("description")}
      onCloseAutoFocus={(event) => {
        if (restoresFocusRef.current) return;
        restoresFocusRef.current = true;
        event.preventDefault();
      }}
    >
      <CommandInput value={query} onValueChange={changeQuery} placeholder={t("placeholder")} />
      <CommandList className="max-h-[min(26rem,60vh)]">
        <CommandGroup heading={t("groups.conversations")} forceMount>
          {searchesServer && searching ? <p className="px-3 py-2 text-xs text-muted-foreground">{t("searching")}</p> : null}
          {searchesServer && !searching && conversations.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted-foreground">{t("noConversations")}</p>
          ) : null}
          {conversations.map((entry) => (
            <CommandItem
              key={inboxEntryKey(entry)}
              value={`conversation:${inboxEntryKey(entry)}`}
              forceMount
              onSelect={() => closeThen(() => onOpenConversation(entry.entry_id, entry.entry_type))}
            >
              <ChannelAvatar name={entry.lead_name || entry.lead_number} pictureUrl={entry.lead_picture} entryType={entry.entry_type} isGroup={entry.is_group} size="sm" />
              <span className="min-w-0 flex-1">
                <span className="block truncate font-medium">
                  <HighlightedText text={entry.lead_name || entry.lead_number} query={term} />
                </span>
                {entry.last_message_preview ? (
                  <span className="block truncate text-xs text-muted-foreground">
                    <HighlightedText text={entry.last_message_preview} query={term} />
                  </span>
                ) : null}
              </span>
            </CommandItem>
          ))}
        </CommandGroup>
        {commands.length > 0 ? (
          <CommandGroup heading={t("groups.actions")}>
            {commands.map((command) => {
              const binding = bindingFor(command.id);
              return (
                <CommandItem key={command.id} value={tShortcuts(binding.labelKey)} onSelect={() => closeThen(command.run)}>
                  <span className="flex-1">{tShortcuts(binding.labelKey)}</span>
                  {binding.keys.length > 0 ? (
                    <CommandShortcut>
                      <KeyChords keys={binding.keys} />
                    </CommandShortcut>
                  ) : null}
                </CommandItem>
              );
            })}
          </CommandGroup>
        ) : null}
        {views.length > 0 ? (
          <CommandGroup heading={t("groups.views")}>
            {views.map((view) => (
              <CommandItem key={view.mode} value={view.label} onSelect={() => closeThen(() => onSwitchView(view.mode))}>
                <span className="flex-1">{view.label}</span>
                {view.mode === currentView ? <CommandShortcut>{t("currentView")}</CommandShortcut> : null}
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
    </CommandDialog>
  );
}
