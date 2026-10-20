import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import type { MercadoLivreAccount, MercadoLivreListing } from "@/lib/mercadolivre/types";

const mocks = vi.hoisted(() => ({
  listListings: vi.fn(),
  listQuestions: vi.fn(),
  listRules: vi.fn(),
  createRule: vi.fn(),
  updateRule: vi.fn(),
  deleteRule: vi.fn(),
}));

vi.mock("@/app/actions/mercadolivre", () => ({
  listMercadoLivreListingsAction: mocks.listListings,
  listMercadoLivreQuestionsAction: mocks.listQuestions,
  answerMercadoLivreQuestionAction: vi.fn(),
  deleteMercadoLivreQuestionAction: vi.fn(),
  setMercadoLivreQuestionAuthorBlockedAction: vi.fn(),
  getMercadoLivreResponseTimeAction: vi.fn(async () => ({ responseTime: { available: false } })),
  listMercadoLivreCommentRulesAction: mocks.listRules,
  createMercadoLivreCommentRuleAction: mocks.createRule,
  updateMercadoLivreCommentRuleAction: mocks.updateRule,
  deleteMercadoLivreCommentRuleAction: mocks.deleteRule,
}));
vi.mock("@/app/actions/instagram", () => ({}));
vi.mock("@/app/actions/facebook", () => ({}));
vi.mock("@/components/mercadolivre/mercadolivre-listing-picker", () => ({
  MercadoLivreListingPicker: (props: { value: string; onChange: (itemId: string) => void }) => (
    <button type="button" onClick={() => props.onChange("MLB2")}>
      pick-listing {props.value}
    </button>
  ),
}));

import { MERCADOLIVRE_ACCOUNT_TABS } from "@/components/mercadolivre/mercadolivre-account-tabs";
import { MercadoLivreListingsTab } from "@/components/mercadolivre/mercadolivre-listings-tab";
import { MercadoLivreRulesTab } from "@/components/mercadolivre/mercadolivre-rules-tab";

const pt = brandedMessages(rawPt);
const copy = pt.mercadolivre;

function account(overrides: Partial<MercadoLivreAccount> = {}): MercadoLivreAccount {
  return {
    id: "acc-1",
    workspaceId: "ws-1",
    mlUserId: "123456",
    siteId: "MLB",
    nickname: "LOJA_TESTE",
    status: "CONNECTED",
    needsReconnect: false,
    grantedScopes: [],
    canReadQuestions: true,
    canAnswerQuestions: true,
    canReadMessages: true,
    canSendMessages: true,
    enableAgentResponses: false,
    enableWorkflow: false,
    automationDisclosure: "",
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

function listing(overrides: Partial<MercadoLivreListing> = {}): MercadoLivreListing {
  return {
    id: "l-1",
    accountId: "acc-1",
    itemId: "MLB1",
    title: "Tênis de corrida",
    status: "active",
    permalink: "https://produto.mercadolivre.com.br/MLB1",
    createdAt: "2026-10-19T10:00:00Z",
    updatedAt: "2026-10-19T10:00:00Z",
    ...overrides,
  };
}

function wrap(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.listListings.mockResolvedValue({ page: { data: [listing()] } });
  mocks.listQuestions.mockResolvedValue({ page: { data: [] } });
  mocks.listRules.mockResolvedValue({ rules: [] });
});

describe("Mercado Livre account tabs", () => {
  it("opens on the questions, then listings, rules and automation", () => {
    expect(MERCADOLIVRE_ACCOUNT_TABS.map((tab) => tab.id)).toEqual(["questions", "listings", "rules", "automation"]);
  });
});

describe("MercadoLivreListingsTab", () => {
  it("lists the mirrored listings with their status", async () => {
    wrap(<MercadoLivreListingsTab account={account()} canUpdate onUpdated={vi.fn()} />);
    expect(await screen.findByText("Tênis de corrida")).toBeTruthy();
    expect(screen.getByText("MLB1")).toBeTruthy();
    expect(screen.getByText(copy.listingStatus.active)).toBeTruthy();
    expect(mocks.listListings).toHaveBeenCalledWith("acc-1", { search: "", status: undefined, cursor: undefined, limit: 30 });
  });

  it("searches and filters by status", async () => {
    wrap(<MercadoLivreListingsTab account={account()} canUpdate onUpdated={vi.fn()} />);
    await screen.findByText("Tênis de corrida");
    fireEvent.click(screen.getByRole("button", { name: copy.listings.statusFilter.paused }));
    await waitFor(() => expect(mocks.listListings).toHaveBeenLastCalledWith("acc-1", expect.objectContaining({ status: "paused" })));
    fireEvent.change(screen.getByLabelText(copy.listings.searchPlaceholder), { target: { value: "tênis" } });
    await waitFor(() => expect(mocks.listListings).toHaveBeenLastCalledWith("acc-1", expect.objectContaining({ search: "tênis", status: "paused" })));
  });

  it("loads more listings with the cursor", async () => {
    mocks.listListings.mockResolvedValueOnce({ page: { data: [listing()], nextCursor: "c2" } });
    mocks.listListings.mockResolvedValueOnce({ page: { data: [listing({ id: "l-2", itemId: "MLB2", title: "Meia esportiva" })] } });
    wrap(<MercadoLivreListingsTab account={account()} canUpdate onUpdated={vi.fn()} />);
    await screen.findByText("Tênis de corrida");
    fireEvent.click(screen.getByRole("button", { name: copy.listings.loadMore }));
    expect(await screen.findByText("Meia esportiva")).toBeTruthy();
    expect(mocks.listListings).toHaveBeenLastCalledWith("acc-1", expect.objectContaining({ cursor: "c2" }));
  });

  it("opens a listing on its own questions and rules", async () => {
    wrap(<MercadoLivreListingsTab account={account()} canUpdate onUpdated={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: copy.listings.open }));
    await waitFor(() => expect(mocks.listQuestions).toHaveBeenCalledWith("acc-1", expect.objectContaining({ itemId: "MLB1" })));
    expect(screen.getByRole("tab", { name: copy.listings.detailTabs.rules })).toBeTruthy();
    expect(screen.getByRole("link", { name: copy.listings.viewOnMercadoLivre }).getAttribute("href")).toBe("https://produto.mercadolivre.com.br/MLB1");
    fireEvent.click(screen.getByRole("button", { name: copy.listings.back }));
    expect(await screen.findByText(copy.listings.title)).toBeTruthy();
  });

  it("shows the empty state when the mirror has no listing yet", async () => {
    mocks.listListings.mockResolvedValue({ page: { data: [] } });
    wrap(<MercadoLivreListingsTab account={account()} canUpdate onUpdated={vi.fn()} />);
    expect(await screen.findByText(copy.listings.emptyTitle)).toBeTruthy();
  });
});

