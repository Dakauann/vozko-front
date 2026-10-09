import type { ReactNode } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { CallSessionApi } from "@/hooks/use-call-session-ws";
import { DialTargetsError, type DialTargets } from "@/lib/dialer/dial-targets";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: {} as Partial<CallSessionApi> }));
const server = vi.hoisted(() => ({
  answer: null as unknown,
  asked: [] as Array<string | null>,
  gate: null as Promise<void> | null,
}));
const workspace = vi.hoisted(() => ({ id: "ws-1" }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({
    can: (resource: string, action: string) => grants.value.has(`${resource}:${action}`),
    permissionsLoading: false,
    currentWorkspace: { id: workspace.id },
  }),
}));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));
vi.mock("@/app/actions/sip-trunks", () => ({
  fetchDialTargets: async (leadId: string | null) => {
    server.asked.push(leadId);
    if (server.gate) await server.gate;
    const answer = server.answer;
    if (answer instanceof Error) throw answer;
    return answer;
  },
}));

import { useDialTargets, type UseDialTargetsOptions } from "@/hooks/use-dial-targets";
import {
  subscribeCallRequest,
  subscribeDialPreset,
  type CallRequest,
  type DialPreset,
} from "@/lib/call-session/call-session-control";
import { rememberTrunk } from "@/lib/dialer/dial-lines";

function leadTargets(overrides: Partial<DialTargets> = {}): DialTargets {
  return {
    leadId: "lead-1",
    numbers: [
      { number: "5584994409684", identity: true },
      { number: "551133334444", identity: false, label: "landline", phoneId: "phone-1" },
    ],
    callable: "5584994409684",
    trunks: [{ id: "t1", name: "Matriz" }],
    ...overrides,
  };
}

function render(options: UseDialTargetsOptions) {
  const client = new QueryClient({ defaultOptions: { queries: { retryDelay: 0 } } });
  const wrapper = ({ children }: { children: ReactNode }) => <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  return renderHook((props: UseDialTargetsOptions) => useDialTargets(props), { wrapper, initialProps: options });
}

