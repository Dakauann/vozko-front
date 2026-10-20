import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";

import rawPt from "@/i18n/messages/pt.json";
import { brandedMessages } from "@/test/branded-messages";
import { REASON_ERROR_CODES } from "@/lib/mercadolivre/reasons";
import type { MercadoLivreReasonOption } from "@/lib/mercadolivre/types";

const mocks = vi.hoisted(() => ({
  list: vi.fn(),
  send: vi.fn(),
  toast: Object.assign(vi.fn(), { error: vi.fn(), success: vi.fn() }),
}));

vi.mock("@/app/actions/mercadolivre", () => ({
  listMercadoLivreReasonsAction: mocks.list,
  sendMercadoLivreReasonAction: mocks.send,
}));
vi.mock("sonner", () => ({ toast: mocks.toast }));

import { MercadoLivreStartConversation } from "@/components/mercadolivre/mercadolivre-start-conversation";

const pt = brandedMessages(rawPt);
const copy = pt.mercadolivre.reasons;

const OTHER: MercadoLivreReasonOption = { id: "OTHER", enabled: true, actionable: true, charLimit: 350, capAvailable: 1, templates: [] };
const VARIANTS: MercadoLivreReasonOption = {
  id: "REQUEST_VARIANTS",
  enabled: true,
  actionable: true,
  capAvailable: 2,
  templates: [{ id: "TPL_1", vars: [{ id: "days", type: "number" }] }],
};
const DELIVERY: MercadoLivreReasonOption = { id: "DELIVERY_PROMISE", enabled: true, actionable: true, capAvailable: 0, templates: [] };

function wrap(children: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
      {children}
    </NextIntlClientProvider>,
  );
}

async function openDialog() {
  wrap(<MercadoLivreStartConversation entryId="entry-1" entryType="mercadolivre" canSend />);
  fireEvent.click(screen.getByRole("button", { name: copy.action }));
  return screen.findByRole("dialog");
}

beforeEach(() => {
  for (const fn of [mocks.list, mocks.send, mocks.toast, mocks.toast.error]) fn.mockReset();
  mocks.list.mockResolvedValue({ options: [OTHER, VARIANTS, DELIVERY] });
});

describe("MercadoLivreStartConversation", () => {
  it("is offered only to whoever may send, and only on Mercado Livre conversations", () => {
    const { rerender } = wrap(<MercadoLivreStartConversation entryId="entry-1" entryType="mercadolivre" canSend={false} />);
    expect(screen.queryByRole("button", { name: copy.action })).toBeNull();
    rerender(
      <NextIntlClientProvider locale="pt" messages={pt} timeZone="America/Sao_Paulo">
        <MercadoLivreStartConversation entryId="entry-1" entryType="instagram" canSend />
      </NextIntlClientProvider>,
    );
    expect(screen.queryByRole("button", { name: copy.action })).toBeNull();
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("lists the reasons with their remaining uses and keeps a spent one closed", async () => {
    const dialog = await openDialog();
    expect(mocks.list).toHaveBeenCalledWith("entry-1");
    expect(await within(dialog).findByText(copy.option.OTHER)).toBeTruthy();
    expect(within(dialog).getByText("1 uso restante")).toBeTruthy();
    expect(within(dialog).getByText("2 usos restantes")).toBeTruthy();
    expect(within(dialog).getByText("Sem usos restantes")).toBeTruthy();
    expect((within(dialog).getByRole("radio", { name: new RegExp(copy.option.DELIVERY_PROMISE) }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("sends free text within the reason limit and the Mercado Livre charset", async () => {
    mocks.send.mockResolvedValue({ providerMessageId: "m-1" });
    const dialog = await openDialog();
    fireEvent.click(await within(dialog).findByRole("radio", { name: new RegExp(copy.option.OTHER) }));
    const text = within(dialog).getByPlaceholderText(copy.textPlaceholder);

    fireEvent.change(text, { target: { value: "Oi “aspas”" } });
    expect((within(dialog).getByRole("button", { name: copy.send }) as HTMLButtonElement).disabled).toBe(true);

    fireEvent.change(text, { target: { value: "Olá! Seu pedido sai amanhã." } });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.send }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("entry-1", { optionId: "OTHER", templateId: "", text: "Olá! Seu pedido sai amanhã.", vars: [] }),
    );
    expect(mocks.toast).toHaveBeenCalledWith(copy.sent);
  });

  it("sends a template with every variable as a whole number", async () => {
    mocks.send.mockResolvedValue({ providerMessageId: "m-2" });
    const dialog = await openDialog();
    fireEvent.click(await within(dialog).findByRole("radio", { name: new RegExp(copy.option.REQUEST_VARIANTS) }));
    fireEvent.click(within(dialog).getByRole("button", { name: copy.send }));
    expect(await within(dialog).findByText(copy.local.missing_value)).toBeTruthy();
    expect(mocks.send).not.toHaveBeenCalled();

    fireEvent.change(within(dialog).getByLabelText("days"), { target: { value: "3" } });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.send }));
    await waitFor(() =>
      expect(mocks.send).toHaveBeenCalledWith("entry-1", { optionId: "REQUEST_VARIANTS", templateId: "TPL_1", text: "", vars: [{ id: "days", value: 3 }] }),
    );
  });

  it("names every refusal the server sends with its own copy", async () => {
    const dialog = await openDialog();
    fireEvent.click(await within(dialog).findByRole("radio", { name: new RegExp(copy.option.OTHER) }));
    fireEvent.change(within(dialog).getByPlaceholderText(copy.textPlaceholder), { target: { value: "Olá" } });
    for (const code of REASON_ERROR_CODES) {
      mocks.send.mockResolvedValueOnce({ error: "refused", code, status: 422 });
      fireEvent.click(within(dialog).getByRole("button", { name: copy.send }));
      expect(await within(dialog).findByText(copy.errors[code])).toBeTruthy();
    }
  });

  it("reloads the reasons when Mercado Livre says the cap was reached", async () => {
    const dialog = await openDialog();
    fireEvent.click(await within(dialog).findByRole("radio", { name: new RegExp(copy.option.OTHER) }));
    fireEvent.change(within(dialog).getByPlaceholderText(copy.textPlaceholder), { target: { value: "Olá" } });
    mocks.send.mockResolvedValueOnce({ error: "cap", code: "reason_cap_reached", status: 422 });
    fireEvent.click(within(dialog).getByRole("button", { name: copy.send }));
    await waitFor(() => expect(mocks.list).toHaveBeenCalledTimes(2));
    expect(await within(dialog).findByText(copy.errors.reason_cap_reached)).toBeTruthy();
  });

  it("says when Mercado Livre offers no reason and when the reasons fail to load", async () => {
    mocks.list.mockResolvedValueOnce({ options: [] });
    const dialog = await openDialog();
    expect(await within(dialog).findByText(copy.empty)).toBeTruthy();
  });

  it("explains a refused list", async () => {
    mocks.list.mockResolvedValueOnce({ error: "no", code: "forbidden", status: 403 });
    const dialog = await openDialog();
    expect(await within(dialog).findByText(copy.errors.forbidden)).toBeTruthy();
  });
});