describe("MercadoLivreRulesTab", () => {
  it("creates a rule that answers, on a listing picked from the mirror", async () => {
    mocks.createRule.mockImplementation(async (_accountId: string, payload: object) => ({
      rule: { id: "r-1", accountId: "acc-1", source: "mercadolivre", createdAt: "", updatedAt: "", ...payload },
    }));
    wrap(<MercadoLivreRulesTab account={account()} canUpdate onUpdated={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: copy.commentRules.emptyCta }));
    const dialog = await screen.findByRole("dialog");

    expect(within(dialog).getByRole("button", { name: new RegExp(copy.commentRules.action.public_reply) }).getAttribute("aria-pressed")).toBe("true");
    expect(within(dialog).getByRole("button", { name: new RegExp(copy.commentRules.action.delete) })).toBeTruthy();
    expect(within(dialog).queryByText(pt.facebook.commentRules.action.private_reply)).toBeNull();
    expect(within(dialog).queryByText(pt.facebook.commentRules.action.hide)).toBeNull();

    fireEvent.change(within(dialog).getByPlaceholderText(copy.commentRules.fieldNamePlaceholder), { target: { value: "Prazo" } });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.commentRules.match.any }));
    fireEvent.change(within(dialog).getByPlaceholderText(copy.commentRules.fieldPublicTextPlaceholder.replace(/'/g, "")), {
      target: { value: "Oi {{username}}, sai em 2 dias." },
    });
    fireEvent.click(within(dialog).getByText(/pick-listing/));
    fireEvent.click(within(dialog).getByRole("button", { name: copy.commentRules.save }));

    await waitFor(() =>
      expect(mocks.createRule).toHaveBeenCalledWith(
        "acc-1",
        expect.objectContaining({ name: "Prazo", containerId: "MLB2", actions: ["public_reply"], publicReplyText: "Oi {{username}}, sai em 2 dias." }),
      ),
    );
  });

  it("refuses an answer past 2,000 characters before saving", async () => {
    wrap(<MercadoLivreRulesTab account={account()} canUpdate onUpdated={vi.fn()} />);
    fireEvent.click(await screen.findByRole("button", { name: copy.commentRules.emptyCta }));
    const dialog = await screen.findByRole("dialog");
    fireEvent.change(within(dialog).getByPlaceholderText(copy.commentRules.fieldNamePlaceholder), { target: { value: "Longa" } });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.commentRules.match.any }));
    fireEvent.change(within(dialog).getByPlaceholderText(copy.commentRules.fieldPublicTextPlaceholder.replace(/'/g, "")), {
      target: { value: "a".repeat(2001) },
    });
    expect(within(dialog).getByText(/2.?001 de 2.?000/)).toBeTruthy();
    expect((within(dialog).getByRole("button", { name: copy.commentRules.save }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("explains why rules cannot be changed without the update permission", async () => {
    wrap(<MercadoLivreRulesTab account={account()} canUpdate={false} onUpdated={vi.fn()} />);
    expect(await screen.findByText(copy.commentRules.noPermission)).toBeTruthy();
    expect((screen.getByRole("button", { name: copy.commentRules.new }) as HTMLButtonElement).disabled).toBe(true);
  });
});
