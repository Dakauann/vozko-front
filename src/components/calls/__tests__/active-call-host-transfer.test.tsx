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
import { setDialerOpen } from "@/lib/call-session/call-session-control";

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
    grants.value = new Set(["call_session:use", "call_session:transfer"]);
    whatsAppCall();
  });

  it("lets an operator without the dialer transfer from the call widget", async () => {
    await renderWidget();
    fireEvent.click(screen.getByRole("button", { name: "Transferir" }));
    fireEvent.click(screen.getByRole("radio", { name: /Bia/ }));
    fireEvent.click(screen.getByRole("button", { name: "Transferir para o colega" }));
    expect(session.value.transferCall).toHaveBeenCalledWith({ kind: "member", userId: "u2" }, "");
  });

  it("shows the same call view as the dialer, whatever the operator's permissions", async () => {
    grants.value = new Set(["call_session:use", "call_session:transfer", "sip_trunks:call"]);
    whatsAppCall({
      callState: {
        callId: "wa-in-1",
        phoneNumber: "5584994409684",
        status: "answered",
        answeredAt: Date.now(),
        transferredBy: { fromName: "Ana", notes: "quer cancelar" },
      },
    });
    await renderWidget();
    expect(screen.getByRole("heading", { name: "Ligação" })).toBeTruthy();
    expect(screen.getByText("Transferida por Ana")).toBeTruthy();
    expect(screen.getByText("quer cancelar")).toBeTruthy();
    for (const name of [/Silenciar/, /^Transferir$/, /Desligar/]) {
      expect(screen.getByRole("button", { name })).toBeTruthy();
    }
  });

  it("stays out of the way while the dialer is open", async () => {
    setDialerOpen(true);
    await renderWidget();
    expect(screen.queryByRole("heading", { name: "Ligação" })).toBeNull();
    setDialerOpen(false);
  });

  it("offers no transfer to someone not allowed to transfer calls", async () => {
    grants.value = new Set(["call_session:use"]);
    await renderWidget();
    expect(screen.queryByRole("button", { name: "Transferir" })).toBeNull();
  });

  it("tells the operator a transfer came back or was refused", async () => {
    whatsAppCall({ transfer: { transferId: "t1", callId: "wa-in-1", status: "returned", reason: "no_answer" } });
    await renderWidget();
    expect(screen.getByText("O colega não atendeu. A ligação voltou para você.")).toBeTruthy();
  });

  it("shows which line the call is on and how long it has run", async () => {
    whatsAppCall({
      callState: { callId: "wa-in-1", phoneNumber: "5584994409684", channel: "whatsapp", status: "answered", answeredAt: Date.now() - 65_000 },
    });
    await renderWidget();
    expect(screen.getByText("WhatsApp")).toBeTruthy();
    expect(screen.getByText("Em chamada")).toBeTruthy();
    expect(screen.getByText("01:05")).toBeTruthy();
  });

  it("marks the microphone as muted", async () => {
    whatsAppCall({ muted: true });
    await renderWidget();
    expect(screen.getByRole("button", { name: "Ativar som" }).getAttribute("aria-pressed")).toBe("true");
  });
});
