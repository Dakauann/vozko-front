"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";

import {
  deleteConversationNoteAction,
  listConversationNotesAction,
} from "@/app/actions/conversation-notes";
import { useOptionalCrm } from "@/contexts/crm-context";
import {
  addNote,
  applyNotesPage,
  emptyNotes,
  needsOlderNotes,
  oldestNoteAt,
  readNote,
  removeNote,
  type ConversationNote,
  type NotesState,
} from "@/lib/conversations/notes";
import type { EntryType } from "@/lib/conversations/types";
import { windowKey } from "@/lib/conversations/window-deck";

const PAGE_SIZE = 50;

const notesByEntry = new Map<string, NotesState>();
const loadingEntries = new Set<string>();
const listeners = new Set<() => void>();

function notesOf(entryKey: string): NotesState {
  return notesByEntry.get(entryKey) ?? emptyNotes;
}

function update(entryKey: string, change: (state: NotesState) => NotesState) {
  const current = notesOf(entryKey);
  const next = change(current);
  if (next === current) return;
  notesByEntry.set(entryKey, next);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function rememberNote(note: ConversationNote) {
  update(windowKey(note.entry_id, note.entry_type), (state) => addNote(state, note));
}

export interface ConversationNotes {
  notes: ConversationNote[];
  deleteNote: (noteId: string) => Promise<void>;
}

export function useConversationNotes(
  entryId: string | null,
  entryType: EntryType | null,
  oldestMessageAt: string | null,
): ConversationNotes {
  const t = useTranslations("crmMessage.notes");
  const subscribeServerEvents = useOptionalCrm()?.subscribeServerEvents;
  const entryKey = entryId && entryType ? windowKey(entryId, entryType) : null;
  const snapshot = useCallback(() => (entryKey ? notesOf(entryKey) : emptyNotes), [entryKey]);
  const state = useSyncExternalStore(subscribe, snapshot, () => emptyNotes);

  const loadPage = useCallback(
    async (before?: string) => {
      if (!entryKey || !entryId || !entryType || loadingEntries.has(entryKey)) return;
      loadingEntries.add(entryKey);
      try {
        const page = await listConversationNotesAction(entryType, entryId, { before, limit: PAGE_SIZE });
        if (page.error) {
          toast.error(t("loadFailed"), { id: `notes-${entryKey}` });
          return;
        }
        update(entryKey, (current) => applyNotesPage(current, { notes: page.notes, has_more: page.hasMore }));
      } finally {
        loadingEntries.delete(entryKey);
      }
    },
    [entryId, entryKey, entryType, t],
  );

  useEffect(() => {
    void loadPage();
  }, [loadPage]);

  useEffect(() => {
    const before = oldestNoteAt(state);
    if (!entryKey || !before || !needsOlderNotes(state, oldestMessageAt)) return;
    void loadPage(before);
  }, [entryKey, loadPage, oldestMessageAt, state]);

  useEffect(() => {
    if (!subscribeServerEvents || !entryId || !entryType) return;
    return subscribeServerEvents((event) => {
      if (event.type === "conversation:note") {
        const note = readNote(event.payload.note);
        if (note && note.entry_id === entryId && note.entry_type === entryType) rememberNote(note);
        return;
      }
      if (event.type === "conversation:note_deleted" && event.payload.entry_id === entryId && event.payload.entry_type === entryType) {
        update(windowKey(entryId, entryType), (current) => removeNote(current, event.payload.note_id));
      }
    });
  }, [entryId, entryType, subscribeServerEvents]);

  const deleteNote = useCallback(
    async (noteId: string) => {
      if (!entryKey) return;
      const result = await deleteConversationNoteAction(noteId);
      if (result.error) {
        toast.error(result.code && t.has(`errors.${result.code}`) ? t(`errors.${result.code}`) : t("deleteFailed"));
        return;
      }
      update(entryKey, (current) => removeNote(current, noteId));
    },
    [entryKey, t],
  );

  return { notes: state.notes, deleteNote };
}
