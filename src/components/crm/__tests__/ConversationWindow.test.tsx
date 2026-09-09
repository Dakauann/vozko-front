/**
 * @vitest-environment jsdom
 *
 * The window frame itself: its title bar controls, and the fact that a
 * minimized window keeps its conversation rather than tearing it down.
 *
 * The thread and composer inside it are the same components the centre pane
 * uses and are covered by their own tests, so they are stubbed here — what is
 * under test is the frame around them.
 */

import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";

vi.mock("@/components/crm/CrmConversationView", () => ({
  default: ({ conversation }: { conversation: { entry_id: string } }) => (
    <div data-testid="thread">thread:{conversation.entry_id}</div>
  ),
}));
vi.mock("@/components/crm/CrmMessageInput", () => ({
  default: () => <div data-testid="composer" />,
}));
vi.mock("@/components/crm/CrmWallpaper", () => ({ default: () => null }));
// Self-contained and locale-aware, with its own tests; here it only needs to
// prove the window WIRES it to the right conversation.
vi.mock("@/components/crm/AssignMemberPicker", () => ({
  default: ({ onAssign }: { onAssign: (userId: string) => void }) => (
    <button type="button" onClick={() => onAssign("u-7")}>
      assign
    </button>
  ),
}));
vi.mock("@/components/channels/channel-avatar", () => ({
  ChannelAvatar: () => <div data-testid="avatar" />,
}));

import ConversationWindow from "@/components/crm/ConversationWindow";
import type { ActiveConversation } from "@/lib/conversations/types";
import type { WindowConversationState } from "@/lib/conversations/windowed-conversations";
import type { ConversationWindow as WindowGeometry } from "@/lib/conversations/window-deck";

const translations = {
  conversation: {
    noConversationSelected: "",
    noConversationDescription: "",
    loadingMore: "",
    windowClosed: "",
    windowClosedDescription: "",
  },
  input: {
    placeholder: "",
    windowClosed: "",
    windowClosedDescription: "",
    windowClosedNoClock: "",
    sendButton: "",
    attachFile: "",
    recording: "",
    uploading: "",
    windowExpires: "",
  },
  minimize: "Minimizar",
  restore: "Restaurar",
  maximize: "Maximizar",
  close: "Fechar janela",
  dragHint: "Arraste para mover",
  actions: {
    actions: "Ações da conversa",
    statusHeading: "Status",
    markOngoing: "Marcar em andamento",
    markFinished: "Marcar como finalizada",
    automationOn: "IA respondendo",
    automationOff: "IA pausada",
  },
} as unknown as React.ComponentProps<
  typeof ConversationWindow
>["translations"];

const geometry = (over: Partial<WindowGeometry> = {}): WindowGeometry => ({
  key: "whatsapp-e1",
  entryId: "e1",
  entryType: "whatsapp",
  leadName: "Ana",
  x: 40,
  y: 60,
  width: 384,
  height: 540,
  minimized: false,
  maximized: false,
  restore: null,
  z: 1,
  ...over,
});

const state = (over: Partial<ActiveConversation> = {}): WindowConversationState => ({
  conversation: {
    entry_id: "e1",
    entry_type: "whatsapp",
    lead_name: "Ana Souza",
    lead_number: "+5511999",
    messages: [],
    has_more: false,
    unread_count: 0,
    window_open: true,
    window_expires_at: null,
    ...over,
  },
  loadingConversation: false,
  loadingHistory: false,
  pendingLoadMore: false,
  typingUserIds: [],
  visible: true,
});

function renderWindow(over: Partial<React.ComponentProps<typeof ConversationWindow>> = {}) {
  const props = {
    geometry: geometry(),
    state: state(),
    translations,
    actions: {
      canAssign: false,
      canSetStatus: false,
      canToggleAutomation: false,
      canAssignStage: false,
      canAssignLabel: false,
      resolve: () => ({}),
      onAssign: vi.fn(),
      onSetStatus: vi.fn(),
      onToggleAutomation: vi.fn(),
    },
    canSend: true,
    onFocus: vi.fn(),
    onClose: vi.fn(),
    onToggleMinimize: vi.fn(),
    onToggleMaximize: vi.fn(),
    onMove: vi.fn(),
    onResize: vi.fn(),
    onLoadHistory: vi.fn(),
    onSend: vi.fn(),
    onSendMedia: vi.fn(),
    onSendButton: vi.fn(),
    onTyping: vi.fn(),
    ...over,
  };
  return { props, ...render(<ConversationWindow {...props} />) };
}

