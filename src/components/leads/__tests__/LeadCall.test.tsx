import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";
import { DIAL_BLOCKERS, type DialTargets } from "@/lib/dialer/dial-targets";

const grants = vi.hoisted(() => ({ value: new Set<string>() }));
const session = vi.hoisted(() => ({ value: {} as Partial<CallSessionApi> }));
const server = vi.hoisted(() => ({ answer: null as unknown, asked: [] as Array<string | null> }));

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
    server.asked.push(leadId);
    return Promise.resolve(server.answer);
  },
}));

import { LeadCallButton, LeadNumberCall } from "@/components/leads/LeadCall";
import { LeadRowActions } from "@/components/leads/LeadRowActions";
import { subscribeCallRequest, type CallRequest } from "@/lib/call-session/call-session-control";

function targets(overrides: Partial<DialTargets> = {}): DialTargets {
  return {
    leadId: "lead-1",
    numbers: [{ number: "5511900010142", identity: true }],
    callable: "5511900010142",
    trunks: [{ id: "t1", name: "Matriz" }],
    ...overrides,
  };
}

function renderWith(node: React.ReactNode) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={pt}>
        {node}
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

async function openRowMenu(name = "Ações de Maria") {
  const trigger = screen.getByRole("button", { name });
  await act(async () => {
    fireEvent.pointerDown(trigger, { button: 0, pointerType: "mouse" });
  });
}

