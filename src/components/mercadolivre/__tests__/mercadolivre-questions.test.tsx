import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import type { MercadoLivreAccount, MercadoLivreQuestion } from "@/lib/mercadolivre/types";

const mocks = vi.hoisted(() => ({
  listQuestions: vi.fn(),
  answer: vi.fn(),
  remove: vi.fn(),
  block: vi.fn(),
  responseTime: vi.fn(),
  pickerProps: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/app/actions/mercadolivre", () => ({
  listMercadoLivreQuestionsAction: mocks.listQuestions,
  answerMercadoLivreQuestionAction: mocks.answer,
  deleteMercadoLivreQuestionAction: mocks.remove,
  setMercadoLivreQuestionAuthorBlockedAction: mocks.block,
  getMercadoLivreResponseTimeAction: mocks.responseTime,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));
vi.mock("@/components/mercadolivre/mercadolivre-listing-picker", () => ({
  MercadoLivreListingPicker: (props: { value: string; onChange: (itemId: string) => void }) => {
    mocks.pickerProps(props);
    return (
      <button type="button" onClick={() => props.onChange("MLB2")}>
        pick-listing
      </button>
    );
  },
}));

import { MercadoLivreQuestionsTab } from "@/components/mercadolivre/mercadolivre-questions-tab";

const pt = brandedMessages(rawPt);
const copy = pt.mercadolivre.questions;

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

function question(overrides: Partial<MercadoLivreQuestion> = {}): MercadoLivreQuestion {
  return {
    id: "row-1",
    accountId: "acc-1",
    itemId: "MLB1",
    questionId: "987",
    text: "Tem em azul?",
    status: "UNANSWERED",
    askedAt: "2026-10-19T10:00:00Z",
    suspectedSpam: false,
    asker: { contactId: "c-1", mlUserId: "555", nickname: "COMPRADOR_1" },
    listing: {
      id: "l-1",
      accountId: "acc-1",
      itemId: "MLB1",
      title: "Tênis de corrida",
      status: "active",
      thumbnailUrl: "https://cdn.test/thumb.jpg",
      createdAt: "2026-10-19T10:00:00Z",
      updatedAt: "2026-10-19T10:00:00Z",
    },
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

function renderTab(overrides: Partial<MercadoLivreAccount> = {}, canUpdate = true) {
  return wrap(<MercadoLivreQuestionsTab account={account(overrides)} canUpdate={canUpdate} onUpdated={vi.fn()} />);
}

beforeEach(() => {
  for (const fn of [mocks.listQuestions, mocks.answer, mocks.remove, mocks.block, mocks.responseTime, mocks.pickerProps, mocks.toast, mocks.toast.error]) {
    fn.mockReset();
  }
  mocks.responseTime.mockResolvedValue({ responseTime: { available: false } });
  mocks.listQuestions.mockResolvedValue({ page: { data: [question()] } });
});

describe("MercadoLivreQuestionsTab", () => {
  it("lists the questions of every listing with the listing, the asker and the status", async () => {
    renderTab();
    expect(await screen.findByText("Tem em azul?")).toBeTruthy();
    expect(screen.getByText("Tênis de corrida")).toBeTruthy();
    expect(screen.getByText("COMPRADOR_1")).toBeTruthy();
    expect(screen.getAllByText(copy.status.UNANSWERED).some((element) => !element.closest("button"))).toBe(true);
    expect(mocks.listQuestions).toHaveBeenCalledWith("acc-1", { status: undefined, itemId: undefined, cursor: undefined, limit: 30 });
  });

  it("shows a neutral no data state when Mercado Livre measured no response time", async () => {
    renderTab();
    expect(await screen.findByText(copy.responseTime.unavailable)).toBeTruthy();
  });

  it("shows the response time Mercado Livre measured", async () => {
    mocks.responseTime.mockResolvedValue({
      responseTime: { available: true, total: { minutes: 135 }, weekend: { minutes: 45, salesPercentIncrease: 12 } },
    });
    renderTab();
    expect(await screen.findByText("2 h 15 min")).toBeTruthy();
    expect(screen.getByText("45 min")).toBeTruthy();
    expect(screen.getByText(copy.responseTime.slot.weekend)).toBeTruthy();
  });

  it("filters by status and by listing", async () => {
    renderTab();
    await screen.findByText("Tem em azul?");
    fireEvent.click(screen.getByRole("button", { name: copy.statusFilter.ANSWERED }));
    await waitFor(() => expect(mocks.listQuestions).toHaveBeenLastCalledWith("acc-1", expect.objectContaining({ status: "ANSWERED" })));
    fireEvent.click(screen.getByText("pick-listing"));
    await waitFor(() =>
      expect(mocks.listQuestions).toHaveBeenLastCalledWith("acc-1", expect.objectContaining({ status: "ANSWERED", itemId: "MLB2" })),
    );
  });

  it("loads the next page with the cursor and keeps the rows already shown", async () => {
    mocks.listQuestions.mockResolvedValueOnce({ page: { data: [question()], nextCursor: "cursor-2" } });
    mocks.listQuestions.mockResolvedValueOnce({ page: { data: [question({ id: "row-2", questionId: "988", text: "Serve no 42?" })] } });
    renderTab();
    await screen.findByText("Tem em azul?");
    fireEvent.click(screen.getByRole("button", { name: copy.loadMore }));
    expect(await screen.findByText("Serve no 42?")).toBeTruthy();
    expect(screen.getByText("Tem em azul?")).toBeTruthy();
    expect(mocks.listQuestions).toHaveBeenLastCalledWith("acc-1", expect.objectContaining({ cursor: "cursor-2" }));
  });

  it("sends an answer only after confirming it is public and final", async () => {
    mocks.answer.mockResolvedValue({ question: question({ status: "ANSWERED", answerText: "Temos sim!", answeredBy: "operator" }) });
    renderTab();
    await screen.findByText("Tem em azul?");
    fireEvent.click(screen.getByRole("button", { name: copy.answer.open }));
    expect(screen.getByText(copy.answer.publicFinal)).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText(copy.answer.placeholder), { target: { value: "Temos sim!" } });
    expect(screen.getByText("10/2000")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: copy.answer.send }));
    const dialog = await screen.findByRole("alertdialog");
    expect(within(dialog).getByText(copy.answer.confirmTitle)).toBeTruthy();
    expect(mocks.answer).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole("button", { name: copy.answer.confirm }));
    await waitFor(() => expect(mocks.answer).toHaveBeenCalledWith("acc-1", "987", "Temos sim!"));
    expect(await screen.findByText("Temos sim!")).toBeTruthy();
    expect(screen.getByText(copy.answeredBy.operator)).toBeTruthy();
  });

  it("refuses an answer past 2,000 characters", async () => {
    renderTab();
    await screen.findByText("Tem em azul?");
    fireEvent.click(screen.getByRole("button", { name: copy.answer.open }));
    fireEvent.change(screen.getByPlaceholderText(copy.answer.placeholder), { target: { value: "a".repeat(2001) } });
    expect((screen.getByRole("button", { name: copy.answer.send }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("reloads and says so when the question was already answered or closed", async () => {
    mocks.answer.mockResolvedValue({ error: "closed", code: "question_not_open", status: 409 });
    renderTab();
    await screen.findByText("Tem em azul?");
    fireEvent.click(screen.getByRole("button", { name: copy.answer.open }));
    fireEvent.change(screen.getByPlaceholderText(copy.answer.placeholder), { target: { value: "Temos" } });
    fireEvent.click(screen.getByRole("button", { name: copy.answer.send }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: copy.answer.confirm }));
    expect(await screen.findByText(copy.answer.alreadyClosed)).toBeTruthy();
    expect(mocks.listQuestions).toHaveBeenCalledTimes(2);
  });

  it("says who answered each answered question", async () => {
    mocks.listQuestions.mockResolvedValue({
      page: {
        data: [
          question({ id: "a", questionId: "1", status: "ANSWERED", answerText: "Sim", answeredBy: "rule" }),
          question({ id: "b", questionId: "2", status: "ANSWERED", answerText: "Não", answeredBy: "mercadolivre_app" }),
        ],
      },
    });
    renderTab();
    expect(await screen.findByText(copy.answeredBy.rule)).toBeTruthy();
    expect(screen.getByText(copy.answeredBy.mercadolivre_app)).toBeTruthy();
    expect(screen.queryByRole("button", { name: copy.answer.open })).toBeNull();
  });

  it("deletes a question only after confirmation", async () => {
    mocks.remove.mockResolvedValue({ status: "deleted" });
    renderTab();
    await screen.findByText("Tem em azul?");
    fireEvent.click(screen.getByRole("button", { name: copy.delete.action }));
    expect(mocks.remove).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: copy.delete.confirm }));
    await waitFor(() => expect(mocks.remove).toHaveBeenCalledWith("acc-1", "987"));
    await waitFor(() => expect(screen.queryByText("Tem em azul?")).toBeNull());
  });

  it("blocks and unblocks the asker only after confirmation", async () => {
    mocks.block.mockResolvedValue({ status: "blocked" });
    renderTab();
    await screen.findByText("Tem em azul?");
    fireEvent.click(screen.getByRole("button", { name: copy.block.blockAction }));
    expect(mocks.block).not.toHaveBeenCalled();
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: copy.block.blockConfirm }));
    await waitFor(() => expect(mocks.block).toHaveBeenCalledWith("acc-1", "987", true));

    mocks.block.mockResolvedValue({ status: "unblocked" });
    fireEvent.click(await screen.findByRole("button", { name: copy.block.unblockAction }));
    fireEvent.click(within(await screen.findByRole("alertdialog")).getByRole("button", { name: copy.block.unblockConfirm }));
    await waitFor(() => expect(mocks.block).toHaveBeenLastCalledWith("acc-1", "987", false));
  });

  it("offers no answer, delete or block without the update permission", async () => {
    renderTab({}, false);
    await screen.findByText("Tem em azul?");
    expect(screen.queryByRole("button", { name: copy.answer.open })).toBeNull();
    expect(screen.queryByRole("button", { name: copy.delete.action })).toBeNull();
    expect(screen.queryByRole("button", { name: copy.block.blockAction })).toBeNull();
  });

  it("offers no answer when Mercado Livre did not grant answers to the account", async () => {
    renderTab({ canAnswerQuestions: false });
    await screen.findByText("Tem em azul?");
    expect(screen.queryByRole("button", { name: copy.answer.open })).toBeNull();
    expect(screen.getByText(copy.answerNotGranted)).toBeTruthy();
  });

  it("does not ask for questions the account may not read", () => {
    renderTab({ canReadQuestions: false });
    expect(screen.getByText(copy.readNotGranted)).toBeTruthy();
    expect(mocks.listQuestions).not.toHaveBeenCalled();
  });
});
