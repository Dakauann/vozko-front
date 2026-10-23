import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import type { CampaignDraft } from "@/lib/campaign-drafts/types";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }) }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws1" }, can: () => true }),
}));

const actions = vi.hoisted(() => ({
  listCampaignDraftsAction: vi.fn(),
  deleteCampaignDraftAction: vi.fn(),
}));
vi.mock("@/app/actions/campaign-drafts", () => ({
  ...actions,
  isDraftActionError: (result: object) => "error" in result,
}));

import { CampaignDraftsPanel } from "../CampaignDraftsPanel";

function draft(id: string, name: string): CampaignDraft {
  return { id, channel: "whatsapp", name, payload: {}, createdBy: "u1", createdAt: "2026-10-22T12:00:00Z", updatedAt: "2026-10-22T13:00:00Z" };
}

function show() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
        <CampaignDraftsPanel channel="whatsapp" continueHref={(id) => `/dashboard/whatsapp-campaigns/new?draft=${id}`} />
      </NextIntlClientProvider>
    </QueryClientProvider>,
  );
}

describe("CampaignDraftsPanel", () => {
  beforeEach(() => {
    actions.listCampaignDraftsAction.mockReset();
    actions.deleteCampaignDraftAction.mockReset();
  });

  it("renders nothing without drafts", async () => {
    actions.listCampaignDraftsAction.mockResolvedValue({ data: { items: [] } });
    const { container } = show();
    await waitFor(() => expect(actions.listCampaignDraftsAction).toHaveBeenCalledWith("whatsapp", expect.anything()));
    expect(container).toBeEmptyDOMElement();
  });

  it("lists drafts with the Rascunho chip and a continue link", async () => {
    actions.listCampaignDraftsAction.mockResolvedValue({ data: { items: [draft("d1", "Black Friday"), draft("d2", "")] } });
    show();
    const list = await screen.findByRole("list", { name: "Rascunhos de campanha" });
    const rows = within(list).getAllByRole("listitem");
    expect(rows).toHaveLength(2);
    expect(within(rows[0]).getByText("Black Friday")).toBeInTheDocument();
    expect(within(rows[0]).getByText("Rascunho")).toBeInTheDocument();
    expect(within(rows[1]).getByText("Sem nome")).toBeInTheDocument();
    expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", expect.stringMatching(/\/dashboard\/whatsapp-campaigns\/new\?draft=d1$/));
  });

  it("deletes a draft after confirming and reloads the list", async () => {
    actions.listCampaignDraftsAction.mockResolvedValueOnce({ data: { items: [draft("d1", "Black Friday")] } }).mockResolvedValue({ data: { items: [] } });
    actions.deleteCampaignDraftAction.mockResolvedValue({ data: { deleted: true } });
    show();
    fireEvent.click(await screen.findByRole("button", { name: "Excluir" }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(/O rascunho Black Friday será apagado/)).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole("button", { name: "Excluir rascunho" }));
    await waitFor(() => expect(actions.deleteCampaignDraftAction).toHaveBeenCalledWith("whatsapp", "d1"));
    await waitFor(() => expect(screen.queryByText("Black Friday")).not.toBeInTheDocument());
  });

  it("says when the drafts could not load", async () => {
    actions.listCampaignDraftsAction.mockResolvedValue({ error: "boom", code: "campaign_draft_invalid" });
    show();
    expect(await screen.findByText("Não foi possível carregar os rascunhos")).toBeInTheDocument();
  });
});
