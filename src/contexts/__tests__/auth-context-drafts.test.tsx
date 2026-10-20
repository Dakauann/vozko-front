import { act, fireEvent, render } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthProvider, useAuth } from "@/contexts/auth-context";
import { conversationDrafts } from "@/lib/conversations/browser-drafts";

const ana = { id: "user-ana", email: "ana@example.com", name: "Ana", role: "user", customerType: "company" as const };

vi.mock("@/lib/auth/client-cookies", () => ({
  getUserDataFromCookie: () => ana,
  hasUserDataCookie: () => true,
  clearClientAuthCookies: vi.fn(),
}));
vi.mock("@/lib/auth/auth-api", () => ({ logout: vi.fn(async () => undefined) }));
vi.mock("@/lib/api/browser-client", () => ({
  apiClient: vi.fn(async () => ({ data: { id: ana.id, username: ana.name, email: ana.email, role: ana.role, customerType: "company" } })),
  notifySessionExpired: vi.fn(),
  onSessionExpired: () => () => {},
}));

function LogoutButton() {
  const auth = useAuth();
  return auth.user ? (
    <button type="button" onClick={() => void auth.logout()}>
      {auth.user.id}
    </button>
  ) : null;
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("logging out", () => {
  it("wipes the operator's conversation drafts and keeps a colleague's", async () => {
    conversationDrafts.write({ workspaceId: "ws-1", userId: ana.id }, "whatsapp-e1", { text: "rascunho", attachments: [] });
    conversationDrafts.write({ workspaceId: "ws-1", userId: "user-bruno" }, "whatsapp-e1", { text: "dele", attachments: [] });

    const view = render(
      <AuthProvider>
        <LogoutButton />
      </AuthProvider>,
    );
    const logoutButton = await view.findByRole("button", { name: ana.id }, { timeout: 5000 });
    await act(async () => {});

    await act(async () => fireEvent.click(logoutButton));

    expect(conversationDrafts.read({ workspaceId: "ws-1", userId: ana.id }, "whatsapp-e1")).toBeNull();
    expect(conversationDrafts.read({ workspaceId: "ws-1", userId: "user-bruno" }, "whatsapp-e1")?.text).toBe("dele");
  });
});