describe("Ligar on a lead", () => {
  let requests: CallRequest[];
  let unsubscribe: () => void;

  beforeEach(() => {
    grants.value = new Set(["sip_trunks:call", "sip_trunks:read", "call_session:use"]);
    session.value = { status: "connected", callState: null };
    server.answer = targets();
    server.asked = [];
    requests = [];
    unsubscribe = subscribeCallRequest((request) => requests.push(request));
  });

  afterEach(() => unsubscribe());

  describe("the button", () => {
    it("calls the lead through its line with the lead attached", async () => {
      renderWith(<LeadCallButton leadId="lead-1" />);
      expect(screen.getByRole("button", { name: "Ligar" }).getAttribute("aria-disabled")).toBe("true");
      await waitFor(() => expect(screen.getByRole("button", { name: "Ligar" }).getAttribute("aria-disabled")).toBeNull());

      fireEvent.click(screen.getByRole("button", { name: "Ligar" }));
      expect(requests).toEqual([{ phoneNumber: "5511900010142", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
      expect(server.asked).toEqual(["lead-1"]);
    });

    it("is disabled with the server's reason", async () => {
      server.answer = targets({ refusal: "blocked", trunks: [], numbers: [{ number: "5511900010142", identity: true, refusal: "blocked" }] });
      renderWith(<LeadCallButton leadId="lead-1" />);
      const reason = await screen.findByText(pt.calling.dialTargets.reasons.blocked);
      const call = screen.getByRole("button", { name: "Ligar" });
      expect(call.getAttribute("aria-disabled")).toBe("true");
      expect(call).toHaveProperty("disabled", false);
      expect(call.getAttribute("aria-describedby")).toBe(reason.id);
      fireEvent.click(call);
      expect(requests).toEqual([]);
    });

    it("shows the reason in a tooltip when reached by keyboard", async () => {
      server.answer = targets({ trunks: [], trunkRefusal: "no_dialable_trunk" });
      renderWith(<LeadCallButton leadId="lead-1" />);
      await screen.findByText(pt.calling.dialTargets.reasons.no_dialable_trunk);
      const call = screen.getByRole("button", { name: "Ligar" });
      act(() => call.focus());
      expect(document.activeElement).toBe(call);
      expect((await screen.findByRole("tooltip")).textContent).toBe(pt.calling.dialTargets.reasons.no_dialable_trunk);
    });

    it("keeps keyboard focus while its reason comes and goes", async () => {
      renderWith(<LeadCallButton leadId="lead-1" />);
      const call = screen.getByRole("button", { name: "Ligar" });
      expect(call.getAttribute("aria-disabled")).toBe("true");
      act(() => call.focus());
      expect(document.activeElement).toBe(call);

      await waitFor(() => expect(call.getAttribute("aria-disabled")).toBeNull());
      expect(call.isConnected).toBe(true);
      expect(screen.getByRole("button", { name: "Ligar" })).toBe(call);
      expect(document.activeElement).toBe(call);
      expect(call.getAttribute("aria-describedby")).toBeNull();
    });

    it("says no line is connected", async () => {
      server.answer = targets({ trunks: [], trunkRefusal: "no_dialable_trunk" });
      renderWith(<LeadCallButton leadId="lead-1" />);
      expect(await screen.findByText(pt.calling.dialTargets.reasons.no_dialable_trunk)).toBeTruthy();
    });

    it("is not offered to someone who may not place calls", async () => {
      grants.value = new Set(["sip_trunks:read"]);
      renderWith(<LeadCallButton leadId="lead-1" />);
      expect(screen.queryByRole("button", { name: "Ligar" })).toBeNull();
      await act(async () => Promise.resolve());
      expect(server.asked).toEqual([]);
    });
  });

  describe("the row menu", () => {
    it("asks for the lead's numbers only once the menu opens", async () => {
      renderWith(<LeadRowActions leadId="lead-1" label="Maria" />);
      await act(async () => Promise.resolve());
      expect(server.asked).toEqual([]);

      await openRowMenu();
      const item = await screen.findByRole("menuitem", { name: /Ligar/ });
      await waitFor(() => expect(item.getAttribute("data-disabled")).toBeNull());
      expect(server.asked).toEqual(["lead-1"]);

      fireEvent.click(item);
      expect(requests).toEqual([{ phoneNumber: "5511900010142", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
    });

    it("shows why the lead cannot be called, outside the faded item", async () => {
      server.answer = targets({ refusal: "opted_out", trunks: [], numbers: [{ number: "5511900010142", identity: true, refusal: "opted_out" }] });
      renderWith(<LeadRowActions leadId="lead-1" label="Maria" />);
      await openRowMenu();
      const reason = await screen.findByText(pt.calling.dialTargets.reasons.opted_out);
      const item = screen.getByRole("menuitem", { name: "Ligar" });
      expect(item.getAttribute("data-disabled")).not.toBeNull();
      expect(item.contains(reason)).toBe(false);
      expect(item.getAttribute("aria-describedby")).toBe(reason.id);
    });

    it("names a lead without a name plainly", async () => {
      renderWith(<LeadRowActions leadId="lead-1" label="" onEdit={() => undefined} />);
      await openRowMenu(pt.leadsPage.table.rowActionsUnnamed);
      expect(await screen.findByRole("menuitem", { name: pt.leadsPage.table.edit })).toBeTruthy();
    });

    it("offers editing next to calling", async () => {
      const onEdit = vi.fn();
      renderWith(<LeadRowActions leadId="lead-1" label="Maria" onEdit={onEdit} />);
      await openRowMenu();
      fireEvent.click(await screen.findByRole("menuitem", { name: pt.leadsPage.table.edit }));
      expect(onEdit).toHaveBeenCalled();
    });

    it("offers only editing to someone who may not place calls", async () => {
      grants.value = new Set(["leads:update"]);
      renderWith(<LeadRowActions leadId="lead-1" label="Maria" onEdit={() => undefined} />);
      await openRowMenu();
      expect(await screen.findByRole("menuitem", { name: pt.leadsPage.table.edit })).toBeTruthy();
      expect(screen.queryByRole("menuitem", { name: /Ligar/ })).toBeNull();
      expect(server.asked).toEqual([]);
    });

    it("is absent when there is nothing to do", () => {
      grants.value = new Set();
      renderWith(<LeadRowActions leadId="lead-1" label="Maria" />);
      expect(screen.queryByRole("button", { name: "Ações de Maria" })).toBeNull();
    });
  });

  describe("one number of the lead", () => {
    const numbers = [
      { number: "5511900010142", identity: true },
      { number: "551133334444", identity: false, phoneId: "phone-1" },
      { number: "551122223333", identity: false, phoneId: "phone-2", refusal: "blocked" as const },
    ];

    it("calls the contact phone it stands next to", async () => {
      server.answer = targets({ numbers });
      renderWith(<LeadNumberCall leadId="lead-1" phoneId="phone-1" />);
      const call = await screen.findByRole("button", { name: /^Ligar para .*3333/ });
      await waitFor(() => expect(call.getAttribute("aria-disabled")).toBeNull());
      fireEvent.click(call);
      expect(requests).toEqual([{ phoneNumber: "551133334444", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
    });

    it("calls the WhatsApp of the lead", async () => {
      server.answer = targets({ numbers });
      renderWith(<LeadNumberCall leadId="lead-1" identity />);
      const call = await screen.findByRole("button", { name: /^Ligar para .*0142/ });
      await waitFor(() => expect(call.getAttribute("aria-disabled")).toBeNull());
      fireEvent.click(call);
      expect(requests).toEqual([{ phoneNumber: "5511900010142", trunkId: "t1", label: "Matriz", leadId: "lead-1" }]);
    });

    it("is disabled with the reason the server gives for that number", async () => {
      server.answer = targets({ numbers });
      renderWith(<LeadNumberCall leadId="lead-1" phoneId="phone-2" />);
      const reason = await screen.findByText(pt.calling.dialTargets.reasons.blocked);
      const call = screen.getByRole("button", { name: /^Ligar para / });
      expect(call.getAttribute("aria-disabled")).toBe("true");
      expect(call.getAttribute("aria-describedby")).toBe(reason.id);
      fireEvent.click(call);
      expect(requests).toEqual([]);
    });

    it("stays out of the way for a phone the server does not list", async () => {
      server.answer = targets({ numbers });
      renderWith(<LeadNumberCall leadId="lead-1" phoneId="phone-same-as-whatsapp" />);
      await waitFor(() => expect(server.asked).toEqual(["lead-1"]));
      await act(async () => Promise.resolve());
      expect(screen.queryByRole("button")).toBeNull();
    });

    it("is not offered to someone who may not place calls", async () => {
      grants.value = new Set(["sip_trunks:read"]);
      renderWith(<LeadNumberCall leadId="lead-1" identity />);
      await act(async () => Promise.resolve());
      expect(screen.queryByRole("button")).toBeNull();
      expect(server.asked).toEqual([]);
    });
  });

  it("explains every blocker in every language, from one place", () => {
    for (const messages of [pt, en, es, de]) {
      const reasons = messages.calling.dialTargets.reasons as Record<string, string>;
      for (const blocker of DIAL_BLOCKERS) expect(reasons[blocker], blocker).toBeTruthy();
      expect(messages.calling.dialTargets.call).toBeTruthy();
      expect(messages.calling.dialTargets.callNumber).toContain("{number}");
      expect(messages.leadsPage.table.rowActions).toContain("{name}");
      expect(messages.leadsPage.table.rowActionsUnnamed).toBeTruthy();
      for (const copied of ["noPermission", "connecting", "busy"]) expect(messages.calling.assistantCard).not.toHaveProperty(copied);
    }
  });
});
