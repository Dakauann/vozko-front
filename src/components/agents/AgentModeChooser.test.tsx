import { render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { AgentModeChooser } from "./AgentModeChooser";

const chooser = ptMessages.agents.new.chooser;
const explainers = ptMessages.explainers.agents;

function renderChooser(lead: { mode: "beginner" | "professional"; remembered: boolean } | null) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <AgentModeChooser
        legend={chooser.legend}
        lead={lead}
        leadLabels={{ remembered: chooser.lastUsed, suggested: chooser.suggested }}
        options={[
          { mode: "beginner", title: chooser.beginner.title, description: chooser.beginner.description, cta: chooser.beginner.cta, href: "/dashboard/agents/new/beginner" },
          { mode: "professional", title: chooser.professional.title, description: chooser.professional.description, cta: chooser.professional.cta, href: "/dashboard/agents/new/professional" },
        ]}
      />
    </NextIntlClientProvider>,
  );
}

describe("AgentModeChooser", () => {
  it("links each mode to its own form", () => {
    renderChooser(null);
    expect(screen.getByRole("link", { name: chooser.beginner.title })).toHaveAttribute("href", "/dashboard/agents/new/beginner");
    expect(screen.getByRole("link", { name: chooser.professional.title })).toHaveAttribute("href", "/dashboard/agents/new/professional");
  });

  it("explains each mode with its own hint", () => {
    renderChooser(null);
    expect(screen.getByRole("button", { name: `Saiba mais sobre ${explainers.guided.name}` })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: `Saiba mais sobre ${explainers.complete.name}` })).toBeInTheDocument();
  });

  it("shows what each mode contains: the guided steps in order and the complete tabs", () => {
    renderChooser(null);
    const guided = screen.getByRole("list", { name: chooser.beginner.title });
    expect(within(guided).getAllByRole("listitem").map((item) => item.textContent)).toEqual(
      ["identity", "models", "prompts", "whatsapp", "review"].map((id, index) => `${index + 1}${ptMessages.agents.new.beginner.steps[id as "identity"].title}`),
    );
    const complete = screen.getByRole("list", { name: chooser.professional.title });
    expect(within(complete).getAllByRole("listitem")).toHaveLength(5);
  });

  it("marks the remembered mode", () => {
    renderChooser({ mode: "professional", remembered: true });
    const card = screen.getByRole("link", { name: chooser.professional.title }).closest("article") as HTMLElement;
    expect(within(card).getByText(chooser.lastUsed)).toBeInTheDocument();
    expect(screen.queryByText(chooser.suggested)).not.toBeInTheDocument();
  });
});
