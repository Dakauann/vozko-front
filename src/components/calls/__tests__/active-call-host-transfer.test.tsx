import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: null as unknown as CallSessionApi }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    permissionsLoading: false,
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));
vi.mock("@/app/actions/call-routing", () => ({
  listTransferQueuesAction: () => Promise.resolve({ queues: [{ id: "q1", name: "Suporte", waiting: 0, ready: 1 }] }),
}));

import { ActiveCallHost } from "@/components/calls/active-call-host";
import { subscribeTransferPanel } from "@/lib/call-session/call-session-control";

function whatsAppCall(overrides: Partial<CallSessionApi> = {}) {
  session.value = {
    callState: { callId: "wa-in-1", phoneNumber: "5584994409684", status: "answered", answeredAt: Date.now() },
    startCall: vi.fn(),
    endCall: vi.fn(),
    muted: false,
    setMuted: vi.fn(),
    clearError: vi.fn(),
    lastErrorCode: null,
    presence: [{ userId: "u2", username: "Bia", busy: false }],
    selfUserId: "u1",
    transfer: null,
    transferCall: vi.fn(),
    cancelTransfer: vi.fn(),
    ...overrides,
  } as unknown as CallSessionApi;
}

async function renderWidget() {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <ActiveCallHost />
    </NextIntlClientProvider>,
  );
  await act(async () => {
    await Promise.resolve();
  });
}

describe("ActiveCallHost transfers", () => {
  beforeEach(() => {
    grants.value = new Set(["call_session:use"]);
    whatsAppCall();
  });

  it("lets an operator without the dialer transfer from the call widget", async () => {
    await renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    fireEvent.click(screen.getByRole("radio", { name: /Bia/ }));
    fireEvent.click(screen.getByRole("button", { name: "Transferir para o colega" }));
    expect(session.value.transferCall).toHaveBeenCalledWith({ kind: "member", userId: "u2" }, "");
  });

  it("hands the transfer to the dialer when the operator has one", async () => {
    grants.value = new Set(["call_session:use", "sip_trunks:call"]);
    const opened = vi.fn();
    const unsubscribe = subscribeTransferPanel(opened);
    await renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    expect(opened).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Transferir para o colega" })).toBeNull();
    unsubscribe();
  });

  it("tells the operator a transfer came back or was refused", async () => {
    whatsAppCall({ transfer: { transferId: "t1", callId: "wa-in-1", status: "returned", reason: "no_answer" } });
    await renderWidget();
    expect(screen.getByText("O colega não atendeu. A ligação voltou para você.")).toBeTruthy();
  });
});
