import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ElevatedContainer from "./elevated-container";

describe("ElevatedContainer", () => {
  it("lays its children out itself, so its spacing and flex classes reach them", () => {
    render(
      <ElevatedContainer data-testid="box" className="space-y-4">
        <p>first</p>
        <p>second</p>
      </ElevatedContainer>,
    );

    const box = screen.getByTestId("box");
    expect(screen.getByText("first").parentElement).toBe(box);
    expect(screen.getByText("second").parentElement).toBe(box);
  });

  it("lifts the children above a decoration", () => {
    render(
      <ElevatedContainer data-testid="box" accentGlow>
        <p>content</p>
      </ElevatedContainer>,
    );

    const lifted = screen.getByText("content").parentElement;
    expect(lifted).not.toBe(screen.getByTestId("box"));
    expect(lifted).toHaveClass("relative", "z-10");
  });

  it("keeps a content wrapper when the caller styles one", () => {
    render(
      <ElevatedContainer data-testid="box" contentClassName="grid gap-2">
        <p>content</p>
      </ElevatedContainer>,
    );

    expect(screen.getByText("content").parentElement).toHaveClass("grid", "gap-2");
  });
});
