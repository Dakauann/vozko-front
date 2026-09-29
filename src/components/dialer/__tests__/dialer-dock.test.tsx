import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";
import type { SipTrunk } from "@/lib/sip-trunks/types";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: null as unknown as CallSessionApi }));
const trunkList = vi.hoisted(() => ({ value: [] as SipTrunk[] }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    permissionsLoading: false,
    currentWorkspace: { id: "ws-1" },
  }),
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));
vi.mock("@/app/actions/sip-trunks", () => ({ listSipTrunksAction: () => Promise.resolve({ trunks: trunkList.value }) }));
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
  fireEvent.click(screen.getByRole("button", { name: "Abrir discador" }));
  await act(async () => {
    await Promise.resolve();
  });
}

describe("DialerDock", () => {
  let requests: CallRequest[];
  let unsubscribe: () => void;

  beforeEach(() => {
    grants.value = new Set(["sip_trunks:call", "sip_trunks:read", "call_session:use"]);
    session.value = callSession();
    trunkList.value = [trunk({})];
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
});
