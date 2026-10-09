import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

const definitions = vi.hoisted(() => ({
  state: { definitions: [] as CustomFieldDefinition[], loading: false, failed: false, reload: vi.fn() },
}));
vi.mock("@/hooks/use-lead-field-definitions", () => ({
  useLeadFieldDefinitions: () => definitions.state,
}));

import { UpdateLeadFieldKeys } from "./update-lead-config";

function definition(key: string, label: string, sensitive = false): CustomFieldDefinition {
  return {
    id: `def-${key}`,
    workspaceId: "ws-1",
    objectType: "lead",
    key,
    label,
    type: "text",
    required: false,
    sensitive,
    position: 0,
    createdAt: "2026-10-08T12:00:00Z",
    updatedAt: "2026-10-08T12:00:00Z",
  };
}

beforeEach(() => {
  definitions.state = {
    definitions: [definition("interesse", "Interesse"), definition("renda", "Renda", true), definition("escola", "Escola")],
    loading: false,
    failed: false,
    reload: vi.fn(),
  };
});

describe("UpdateLeadFieldKeys", () => {
  it("adds the key of a lead custom field with an empty value, keeping what is there", () => {
    const onChange = vi.fn();
    render(<UpdateLeadFieldKeys value={{ escola: "{{last.escola}}" }} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Interesse/ }));

    expect(onChange).toHaveBeenCalledWith({ escola: "{{last.escola}}", interesse: "" });
  });

  it("marks a key already in the node and does not add it twice", () => {
    const onChange = vi.fn();
    render(<UpdateLeadFieldKeys value={{ escola: "x" }} onChange={onChange} />);

    const added = screen.getByRole("button", { name: /Escola/ });
    expect(added).toBeDisabled();
    expect(added).toHaveTextContent("updateLead.keyAdded");
  });

  it("never offers a sensitive field, because workflows do not write them", () => {
    render(<UpdateLeadFieldKeys value={{}} onChange={vi.fn()} />);

    const sensitive = screen.getByRole("button", { name: /Renda/ });
    expect(sensitive).toBeDisabled();
    expect(sensitive).toHaveTextContent("updateLead.keySensitive");
  });

  it("explains an empty catalog and a failed load with a retry", () => {
    definitions.state = { ...definitions.state, definitions: [] };
    const { rerender } = render(<UpdateLeadFieldKeys value={{}} onChange={vi.fn()} />);
    expect(screen.getByText("updateLead.keysEmpty")).toBeInTheDocument();

    definitions.state = { ...definitions.state, failed: true };
    rerender(<UpdateLeadFieldKeys value={{}} onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "updateLead.keysRetry" }));
    expect(definitions.state.reload).toHaveBeenCalled();
  });
});
