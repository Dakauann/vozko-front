import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import de from "@/i18n/messages/de.json";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";
import pt from "@/i18n/messages/pt.json";
import type { ConversationMessage } from "@/lib/conversations/types";
import { EMAIL_HTML_ERROR_CODES, type EmailHTMLResult } from "@/lib/email/html-view";

import { EMAIL_FRAME_SANDBOX, EmailMessageBody } from "./EmailMessageBody";

const fetchEmailHTML = vi.fn<(entryId: string, messageId: string, showImages: boolean) => Promise<EmailHTMLResult>>();

vi.mock("@/lib/email/html-view", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/email/html-view")>();
  return { ...actual, fetchEmailHTML: (...args: [string, string, boolean]) => fetchEmailHTML(...args) };
});

function email(metadata: Record<string, unknown>): ConversationMessage {
  return {
    id: "m-1",
    entry_id: "conv-1",
    entry_type: "email",
    channel: "email",
    message_type: "user_message",
    direction: "INBOUND",
    from: "ana@cliente.test",
    to: "loja@loja.test",
    text: "Oi, segue o pedido em anexo.",
    metadata,
    created_at: "2026-10-22T12:00:00Z",
    updated_at: "2026-10-22T12:00:00Z",
  } as unknown as ConversationMessage;
}

function wrap({ children }: { children: ReactNode }) {
  return (
    <NextIntlClientProvider locale="pt" messages={pt} timeZone="UTC">
      {children}
    </NextIntlClientProvider>
  );
}

const copy = pt.crmConversation.emailView;

beforeEach(() => fetchEmailHTML.mockReset());

describe("EmailMessageBody", () => {
  it("keeps the plain text when the email has no html", () => {
    render(<EmailMessageBody message={email({ email_subject: "Pedido" })} fallback={<p>texto simples</p>} />, { wrapper: wrap });
    expect(screen.getByText("texto simples")).toBeInTheDocument();
    expect(screen.queryByText(copy.fullEmail)).not.toBeInTheDocument();
  });

  it("shows the subject and a preview, and opens the email in a sandbox without scripts or the app origin", async () => {
    fetchEmailHTML.mockResolvedValue({ view: { html: "<p>Pedido completo</p>", text: "Pedido", has_html: true, inbound: false, images_blocked: false } });
    render(<EmailMessageBody message={email({ email_subject: "Pedido 42", email_html_media_id: "h-1" })} fallback={null} />, { wrapper: wrap });

    expect(screen.getByText("Pedido 42")).toBeInTheDocument();
    expect(screen.getByText("Oi, segue o pedido em anexo.")).toBeInTheDocument();
    fireEvent.click(screen.getByText(copy.fullEmail));

    const frame = await screen.findByTitle(copy.frameTitle);
    const sandbox = frame.getAttribute("sandbox") ?? "";
    expect(sandbox).toBe(EMAIL_FRAME_SANDBOX);
    expect(sandbox).not.toContain("allow-scripts");
    expect(sandbox).not.toContain("allow-same-origin");
    expect(frame.getAttribute("srcdoc")).toContain("<p>Pedido completo</p>");
    expect(fetchEmailHTML).toHaveBeenCalledWith("conv-1", "m-1", false);
  });

  it("blocks the remote images of a received email until the operator asks for them", async () => {
    fetchEmailHTML
      .mockResolvedValueOnce({ view: { html: "<p>oi</p>", text: "oi", has_html: true, inbound: true, images_blocked: true } })
      .mockResolvedValueOnce({ view: { html: "<p>oi</p><img src=\"https://cdn.test/a.png\">", text: "oi", has_html: true, inbound: true, images_blocked: false } });
    render(<EmailMessageBody message={email({ email_html_media_id: "h-1" })} fallback={null} />, { wrapper: wrap });

    fireEvent.click(screen.getByText(copy.fullEmail));
    expect(await screen.findByText(copy.imagesBlocked)).toBeInTheDocument();
    expect(screen.getByTitle(copy.frameTitle).getAttribute("srcdoc")).toContain("img-src data:;");

    fireEvent.click(screen.getByText(copy.showImages));
    await waitFor(() => expect(fetchEmailHTML).toHaveBeenLastCalledWith("conv-1", "m-1", true));
    await waitFor(() => expect(screen.queryByText(copy.imagesBlocked)).not.toBeInTheDocument());
    expect(screen.getByTitle(copy.frameTitle).getAttribute("srcdoc")).toContain("https://cdn.test/a.png");
  });

  it("explains a refusal by its code in all four languages", async () => {
    fetchEmailHTML.mockResolvedValue({ error: "conversation_not_found" });
    render(<EmailMessageBody message={email({ email_html_media_id: "h-1" })} fallback={null} />, { wrapper: wrap });
    fireEvent.click(screen.getByText(copy.fullEmail));
    expect(await screen.findByText(copy.errors.conversation_not_found)).toBeInTheDocument();

    for (const catalog of [pt, en, es, de]) {
      const errors = catalog.crmConversation.emailView.errors as Record<string, string>;
      for (const code of [...EMAIL_HTML_ERROR_CODES, "default"]) {
        expect(errors[code]?.trim()).toBeTruthy();
        expect(errors[code]).not.toMatch(/[–—]/);
      }
    }
  });
});
