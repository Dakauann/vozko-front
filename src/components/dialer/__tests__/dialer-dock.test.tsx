import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";
import type { SipTrunk } from "@/lib/sip-trunks/types";
import type { QueueTarget } from "@/lib/call-routing/types";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: null as unknown as CallSessionApi }));
const trunkList = vi.hoisted(() => ({ value: [] as SipTrunk[] }));
const queueList = vi.hoisted(() => ({ value: [] as QueueTarget[] }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    permissionsLoading: false,
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));
vi.mock("@/app/actions/sip-trunks", () => ({ listSipTrunksAction: () => Promise.resolve({ trunks: trunkList.value }) }));
vi.mock("@/app/actions/call-routing", () => ({ listTransferQueuesAction: () => Promise.resolve({ queues: queueList.value }) }));
vi.mock("@/i18n/routing", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { DialerDock } from "@/components/dialer/dialer-dock";
import { presetDial, subscribeCallRequest, type CallRequest } from "@/lib/call-session/call-session-control";

function trunk(overrides: Partial<SipTrunk>): SipTrunk {
  return {
    id: "t1",
    name: "Principal",
    trunkType: "BIDIRECTIONAL",
    host: "sip.example.com",
    port: 5060,
    transport: "UDP",
    username: "1001",
    hasPassword: true,
    enabled: true,
    settings: { skipRegistration: false, dialPlan: {}, stunEnabled: false },
    registrationStatus: "REGISTERED",
    createdAt: "",
    updatedAt: "",
    ...overrides,
  };
}

function callSession(overrides: Partial<CallSessionApi> = {}): CallSessionApi {
  return {
    status: "connected",
    callState: null,
    lastError: null,
    lastErrorCode: null,
    muted: false,
    setMuted: vi.fn(),
    startCall: vi.fn(),
    endCall: vi.fn(),
    clearError: vi.fn(),
    presence: [],
    selfUserId: "u1",
    incomingCall: null,
    acceptIncomingCall: vi.fn(),
    declineIncomingCall: vi.fn(),
    transfer: null,
    transferCall: vi.fn(),
    cancelTransfer: vi.fn(),
    ...overrides,
  } as CallSessionApi;
}

function renderDialer() {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <DialerDock />
    </NextIntlClientProvider>,
  );
}

async function openDialer() {
  fireEvent.click(screen.getByRole("button", { name: /^Abrir discador/ }));
  await act(async () => {
    await Promise.resolve();
  });
}

