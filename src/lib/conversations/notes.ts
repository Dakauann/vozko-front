import { inLoadedRange, olderPageNeeded, type LoadedRange } from "./loaded-range";

export interface ConversationNote {
  id: string;
  entry_id: string;
  entry_type: string;
  author_id: string;
  author_name: string;
  body: string;
  mentions: string[];
  created_at: string;
}

export interface NotesPage {
  notes: ConversationNote[];
  has_more: boolean;
}

export interface NotesState {
  notes: ConversationNote[];
  hasMore: boolean;
  loaded: boolean;
}

export type NoteRange = LoadedRange;

export interface MentionQuery {
  start: number;
  query: string;
}

export interface MentionCandidate {
  userId: string;
  name: string;
}

export const emptyNotes: NotesState = { notes: [], hasMore: false, loaded: false };

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function timeOf(iso: string): number {
  return new Date(iso).getTime();
}

export function readNote(raw: unknown): ConversationNote | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = raw as Record<string, unknown>;
  const note: ConversationNote = {
    id: text(value.id),
    entry_id: text(value.entry_id),
    entry_type: text(value.entry_type),
    author_id: text(value.author_id),
    author_name: text(value.author_name),
    body: text(value.body),
    mentions: Array.isArray(value.mentions) ? value.mentions.filter((id): id is string => typeof id === "string") : [],
    created_at: text(value.created_at),
  };
  if (!note.id || !note.entry_id || !note.entry_type || Number.isNaN(timeOf(note.created_at))) return null;
  return note;
}

function merged(existing: readonly ConversationNote[], incoming: readonly ConversationNote[]): ConversationNote[] {
  const byId = new Map(existing.map((note) => [note.id, note]));
  for (const note of incoming) byId.set(note.id, note);
  return [...byId.values()].sort((a, b) => timeOf(a.created_at) - timeOf(b.created_at));
}

export function applyNotesPage(state: NotesState, page: NotesPage): NotesState {
  return { notes: merged(state.notes, page.notes), hasMore: page.has_more, loaded: true };
}

export function addNote(state: NotesState, note: ConversationNote): NotesState {
  return { ...state, notes: merged(state.notes, [note]) };
}

export function removeNote(state: NotesState, noteId: string): NotesState {
  if (!state.notes.some((note) => note.id === noteId)) return state;
  return { ...state, notes: state.notes.filter((note) => note.id !== noteId) };
}

export function oldestNoteAt(state: NotesState): string | null {
  return state.notes[0]?.created_at ?? null;
}

export function needsOlderNotes(state: NotesState, oldestMessageAt: string | null): boolean {
  if (!state.loaded || !state.hasMore) return false;
  return olderPageNeeded(oldestNoteAt(state), oldestMessageAt);
}

export function visibleNotes(notes: ConversationNote[], range: NoteRange): ConversationNote[] {
  return inLoadedRange(notes, range, (note) => note.created_at);
}

export function mentionQuery(value: string, caret: number): MentionQuery | null {
  const before = value.slice(0, caret);
  const start = before.lastIndexOf("@");
  if (start < 0) return null;
  if (start > 0 && !/\s/.test(before[start - 1])) return null;
  const query = before.slice(start + 1);
  return /\s/.test(query) ? null : { start, query };
}

export function insertMention(value: string, mention: MentionQuery, name: string): { text: string; caret: number } {
  const inserted = `@${name} `;
  const end = mention.start + 1 + mention.query.length;
  return { text: value.slice(0, mention.start) + inserted + value.slice(end), caret: mention.start + inserted.length };
}

function endsAtBoundary(value: string, index: number): boolean {
  return index >= value.length || !/[\p{L}\p{N}_]/u.test(value[index]);
}

export function mentionsIn(body: string, members: readonly MentionCandidate[]): string[] {
  const candidates = members.filter((member) => member.name.trim() !== "").sort((a, b) => b.name.length - a.name.length);
  const found: string[] = [];
  for (let index = body.indexOf("@"); index >= 0; index = body.indexOf("@", index + 1)) {
    const match = candidates.find(
      (member) => body.startsWith(member.name, index + 1) && endsAtBoundary(body, index + 1 + member.name.length),
    );
    if (match && !found.includes(match.userId)) found.push(match.userId);
  }
  return found;
}

function folded(value: string): string {
  return value.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

export function matchingMembers<T extends MentionCandidate>(members: readonly T[], query: string, limit = 8): T[] {
  const wanted = folded(query.trim());
  return members
    .filter((member) => member.name.trim() !== "")
    .filter((member) => !wanted || folded(member.name).split(/\s+/).some((word) => word.startsWith(wanted)))
    .slice(0, limit);
}