describe("useDialTargets", () => {
  let requests: CallRequest[];
  let presets: DialPreset[];
  let unsubscribe: Array<() => void>;

  beforeEach(() => {
    grants.value = new Set(["sip_trunks:call", "sip_trunks:read", "call_session:use"]);
    session.value = { status: "connected", callState: null };
    server.answer = leadTargets();
    server.asked = [];
    server.gate = null;
    workspace.id = "ws-1";
    requests = [];
    presets = [];
    unsubscribe = [subscribeCallRequest((request) => requests.push(request)), subscribeDialPreset((preset) => presets.push(preset))];
    window.localStorage.clear();
  });

  afterEach(() => {
    unsubscribe.forEach((stop) => stop());
    window.localStorage.clear();
  });

  it("asks nothing of someone who may not place calls", async () => {
    grants.value = new Set(["sip_trunks:read"]);
    const hook = render({ leadId: "lead-1" });
    expect(hook.result.current.blocker).toBe("noPermission");
    expect(hook.result.current.status).toBe("idle");
    await act(async () => Promise.resolve());
    expect(server.asked).toEqual([]);
  });

  it("asks nothing until it is enabled", async () => {
    const hook = render({ leadId: "lead-1", enabled: false });
    await act(async () => Promise.resolve());
    expect(server.asked).toEqual([]);
    expect(hook.result.current.blocker).toBe("checking");

    hook.rerender({ leadId: "lead-1", enabled: true });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    expect(server.asked).toEqual(["lead-1"]);
  });

  it("calls the number the server planned the lines for, through its only line", async () => {
    server.answer = leadTargets({
      numbers: [{ number: "5584994409684", identity: true, refusal: "opted_out" }, { number: "551133334444", identity: false }],
      callable: "551133334444",
    });
    const hook = render({ leadId: "lead-1" });
    expect(hook.result.current.blocker).toBe("checking");
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    expect(hook.result.current.blocker).toBeNull();
    expect(hook.result.current.number?.number).toBe("551133334444");
    let placed = false;
    act(() => {
      placed = hook.result.current.call();
    });
    expect(placed).toBe(true);
    expect(requests).toEqual([{ phoneNumber: "551133334444", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
    expect(presets).toEqual([]);
  });

  it("hands the number to the dialer with the remembered line when there are several lines", async () => {
    window.localStorage.setItem("dialer:trunk:ws-1", "t2");
    server.answer = leadTargets({ trunks: [{ id: "t1", name: "Matriz" }, { id: "t2", name: "Filial" }] });
    const hook = render({ leadId: "lead-1" });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    expect(hook.result.current.selectedTrunk?.id).toBe("t2");
    act(() => {
      hook.result.current.call();
    });
    expect(presets).toEqual([{ phoneNumber: "5584994409684", trunkId: "t2", leadId: "lead-1" }]);
    expect(requests).toEqual([]);
  });

  it("hands the lead revision to the dialer so it reads the same answer", async () => {
    server.answer = leadTargets({ trunks: [{ id: "t1", name: "Matriz" }, { id: "t2", name: "Filial" }] });
    const hook = render({ leadId: "lead-1", revision: 7 });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    act(() => {
      hook.result.current.call();
    });
    expect(presets).toEqual([{ phoneNumber: "5584994409684", trunkId: "t1", leadId: "lead-1", leadRevision: 7 }]);
  });

  it("calls one chosen number of the lead", async () => {
    server.answer = leadTargets({
      numbers: [
        { number: "5584994409684", identity: true },
        { number: "551133334444", identity: false, phoneId: "phone-1" },
        { number: "551122223333", identity: false, phoneId: "phone-2", refusal: "blocked" },
      ],
    });
    const hook = render({ leadId: "lead-1" });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    expect(hook.result.current.numberBlocker("551133334444")).toBeNull();
    expect(hook.result.current.numberBlocker("551122223333")).toBe("blocked");
    expect(hook.result.current.numberBlocker("559999999999")).toBe("number_not_held");

    let placed = false;
    act(() => {
      placed = hook.result.current.callNumber("551122223333");
    });
    expect(placed).toBe(false);
    act(() => {
      placed = hook.result.current.callNumber("551133334444");
    });
    expect(placed).toBe(true);
    expect(requests).toEqual([{ phoneNumber: "551133334444", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
  });

  it("keeps the lines on screen while the next answer loads, without letting anyone call", async () => {
    server.answer = leadTargets({ trunks: [{ id: "t1", name: "Matriz" }, { id: "t2", name: "Filial" }] });
    const hook = render({ leadId: "lead-1", revision: 3 });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    let release: () => void = () => undefined;
    server.gate = new Promise((resolve) => {
      release = resolve;
    });
    hook.rerender({ leadId: null });
    expect(hook.result.current.status).toBe("loading");
    expect(hook.result.current.blocker).toBe("checking");
    expect(hook.result.current.targets).toBeNull();
    expect(hook.result.current.number).toBeNull();
    expect(hook.result.current.trunks.map((trunk) => trunk.id)).toEqual(["t1", "t2"]);

    server.answer = { leadId: "", numbers: [], trunks: [{ id: "t3", name: "Nova" }] };
    await act(async () => release());
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    expect(hook.result.current.trunks.map((trunk) => trunk.id)).toEqual(["t3"]);
  });

  it("never shows the lines of another workspace while the next one loads", async () => {
    const hook = render({ leadId: "lead-1" });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    server.gate = new Promise(() => undefined);
    workspace.id = "ws-2";
    hook.rerender({ leadId: "lead-1" });
    expect(hook.result.current.status).toBe("loading");
    expect(hook.result.current.trunks).toEqual([]);
  });

  it("refuses to call a lead the server refuses, with its reason", async () => {
    server.answer = leadTargets({ refusal: "blocked", trunks: [], numbers: [{ number: "5584994409684", identity: true, refusal: "blocked" }] });
    const hook = render({ leadId: "lead-1" });
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    expect(hook.result.current.blocker).toBe("blocked");
    let placed = true;
    act(() => {
      placed = hook.result.current.call();
    });
    expect(placed).toBe(false);
    expect(requests).toEqual([]);
    expect(presets).toEqual([]);
  });

  it("explains a refused answer without retrying it", async () => {
    server.answer = new DialTargetsError("forbidden", "forbidden", 403);
    const hook = render({ leadId: "lead-1" });
    await waitFor(() => expect(hook.result.current.status).toBe("error"));
    expect(hook.result.current.blocker).toBe("forbidden");
    expect(server.asked).toEqual(["lead-1"]);
  });

  it("waits for the call service only when it calls directly", async () => {
    session.value = { status: "connected", callState: { phoneNumber: "200", status: "answered" } };
    const direct = render({ leadId: "lead-1" });
    await waitFor(() => expect(direct.result.current.status).toBe("ready"));
    expect(direct.result.current.blocker).toBe("busy");

    server.answer = leadTargets({ trunks: [{ id: "t1", name: "Matriz" }, { id: "t2", name: "Filial" }] });
    const handedOver = render({ leadId: "lead-1" });
    await waitFor(() => expect(handedOver.result.current.status).toBe("ready"));
    expect(handedOver.result.current.blocker).toBeNull();
  });

  it("offers only the lines when no lead is named", async () => {
    server.answer = { leadId: "", numbers: [], trunks: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
    const hook = render({});
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));

    expect(server.asked).toEqual([null]);
    expect(hook.result.current.blocker).toBeNull();
    expect(hook.result.current.trunks.map((trunk) => trunk.id)).toEqual(["a", "b"]);
    expect(hook.result.current.selectedTrunk?.id).toBe("a");

    act(() => hook.result.current.chooseTrunk("b"));
    expect(hook.result.current.selectedTrunk?.id).toBe("b");
    expect(window.localStorage.getItem("dialer:trunk:ws-1")).toBe("b");

    act(() => hook.result.current.presetTrunk("a"));
    expect(hook.result.current.selectedTrunk?.id).toBe("a");
    expect(window.localStorage.getItem("dialer:trunk:ws-1")).toBe("b");
  });

  it("hands every Ligar button the line the member chose anywhere", async () => {
    server.answer = leadTargets({ trunks: [{ id: "t1", name: "Matriz" }, { id: "t2", name: "Filial" }, { id: "t3", name: "Loja" }] });
    const dock = render({});
    const button = render({ leadId: "lead-1" });
    await waitFor(() => expect(button.result.current.status).toBe("ready"));
    await waitFor(() => expect(dock.result.current.status).toBe("ready"));
    expect(button.result.current.selectedTrunk?.id).toBe("t1");

    act(() => dock.result.current.chooseTrunk("t2"));
    expect(button.result.current.selectedTrunk?.id).toBe("t2");
    act(() => {
      button.result.current.call();
    });
    expect(presets).toEqual([{ phoneNumber: "5584994409684", trunkId: "t2", leadId: "lead-1" }]);

    act(() => rememberTrunk("ws-1", "t3"));
    expect(dock.result.current.selectedTrunk?.id).toBe("t3");
    expect(button.result.current.selectedTrunk?.id).toBe("t3");
  });

  it("drops a handed over line once the member chooses one", async () => {
    server.answer = { leadId: "", numbers: [], trunks: [{ id: "a", name: "A" }, { id: "b", name: "B" }] };
    const hook = render({});
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    act(() => hook.result.current.presetTrunk("b"));
    act(() => hook.result.current.chooseTrunk("a"));
    expect(hook.result.current.selectedTrunk?.id).toBe("a");
    act(() => rememberTrunk("ws-1", "b"));
    expect(hook.result.current.selectedTrunk?.id).toBe("b");
  });

  it("says so when no line can call", async () => {
    server.answer = { leadId: "", numbers: [], trunks: [], trunkRefusal: "no_dialable_trunk" };
    const hook = render({});
    await waitFor(() => expect(hook.result.current.status).toBe("ready"));
    expect(hook.result.current.blocker).toBe("no_dialable_trunk");
    expect(hook.result.current.selectedTrunk).toBeNull();
  });
});
