"use client";

import { useMemo, useState } from "react";

import { CrmCommandPalette, type ConversationCommand, type ViewCommand } from "@/components/crm/CrmCommandPalette";
import { ShortcutsHelpDialog } from "@/components/crm/ShortcutsHelpDialog";
import { useShortcuts, type ShortcutHandlers } from "@/hooks/use-shortcuts";
import type { EntryType, InboxEntry, WsSearchInboxPayload } from "@/lib/conversations/types";
import type { CrmViewMode } from "@/lib/crm/view-mode";

interface CrmCommandCenterProps {
  enabled: boolean;
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
  onFocusSearch?: () => void;
}

export function CrmCommandCenter({ enabled, commands, onFocusSearch, ...palette }: CrmCommandCenterProps) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);

  useShortcuts(
    "global",
    {
      "palette.open": () => setPaletteOpen((open) => !open),
      "help.open": () => setHelpOpen(true),
      "search.focus": onFocusSearch ? () => onFocusSearch() : undefined,
    },
    { enabled },
  );

  const conversationHandlers = useMemo<ShortcutHandlers>(
    () => Object.fromEntries(commands.map((command) => [command.id, () => command.run()])),
    [commands],
  );
  useShortcuts("thread", conversationHandlers, { enabled: enabled && commands.length > 0 });

  return (
    <>
      <CrmCommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} {...palette} />
      <ShortcutsHelpDialog open={helpOpen} onOpenChange={setHelpOpen} />
    </>
  );
}
