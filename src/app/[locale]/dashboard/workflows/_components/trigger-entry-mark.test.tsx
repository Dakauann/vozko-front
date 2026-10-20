import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { entryPointsByNode } from "@/lib/workflows/entry-points";
import type { EntryPoint } from "@/lib/workflows/types";

import { EntryPointsContext, TriggerEntryMark } from "./trigger-entry-mark";

const NOW = new Date("2026-10-20T12:00:00Z");

const entries: EntryPoint[] = [
  { kind: "webhook", nodeId: "wh", readiness: "blocked", reason: "paused", lastReceivedAt: "2026-10-20T11:55:00Z" },
  { kind: "agent_call", nodeId: "ag", readiness: "ready" },
  { kind: "message_received", nodeId: "msg", readiness: "blocked", reason: "no_channel" },
];

function wrap(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC" now={NOW}>
      <EntryPointsContext.Provider value={entryPointsByNode(entries)}>{children}</EntryPointsContext.Provider>
    </NextIntlClientProvider>,
  );
}

describe("TriggerEntryMark", () => {
  it("says inline why a blocked webhook refuses calls, with its last call", () => {
    wrap(<TriggerEntryMark nodeId="wh" />);
    expect(screen.getByText("Webhook recusa chamadas: fluxo pausado")).toBeInTheDocument();
    expect(screen.getByText("Última chamada há 5 minutos")).toBeInTheDocument();
  });

  it("shows a ready agent call trigger with no call yet", () => {
    wrap(<TriggerEntryMark nodeId="ag" />);
    expect(screen.getByLabelText("Recebe chamadas")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma chamada ainda")).toBeInTheDocument();
  });

  it("marks other blocked triggers by status only, without the inline sentence", () => {
    wrap(<TriggerEntryMark nodeId="msg" />);
    expect(screen.getByLabelText("Não recebe: nenhum canal envia para este fluxo")).toBeInTheDocument();
    expect(screen.queryByText(/recusa chamadas/)).toBeNull();
  });

  it("renders nothing for a node that is not an entry point of the running version", () => {
    const { container } = wrap(<TriggerEntryMark nodeId="draft-only" />);
    expect(container).toBeEmptyDOMElement();
  });
});
