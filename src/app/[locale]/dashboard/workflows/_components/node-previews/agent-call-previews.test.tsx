import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

import { renderActionContentPreview } from "./actions";

function show(type: string, config: Record<string, unknown>) {
  render(<>{renderActionContentPreview(type as Parameters<typeof renderActionContentPreview>[0], config)}</>);
}

describe("agent-call trigger preview", () => {
  it("shows the declared inputs with required ones marked", () => {
    show("trigger_agent_call", { inputs: [{ name: "cpf", required: true }, { name: "nome" }] });
    expect(screen.getAllByTestId("agent-call-input-chip").map((chip) => chip.textContent)).toEqual(["cpf*", "nome"]);
  });

  it("caps the chips and counts the rest", () => {
    show("trigger_agent_call", { inputs: ["a", "b", "c", "d", "e", "f"].map((name) => ({ name })) });
    expect(screen.getAllByTestId("agent-call-input-chip")).toHaveLength(4);
    expect(screen.getByText('more {"count":2}')).toBeInTheDocument();
  });

  it("says the agent sends no fields when none are declared", () => {
    show("trigger_agent_call", { inputs: [] });
    expect(screen.getByText("noInputs")).toBeInTheDocument();
  });
});

describe("reply to agent preview", () => {
  it("lists the fields handed back to the agent", () => {
    show("action_reply_to_agent", { fields: [{ key: "status", value: "{{node.n5.status}}" }] });
    expect(screen.getAllByTestId("reply-to-agent-field").map((row) => row.textContent)).toEqual(["status{{node.n5.status}}"]);
  });

  it("shows the empty state without fields", () => {
    show("action_reply_to_agent", { fields: [] });
    expect(screen.getByText("empty")).toBeInTheDocument();
  });
});
