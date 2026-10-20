import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";

import type { PeriodLimitReport } from "@/lib/period-limit/period-limit";

import { PeriodLimitDialog } from "./period-limit-dialog";
import { PeriodLimitNotice } from "./period-limit-notice";

vi.mock("@/i18n/routing", () => ({
  Link: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

function withMessages(node: ReactNode, locale: keyof typeof LOCALES = "pt") {
  return (
    <NextIntlClientProvider locale={locale} messages={LOCALES[locale]}>
      {node}
    </NextIntlClientProvider>
  );
}

const LOCALES = { pt: ptMessages, en: enMessages, es: esMessages, de: deMessages } as const;

function openDialog(report?: PeriodLimitReport) {
  const onUseWindow = vi.fn();
  const onClose = vi.fn();
  render(withMessages(<PeriodLimitDialog open limit={92} share={92 / 273} report={report} onUseWindow={onUseWindow} onClose={onClose} />));
  return { dialog: screen.getByRole("dialog", { name: "Período maior que esta visão" }), onUseWindow, onClose };
}

describe("PeriodLimitDialog", () => {
  it("says the limit and offers the report first, then the window", () => {
    const onRequest = vi.fn();
    const { dialog, onUseWindow } = openDialog({ state: "idle", onRequest });

    expect(within(dialog).getByText("Esta visão mostra até 92 dias")).toBeInTheDocument();
    const choices = within(dialog).getAllByRole("listitem").map((item) => item.textContent);
    expect(choices).toEqual(["1Gerar relatórioO período inteiro em um arquivo", "2Ver os últimos 92 diasNesta tela, agora"]);

    fireEvent.click(within(dialog).getByRole("button", { name: /Gerar relatório/ }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog).getByRole("button", { name: /Ver os últimos 92 dias/ }));
    expect(onUseWindow).toHaveBeenCalledTimes(1);
  });

  it("never offers a report that cannot be produced", () => {
    const { dialog } = openDialog();

    expect(within(dialog).queryByText("Gerar relatório")).not.toBeInTheDocument();
    expect(within(dialog).getAllByRole("listitem")).toHaveLength(1);
  });

  it("keeps the period on cancel and on Escape", () => {
    const { dialog, onClose, onUseWindow } = openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancelar" }));
    fireEvent.keyDown(dialog, { key: "Escape" });

    expect(onClose).toHaveBeenCalledTimes(2);
    expect(onUseWindow).not.toHaveBeenCalled();
  });

  it("tells where a requested report will be ready", () => {
    const { dialog } = openDialog({ state: "queued", onRequest: vi.fn() });

    expect(within(dialog).getByText("Relatório pedido")).toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Abrir Relatórios" })).toHaveAttribute("href", "/dashboard/reports");
  });

  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    it(`has its texts in ${locale}, written without dashes`, () => {
      const texts = JSON.stringify((LOCALES[locale] as { periodLimit: unknown }).periodLimit);
      expect(texts).toBeTruthy();
      expect(/[\u2013\u2014]/.test(texts)).toBe(false);
      render(withMessages(<PeriodLimitDialog open limit={92} share={0.46} report={{ state: "idle", onRequest: vi.fn() }} onUseWindow={vi.fn()} onClose={vi.fn()} />, locale));
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
  }
});

describe("PeriodLimitNotice", () => {
  it("is one short line with the same two choices", () => {
    const onRequest = vi.fn();
    const onUseWindow = vi.fn();
    render(withMessages(<PeriodLimitNotice limit={92} report={{ state: "idle", onRequest }} onUseWindow={onUseWindow} />));

    const line = screen.getByRole("status");
    expect(within(line).getByText("Esta visão mostra até 92 dias.")).toBeInTheDocument();
    fireEvent.click(within(line).getByRole("button", { name: "Gerar relatório" }));
    fireEvent.click(within(line).getByRole("button", { name: "Ver os últimos 92 dias" }));
    expect(onRequest).toHaveBeenCalledTimes(1);
    expect(onUseWindow).toHaveBeenCalledTimes(1);
  });

  it("drops the report choice where no report exists", () => {
    render(withMessages(<PeriodLimitNotice limit={92} onUseWindow={vi.fn()} />));
    expect(screen.queryByRole("button", { name: "Gerar relatório" })).not.toBeInTheDocument();
  });
});

describe("PeriodLimitDialog for long windows", () => {
  const tenYears = { pt: "Ver os últimos 10 anos", en: "See the last 10 years", es: "Ver los últimos 10 años", de: "Die letzten 10 Jahre ansehen" };

  for (const locale of Object.keys(LOCALES) as (keyof typeof LOCALES)[]) {
    it(`says ten years instead of 3650 days in ${locale}`, () => {
      render(withMessages(<PeriodLimitDialog open limit={3650} share={0.5} onUseWindow={vi.fn()} onClose={vi.fn()} />, locale));
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByRole("button", { name: new RegExp(tenYears[locale]) })).toBeInTheDocument();
      expect(within(dialog).queryByText(/3650/)).not.toBeInTheDocument();
    });
  }

  it("says the same in the short notice line", () => {
    render(withMessages(<PeriodLimitNotice limit={3650} onUseWindow={vi.fn()} />));
    expect(screen.getByText("Esta visão mostra até 10 anos.")).toBeInTheDocument();
  });
});

describe("PeriodLimitDialog in months", () => {
  it("speaks of months for a view limited in months", () => {
    render(withMessages(<PeriodLimitDialog open limit={37} unit="months" share={0.8} onUseWindow={vi.fn()} onClose={vi.fn()} />));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Esta visão mostra até 37 meses")).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Ver os últimos 37 meses/ })).toBeInTheDocument();
  });
});
