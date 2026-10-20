import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { hasUserDataCookie } = vi.hoisted(() => ({ hasUserDataCookie: vi.fn(() => true) }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => false }),
}));
vi.mock("@/contexts/department-context", () => ({
  useDepartment: () => ({ currentDepartment: null }),
}));
vi.mock("@/lib/auth/client-cookies", () => ({ hasUserDataCookie }));
vi.mock("@/lib/sounds/sound-player", () => ({ soundPlayer: { play: vi.fn() } }));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));
vi.mock("next-intl", async () => (await import("@/test/next-intl-pt")).nextIntlInPortuguese());

import { useConversationWs } from "@/hooks/use-conversation-ws";
import { FakeWebSocket } from "@/test/fake-websocket";

const limits = [
  { kind: "document", max_bytes: 26214400, mime_types: ["application/pdf", "text/plain"] },
  { kind: "image", max_bytes: 26214400, mime_types: ["image/jpeg", "image/png"] },
];

async function mountOpenSocket() {
  const view = renderHook(() => useConversationWs({ token: "session-token", enabled: true }));
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 60));
  });
  const socket = FakeWebSocket.instances[0];
  await act(async () => {
    socket.simulateOpen();
  });
  return { view, socket };
}

async function subscribe(socket: FakeWebSocket, extra: Record<string, unknown>) {
  await act(async () => {
    socket.receive("conversation:subscribed", {
      entry_id: "e1",
      entry_type: "mercadolivre",
      lead_name: "Comprador",
      lead_number: "",
      unread_count: 0,
      ...extra,
    });
  });
}

describe("attachment limits over the socket", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    FakeWebSocket.instances = [];
    hasUserDataCookie.mockReturnValue(true);
    vi.stubGlobal("WebSocket", FakeWebSocket);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps the limits the subscribe answer carries", async () => {
    const { view, socket } = await mountOpenSocket();
    act(() => view.result.current.subscribe("e1", "mercadolivre"));
    await subscribe(socket, { media_limits: limits });
    expect(view.result.current.activeConversation?.media_limits).toEqual(limits);
  });

  it("keeps a channel without attachments apart from unknown limits", async () => {
    const { view, socket } = await mountOpenSocket();
    act(() => view.result.current.subscribe("e1", "mercadolivre"));
    await subscribe(socket, { media_limits: [] });
    expect(view.result.current.activeConversation?.media_limits).toEqual([]);
  });

  it("leaves the limits unknown when the answer has none or a malformed list", async () => {
    const { view, socket } = await mountOpenSocket();
    act(() => view.result.current.subscribe("e1", "mercadolivre"));
    await subscribe(socket, {});
    expect(view.result.current.activeConversation?.media_limits).toBeUndefined();
    await subscribe(socket, { media_limits: [{ kind: "image", max_bytes: "big", mime_types: [] }] });
    expect(view.result.current.activeConversation?.media_limits).toBeUndefined();
  });
});
