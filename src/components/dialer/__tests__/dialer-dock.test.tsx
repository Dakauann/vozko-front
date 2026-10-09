import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";
import type { DialTargets, DialTrunk } from "@/lib/dialer/dial-targets";
import type { QueueTarget } from "@/lib/call-routing/types";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: null as unknown as CallSessionApi }));
const trunkList = vi.hoisted(() => ({ value: [] as DialTrunk[], leads: {} as Record<string, DialTargets>, asked: [] as Array<string | null> }));
const queueList = vi.hoisted(() => ({ value: [] as QueueTarget[] }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    permissionsLoading: false,
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));
vi.mock("@/app/actions/sip-trunks", () => ({
  fetchDialTargets: (leadId: string | null) => {
    trunkList.asked.push(leadId);
    const lead = leadId ? trunkList.leads[leadId] : undefined;
    return Promise.resolve(
      lead ?? {
        leadId: leadId ?? "",
        numbers: [],
        trunks: trunkList.value,
        ...(trunkList.value.length === 0 ? { trunkRefusal: "no_dialable_trunk" } : {}),
      },
    );
  },
}));
vi.mock("@/app/actions/call-routing", () => ({ listTransferQueuesAction: () => Promise.resolve({ queues: queueList.value }) }));
vi.mock("@/i18n/routing", () => ({ Link: ({ children }: { children: React.ReactNode }) => <a>{children}</a> }));

import { DialerDock } from "@/components/dialer/dialer-dock";
import {
  callSurfaceOwner,
  presetDial,
  releaseCallSurface,
  setCallSurface,
  subscribeCallRequest,
  type CallRequest,
} from "@/lib/call-session/call-session-control";

