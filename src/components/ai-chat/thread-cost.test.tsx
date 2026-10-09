import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import en from "@/i18n/messages/en.json";

const getCost = vi.fn();
vi.mock("@/app/actions/aichat", () => ({
  getChatThreadCostAction: (...args: unknown[]) => getCost(...args),
}));

import { LIVE_COST_REFRESH_MS } from "@/lib/aichat/thread-cost";

import { ThreadCostBadge } from "./thread-cost";

const costCopy = {
  label: "Cost of this conversation",
  tooltip: "What this conversation has charged so far.",
  unavailable: "This conversation's cost cannot be shown exactly.",
  tokens: "{count} tokens",
  usage: { calls: "Model calls", input: "Input tokens", cacheRead: "Read from cache", cacheWrite: "Written to cache", output: "Output tokens", reasoning: "Reasoning" },
};

const usage = { available: true, calls: 15, inputTokens: 960_532, outputTokens: 19_172, cacheReadTokens: 820_000, cacheWriteTokens: 95_000, reasoningTokens: 0 };

const messages = { ...en, aiChatPage: { ...en.aiChatPage, cost: costCopy } };

function Badge({ threadId, streaming = false }: { threadId: string | null; streaming?: boolean }) {
  return (
    <NextIntlClientProvider locale="en" messages={messages}>
      <ThreadCostBadge threadId={threadId} streaming={streaming} />
    </NextIntlClientProvider>
  );
}

beforeEach(() => {
  getCost.mockReset();
});
afterEach(cleanup);

describe("ThreadCostBadge", () => {
  it("shows what the conversation was charged", async () => {
    getCost.mockResolvedValue({ data: { available: true, amountMicros: 420_000, currency: "BRL" }, error: null });
    render(<Badge threadId="th-1" />);
    expect(await screen.findByRole("button", { name: `${costCopy.label}: R$0.42` })).toHaveTextContent("R$0.42");
    expect(getCost).toHaveBeenCalledWith("th-1");
  });

  it("shows the tokens the conversation used next to its cost, with the breakdown on focus", async () => {
    getCost.mockResolvedValue({ data: { available: true, amountMicros: 420_000, currency: "BRL", usage }, error: null });
    render(<Badge threadId="th-1" />);
    const badge = await screen.findByRole("button", { name: `${costCopy.label}: R$0.42, 979.7K tokens` });
    expect(badge).toHaveTextContent("979.7K tokens");
    fireEvent.focus(badge);
    expect((await screen.findAllByText(costCopy.usage.cacheRead)).length).toBeGreaterThan(0);
    expect(screen.getAllByText("820,000").length).toBeGreaterThan(0);
    expect(screen.queryByText(costCopy.usage.reasoning)).not.toBeInTheDocument();
  });

  it("leaves the tokens out when they cannot be exact", async () => {
    getCost.mockResolvedValue({ data: { available: true, amountMicros: 420_000, currency: "BRL", usage: { ...usage, available: false } }, error: null });
    render(<Badge threadId="th-1" />);
    const badge = await screen.findByRole("button", { name: `${costCopy.label}: R$0.42` });
    expect(badge).not.toHaveTextContent("tokens");
  });

  it("shows the muted empty value when the cost cannot be exact", async () => {
    getCost.mockResolvedValue({ data: { available: false, amountMicros: 0, currency: "BRL" }, error: null });
    render(<Badge threadId="th-1" />);
    expect(await screen.findByRole("button", { name: `${costCopy.label}: n/a` })).toHaveTextContent("n/a");
  });

  it("shows the empty value when the cost cannot be read", async () => {
    getCost.mockResolvedValue({ data: null, error: "boom" });
    render(<Badge threadId="th-1" />);
    expect(await screen.findByRole("button", { name: `${costCopy.label}: n/a` })).toBeInTheDocument();
  });

  it("refreshes when an answer ends", async () => {
    getCost.mockResolvedValue({ data: { available: true, amountMicros: 420_000, currency: "BRL" }, error: null });
    const view = render(<Badge threadId="th-1" streaming />);
    await screen.findByText("R$0.42");
    getCost.mockResolvedValue({ data: { available: true, amountMicros: 980_000, currency: "BRL" }, error: null });
    await act(async () => view.rerender(<Badge threadId="th-1" streaming={false} />));
    await waitFor(() => expect(screen.getByText("R$0.98")).toBeInTheDocument());
  });

  it("keeps the cost current while an answer is still running", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      getCost.mockResolvedValue({ data: { available: true, amountMicros: 420_000, currency: "BRL" }, error: null });
      render(<Badge threadId="th-1" streaming />);
      await screen.findByText("R$0.42");
      getCost.mockResolvedValue({ data: { available: true, amountMicros: 980_000, currency: "BRL" }, error: null });
      await act(async () => {
        await vi.advanceTimersByTimeAsync(LIVE_COST_REFRESH_MS);
      });
      expect(screen.getByText("R$0.98")).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it("refreshes when another conversation opens", async () => {
    getCost.mockResolvedValue({ data: { available: true, amountMicros: 420_000, currency: "BRL" }, error: null });
    const view = render(<Badge threadId="th-1" />);
    await screen.findByText("R$0.42");
    getCost.mockResolvedValue({ data: { available: true, amountMicros: 10_000_000, currency: "BRL" }, error: null });
    view.rerender(<Badge threadId="th-2" />);
    expect(await screen.findByText("R$10.00")).toBeInTheDocument();
    expect(getCost).toHaveBeenLastCalledWith("th-2");
  });

  it("shows nothing without a conversation", () => {
    render(<Badge threadId={null} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(getCost).not.toHaveBeenCalled();
  });
});
