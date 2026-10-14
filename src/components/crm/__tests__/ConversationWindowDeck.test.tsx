import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/crm/ConversationWindow", () => ({
  default: ({
    state,
    poppedOut,
    onTogglePopOut,
  }: {
    state: { conversation: { entry_id: string } };
    poppedOut?: boolean;
    onTogglePopOut?: () => void;
  }) => (
    <section
      data-testid={`window-${state.conversation.entry_id}`}
      data-popped-out={String(Boolean(poppedOut))}
    >
      {onTogglePopOut && (
        <button type="button" onClick={onTogglePopOut}>
          toggle
        </button>
      )}
    </section>
  ),
}));

import ConversationWindowDeck from "@/components/crm/ConversationWindowDeck";
import type { WindowConversationState } from "@/lib/conversations/windowed-conversations";

type FakePictureWindow = Window & { close: ReturnType<typeof vi.fn> };

function fakePictureWindow(): FakePictureWindow {
  const target = new EventTarget();
  return Object.assign(target, {
    document: document.implementation.createHTMLDocument("pip"),
    close: vi.fn(() => target.dispatchEvent(new Event("pagehide"))),
  }) as unknown as FakePictureWindow;
}

function installBrowserApi(requestWindow: () => Promise<Window>) {
  const api = { requestWindow: vi.fn(requestWindow) };
  Object.defineProperty(window, "documentPictureInPicture", {
    configurable: true,
    value: api,
  });
  return api;
}

afterEach(() => {
  Reflect.deleteProperty(window, "documentPictureInPicture");
});

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
    typingUserIds: [],
    visible: true,
  } as unknown as WindowConversationState;
}

function conversationsOf(...entryIds: string[]) {
  return new Map(
    entryIds.map((id) => [`whatsapp-${id}`, conversationState(id)]),
  );
}

function deck(conversations: ReturnType<typeof conversationsOf>) {
  return (
    <ConversationWindowDeck
      conversations={conversations}
      focusRequest={null}
      translations={
        {} as React.ComponentProps<typeof ConversationWindowDeck>["translations"]
      }
      actions={
        {} as React.ComponentProps<typeof ConversationWindowDeck>["actions"]
      }
      canSend
      onClose={vi.fn()}
      onLoadHistory={vi.fn()}
      onSend={vi.fn()}
      onSendMedia={vi.fn()}
      onSendButton={vi.fn()}
      onTyping={vi.fn()}
      onVisibilityChange={vi.fn()}
    />
  );
}

async function settle() {
  await act(async () => {});
}

describe("ConversationWindowDeck popping out of the page", () => {
  it("keeps the window in the page where the browser cannot pop it out", async () => {
    render(deck(conversationsOf("e1")));
    await settle();

    expect(screen.getByTestId("window-e1").dataset.poppedOut).toBe("false");
    expect(screen.queryByRole("button", { name: "toggle" })).toBeNull();
  });

  it("pops a newly opened conversation out by default", async () => {
    const pictureWindow = fakePictureWindow();
    installBrowserApi(() => Promise.resolve(pictureWindow));

    render(deck(conversationsOf("e1")));
    await settle();

    expect(screen.queryByTestId("window-e1")).toBeNull();
    const hosted = within(pictureWindow.document.body).getByTestId(
      "window-e1",
    );
    expect(hosted.dataset.poppedOut).toBe("true");
    expect(pictureWindow.document.title).toBe("Lead e1");
  });

  it("stays in the page when the browser refuses the window", async () => {
    installBrowserApi(() => Promise.reject(new Error("NotAllowedError")));

    render(deck(conversationsOf("e1")));
    await settle();

    expect(screen.getByTestId("window-e1").dataset.poppedOut).toBe("false");
  });

  it("moves the newest conversation into the pop-out and the previous one back", async () => {
    const first = fakePictureWindow();
    const second = fakePictureWindow();
    const windows = [first, second];
    installBrowserApi(() => Promise.resolve(windows.shift()!));

    const { rerender } = render(deck(conversationsOf("e1")));
    await settle();
    rerender(deck(conversationsOf("e1", "e2")));
    await settle();
    act(() => {
      first.dispatchEvent(new Event("pagehide"));
    });

    expect(screen.getByTestId("window-e1").dataset.poppedOut).toBe("false");
    expect(within(second.document.body).getByTestId("window-e2")).toBeTruthy();
  });

  it("comes back to the page when the pop-out is closed", async () => {
    const pictureWindow = fakePictureWindow();
    installBrowserApi(() => Promise.resolve(pictureWindow));
    render(deck(conversationsOf("e1")));
    await settle();

    act(() => {
      within(pictureWindow.document.body).getByText("toggle").click();
    });

    expect(pictureWindow.close).toHaveBeenCalled();
    expect(screen.getByTestId("window-e1").dataset.poppedOut).toBe("false");
  });

  it("closes the pop-out when its conversation is closed", async () => {
    const pictureWindow = fakePictureWindow();
    installBrowserApi(() => Promise.resolve(pictureWindow));
    const { rerender } = render(deck(conversationsOf("e1")));
    await settle();

    rerender(deck(conversationsOf()));
    await settle();

    expect(pictureWindow.close).toHaveBeenCalled();
  });

  it("can pop a window back out by hand", async () => {
    const first = fakePictureWindow();
    const second = fakePictureWindow();
    const windows = [first, second];
    installBrowserApi(() => Promise.resolve(windows.shift()!));
    render(deck(conversationsOf("e1")));
    await settle();
    act(() => {
      first.close();
    });

    fireEvent.click(screen.getByRole("button", { name: "toggle" }));
    await settle();

    expect(within(second.document.body).getByTestId("window-e1")).toBeTruthy();
  });
});
