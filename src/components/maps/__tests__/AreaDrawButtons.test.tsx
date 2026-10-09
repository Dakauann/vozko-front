import { describe, expect, it, vi } from "vitest";
import { fireEvent, screen, within } from "@testing-library/react";

import { AreaDrawButtons } from "../AreaDrawButtons";
import { renderInPortuguese } from "./intl";

describe("AreaDrawButtons", () => {
  it("offers polygon, rectangle and circle as keyboard reachable toggle buttons", () => {
    renderInPortuguese(<AreaDrawButtons activeMode={null} onSelectMode={vi.fn()} onCancel={vi.fn()} />);
    const toolbar = screen.getByRole("toolbar", { name: "Desenhar área" });
    const buttons = within(toolbar).getAllByRole("button");
    expect(buttons.map((button) => button.textContent)).toEqual(["Polígono", "Retângulo", "Raio"]);
    for (const button of buttons) {
      expect(button).toHaveAttribute("type", "button");
      expect(button).toHaveAttribute("aria-pressed", "false");
      expect(button.tabIndex).toBe(0);
    }
  });

  it("selects a mode", () => {
    const onSelectMode = vi.fn();
    renderInPortuguese(<AreaDrawButtons activeMode={null} onSelectMode={onSelectMode} onCancel={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Retângulo" }));
    expect(onSelectMode).toHaveBeenCalledWith("rectangle");
  });

  it("marks the active mode, shows how to draw and offers cancel", () => {
    const onCancel = vi.fn();
    renderInPortuguese(<AreaDrawButtons activeMode="polygon" onSelectMode={vi.fn()} onCancel={onCancel} />);
    expect(screen.getByRole("button", { name: "Polígono" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("toolbar")).toHaveAccessibleDescription(/Clique para marcar cada canto/);
    fireEvent.click(screen.getByRole("button", { name: "Cancelar desenho" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("cancels when the active mode is pressed again", () => {
    const onCancel = vi.fn();
    const onSelectMode = vi.fn();
    renderInPortuguese(<AreaDrawButtons activeMode="circle" onSelectMode={onSelectMode} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "Raio" }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onSelectMode).not.toHaveBeenCalled();
  });

  it("cancels with Escape from the toolbar", () => {
    const onCancel = vi.fn();
    renderInPortuguese(<AreaDrawButtons activeMode="rectangle" onSelectMode={vi.fn()} onCancel={onCancel} />);
    fireEvent.keyDown(screen.getByRole("button", { name: "Retângulo" }), { key: "Escape" });
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("has no cancel button while idle", () => {
    renderInPortuguese(<AreaDrawButtons activeMode={null} onSelectMode={vi.fn()} onCancel={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Cancelar desenho" })).not.toBeInTheDocument();
  });

  it("disables the modes until the drawing tools are ready", () => {
    renderInPortuguese(<AreaDrawButtons activeMode={null} onSelectMode={vi.fn()} onCancel={vi.fn()} disabled />);
    for (const button of screen.getAllByRole("button")) expect(button).toBeDisabled();
  });

  it("announces an error in place of the hint", () => {
    renderInPortuguese(<AreaDrawButtons activeMode={null} onSelectMode={vi.fn()} onCancel={vi.fn()} error="Área inválida" />);
    expect(screen.getByText("Área inválida")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByRole("toolbar")).toHaveAccessibleDescription("Área inválida");
  });
});
