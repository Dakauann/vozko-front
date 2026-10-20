import type { ReactNode } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { EntryPoint } from "@/lib/workflows/types";

import { EntryPointCard, EntryPointChips } from "./entry-point-chips";

const NOW = new Date("2026-10-20T12:00:00Z");

function wrap(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="UTC" now={NOW}>
      {children}
    </NextIntlClientProvider>,
  );
}

const pausedWebhook: EntryPoint = {
  kind: "webhook",
  nodeId: "wh",
  readiness: "blocked",
  reason: "paused",
  details: { webhook: { active: true, authMode: "header_token", method: "POST" } },
  lastReceivedAt: "2026-10-20T11:55:00Z",
  lastOutcome: "rejected",
  lastReason: "workflow_not_active",
};

const agentCall: EntryPoint = {
  kind: "agent_call",
  nodeId: "ag",
  readiness: "ready",
  details: { agents: [{ id: "a1", name: "Bia", active: true }] },
};

describe("EntryPointChips", () => {
  it("shows each entry point with its readiness in its accessible name", () => {
    wrap(<EntryPointChips entries={[pausedWebhook, agentCall]} canUpdate onFix={vi.fn()} />);
    expect(screen.getByLabelText("Webhook: Não recebe: fluxo pausado")).toBeInTheDocument();
    expect(screen.getByLabelText("Chamado por agente IA: Recebe chamadas")).toBeInTheDocument();
  });

  it("says when a workflow has no entry point and shows n/d when the list was not read", () => {
    const { unmount } = wrap(<EntryPointChips entries={[]} canUpdate onFix={vi.fn()} />);
    expect(screen.getByText("Nenhuma entrada")).toBeInTheDocument();
    unmount();
    wrap(<EntryPointChips entries={undefined} canUpdate onFix={vi.fn()} />);
    expect(screen.getByText("n/d")).toBeInTheDocument();
  });
});

describe("EntryPointCard", () => {
  it("explains a blocked webhook, its last call with outcome and reason, and offers Retomar", () => {
    const onFix = vi.fn();
    wrap(<EntryPointCard entry={pausedWebhook} canUpdate onFix={onFix} />);
    expect(screen.getByText("Não recebe: fluxo pausado")).toBeInTheDocument();
    expect(screen.getByText("Token no cabeçalho")).toBeInTheDocument();
    expect(screen.getByText("POST")).toBeInTheDocument();
    expect(screen.getByText("Última chamada há 5 minutos")).toBeInTheDocument();
    expect(screen.getByText("Resultado: Recusada · Fluxo inativo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Retomar" }));
    expect(onFix).toHaveBeenCalledWith({ kind: "resume" });
  });

  it("hides Publicar and Retomar from someone who cannot update the workflow", () => {
    wrap(<EntryPointCard entry={pausedWebhook} canUpdate={false} onFix={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Retomar" })).toBeNull();
  });

  it("offers links to fix a binding even without update permission", () => {
    const onFix = vi.fn();
    const form: EntryPoint = {
      kind: "form_submitted",
      readiness: "blocked",
      reason: "form_inactive",
      details: { forms: [{ id: "f1", name: "Matrícula", active: false }] },
    };
    wrap(<EntryPointCard entry={form} canUpdate={false} onFix={onFix} />);
    expect(screen.getByText("Matrícula")).toBeInTheDocument();
    expect(screen.getByText("inativo")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Abrir formulário" }));
    expect(onFix).toHaveBeenCalledWith({ kind: "link", href: "/dashboard/whatsapp-forms/f1" });
  });

  it("says there was no call yet and lists the agents of a ready agent call", () => {
    wrap(<EntryPointCard entry={agentCall} canUpdate onFix={vi.fn()} />);
    expect(screen.getByText("Recebe chamadas")).toBeInTheDocument();
    expect(screen.getByText("Nenhuma chamada ainda")).toBeInTheDocument();
    expect(screen.getByText("Bia")).toBeInTheDocument();
  });

  it("lists at most ten channels, with flows off marked", () => {
    const channels = Array.from({ length: 12 }, (_, index) => ({
      kind: "instagram_account" as const,
      id: `c${index}`,
      name: `Conta ${index}`,
      workflowEnabled: index !== 0,
      bound: true,
    }));
    wrap(<EntryPointCard entry={{ kind: "message_received", readiness: "ready", details: { channels } }} canUpdate onFix={vi.fn()} />);
    expect(screen.getByText("Conta 9")).toBeInTheDocument();
    expect(screen.queryByText("Conta 10")).toBeNull();
    expect(screen.getByText("fluxos desligados")).toBeInTheDocument();
  });

  it("lists lead exits by source and button", () => {
    wrap(
      <EntryPointCard
        entry={{ kind: "lead_exit", readiness: "ready", details: { leadExits: [{ source: "template", id: "t1", name: "boas_vindas", button: "Sair" }] } }}
        canUpdate
        onFix={vi.fn()}
      />,
    );
    expect(screen.getByText("boas_vindas")).toBeInTheDocument();
    expect(screen.getByText("Template · botão Sair")).toBeInTheDocument();
  });
});
