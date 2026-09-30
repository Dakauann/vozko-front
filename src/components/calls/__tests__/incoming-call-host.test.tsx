import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { CallSessionApi } from "@/hooks/use-call-session-ws";
import type { IncomingCallOffer } from "@/lib/call-session/inbound-call-types";

const session = vi.hoisted(() => ({ value: null as unknown as CallSessionApi }));
vi.mock("@/contexts/call-session-context", () => ({ useCallSession: () => session.value }));

import { IncomingCallHost } from "@/components/calls/incoming-call-host";

function ring(offer: Partial<IncomingCallOffer>) {
  session.value = {
    incomingCall: { offerId: "o1", callId: "c1", workspaceId: "ws-1", fromNumber: "5584994409684", channel: "sip", receivedAt: Date.now(), ...offer },
    acceptIncomingCall: vi.fn(),
    declineIncomingCall: vi.fn(),
    callState: null,
  } as unknown as CallSessionApi;
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <IncomingCallHost />
    </NextIntlClientProvider>,
  );
}

describe("IncomingCallHost", () => {
  it("shows the queue, who sent the call and their note before answering", () => {
    ring({ transfer: { fromName: "URA principal", queueName: "Suporte", notes: "Escolheu segunda via" } });
    expect(screen.getByText("Da fila Suporte")).toBeTruthy();
    expect(screen.getByText("Enviada por URA principal")).toBeTruthy();
    expect(screen.getByText("Escolheu segunda via")).toBeTruthy();
  });

  it("shows a colleague's warm transfer", () => {
    ring({ transfer: { fromName: "Ana", notes: "quer cancelar" } });
    expect(screen.getByText("Transferida por Ana")).toBeTruthy();
    expect(screen.getByText("quer cancelar")).toBeTruthy();
  });

  it("stays plain for an ordinary call", () => {
    ring({});
    expect(screen.queryByText(/Transferida por|Da fila/)).toBeNull();
  });

  it("offers a held call back to its operator after a reload", () => {
    ring({ resume: true });
    expect(screen.getByText("Sua ligação está em espera")).toBeTruthy();
    expect(screen.getByRole("button", { name: /Retomar/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Encerrar/ })).toBeTruthy();
  });

  it("names the line a call arrives on", () => {
    ring({ channel: "sip" });
    expect(screen.getByText("Chamada recebida · Linha telefônica")).toBeTruthy();
    expect(screen.getAllByText("Linha telefônica").length).toBeGreaterThan(0);
  });

  it("does not invent a line it was not told about", () => {
    ring({ channel: undefined });
    expect(screen.getByText("Chamada recebida")).toBeTruthy();
  });

  it("counts down the ring with an accessible label", () => {
    ring({ receivedAt: Date.now(), expiresAt: new Date(Date.now() + 20_000).toISOString() });
    expect(screen.getByLabelText(/Tocando por mais (19|20)s/)).toBeTruthy();
  });
});
