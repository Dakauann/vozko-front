import { fireEvent, render, screen, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { stepNeighbours, stepOf } from "@/lib/campaign-wizard/steps";

import { WizardFooterNext, WizardNav } from "../WizardNav";
import { WizardStepBar } from "../WizardStepBar";

const STEPS = ["config", "message", "audience", "review", "send"] as const;
type Step = (typeof STEPS)[number];
const LABELS: Record<Step, string> = { config: "Configuração", message: "Mensagem", audience: "Público", review: "Revisão", send: "Envio" };
const labelOf = (step: Step) => LABELS[step];
const nextLabelOf = (step: Step) => `Ir para ${LABELS[step]}`;

function wrap(node: ReactNode) {
  return render(
    <NextIntlClientProvider locale="pt" messages={ptMessages}>
      {node}
    </NextIntlClientProvider>,
  );
}

describe("stepNeighbours", () => {
  it("finds the previous and next steps", () => {
    expect(stepNeighbours(STEPS, "config")).toEqual({ previous: null, next: "message" });
    expect(stepNeighbours(STEPS, "review")).toEqual({ previous: "audience", next: "send" });
    expect(stepNeighbours(STEPS, "send")).toEqual({ previous: "review", next: null });
  });

  it("reads a step from the address or falls back", () => {
    expect(stepOf(STEPS, "audience", "config")).toBe("audience");
    expect(stepOf(STEPS, "bogus", "config")).toBe("config");
    expect(stepOf(STEPS, null, "config")).toBe("config");
  });
});

describe("WizardStepBar", () => {
  it("marks the current step and numbers the rest", () => {
    const onSelect = vi.fn();
    wrap(<WizardStepBar steps={STEPS} current="audience" labelOf={labelOf} onSelect={onSelect} enabled />);
    const nav = screen.getByRole("navigation", { name: "Etapas da campanha" });
    expect(within(nav).getByRole("button", { name: /Público/ })).toHaveAttribute("aria-current", "step");
    expect(within(within(nav).getByRole("button", { name: "Revisão" })).getByText("4")).toBeInTheDocument();
    fireEvent.click(within(nav).getByRole("button", { name: /Envio/ }));
    expect(onSelect).toHaveBeenCalledWith("send");
  });

  it("only allows the current step until the draft exists", () => {
    wrap(<WizardStepBar steps={STEPS} current="config" labelOf={labelOf} onSelect={vi.fn()} enabled={false} />);
    expect(screen.getByRole("button", { name: /Configuração/ })).toBeEnabled();
    expect(screen.getByRole("button", { name: /Mensagem/ })).toBeDisabled();
  });
});

describe("WizardNav", () => {
  it("goes back and forward", () => {
    const onGo = vi.fn();
    wrap(<WizardNav steps={STEPS} current="message" labelOf={labelOf} nextLabelOf={nextLabelOf} onGo={onGo} enabled />);
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    fireEvent.click(screen.getByRole("button", { name: "Ir para Público" }));
    expect(onGo.mock.calls).toEqual([["config"], ["audience"]]);
  });

  it("has no next on the last step and no back on the first", () => {
    const { unmount } = wrap(<WizardNav steps={STEPS} current="send" labelOf={labelOf} nextLabelOf={nextLabelOf} onGo={vi.fn()} enabled />);
    expect(screen.queryByRole("button", { name: /Ir para/ })).not.toBeInTheDocument();
    unmount();
    wrap(<WizardNav steps={STEPS} current="config" labelOf={labelOf} nextLabelOf={nextLabelOf} onGo={vi.fn()} enabled={false} />);
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ir para Mensagem" })).toBeDisabled();
  });

  it("renders the footer next only before the last step", () => {
    const onGo = vi.fn();
    const { unmount } = wrap(<WizardFooterNext steps={STEPS} current="review" nextLabelOf={nextLabelOf} onGo={onGo} enabled />);
    fireEvent.click(screen.getByRole("button", { name: "Ir para Envio" }));
    expect(onGo).toHaveBeenCalledWith("send");
    unmount();
    wrap(<WizardFooterNext steps={STEPS} current="send" nextLabelOf={nextLabelOf} onGo={onGo} enabled />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
