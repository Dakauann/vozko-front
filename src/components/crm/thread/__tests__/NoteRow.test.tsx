import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { ConversationNote } from "@/lib/conversations/notes";

import { NoteRow } from "../NoteRow";
import { ThreadRowProvider, type ThreadRowContextValue } from "../thread-context";

function note(overrides: Partial<ConversationNote> = {}): ConversationNote {
  return {
    id: "note-1",
    entry_id: "entry-1",
    entry_type: "email",
    author_id: "user-1",
    author_name: "Ana",
    body: "Cliente pediu o comprovante.",
    mentions: [],
    images: [],
    created_at: new Date(Date.UTC(2026, 9, 22, 18, 0)).toISOString(),
    ...overrides,
  };
}

const context: ThreadRowContextValue = {
  conversation: {
    entry_id: "entry-1",
    entry_type: "email",
    lead_name: "Lead",
    lead_number: "",
    messages: [],
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
  },
  messagesById: new Map(),
  matchedIds: new Set(),
  currentMatchId: null,
  arrivalStart: () => false,
  canSeekOriginal: false,
  onJumpToMessage: () => {},
  resendingIds: new Set(),
  toolDefinitions: new Map(),
  toolCopy: { ...ptMessages.crmConversation.thread.tool, imageSentTo: (recipient: string) => recipient },
};

function show(value: ConversationNote) {
  const wrapper = ({ children }: { children: ReactNode }) => (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <ThreadRowProvider value={context}>{children}</ThreadRowProvider>
    </NextIntlClientProvider>
  );
  return render(<NoteRow row={{ kind: "note", key: value.id, note: value }} />, { wrapper });
}

describe("NoteRow", () => {
  it("shows the images attached to a note next to its text", () => {
    show(note({ images: [{ id: "img-1", url: "https://cdn/img-1.png", mime_type: "image/png" }] }));

    expect(screen.getByText("Cliente pediu o comprovante.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Abrir imagem 1 de 1" })).toBeInTheDocument();
  });

  it("leaves no empty paragraph on a note that only carries images", () => {
    const { container } = show(note({ body: "", images: [{ id: "img-1", url: "https://cdn/img-1.png", mime_type: "image/png" }] }));

    expect(container.querySelector("article p")).toBeNull();
    expect(screen.getByRole("button", { name: "Abrir imagem 1 de 1" })).toBeInTheDocument();
  });
});
