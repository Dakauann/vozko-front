import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { Notice } from "../notice";

describe("Notice", () => {
  it("draws on the card ground and spends the tone only on the mark", () => {
    render(
      <Notice tone="warning" title="Lista pausada">
        Ninguém pega novos contatos.
      </Notice>,
    );
    const notice = screen.getByRole("status");
    expect(notice).toHaveClass("notice", "notice-warning");
    expect(screen.getByText("Lista pausada")).toHaveClass("text-foreground");
    expect(screen.getByText("Lista pausada").closest(".notice-mark")).toBeNull();
    expect(notice.querySelector("svg")?.closest(".notice-mark")).not.toBeNull();
    expect(notice.className).not.toMatch(/bg-/);
  });

  it("announces a fault as an alert", () => {
    render(<Notice tone="fault">Falhou</Notice>);
    expect(screen.getByRole("alert")).toHaveClass("notice-fault");
  });

  it("takes the glyph the caller gives", () => {
    render(
      <Notice tone="healthy" icon={<svg data-testid="own-glyph" />}>
        Encerrada
      </Notice>,
    );
    expect(screen.getByTestId("own-glyph").closest(".notice-mark")).not.toBeNull();
    expect(screen.getByRole("status")).toHaveClass("notice-healthy");
  });
});
