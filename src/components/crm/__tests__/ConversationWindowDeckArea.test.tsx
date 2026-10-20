import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/crm/ConversationWindow", () => ({
  default: ({ state, geometry }: { state: { conversation: { entry_id: string } }; geometry: { x: number; width: number } }) => (
    <section data-testid={`window-${state.conversation.entry_id}`} data-right={geometry.x + geometry.width} />
  ),
}));

import ConversationWindowDeck from "@/components/crm/ConversationWindowDeck";
import type { WindowConversationState } from "@/lib/conversations/windowed-conversations";

const AREA_WIDTH = 900;

function conversationState(entryId: string): WindowConversationState {
  return {
    conversation: {
      entry_id: entryId,
      entry_type: "whatsapp",
      lead_name: `Lead ${entryId}`,
      lead_number: "+5511999",
      messages: [],
      has_more: false,
      unread_count: 0,
      window_open: true,
      window_expires_at: null,
    },
    loadingConversation: false,
    loadingHistory: false,
    pendingLoadMore: false,
    pendingJump: false,
    search: null,
    typingUserIds: [],
    visible: true,
  } as unknown as WindowConversationState;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("floating conversation windows and the dock rail", () => {
  it("lays windows out inside the area that keeps clear of the rail and the assistant sheet", async () => {
    vi.spyOn(HTMLElement.prototype, "getBoundingClientRect").mockImplementation(function (this: HTMLElement) {
      const reserved = this.className.includes("right-[var(--dock-float-reserve)]");
      return { width: reserved ? AREA_WIDTH : 0, height: reserved ? 800 : 0, x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, toJSON: () => ({}) } as DOMRect;
    });
    const conversations = new Map([["whatsapp-e1", conversationState("e1")]]);
    render(
      <ConversationWindowDeck
        conversations={conversations}
        focusRequest={null}
        translations={{} as React.ComponentProps<typeof ConversationWindowDeck>["translations"]}
        actions={{} as React.ComponentProps<typeof ConversationWindowDeck>["actions"]}
        canSend
        onClose={vi.fn()}
        onLoadHistory={vi.fn()}
        onSend={vi.fn()}
        onSendMedia={vi.fn()}
        onSendButton={vi.fn()}
        onTyping={vi.fn()}
        onVisibilityChange={vi.fn()}
      />,
    );
    await act(async () => {});

    expect(window.innerWidth).toBeGreaterThan(AREA_WIDTH);
    expect(Number(screen.getByTestId("window-e1").dataset.right)).toBeLessThanOrEqual(AREA_WIDTH);
  });
});