describe("ConversationWindow", () => {
  it("names the window after the person, so a deck of them can be told apart", () => {
    renderWindow();
    expect(screen.getByRole("dialog", { name: "Ana Souza" })).toBeInTheDocument();
    expect(screen.getByText("+5511999")).toBeInTheDocument();
  });

  it("sits where the deck placed it", () => {
    renderWindow();
    const win = screen.getByRole("dialog");
    expect(win).toHaveStyle({ left: "40px", top: "60px", width: "384px" });
  });

  it("shows the conversation and its composer", () => {
    renderWindow();
    expect(screen.getByTestId("thread")).toHaveTextContent("thread:e1");
    expect(screen.getByTestId("composer")).toBeInTheDocument();
  });

  it("closes on the close control", () => {
    const { props } = renderWindow();
    fireEvent.click(screen.getByRole("button", { name: "Fechar janela" }));
    expect(props.onClose).toHaveBeenCalledOnce();
  });

  it("minimizes and maximizes through their own controls", () => {
    const { props } = renderWindow();
    fireEvent.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(props.onToggleMinimize).toHaveBeenCalledOnce();

    fireEvent.click(screen.getByRole("button", { name: "Maximizar" }));
    expect(props.onToggleMaximize).toHaveBeenCalledOnce();
  });

  // A minimized window is still subscribed and still holds its transcript; only
  // the body is hidden, so restoring it is instant and nothing was missed.
  it("hides the thread when minimized but still says who is waiting", () => {
    renderWindow({ geometry: geometry({ minimized: true }) });

    expect(screen.queryByTestId("thread")).not.toBeInTheDocument();
    expect(screen.queryByTestId("composer")).not.toBeInTheDocument();
    expect(screen.getByRole("dialog", { name: "Ana Souza" })).toBeInTheDocument();
  });

  // 44px of bar has room for a name or for three buttons and a second line of
  // grey text, not both. Parked, the name wins.
  it("gives the name the room, dropping the number and the window controls", () => {
    renderWindow({ geometry: geometry({ minimized: true }) });

    expect(screen.getByText("Ana Souza")).toBeInTheDocument();
    expect(screen.queryByText("+5511999")).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Minimizar" }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Maximizar" }),
    ).not.toBeInTheDocument();
    // Closing is the one thing the bar itself cannot do.
    expect(screen.getByRole("button", { name: "Fechar janela" })).toBeInTheDocument();
  });

  it("shows what has gone unread while it was set aside", () => {
    renderWindow({
      geometry: geometry({ minimized: true }),
      state: state({ unread_count: 3 }),
    });

    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("caps a very large unread count so it still fits the bar", () => {
    renderWindow({
      geometry: geometry({ minimized: true }),
      state: state({ unread_count: 250 }),
    });

    expect(screen.getByText("99+")).toBeInTheDocument();
  });

  it("shows no unread badge when there is nothing waiting", () => {
    renderWindow({ geometry: geometry({ minimized: true }) });
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  // Parked conversations line the bottom edge, so they read as set aside
  // rather than as windows that happen to be short.
  it("sits where the dock parked it when minimized", () => {
    renderWindow({
      geometry: geometry({ minimized: true }),
      dockedBox: { x: 900, y: 844, width: 260, height: 44 },
    });

    const win = screen.getByRole("dialog");
    expect(win).toHaveStyle({
      left: "900px",
      top: "844px",
      width: "260px",
      height: "44px",
    });
  });

  it("stays narrow while parked, however wide the window was", () => {
    renderWindow({
      geometry: geometry({ minimized: true, width: 900 }),
      dockedBox: { x: 900, y: 844, width: 260, height: 44 },
    });

    expect(screen.getByRole("dialog")).toHaveStyle({ maxWidth: "260px" });
  });

  it("comes back when the parked bar is clicked, the way a chat dock behaves", () => {
    const { props } = renderWindow({
      geometry: geometry({ minimized: true }),
      dockedBox: { x: 900, y: 844, width: 260, height: 44 },
    });

    fireEvent.click(screen.getByText("Ana Souza"));
    expect(props.onToggleMinimize).toHaveBeenCalledOnce();
  });

  it("does not fold away when a real window's title bar is clicked", () => {
    const { props } = renderWindow();
    fireEvent.click(screen.getByText("Ana Souza"));
    expect(props.onToggleMinimize).not.toHaveBeenCalled();
  });

  it("keeps its own box while parked, so restoring returns it there", () => {
    // The docked box is presentation only; the geometry the deck holds is
    // untouched, which is what makes restore land where the operator left it.
    const { props } = renderWindow({
      geometry: geometry({ minimized: true, x: 40, y: 60 }),
      dockedBox: { x: 900, y: 844, width: 260, height: 44 },
    });

    expect(props.geometry.x).toBe(40);
    expect(props.geometry.y).toBe(60);
  });

  it("offers to restore, not to maximize again, once maximized", () => {
    renderWindow({ geometry: geometry({ maximized: true }) });
    expect(screen.getByRole("button", { name: "Restaurar" })).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "Maximizar" }),
    ).not.toBeInTheDocument();
  });

  it("raises itself when clicked anywhere, not only on the bar", () => {
    const { props } = renderWindow();
    fireEvent.pointerDown(screen.getByTestId("thread"));
    expect(props.onFocus).toHaveBeenCalled();
  });

  /**
   * A windowed conversation has to be WORKABLE. An operator who can only read
   * and reply from a window, and has to go back to the centre pane to hand the
   * conversation over or close it out, will stop using windows.
   */
  describe("working the conversation from the window", () => {
    // Radix opens its menu on pointerdown, not on click.
    const openActions = () =>
      fireEvent.pointerDown(
        screen.getByRole("button", { name: "Ações da conversa" }),
        { button: 0, ctrlKey: false },
      );

    const workable = {
      canAssign: true,
      canSetStatus: true,
      canToggleAutomation: true,
      canAssignStage: true,
      canAssignLabel: true,
      workspaceId: "ws-1",
      resolve: () => ({ assignedUserId: null }),
      onAssign: vi.fn(),
      onSetStatus: vi.fn(),
      onToggleAutomation: vi.fn(),
    };

    it("offers the conversation actions", () => {
      renderWindow({ actions: { ...workable, onSetStatus: vi.fn() } });
      expect(
        screen.getByRole("button", { name: "Ações da conversa" }),
      ).toBeInTheDocument();
    });

    it("hands the conversation over to another operator, by entry", () => {
      const onAssign = vi.fn();
      renderWindow({ actions: { ...workable, onAssign } });

      fireEvent.click(screen.getByRole("button", { name: "assign" }));

      expect(onAssign).toHaveBeenCalledWith("e1", "whatsapp", "u-7");
    });

    it("moves the conversation on, addressed to ITS entry", async () => {
      const onSetStatus = vi.fn();
      renderWindow({
        actions: { ...workable, onSetStatus },
        state: state({ conversation_status: "ongoing" }),
      });

      openActions();
      fireEvent.click(await screen.findByText("Marcar como finalizada"));

      expect(onSetStatus).toHaveBeenCalledWith("e1", "whatsapp", "finished");
    });

    it("pauses and resumes the agent for ITS entry", async () => {
      const onToggleAutomation = vi.fn();
      renderWindow({ actions: { ...workable, onToggleAutomation } });

      openActions();
      fireEvent.click(await screen.findByText("IA respondendo"));

      expect(onToggleAutomation).toHaveBeenCalledWith("e1", "whatsapp");
    });

    // Permissions are the centre pane's, not a second set: an operator who may
    // not hand a conversation over must not be offered it here either.
    it("offers nothing it is not allowed to do", () => {
      renderWindow();
      expect(
        screen.queryByRole("button", { name: "Ações da conversa" }),
      ).not.toBeInTheDocument();
    });

    it("does not carry the actions onto a parked bar", () => {
      renderWindow({
        actions: workable,
        geometry: geometry({ minimized: true }),
        dockedBox: { x: 900, y: 844, width: 260, height: 52 },
      });

      expect(
        screen.queryByRole("button", { name: "Ações da conversa" }),
      ).not.toBeInTheDocument();
    });
  });

  it("falls back to the number before the server has named the lead", () => {
    renderWindow({ state: state({ lead_name: "" }) });
    expect(
      screen.getByRole("dialog", { name: "+5511999" }),
    ).toBeInTheDocument();
  });
});
