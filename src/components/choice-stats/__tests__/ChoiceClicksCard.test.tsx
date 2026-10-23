import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  getWhatsAppCampaignChoiceStatsAction: vi.fn(),
  getUnofficialCampaignChoiceStatsAction: vi.fn(),
  getTemplateChoiceStatsAction: vi.fn(),
}));

vi.mock("@/app/actions/choice-stats", () => actions);

import messages from "@/i18n/messages/pt.json";

import { ChoiceClicksCard } from "../ChoiceClicksCard";
import { usePromptChoiceStats, type PromptChoiceSource } from "../use-prompt-choice-stats";

const OPTIONS = [
  { optionId: "template_button:0", label: "Quero saber mais" },
  { optionId: "template_url:1", label: "Ver site" },
];

function prompt(sends: number) {
  return {
    sends,
    clickedPrompts: 40,
    clickRate: 4000,
    freeText: { count: 5, rate: 500 },
    options: [
      { optionId: "template_button:0", shown: sends, clicks: 40, ctr: 4000, tracked: true },
      { optionId: "template_url:1", shown: sends, clicks: 0, ctr: 0, tracked: false },
    ],
  };
}

function Harness({ source }: { source: PromptChoiceSource }) {
  const read = usePromptChoiceStats(source);
  return <ChoiceClicksCard read={read} options={OPTIONS} scope="template" />;
}

function renderCard(source: PromptChoiceSource = { kind: "template", id: "t1" }) {
  return render(
    <NextIntlClientProvider locale="pt" messages={messages} timeZone="America/Sao_Paulo">
      <Harness source={source} />
    </NextIntlClientProvider>,
  );
}

describe("ChoiceClicksCard", () => {
  beforeEach(() => Object.values(actions).forEach((action) => action.mockReset()));

  it("shows the CTR of each button by its title", async () => {
    actions.getTemplateChoiceStatsAction.mockResolvedValue({ status: "ready", stats: { from: null, to: null, timezone: "UTC", prompt: prompt(100) } });
    renderCard();
    const row = await screen.findByRole("listitem", { name: /Quero saber mais/ });
    expect(row).toHaveTextContent("CTR 40,0%");
    expect(row).toHaveTextContent("40 de 100");
    expect(screen.getByRole("meter", { name: "Quero saber mais" })).toHaveAttribute("aria-valuenow", "40");
  });

  it("marks an untracked link button as not tracked, never 0%", async () => {
    actions.getTemplateChoiceStatsAction.mockResolvedValue({ status: "ready", stats: { from: null, to: null, timezone: "UTC", prompt: prompt(100) } });
    renderCard();
    const row = await screen.findByRole("listitem", { name: /Ver site/ });
    expect(row).toHaveTextContent("não rastreado");
    expect(row).not.toHaveTextContent("0%");
  });

  it("shows n/d before the first send", async () => {
    actions.getWhatsAppCampaignChoiceStatsAction.mockResolvedValue({ status: "ready", stats: { from: null, to: null, timezone: "UTC", prompt: { ...prompt(0), options: [] } } });
    renderCard({ kind: "whatsapp_campaign", id: "c1" });
    expect(await screen.findByText("Nenhum envio com botões ainda.")).toBeInTheDocument();
    expect(screen.getAllByText("n/d")).toHaveLength(3);
  });

  it("says the clicks are unreadable instead of showing zeros", async () => {
    actions.getUnofficialCampaignChoiceStatsAction.mockResolvedValue({ status: "unreadable" });
    renderCard({ kind: "unofficial_campaign", id: "u1" });
    expect(await screen.findByText(/não são mostrados/)).toBeInTheDocument();
  });

  it("translates a refusal and retries on request", async () => {
    actions.getTemplateChoiceStatsAction.mockResolvedValue({ status: "failed", message: "raw", code: "template_not_found" });
    renderCard();
    expect(await screen.findByText("Template não encontrado.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tentar de novo" }));
    await waitFor(() => expect(actions.getTemplateChoiceStatsAction).toHaveBeenCalledTimes(2));
  });
});