function trunk(overrides: Partial<DialTrunk>): DialTrunk {
  return { id: "t1", name: "Principal", ...overrides };
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

function renderDialer(client = new QueryClient({ defaultOptions: { queries: { retry: false } } })) {
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt}>
        <DialerDock />
      </NextIntlClientProvider>
    </QueryClientProvider>,
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
    trunkList.leads = {};
    trunkList.asked = [];
    queueList.value = [];
    requests = [];
    unsubscribe = subscribeCallRequest((request) => requests.push(request));
  });

  afterEach(() => {
    unsubscribe();
    releaseCallSurface("call_list");
  });

  it("stays hidden for members who may not call through trunks", () => {
    grants.value = new Set(["call_session:use"]);
    renderDialer();
    expect(screen.queryByRole("button", { name: "Abrir discador" })).toBeNull();
  });

  it("offers the lines the server says can dial", async () => {
    trunkList.value = [trunk({ id: "ok", name: "Registrado" })];
    renderDialer();
    expect(trunkList.asked).toEqual([]);
    await openDialer();
    await waitFor(() => expect(screen.getByText("Registrado")).toBeTruthy());
    expect(trunkList.asked).toEqual([null]);
  });

  it("says so when no line can dial", async () => {
    trunkList.value = [];
    renderDialer();
    await openDialer();
    expect(await screen.findByText(pt.calling.dialer.noTrunks)).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Número"), { target: { value: "100" } });
    expect(screen.getByRole("button", { name: "Ligar" })).toHaveProperty("disabled", true);
  });

  it("asks for the lines of the handed over lead", async () => {
    trunkList.leads = {
      "lead-1": { leadId: "lead-1", numbers: [{ number: "5584999990000", identity: true }], trunks: [{ id: "t9", name: "Do lead" }] },
    };
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "5584999990000", leadId: "lead-1" });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText("Do lead")).toBeTruthy());
    expect(trunkList.asked).toContain("lead-1");
    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    expect(requests).toEqual([{ phoneNumber: "5584999990000", trunkId: "t9", label: "Do lead", leadId: "lead-1" }]);
  });

  it("reads the answer the Ligar button already holds for the same lead revision", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false, staleTime: 60_000 } } });
    client.setQueryData(["dial-targets", "ws-1", "lead-1", 3], {
      leadId: "lead-1",
      callable: "5584999990000",
      numbers: [{ number: "5584999990000", identity: true }],
      trunks: [{ id: "t9", name: "Do lead" }, { id: "t8", name: "Outra" }],
    });
    renderDialer(client);
    await act(async () => {
      presetDial({ phoneNumber: "5584999990000", leadId: "lead-1", leadRevision: 3, trunkId: "t9" });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByText("Do lead")).toBeTruthy());
    expect(trunkList.asked).not.toContain("lead-1");
  });

  it("calls a contact phone of the lead that is not the first callable number", async () => {
    trunkList.leads = {
      "lead-1": {
        leadId: "lead-1",
        callable: "5584999990000",
        numbers: [
          { number: "5584999990000", identity: true },
          { number: "551133334444", identity: false, phoneId: "phone-1" },
        ],
        trunks: [{ id: "t9", name: "Do lead" }],
      },
    };
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "551133334444", leadId: "lead-1" });
      await Promise.resolve();
    });
    await waitFor(() => expect(screen.getByRole("button", { name: "Ligar" })).toHaveProperty("disabled", false));
    fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
    expect(requests).toEqual([{ phoneNumber: "551133334444", trunkId: "t9", label: "Do lead", leadId: "lead-1" }]);
  });

  it("refuses a handed over number the lead may not be called on, with the reason", async () => {
    trunkList.leads = {
      "lead-1": {
        leadId: "lead-1",
        numbers: [
          { number: "5584999990000", identity: true, refusal: "opted_out" },
          { number: "551133334444", identity: false },
        ],
        trunks: [{ id: "t1", name: "Principal" }],
      },
    };
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "5584999990000", leadId: "lead-1" });
      await Promise.resolve();
    });
    expect(await screen.findByText(pt.calling.dialTargets.reasons.opted_out)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ligar" })).toHaveProperty("disabled", true);
  });

  it("explains why a handed over lead cannot be called at all", async () => {
    trunkList.leads = {
      "lead-1": { leadId: "lead-1", refusal: "blocked", numbers: [{ number: "5584999990000", identity: true, refusal: "blocked" }], trunks: [] },
    };
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "5584999990000", leadId: "lead-1" });
      await Promise.resolve();
    });
    expect(await screen.findByText(pt.calling.dialTargets.reasons.blocked)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Ligar" })).toHaveProperty("disabled", true);
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

  it("keeps the handed over lead while the number is still the one handed over", async () => {
    trunkList.leads = {
      "lead-1": { leadId: "lead-1", numbers: [{ number: "5584999990000", identity: true }], trunks: [trunk({})] },
    };
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "5584999990000", leadId: "lead-1" });
      await Promise.resolve();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Ligar" }));
    expect(requests).toEqual([{ phoneNumber: "5584999990000", trunkId: "t1", label: "Principal", leadId: "lead-1" }]);
  });

  it("drops the handed over lead once the member changes the number", async () => {
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "100", leadId: "lead-1" });
      await Promise.resolve();
    });
    fireEvent.click(screen.getByRole("button", { name: "1" }));
    fireEvent.click(screen.getByRole("button", { name: "Apagar" }));
    expect((screen.getByLabelText("Número") as HTMLInputElement).value).toBe("100");
    fireEvent.click(await screen.findByRole("button", { name: "Ligar" }));
    expect(requests).toEqual([{ phoneNumber: "100", trunkId: "t1", label: "Principal" }]);
  });

  it("replaces an earlier lead when another number is handed over", async () => {
    renderDialer();
    await act(async () => {
      presetDial({ phoneNumber: "100", leadId: "lead-1" });
      await Promise.resolve();
    });
    await act(async () => {
      presetDial({ phoneNumber: "100" });
      await Promise.resolve();
    });
    fireEvent.click(await screen.findByRole("button", { name: "Ligar" }));
    expect(requests).toEqual([{ phoneNumber: "100", trunkId: "t1", label: "Principal" }]);
  });

  it("owns the call surface only while open", async () => {
    renderDialer();
    expect(callSurfaceOwner()).toBeNull();
    await openDialer();
    expect(callSurfaceOwner()).toBe("dialer");
    fireEvent.click(screen.getByRole("button", { name: "Minimizar" }));
    expect(callSurfaceOwner()).toBeNull();
  });

  it("leaves the live call to the call list while the call list owns the call surface", async () => {
    session.value = callSession({ callState: { phoneNumber: "100", status: "answered", answeredAt: Date.now() } });
    renderDialer();
    await openDialer();
    expect(screen.getByText(pt.calling.dialer.inCall)).toBeTruthy();

    act(() => setCallSurface("call_list"));
    expect(screen.queryByText(pt.calling.dialer.inCall)).toBeNull();
    expect(screen.queryByRole("button", { name: /Desligar/ })).toBeNull();
    expect(screen.getByRole("status").textContent).toBe(pt.calling.dialer.callHeldBy.call_list);

    act(() => releaseCallSurface("call_list"));
    expect(screen.getByText(pt.calling.dialer.inCall)).toBeTruthy();
  });

  it("explains a refused lead call in the member's language", async () => {
    session.value = callSession({ lastErrorCode: "lead_blocked", lastError: "lead blocked" });
    renderDialer();
    await openDialer();
    expect(await screen.findByText(pt.calling.dialer.errors.lead_blocked)).toBeTruthy();
  });

  it("explains a refused call in the member's language", async () => {
    session.value = callSession({ lastErrorCode: "trunk_not_registered", lastError: "trunk not registered" });
    renderDialer();
    await openDialer();
    expect(await screen.findByText("A linha não está conectada à operadora.")).toBeTruthy();
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