describe("DialerDock", () => {
  let requests: CallRequest[];
  let unsubscribe: () => void;

  beforeEach(() => {
    grants.value = new Set(["sip_trunks:call", "sip_trunks:read", "call_session:use", "call_session:transfer"]);
    session.value = callSession();
    trunkList.value = [trunk({})];
    queueList.value = [];
    requests = [];
    unsubscribe = subscribeCallRequest((request) => requests.push(request));
  });

  afterEach(() => unsubscribe());

  it("stays hidden for members who may not call through trunks", () => {
    grants.value = new Set(["call_session:use"]);
    renderDialer();
    expect(screen.queryByRole("button", { name: "Abrir discador" })).toBeNull();
  });

  it("offers only registered trunks that can dial", async () => {
    trunkList.value = [
      trunk({ id: "ok", name: "Registrado" }),
      trunk({ id: "failed", name: "Falhou", registrationStatus: "FAILED" }),
      trunk({ id: "in", name: "Entrada", trunkType: "INBOUND" }),
      trunk({ id: "off", name: "Desligado", enabled: false }),
    ];
    renderDialer();
    await openDialer();
    await waitFor(() => expect(screen.getByText("Registrado")).toBeTruthy());
    expect(screen.queryByText("Falhou")).toBeNull();
    expect(screen.queryByText("Entrada")).toBeNull();
    expect(screen.queryByText("Desligado")).toBeNull();
  });

  it("dials through the selected trunk once the number is valid", async () => {
    renderDialer();
    await openDialer();
    const call = await screen.findByRole("button", { name: "Ligar" });
    expect(call).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "100@evil" } });
    expect(call).toHaveProperty("disabled", true);

    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "" } });
    for (const key of ["1", "0", "0"]) fireEvent.click(screen.getByRole("button", { name: key }));
    expect(call).toHaveProperty("disabled", false);
    fireEvent.click(call);
    expect(requests).toEqual([{ phoneNumber: "100", trunkId: "t1", label: "Principal" }]);
  });

  it("will not dial while offline or already in a call", async () => {
    session.value = callSession({ status: "connecting" });
    const { unmount } = renderDialer();
    await openDialer();
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "100" } });
    expect(screen.getByRole("button", { name: "Ligar" })).toHaveProperty("disabled", true);
    unmount();
  });

  it("shows the live call with mute and hang up", async () => {
    const endCall = vi.fn();
    const setMuted = vi.fn();
    session.value = callSession({ callState: { phoneNumber: "100", status: "answered", answeredAt: Date.now() }, endCall, setMuted });
    renderDialer();
    await openDialer();
    expect(screen.getByText("Em chamada")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Silenciar/ }));
    expect(setMuted).toHaveBeenCalledWith(true);
    fireEvent.click(screen.getByRole("button", { name: /Desligar/ }));
    expect(endCall).toHaveBeenCalled();
  });

  it("explains why a call ended", async () => {
    session.value = callSession({ callState: { phoneNumber: "100", status: "ended", reason: "busy" } });
    renderDialer();
    await openDialer();
    expect(screen.getByText("Número ocupado")).toBeTruthy();
  });

  it("opens filled in when a number is handed over", async () => {
    trunkList.value = [trunk({ id: "a", name: "A" }), trunk({ id: "b", name: "B" })];
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "5584999990000", trunkId: "b" });
      await Promise.resolve();
    });
    expect((screen.getByLabelText("Número") as HTMLInputElement).value).toBe("5584999990000");
    fireEvent.click(await screen.findByRole("button", { name: "Ligar" }));
    expect(requests).toEqual([{ phoneNumber: "5584999990000", trunkId: "b", label: "B" }]);
  });

  it("explains a refused call in the member's language", async () => {
    session.value = callSession({ lastErrorCode: "trunk_not_registered", lastError: "trunk not registered" });
    renderDialer();
    await openDialer();
    expect(await screen.findByText("O tronco não está registrado no provedor.")).toBeTruthy();
  });

  describe("transferring a live call", () => {
    const answered = { callId: "c1", phoneNumber: "5584994409684", status: "answered" as const, answeredAt: Date.now() };

    it("hands the call to a free colleague with a note", async () => {
      const transferCall = vi.fn();
      session.value = callSession({
        callState: answered,
        transferCall,
        presence: [
          { userId: "u1", username: "Eu", busy: false },
          { userId: "u2", username: "Bia", busy: false },
          { userId: "u3", username: "Caio", busy: true },
        ],
      });
      renderDialer();
      await openDialer();
      fireEvent.click(screen.getByRole("button", { name: /Transferir/ }));

      expect(screen.queryByRole("radio", { name: /Eu/ })).toBeNull();
      expect(screen.queryByRole("radio", { name: /Caio/ })).toBeNull();
      const send = screen.getByRole("button", { name: "Transferir para o colega" });
      expect(send).toHaveProperty("disabled", true);

      fireEvent.click(screen.getByRole("radio", { name: /Bia/ }));
      fireEvent.change(screen.getByLabelText("Nota para quem vai atender"), { target: { value: "quer cancelar" } });
      fireEvent.click(send);
      expect(transferCall).toHaveBeenCalledWith({ kind: "member", userId: "u2" }, "quer cancelar");
    });

    it("shows how busy each queue is and sends the call to one", async () => {
      const transferCall = vi.fn();
      queueList.value = [{ id: "q1", name: "Suporte", waiting: 2, ready: 1 }];
      session.value = callSession({ callState: answered, transferCall });
      renderDialer();
      await openDialer();
      fireEvent.click(screen.getByRole("button", { name: /Transferir/ }));
      fireEvent.click(screen.getByRole("tab", { name: "Fila" }));
      const queue = await screen.findByRole("radio", { name: /Suporte/ });
      expect(queue.textContent).toContain("2 esperando · 1 livre");
      fireEvent.click(queue);
      fireEvent.click(screen.getByRole("button", { name: "Transferir para a fila" }));
      expect(transferCall).toHaveBeenCalledWith({ kind: "queue", queueId: "q1" }, "");
    });

    it("lets the operator cancel while the colleague is being rung", async () => {
      const cancelTransfer = vi.fn();
      session.value = callSession({
        callState: answered,
        cancelTransfer,
        transfer: { transferId: "t1", callId: "c1", status: "ringing", targetName: "Bia" },
      });
      renderDialer();
      await openDialer();
      expect(screen.getByText("Chamando Bia…")).toBeTruthy();
      fireEvent.click(screen.getByRole("button", { name: "Cancelar transferência" }));
      expect(cancelTransfer).toHaveBeenCalled();
    });

    it("tells the operator the call came back and why", async () => {
      session.value = callSession({
        callState: answered,
        transfer: { transferId: "t1", callId: "c1", status: "returned", reason: "declined" },
      });
      renderDialer();
      await openDialer();
      expect(screen.getByText("O colega recusou. A ligação voltou para você.")).toBeTruthy();
    });

    it("explains a refused transfer in the member's language", async () => {
      session.value = callSession({ callState: answered, lastErrorCode: "target_unavailable", lastError: "busy" });
      renderDialer();
      await openDialer();
      expect(screen.getByText("Esse colega não está livre para atender agora.")).toBeTruthy();
    });

    it("shows who sent a transferred call and their note", async () => {
      session.value = callSession({
        callState: { ...answered, transferredBy: { fromName: "Ana", notes: "segunda via do boleto" } },
      });
      renderDialer();
      await openDialer();
      expect(screen.getByText("Transferida por Ana")).toBeTruthy();
      expect(screen.getByText("segunda via do boleto")).toBeTruthy();
    });

    it("offers no transfer to someone not allowed to transfer calls", async () => {
      grants.value = new Set(["sip_trunks:call", "sip_trunks:read", "call_session:use"]);
      session.value = callSession({ callState: answered });
      renderDialer();
      await openDialer();
      expect(screen.queryByRole("button", { name: /Transferir/ })).toBeNull();
    });

    it("reports a handed-over call as transferred", async () => {
      session.value = callSession({ callState: { ...answered, status: "ended", reason: "transferred" } });
      renderDialer();
      await openDialer();
      expect(screen.getByText("Chamada transferida")).toBeTruthy();
    });
  });

  describe("side tab", () => {
    it("rests as the dialer when nothing is happening", () => {
      renderDialer();
      expect(screen.getByRole("button", { name: "Abrir discador" }).getAttribute("data-status")).toBe("idle");
    });

    it("shows the call clock while talking", () => {
      session.value = callSession({ callState: { phoneNumber: "100", status: "answered", answeredAt: Date.now() - 65_000 } });
      renderDialer();
      const tab = screen.getByRole("button", { name: /^Abrir discador · 01:0\d$/ });
      expect(tab.getAttribute("data-status")).toBe("live");
    });

    it("calls attention to a call ringing in", () => {
      session.value = callSession({
        incomingCall: { offerId: "o1", callId: "c1", workspaceId: "ws-1", fromNumber: "100", receivedAt: Date.now() },
      });
      renderDialer();
      expect(screen.getByRole("button", { name: "Abrir discador · Chamada" }).getAttribute("data-status")).toBe("alert");
    });
  });
});
