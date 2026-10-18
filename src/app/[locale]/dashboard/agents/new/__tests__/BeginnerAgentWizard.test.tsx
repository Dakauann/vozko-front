import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

vi.mock("zod", async () => {
  const actual = await vi.importActual<Record<string, unknown>>("zod");
  return { ...actual, z: actual.z ?? actual.default ?? actual };
});
vi.mock("@/app/actions/agents", () => ({
  getAgentOptionsAction: vi.fn(async () => ({ options: { messaging: ["openai/gpt-4o"], defaults: { messagingModel: "openai/gpt-4o" } } })),
  getAgentToolsAction: vi.fn(async () => ({ tools: [] })),
  createAgentAction: vi.fn(),
  updateAgentAction: vi.fn(),
}));
vi.mock("@/app/actions/whatsapp-business-phones", () => ({
  listBusinessPhonesAction: vi.fn(async () => ({ phones: [], meta: { totalPages: 1 } })),
}));
vi.mock("@/app/actions/whatsapp-templates", () => ({
  listWhatsAppTemplatesAction: vi.fn(async () => ({ templates: [], meta: { totalPages: 1 } })),
}));
vi.mock("sonner", () => ({ toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }) }));

import BeginnerAgentWizard from "../BeginnerAgentWizard";

const wizard = ptMessages.agents.new.beginner;

function renderWizard() {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
      <BeginnerAgentWizard onSaved={vi.fn()} />
    </NextIntlClientProvider>,
  );
}

describe("BeginnerAgentWizard as a top to bottom flow", () => {
  it("shows every step in one column with only the first one open", () => {
    renderWizard();
    const steps = screen.getAllByRole("listitem");
    expect(steps).toHaveLength(5);
    expect(steps[0]).toHaveAttribute("aria-current", "step");
    expect(within(steps[0]).getByLabelText(wizard.fields.name.label)).toBeInTheDocument();
    expect(within(steps[1]).getByText(wizard.steps.models.short)).toBeInTheDocument();
  });

  it("folds a finished step into a summary and reopens it on demand", async () => {
    renderWizard();
    fireEvent.change(screen.getByLabelText(wizard.fields.name.label), { target: { value: "Recepção 24h" } });
    fireEvent.click(screen.getByRole("button", { name: wizard.nav.next }));

    await waitFor(() => expect(screen.getAllByRole("listitem")[1]).toHaveAttribute("aria-current", "step"));
    expect(screen.getByText("Recepção 24h")).toBeInTheDocument();
    expect(screen.queryByLabelText(wizard.fields.name.label)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: `${wizard.nav.edit} ${wizard.steps.identity.title}` }));
    expect(screen.getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
    expect(screen.getByLabelText(wizard.fields.name.label)).toHaveValue("Recepção 24h");
  });

  it("keeps the user on the step while a required field is empty", async () => {
    renderWizard();
    fireEvent.click(screen.getByRole("button", { name: wizard.nav.next }));
    expect(await screen.findByText(ptMessages.agents.form.validation.nameRequired)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[0]).toHaveAttribute("aria-current", "step");
  });
});
