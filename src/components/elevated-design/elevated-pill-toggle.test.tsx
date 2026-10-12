import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ElevatedPillToggle } from "./elevated-pill-toggle";

describe("ElevatedPillToggle accessible names", () => {
  it("names an option by its fuller title when the title still contains the visible label", () => {
    render(<ElevatedPillToggle value="square" onChange={vi.fn()} options={[{ value: "square", label: "1:1", title: "Quadrado 1:1" }]} />);
    expect(screen.getByRole("button", { name: "Quadrado 1:1" })).toBeTruthy();
  });

  it("keeps the visible label as the name when the title only explains why the option is disabled", () => {
    render(
      <ElevatedPillToggle
        value="1h"
        onChange={vi.fn()}
        options={[
          { value: "1h", label: "Em 1 hora" },
          { value: "tomorrow", label: "Amanhã, 09:00", disabled: true, title: "Este horário fica depois de a janela fechar" },
        ]}
      />,
    );
    const tomorrow = screen.getByRole("button", { name: "Amanhã, 09:00" });
    expect(tomorrow).toBeDisabled();
    expect(tomorrow.getAttribute("title")).toBe("Este horário fica depois de a janela fechar");
  });

  it("names an icon-only option by its title", () => {
    render(<ElevatedPillToggle value="grid" onChange={vi.fn()} options={[{ value: "grid", label: <svg />, title: "Grade" }]} />);
    expect(screen.getByRole("button", { name: "Grade" })).toBeTruthy();
  });
});
