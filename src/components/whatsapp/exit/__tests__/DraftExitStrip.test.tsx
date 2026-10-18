import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import ptMessages from "@/i18n/messages/pt.json";
import type { TemplateDraftPurpose } from "@/lib/whatsapp-templates/draft";

const actions = vi.hoisted(() => ({ getDraftExitVerdictAction: vi.fn() }));
vi.mock("@/app/actions/template-exit", () => actions);
vi.mock("@/contexts/workspace-context", () => ({ useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, can: () => true }) }));

import { DraftExitStrip } from "../DraftExitStrip";

const t = ptMessages.templateExit;
const NONE = { state: "none", buttons: [], exitWords: [] };
const draft: DraggableComponent[] = [
  { id: "b", type: "BODY", data: { text: "Ofertas" } },
  { id: "q", type: "BUTTONS", data: { buttons: [{ id: "x", type: "QUICK_REPLY", text: "Quero ver" }] } },
];

function renderStrip(components: DraggableComponent[], category: string, purpose: TemplateDraftPurpose = "create") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages}>
        <DraftExitStrip components={components} category={category} purpose={purpose} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

beforeEach(() => {
  actions.getDraftExitVerdictAction.mockReset();
});

describe("DraftExitStrip", () => {
  it("warns on the canvas that the server will not create the draft without an exit", async () => {
    actions.getDraftExitVerdictAction.mockResolvedValue({ data: { verdict: { ...NONE, templateExitRequired: true, campaignAcknowledgementRequired: true } } });
    renderStrip(draft, "MARKETING");
    expect(await screen.findByText(t.verdict.marketingNone, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText(t.verdict.creationNeedsExit)).toBeInTheDocument();
    expect(actions.getDraftExitVerdictAction).toHaveBeenCalledWith({
      category: "MARKETING",
      header: "",
      body: "Ofertas",
      footer: "",
      buttons: [{ type: "QUICK_REPLY", text: "Quero ver" }],
      buttonActions: [],
    });
  });

  it("stays quiet when the server needs no acknowledgement", async () => {
    actions.getDraftExitVerdictAction.mockResolvedValue({
      data: { verdict: { ...NONE, state: "ok", templateExitRequired: false, campaignAcknowledgementRequired: false } },
    });
    renderStrip(draft, "MARKETING");
    await waitFor(() => expect(actions.getDraftExitVerdictAction).toHaveBeenCalled(), { timeout: 3000 });
    expect(screen.queryByText(t.verdict.marketingNone)).not.toBeInTheDocument();
  });

  it("says sends will ask for the acknowledgement when only sends are gated, without blocking creation", async () => {
    actions.getDraftExitVerdictAction.mockResolvedValue({ data: { verdict: { ...NONE, templateExitRequired: false, campaignAcknowledgementRequired: true } } });
    renderStrip(draft, "UTILITY");
    expect(await screen.findByText(t.verdict.sendsNeedAck, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText(t.verdict.creationNeedsExit)).not.toBeInTheDocument();
  });

  it("asks the server about any category instead of deciding by category", async () => {
    actions.getDraftExitVerdictAction.mockResolvedValue({
      data: { verdict: { ...NONE, state: "ok", templateExitRequired: false, campaignAcknowledgementRequired: false } },
    });
    renderStrip(draft, "AUTHENTICATION");
    await waitFor(() => expect(actions.getDraftExitVerdictAction).toHaveBeenCalledWith(expect.objectContaining({ category: "AUTHENTICATION" })), { timeout: 3000 });
  });

  it("asks nothing for an empty canvas", async () => {
    renderStrip([], "MARKETING");
    await new Promise((resolve) => setTimeout(resolve, 700));
    expect(actions.getDraftExitVerdictAction).not.toHaveBeenCalled();
  });

  it("says an edit is not saved without an exit", async () => {
    actions.getDraftExitVerdictAction.mockResolvedValue({ data: { verdict: { ...NONE, templateExitRequired: true, campaignAcknowledgementRequired: true } } });
    renderStrip(draft, "MARKETING", "edit");
    expect(await screen.findByText(t.verdict.editNeedsExit, {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.queryByText(t.verdict.creationNeedsExit)).not.toBeInTheDocument();
  });
});
