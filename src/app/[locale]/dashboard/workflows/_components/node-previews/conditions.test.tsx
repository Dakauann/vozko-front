import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import { renderConditionContentPreview } from "./conditions";

function renderDealCheck(config: Record<string, unknown>) {
  render(<>{renderConditionContentPreview("condition_check_opportunity", config)}</>);
}

describe("condition_check_opportunity preview", () => {
  it("shows the existence check by default", () => {
    renderDealCheck({ pipeline_id: "pl-1" });
    expect(screen.getByText("Tem negócio")).toBeInTheDocument();
  });

  it("names the status it compares", () => {
    renderDealCheck({ check: "status", status: "won" });
    expect(screen.getByText("Negócio ganho")).toBeInTheDocument();
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
