import { render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";

import { ScreenLoader } from "./screen-loader";

function renderLoader(ui: React.ReactElement) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {ui}
    </NextIntlClientProvider>,
  );
}

describe("ScreenLoader", () => {
  it("announces itself as a busy status with the localized default label", () => {
    renderLoader(<ScreenLoader />);
    const status = screen.getByRole("status");
    expect(status).toHaveAttribute("aria-busy", "true");
    expect(status).toHaveTextContent(ptMessages.screenLoader.label);
  });

  it("uses a caller label when one is given", () => {
    renderLoader(<ScreenLoader label="Carregando agentes…" />);
    expect(screen.getByRole("status")).toHaveTextContent("Carregando agentes…");
  });

  it("keeps the trace art out of the accessibility tree", () => {
    const { container } = renderLoader(<ScreenLoader />);
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("fills the content viewport by default, and the window, its parent or a row when asked", () => {
    renderLoader(
      <>
        <ScreenLoader label="screen" />
        <ScreenLoader fit="fill" label="fill" />
        <ScreenLoader fit="inline" label="inline" />
        <ScreenLoader fit="viewport" label="viewport" />
      </>,
    );
    const [screenFit, fillFit, inlineFit, viewportFit] = screen.getAllByRole("status");
    expect(screenFit).toHaveAttribute("data-fit", "screen");
    expect(fillFit).toHaveAttribute("data-fit", "fill");
    expect(inlineFit).toHaveAttribute("data-fit", "inline");
    expect(viewportFit).toHaveAttribute("data-fit", "viewport");
  });

  it("ships the label in every locale", async () => {
    for (const locale of ["pt", "en", "de", "es"]) {
      const messages = (await import(`@/i18n/messages/${locale}.json`)).default;
      expect(messages.screenLoader?.label, locale).toBeTruthy();
    }
  });
});
