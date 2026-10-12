import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("./model-picker-sheet", () => ({ ModelPickerSheet: () => null }));

import { AIModelSelector } from "./ai-model-selector";

const pricing = [{ id: "openai/gpt-4o", name: "GPT-4o", promptPrice: 2.5, completionPrice: 10 }];

afterEach(cleanup);

describe("AIModelSelector", () => {
  it("shows its label above the field by default", () => {
    render(<AIModelSelector label="Model" value="openai/gpt-4o" models={["openai/gpt-4o"]} modelPricing={pricing} />);
    expect(screen.getByText("Model").className).not.toContain("sr-only");
    expect(screen.getByText("$2.50 · $10.00 /M")).toBeTruthy();
  });

  it("sits on a toolbar row at icon button height with the label kept for screen readers", () => {
    render(<AIModelSelector variant="toolbar" label="Model" value="openai/gpt-4o" models={["openai/gpt-4o"]} modelPricing={pricing} />);
    const trigger = screen.getByRole("button", { name: /Model\s*GPT-4o/ });
    expect(trigger.className).toContain("h-8");
    expect(screen.getByText("Model").className).toContain("sr-only");
    expect(trigger.getAttribute("title")).toBe("GPT-4o · $2.50 · $10.00 /M");
    expect(screen.queryByText("$2.50 · $10.00 /M")).toBeNull();
  });
});
