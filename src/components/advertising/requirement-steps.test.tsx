import { act, fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { LEAD_TERMS_URL, LeadTermsNotice } from "./requirement-steps";

function renderNotice(checking: boolean, onRecheck = vi.fn()) {
  render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      <LeadTermsNotice pageName="Vtk Tet" checking={checking} onRecheck={onRecheck} />
    </NextIntlClientProvider>,
  );
  return onRecheck;
}

describe("LeadTermsNotice", () => {
  it("names the page, links to Meta's terms and checks again on demand", () => {
    const onRecheck = renderNotice(false);
    expect(screen.getByText(/A Página Vtk Tet ainda não aceitou/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Aceitar termos na Meta/ }).getAttribute("href")).toBe(LEAD_TERMS_URL);
    fireEvent.click(screen.getByRole("button", { name: /Verificar novamente/ }));
    expect(onRecheck).toHaveBeenCalledTimes(1);
  });

  it("does not check twice while a check is running", () => {
    renderNotice(true);
    const button = screen.getByRole("button", { name: /Verificando/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });

  it("opens the terms in a Meta popup and checks again by itself when it closes", () => {
    vi.useFakeTimers();
    const popup = { closed: false };
    const open = vi.fn(() => popup);
    vi.stubGlobal("open", open);
    try {
      const onRecheck = renderNotice(false);
      fireEvent.click(screen.getByRole("link", { name: /Aceitar termos na Meta/ }));
      expect(open).toHaveBeenCalledWith(LEAD_TERMS_URL, expect.any(String), expect.any(String));
      popup.closed = true;
      act(() => {
        vi.advanceTimersByTime(700);
      });
      expect(onRecheck).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
      vi.unstubAllGlobals();
    }
  });
});
