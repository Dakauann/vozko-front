import type { EntryType } from '@/lib/conversations/types';
import { readNote, type ConversationNote } from '@/lib/conversations/notes';
import { apiClient } from '@/lib/api/browser-client';

interface NoteListResult {
    notes: ConversationNote[];
    hasMore: boolean;
    error?: string;
}

interface NoteWriteResult {
    note: ConversationNote | null;
    error?: string;
    code?: string;
}

function readNotes(raw: unknown): ConversationNote[] {
    return Array.isArray(raw) ? raw.map(readNote).filter((note): note is ConversationNote => note !== null) : [];
}

function notesPath(entryType: EntryType, entryId: string): string {
    return `/conversations/${encodeURIComponent(entryType)}/${encodeURIComponent(entryId)}/notes`;
}

export async function listConversationNotesAction(
    entryType: EntryType,
    entryId: string,
    options: { before?: string; limit?: number } = {},
): Promise<NoteListResult> {
    const params = new URLSearchParams();
    if (options.before) params.set('before', options.before);
    if (options.limit) params.set('limit', String(options.limit));
    const query = params.toString();
    const response = await apiClient<{ notes?: unknown; has_more?: boolean }>(
        `${notesPath(entryType, entryId)}${query ? `?${query}` : ''}`,
        { method: 'GET' },
    );
    if (response.error) return { notes: [], hasMore: false, error: response.error.message };
    return { notes: readNotes(response.data?.notes), hasMore: Boolean(response.data?.has_more) };
}

export async function createConversationNoteAction(
    entryType: EntryType,
    entryId: string,
    body: string,
    mentions: string[],
): Promise<NoteWriteResult> {
    const response = await apiClient<{ note?: unknown }>(notesPath(entryType, entryId), {
        method: 'POST',
        body: JSON.stringify({ body, mentions }),
    });
    if (response.error) return { note: null, error: response.error.message, code: response.error.code };
    const note = readNote(response.data?.note);
    return note ? { note } : { note: null, error: 'invalid_note' };
}

export async function deleteConversationNoteAction(noteId: string): Promise<{ error?: string; code?: string }> {
    const response = await apiClient(`/conversation-notes/${encodeURIComponent(noteId)}`, { method: 'DELETE' });
    return response.error ? { error: response.error.message, code: response.error.code } : {};
}
