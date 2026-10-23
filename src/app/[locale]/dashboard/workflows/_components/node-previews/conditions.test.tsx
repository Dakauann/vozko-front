import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import type { NodeDefinition } from "@/lib/workflows/types";

import { renderConditionContentPreview } from "./conditions";
import { NodeDefinitionsProvider } from "./node-definitions";

function renderDealCheck(config: Record<string, unknown>) {
  render(<>{renderConditionContentPreview("condition_check_opportunity", config)}</>);
}

describe("condition_check_opportunity preview", () => {
  it("shows the existence check by default", () => {
    renderDealCheck({ pipeline_id: "pl-1" });
    expect(screen.getByText("Tem oportunidade")).toBeInTheDocument();
  });

  it("names the status it compares", () => {
    renderDealCheck({ check: "status", status: "won" });
    expect(screen.getByText("Oportunidade ganha")).toBeInTheDocument();
  });

  it("names the picked stage", () => {
    renderDealCheck({ check: "stage", stage_id: "st-1", _display_stage_id: "Vendas · Proposta" });
    expect(screen.getByText("Vendas · Proposta")).toBeInTheDocument();
  });

  it("flags a status check with nothing chosen", () => {
    renderDealCheck({ check: "status" });
    expect(screen.getByText("Sem situação")).toBeInTheDocument();
  });
});

function operatorDefinition(type: "condition_branch" | "condition_filter"): NodeDefinition {
  return {
    type,
    category: "condition",
    label: "Condição",
    description: "",
    icon: "GitBranch",
    defaultConfig: {},
    configSchema: [{ key: "operator", label: "Operador", type: "select", options: [{ value: "empty", label: "Está vazio" }, { value: "eq", label: "Igual a (==)" }] }],
  };
}

function renderOperatorCheck(type: "condition_branch" | "condition_filter", config: Record<string, unknown>) {
  render(<NodeDefinitionsProvider definitions={[operatorDefinition(type)]}>{renderConditionContentPreview(type, config)}</NodeDefinitionsProvider>);
}

describe("operator conditions on the canvas", () => {
  it.each(["condition_branch", "condition_filter"] as const)("%s names a saved operator by the catalog label, since a reloaded config carries no display cache", (type) => {
    renderOperatorCheck(type, { variable: "{{input.turno}}", operator: "empty", value: "" });
    expect(screen.getByText("Está vazio")).toBeInTheDocument();
    expect(screen.queryByText("empty")).toBeNull();
  });

  it("keeps the raw operator when the catalog does not know it, so nothing is invented", () => {
    renderOperatorCheck("condition_branch", { variable: "{{x}}", operator: "custom_op", value: "1" });
    expect(screen.getByText("custom_op")).toBeInTheDocument();
  });
});
