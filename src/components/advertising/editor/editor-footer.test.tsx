import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";

import { EditorFooter } from "./editor-footer";

const labels = pt.adsEditor.footer;

function renderFooter(onNext: (() => void) | null) {
  render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      <EditorFooter onClose={vi.fn()} onBack={vi.fn()} onNext={onNext} finish={<button type="button">Publicar</button>} />
    </NextIntlClientProvider>,
  );
}

describe("EditorFooter", () => {
  it("offers Avançar and keeps Publicar away until the last step", () => {
    const onNext = vi.fn();
    renderFooter(onNext);
    fireEvent.click(screen.getByRole("button", { name: labels.next }));
    expect(onNext).toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Publicar" })).toBeNull();
  });

  it("never puts Publicar where Avançar was on the last step", () => {
    renderFooter(null);
    const next = screen.getByRole("button", { name: labels.next });
    const publish = screen.getByRole("button", { name: "Publicar" });
    expect(next).toBeDisabled();
    expect(next.compareDocumentPosition(publish) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });
});
