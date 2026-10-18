import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { FeatureExplainer } from "./feature-explainer";

const steps = [
  { title: "Envia uma onda", text: "Uma parte pequena da lista sai primeiro." },
  { title: "Observa a Meta", text: "Espera os sinais de saúde chegarem." },
  { title: "Decide a próxima", text: "Cresce, reduz ou segura." },
];

function renderExplainer() {
  return render(
    <FeatureExplainer name="Disparo Inteligente" tagline="Envio em ondas" steps={steps} footnote="Campanhas sem Disparo Inteligente enviam como hoje." visual={<svg data-testid="visual" />}>
      <button type="button">Como funciona</button>
    </FeatureExplainer>,
  );
}

describe("FeatureExplainer", () => {
  it("stays closed until the trigger is used", () => {
    renderExplainer();
    expect(screen.queryByText("Envio em ondas")).not.toBeInTheDocument();
  });

  it("opens on a tap with the visual, the steps in order and the footnote", () => {
    renderExplainer();

    fireEvent.click(screen.getByRole("button", { name: "Como funciona" }));

    const card = screen.getByRole("dialog", { name: "Disparo Inteligente" });
    expect(within(card).getByTestId("visual")).toBeInTheDocument();
    expect(within(card).getByText("Envio em ondas")).toBeInTheDocument();
    expect(within(card).getAllByRole("listitem").map((item) => item.textContent)).toEqual(steps.map((step, index) => `${index + 1}${step.title}${step.text}`));
    expect(within(card).getByText("Campanhas sem Disparo Inteligente enviam como hoje.")).toBeInTheDocument();
  });

  it("opens from the keyboard", async () => {
    renderExplainer();

    fireEvent.focus(screen.getByRole("button", { name: "Como funciona" }));

    expect(await screen.findByRole("dialog", { name: "Disparo Inteligente" })).toBeInTheDocument();
  });

  it("lifts the card out of the page so later sections never paint over it", () => {
    const { container } = renderExplainer();

    fireEvent.click(screen.getByRole("button", { name: "Como funciona" }));

    const card = screen.getByRole("dialog", { name: "Disparo Inteligente" });
    expect(container.contains(card)).toBe(false);
    expect(document.body.contains(card)).toBe(true);
  });
});
