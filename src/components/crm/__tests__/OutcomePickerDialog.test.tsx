import { fireEvent, render, screen } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";

import pt from "@/i18n/messages/pt.json";
import type { PendingOutcomeRequest } from "@/lib/conversations/types";

import { OutcomePickerDialog } from "../OutcomePickerDialog";
import { OutcomeOptions } from "../OutcomeOptions";

const request: PendingOutcomeRequest = {
  entryId: "e1",
  entryType: "whatsapp",
  status: "finished",
  message: "",
  outcomes: [
    { code: "venda", label: "Venda", isDurable: true, position: 1 },
    { code: "sem_interesse", label: "Sem interesse", isDurable: false, position: 2 },
  ],
};

function renderIntl(node: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={pt}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("OutcomePickerDialog", () => {
  beforeEach(() => window.localStorage.clear());

  it("starts on the outcome chosen last time and confirms the one picked", () => {
    window.localStorage.setItem("vozko:last-outcome-code", "sem_interesse");
    const onConfirm = vi.fn();
    renderIntl(<OutcomePickerDialog request={request} onConfirm={onConfirm} onCancel={vi.fn()} />);

    expect(screen.getByRole("radio", { name: "Sem interesse" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: /Venda/ }));
    fireEvent.click(screen.getByRole("button", { name: "Encerrar conversa" }));

    expect(onConfirm).toHaveBeenCalledWith("e1", "whatsapp", "finished", "venda");
    expect(window.localStorage.getItem("vozko:last-outcome-code")).toBe("venda");
  });
});

describe("OutcomeOptions", () => {
  it("offers the outcomes as one radio group and reports the pick", () => {
    const onSelect = vi.fn();
    renderIntl(<OutcomeOptions label="Como foi?" layout="chips" outcomes={request.outcomes} selected="venda" onSelect={onSelect} />);

    expect(screen.getByRole("radiogroup", { name: "Como foi?" })).toBeInTheDocument();
    expect(screen.getByRole("radio", { name: "Venda" })).toHaveAttribute("aria-checked", "true");
    fireEvent.click(screen.getByRole("radio", { name: "Sem interesse" }));
    expect(onSelect).toHaveBeenCalledWith("sem_interesse");
  });

  it("marks the pick with the edge token and a neutral ground for list rows, and every option shows focus", () => {
    const { unmount } = renderIntl(<OutcomeOptions label="Como foi?" layout="chips" outcomes={request.outcomes} selected="venda" onSelect={vi.fn()} />);
    expect(screen.getByRole("radio", { name: "Venda" })).toHaveClass("border-primary-edge", "bg-primary");
    unmount();

    renderIntl(<OutcomeOptions label="Resultado" outcomes={request.outcomes} selected="venda" onSelect={vi.fn()} />);
    const picked = screen.getByRole("radio", { name: /Venda/ });
    expect(picked).toHaveClass("border-primary-edge", "bg-muted", "focus-visible:ring-2");
    expect(picked.className).not.toMatch(/bg-primary\//);
    expect(screen.getByRole("radio", { name: "Sem interesse" })).toHaveClass("focus-visible:ring-2");
  });

  it("refuses picks while disabled", () => {
    const onSelect = vi.fn();
    renderIntl(<OutcomeOptions label="Como foi?" layout="chips" outcomes={request.outcomes} selected="" onSelect={onSelect} disabled />);
    fireEvent.click(screen.getByRole("radio", { name: "Venda" }));
    expect(onSelect).not.toHaveBeenCalled();
  });
});
