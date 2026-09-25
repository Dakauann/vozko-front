import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/department/client", () => ({
  fetchDepartments: vi.fn(async () => ({ departments: [{ id: "d-1", name: "Vendas" }] })),
}));
vi.mock("@/lib/crm/pipelines", () => ({
  listPipelines: vi.fn(async (objectType: string) => ({
    data: objectType === "opportunity" ? [{ id: "pl-1", name: "Funil de vendas" }] : [],
  })),
}));

import { loadToolOptions, toggleChoice } from "@/lib/agents/tool-option-sources";

describe("loadToolOptions", () => {
  it("loads the workspace departments", async () => {
    expect(await loadToolOptions("departments")).toEqual([{ value: "d-1", label: "Vendas" }]);
  });

  it("loads only the deal funnels for opportunity pipelines", async () => {
    expect(await loadToolOptions("opportunity_pipelines")).toEqual([{ value: "pl-1", label: "Funil de vendas" }]);
  });

  it("has no options for a source it does not know", async () => {
    expect(await loadToolOptions("unknown")).toBeNull();
  });
});

describe("toggleChoice", () => {
  it("adds and removes a choice keeping the option order", () => {
    const order = ["create", "update_value", "win"];
    expect(toggleChoice(["win"], "create", order)).toEqual(["create", "win"]);
    expect(toggleChoice(["create", "win"], "win", order)).toEqual(["create"]);
  });

  it("treats a missing value as nothing chosen", () => {
    expect(toggleChoice(undefined, "win", ["create", "win"])).toEqual(["win"]);
  });
});
