import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { nextIntlInPortuguese } from "@/test/next-intl-pt";

vi.mock("next-intl", () => nextIntlInPortuguese());

import { renderActionContentPreview } from "./actions";
import { renderConditionContentPreview } from "./conditions";

const consent = ptMessages.workflowsPage.consent;
const button = ptMessages.workflowsPage.templateButton;

function show(node: React.ReactNode) {
  return render(<>{node}</>);
}

describe("consent node preview", () => {
  it("says the node records consent and shows its purpose", () => {
    show(renderActionContentPreview("action_consent", { mode: "registrar", purpose: "ofertas" }));
    expect(screen.getByText(consent.registrar)).toBeInTheDocument();
    expect(screen.getByText(consent.purpose.replace("{purpose}", "ofertas"))).toBeInTheDocument();
  });

  it("says the node withdraws consent and shows its note", () => {
    show(renderActionContentPreview("action_consent", { mode: "retirar", note: "pedido por telefone", purpose: "ignorado" }));
    expect(screen.getByText(consent.retirar)).toBeInTheDocument();
    expect(screen.getByText(consent.note.replace("{note}", "pedido por telefone"))).toBeInTheDocument();
    expect(screen.queryByText(/ignorado/)).toBeNull();
  });

  it("asks for a mode when none was chosen, since nothing is preselected", () => {
    show(renderActionContentPreview("action_consent", { mode: "" }));
    expect(screen.getByText(consent.noMode)).toBeInTheDocument();
  });
});

describe("template button branch preview", () => {
  it("names the template button a condition routes on, counting from 1", () => {
    show(renderConditionContentPreview("condition_branch", { variable: "{{selected_option_id}}", operator: "eq", value: "template_button:0" }));
    expect(screen.getByText(button.preview.replace("{position}", "1"))).toBeInTheDocument();
  });

  it("keeps the plain condition preview for any other condition", () => {
    show(renderConditionContentPreview("condition_branch", { variable: "{{message}}", operator: "eq", value: "oi" }));
    expect(screen.queryByText(/template/)).toBeNull();
    expect(screen.getByText(/\{\{message\}\}/)).toBeInTheDocument();
  });
});
