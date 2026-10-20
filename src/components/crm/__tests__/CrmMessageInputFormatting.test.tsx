import { describe, expect, it, vi } from "vitest";
import { createRef } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import CrmMessageInput, { type ComposerControl } from "../CrmMessageInput";
import ptMessages from "@/i18n/messages/pt.json";

vi.mock("@/app/actions/conversations", () => ({
  uploadConversationMediaAction: vi.fn(),
}));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ can: () => true }),
}));

const composerTranslations = ptMessages.whatsappCampaignsPage.detail.crm.input;

function renderComposer(control = createRef<ComposerControl>()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <CrmMessageInput
        entryType="whatsapp"
        entryId="entry-1"
        onSend={vi.fn()}
        onSendMedia={vi.fn()}
        onTyping={vi.fn()}
        windowOpen
        windowExpiresAt={null}
        translations={composerTranslations}
        controlRef={control}
      />
    </NextIntlClientProvider>,
  );
  return screen.getByPlaceholderText(composerTranslations.placeholder) as HTMLTextAreaElement;
}

function typeAndSelect(textarea: HTMLTextAreaElement, value: string, start: number, end: number) {
  fireEvent.change(textarea, { target: { value } });
  textarea.setSelectionRange(start, end);
}

describe("WhatsApp formatting from the keyboard", () => {
  it("wraps the selection in bold markers on Ctrl+B", () => {
    const textarea = renderComposer();
    typeAndSelect(textarea, "pedido pronto", 7, 13);
    fireEvent.keyDown(textarea, { key: "b", ctrlKey: true });
    expect(textarea).toHaveValue("pedido *pronto*");
  });

  it("uses italic and strike markers for Ctrl+I and Ctrl+Shift+X", () => {
    const textarea = renderComposer();
    typeAndSelect(textarea, "oi", 0, 2);
    fireEvent.keyDown(textarea, { key: "i", ctrlKey: true });
    expect(textarea).toHaveValue("_oi_");
    textarea.setSelectionRange(0, 4);
    fireEvent.keyDown(textarea, { key: "X", ctrlKey: true, shiftKey: true });
    expect(textarea).toHaveValue("~_oi_~");
  });

  it("previews the formatted text and goes back to editing", () => {
    const textarea = renderComposer();
    fireEvent.change(textarea, { target: { value: "*pronto*" } });
    fireEvent.click(screen.getByRole("button", { name: ptMessages.crmComposer.preview }));
    const preview = screen.getByRole("region", { name: ptMessages.crmComposer.previewLabel });
    expect(preview.querySelector("strong")).toHaveTextContent("pronto");
    fireEvent.click(screen.getByRole("button", { name: ptMessages.crmComposer.edit }));
    expect(screen.queryByRole("region", { name: ptMessages.crmComposer.previewLabel })).toBeNull();
  });

  it("lets the page put the cursor back in the composer", () => {
    const control = createRef<ComposerControl>();
    const textarea = renderComposer(control);
    control.current?.focus();
    expect(document.activeElement).toBe(textarea);
  });
});
