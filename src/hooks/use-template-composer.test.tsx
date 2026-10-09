import { act, renderHook, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

const listWhatsAppTemplatesAction = vi.fn();
const quoteTemplateSendAction = vi.fn();
const useExchangeRate = vi.fn();

vi.mock("@/app/actions/whatsapp-templates", () => ({
  listWhatsAppTemplatesAction: (...args: unknown[]) => listWhatsAppTemplatesAction(...args),
}));
vi.mock("@/app/actions/whatsapp-outreach", () => ({
  quoteTemplateSendAction: (...args: unknown[]) => quoteTemplateSendAction(...args),
}));
vi.mock("@/hooks/use-exchange-rate", () => ({ useExchangeRate: (enabled: boolean) => useExchangeRate(enabled) }));

import { useTemplateComposer } from "./use-template-composer";

const TEMPLATE = {
  id: "tpl-1",
  name: "aviso",
  language: "pt_BR",
  category: "MARKETING",
  status: "APPROVED",
  components: [{ type: "BODY", text: "Olá {{1}}" }],
};

function wrapper({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {children}
    </NextIntlClientProvider>
  );
}

async function pickTemplate(quote?: boolean) {
  const hook = renderHook(() => useTemplateComposer({ businessPhoneId: "bp-1", enabled: true, quote }), { wrapper });
  await waitFor(() => expect(hook.result.current.templatesLoading).toBe(false));
  act(() => hook.result.current.selectTemplate("tpl-1"));
  await waitFor(() => expect(hook.result.current.template?.id).toBe("tpl-1"));
  return hook;
}

describe("useTemplateComposer", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    listWhatsAppTemplatesAction.mockResolvedValue({ templates: [TEMPLATE] });
    quoteTemplateSendAction.mockResolvedValue({ quote: null, error: null });
    useExchangeRate.mockReturnValue(null);
  });

  it("quotes the one-to-one send of the picked template by default", async () => {
    await pickTemplate();
    await waitFor(() => expect(quoteTemplateSendAction).toHaveBeenCalledWith("tpl-1", "bp-1"));
    expect(useExchangeRate).toHaveBeenLastCalledWith(true);
  });

  it("shows why the quote was refused instead of an empty price", async () => {
    quoteTemplateSendAction.mockResolvedValue({ quote: null, error: { code: "quote_out_of_range", message: "out of range" } });
    const hook = await pickTemplate();
    await waitFor(() => expect(hook.result.current.quoteError).toBe(ptMessages.whatsappOutreach.errors.quote_out_of_range));
    expect(hook.result.current.quote).toBeNull();
  });

  it("names a quote failure it has no copy for as unavailable", async () => {
    quoteTemplateSendAction.mockResolvedValue({ quote: null, error: { code: "scope_unavailable", message: "scope" } });
    const hook = await pickTemplate();
    await waitFor(() => expect(hook.result.current.quoteError).toBe(ptMessages.whatsappOutreach.errors.quote_unavailable));
  });

  it("names a quote request that never answered as unavailable", async () => {
    quoteTemplateSendAction.mockRejectedValue(new Error("network"));
    const hook = await pickTemplate();
    await waitFor(() => expect(hook.result.current.quoteError).toBe(ptMessages.whatsappOutreach.errors.quote_unavailable));
  });

  it("asks for the quote again when the operator retries an unavailable quote", async () => {
    quoteTemplateSendAction.mockResolvedValueOnce({ quote: null, error: { code: "quote_unavailable", message: "x" } });
    quoteTemplateSendAction.mockResolvedValue({
      quote: { category: "MARKETING", priceMicros: 7, balanceMicros: 9, affordable: true },
      error: null,
    });
    const hook = await pickTemplate();
    await waitFor(() => expect(hook.result.current.quoteError).toBe(ptMessages.whatsappOutreach.errors.quote_unavailable));
    expect(hook.result.current.retryQuote).toBeInstanceOf(Function);
    act(() => hook.result.current.retryQuote?.());
    await waitFor(() => expect(hook.result.current.quote?.priceMicros).toBe(7));
    expect(hook.result.current.quoteError).toBeNull();
    expect(hook.result.current.retryQuote).toBeNull();
    expect(quoteTemplateSendAction).toHaveBeenCalledTimes(2);
  });

  it("offers no retry for a refusal that would answer the same", async () => {
    quoteTemplateSendAction.mockResolvedValue({ quote: null, error: { code: "quote_out_of_range", message: "x" } });
    const hook = await pickTemplate();
    await waitFor(() => expect(hook.result.current.quoteError).toBe(ptMessages.whatsappOutreach.errors.quote_out_of_range));
    expect(hook.result.current.retryQuote).toBeNull();
  });

  it("has no quote refusal while the quote answers", async () => {
    quoteTemplateSendAction.mockResolvedValue({
      quote: { category: "MARKETING", priceMicros: 1, balanceMicros: 2, affordable: true },
      error: null,
    });
    const hook = await pickTemplate();
    await waitFor(() => expect(hook.result.current.quote?.priceMicros).toBe(1));
    expect(hook.result.current.quoteError).toBeNull();
  });

  it("asks for neither the quote nor the exchange rate when the caller prices the send itself", async () => {
    await pickTemplate(false);
    expect(quoteTemplateSendAction).not.toHaveBeenCalled();
    expect(useExchangeRate).not.toHaveBeenCalledWith(true);
  });
});
