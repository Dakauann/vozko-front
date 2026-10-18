import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { nextIntlInPortuguese } from "@/test/next-intl-pt";

vi.mock("next-intl", () => nextIntlInPortuguese());

import { TemplateButtonBranchField } from "./template-button-branch";

const t = ptMessages.workflowsPage.templateButton;

function label(position: number) {
  return t.position.replace("{position}", String(position));
}

describe("TemplateButtonBranchField", () => {
  it("turns the condition into a template button branch on the chosen button", () => {
    const onApply = vi.fn();
    render(<TemplateButtonBranchField config={{ variable: "", operator: "eq", value: "" }} onApply={onApply} />);
    expect(screen.getByText(t.title)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: label(2) }));
    expect(onApply).toHaveBeenCalledWith({ variable: "{{selected_option_id}}", operator: "eq", value: "template_button:1" });
  });

  it("shows which button the condition already follows", () => {
    render(<TemplateButtonBranchField config={{ variable: "{{selected_option_id}}", operator: "eq", value: "template_button:0" }} onApply={vi.fn()} />);
    expect(screen.getByRole("button", { name: label(1) })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: label(2) })).toHaveAttribute("aria-pressed", "false");
    expect(screen.getByText(t.active.replace("{position}", "1"))).toBeInTheDocument();
  });

  it("marks no button for any other condition", () => {
    render(<TemplateButtonBranchField config={{ variable: "{{message}}", operator: "eq", value: "oi" }} onApply={vi.fn()} />);
    expect(screen.getAllByRole("button").every((button) => button.getAttribute("aria-pressed") === "false")).toBe(true);
    expect(screen.queryByText(t.active.replace("{position}", "1"))).toBeNull();
  });
});
