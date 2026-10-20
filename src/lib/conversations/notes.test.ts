import { describe, expect, it } from "vitest";

import {
  addNote,
  applyNotesPage,
  emptyNotes,
  insertMention,
  matchingMembers,
  mentionQuery,
  mentionsIn,
  needsOlderNotes,
  oldestNoteAt,
  readNote,
  removeNote,
  visibleNotes,
  type ConversationNote,
} from "./notes";

function note(id: string, created_at: string, overrides: Partial<ConversationNote> = {}): ConversationNote {
  return {
    id,
    entry_id: "e1",
    entry_type: "whatsapp",
    author_id: "u-ana",
    author_name: "Ana",
    body: `nota ${id}`,
    mentions: [],
    created_at,
    ...overrides,
  };
}

const t = (minute: number) => new Date(Date.UTC(2026, 9, 18, 12, minute)).toISOString();

describe("readNote", () => {
  it("reads a note from the server", () => {
    expect(readNote(note("n1", t(0)))).toEqual(note("n1", t(0)));
  });

  it("refuses a note without id, conversation or time, and fills missing mentions with none", () => {
    expect(readNote({ ...note("n1", t(0)), id: "" })).toBeNull();
    expect(readNote({ ...note("n1", t(0)), created_at: undefined })).toBeNull();
    expect(readNote(null)).toBeNull();
    expect(readNote({ ...note("n1", t(0)), mentions: null })?.mentions).toEqual([]);
  });
});

describe("notes state", () => {
  it("keeps notes oldest first whatever order the pages arrive in, without duplicates", () => {
    let state = applyNotesPage(emptyNotes, { notes: [note("n3", t(3)), note("n2", t(2))], has_more: true });
    state = applyNotesPage(state, { notes: [note("n2", t(2)), note("n1", t(1))], has_more: false });
    expect(state.notes.map((n) => n.id)).toEqual(["n1", "n2", "n3"]);
    expect(state.hasMore).toBe(false);
    expect(state.loaded).toBe(true);
  });

  it("adds a live note once even if the post answer and the socket both deliver it", () => {
    const state = addNote(addNote(emptyNotes, note("n1", t(1))), note("n1", t(1)));
    expect(state.notes).toHaveLength(1);
  });

  it("removes a deleted note and keeps the same state when it was not there", () => {
    const state = addNote(emptyNotes, note("n1", t(1)));
    expect(removeNote(state, "n1").notes).toEqual([]);
    expect(removeNote(state, "other")).toBe(state);
  });

  it("names the time of the oldest note for the next page", () => {
    expect(oldestNoteAt(emptyNotes)).toBeNull();
    expect(oldestNoteAt(applyNotesPage(emptyNotes, { notes: [note("n2", t(2)), note("n1", t(1))], has_more: true }))).toBe(t(1));
  });
});

describe("needsOlderNotes", () => {
  it("asks for older notes while the loaded ones do not reach back to the oldest loaded message", () => {
    const state = applyNotesPage(emptyNotes, { notes: [note("n5", t(5))], has_more: true });
    expect(needsOlderNotes(state, t(1))).toBe(true);
    expect(needsOlderNotes(state, t(6))).toBe(false);
  });

  it("stops when the server has no older notes, or before the first page arrived", () => {
    expect(needsOlderNotes(applyNotesPage(emptyNotes, { notes: [note("n5", t(5))], has_more: false }), t(1))).toBe(false);
    expect(needsOlderNotes(emptyNotes, t(1))).toBe(false);
  });

  it("asks again when the first page was empty but more exist", () => {
    expect(needsOlderNotes(applyNotesPage(emptyNotes, { notes: [], has_more: true }), t(1))).toBe(true);
  });
});

describe("visibleNotes", () => {
  const notes = [note("n1", t(1)), note("n3", t(3)), note("n5", t(5))];

  it("shows only the notes inside the loaded stretch of messages", () => {
    expect(visibleNotes(notes, { from: t(2), until: t(4) }).map((n) => n.id)).toEqual(["n3"]);
  });

  it("leaves a side open when the thread already holds its oldest or newest message", () => {
    expect(visibleNotes(notes, { from: null, until: t(4) }).map((n) => n.id)).toEqual(["n1", "n3"]);
    expect(visibleNotes(notes, { from: t(2), until: null }).map((n) => n.id)).toEqual(["n3", "n5"]);
    expect(visibleNotes(notes, { from: null, until: null })).toBe(notes);
  });
});

describe("mentions", () => {
  it("finds the name being typed after an @ at the caret", () => {
    expect(mentionQuery("fala @an", 8)).toEqual({ start: 5, query: "an" });
    expect(mentionQuery("@", 1)).toEqual({ start: 0, query: "" });
  });

  it("does not open the picker inside an e-mail address or after a space", () => {
    expect(mentionQuery("ana@empresa", 11)).toBeNull();
    expect(mentionQuery("fala @ana souza", 15)).toBeNull();
    expect(mentionQuery("sem arroba", 10)).toBeNull();
  });

  it("puts the chosen name in place of the typed query and the caret after it", () => {
    expect(insertMention("fala @an hoje", { start: 5, query: "an" }, "Ana Souza")).toEqual({ text: "fala @Ana Souza  hoje", caret: 16 });
  });

  it("collects the members whose names were mentioned, once each", () => {
    const members = [
      { userId: "u-ana", name: "Ana Souza" },
      { userId: "u-ana2", name: "Ana" },
      { userId: "u-bruno", name: "Bruno" },
    ];
    expect(mentionsIn("@Ana Souza pode ver? @Bruno, e @Ana Souza de novo", members)).toEqual(["u-ana", "u-bruno"]);
    expect(mentionsIn("@Ana, olha", members)).toEqual(["u-ana2"]);
    expect(mentionsIn("@Brunoo não existe", members)).toEqual([]);
  });
});

describe("matchingMembers", () => {
  const members = [
    { userId: "u-ana", name: "Ana Souza" },
    { userId: "u-joao", name: "João Lima" },
    { userId: "u-bruno", name: "Bruno" },
  ];

  it("matches the start of any word of the name, ignoring case and accents", () => {
    expect(matchingMembers(members, "sou").map((m) => m.userId)).toEqual(["u-ana"]);
    expect(matchingMembers(members, "joa").map((m) => m.userId)).toEqual(["u-joao"]);
    expect(matchingMembers(members, "BR").map((m) => m.userId)).toEqual(["u-bruno"]);
  });

  it("lists everyone for an empty query, up to the limit", () => {
    expect(matchingMembers(members, "")).toHaveLength(3);
    expect(matchingMembers(members, "", 2)).toHaveLength(2);
  });
});
