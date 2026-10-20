import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import { StoryRow } from "../event-rows";
import type { ConversationMessage } from "@/lib/conversations/types";
import ptMessages from "@/i18n/messages/pt.json";

const metaCopy = ptMessages.crmConversation.meta;

function story(overrides: Partial<ConversationMessage>): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "e-1",
    entry_type: "instagram",
    channel: "instagram",
    message_type: "story_reply",
    from: "cliente",
    to: "loja",
    text: "Que lindo",
    created_at: "2026-10-19T10:00:00Z",
    ...overrides,
  } as ConversationMessage;
}

function renderStory(message: ConversationMessage) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <StoryRow row={{ kind: "story", key: message.id, message, runGap: false }} />
    </NextIntlClientProvider>,
  );
}

describe("StoryRow", () => {
  it("renders a story reply for a Meta channel", () => {
    renderStory(story({}));
    expect(screen.getByText(metaCopy.storyReply)).toBeInTheDocument();
    expect(screen.getByText("Que lindo")).toBeInTheDocument();
  });

  it("does not dress a story from an unknown channel as an Instagram story", () => {
    renderStory(story({ channel: "mercadolivre" as ConversationMessage["channel"], entry_type: "mercadolivre" as ConversationMessage["entry_type"] }));
    expect(screen.queryByText(metaCopy.storyReply)).not.toBeInTheDocument();
    expect(screen.getByText("Que lindo")).toBeInTheDocument();
  });
});
