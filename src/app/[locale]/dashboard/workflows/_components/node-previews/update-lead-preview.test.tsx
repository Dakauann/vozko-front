import { describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";

import type { NodeDefinition } from "@/lib/workflows/types";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key} ${JSON.stringify(values)}` : key,
}));

import { renderActionContentPreview } from "./actions";
import { NodeDefinitionsProvider } from "./node-definitions";

const UPDATE_LEAD: NodeDefinition = {
  type: "action_update_lead",
  category: "action",
  label: "Atualizar Lead",
  description: "",
  icon: "UserCircle",
  defaultConfig: { custom_fields: {} },
  configSchema: [
    { key: "zip_code", label: "CEP", type: "text" },
    { key: "street", label: "Logradouro", type: "text" },
    { key: "number", label: "Número", type: "text" },
    { key: "complement", label: "Complemento", type: "text" },
    { key: "district", label: "Bairro", type: "text" },
    { key: "city", label: "Cidade", type: "text" },
    { key: "neighbourhood_code", label: "Código do bairro", type: "text" },
    { key: "custom_fields", label: "Campos personalizados", type: "keyvalue" },
  ],
};

function renderUpdateLead(config: Record<string, unknown>, definitions: NodeDefinition[] | null = [UPDATE_LEAD]) {
  const preview = <>{renderActionContentPreview("action_update_lead", config)}</>;
  render(definitions ? <NodeDefinitionsProvider definitions={definitions}>{preview}</NodeDefinitionsProvider> : preview);
}

function rows() {
  return screen.getAllByTestId("update-lead-field").map((row) => row.textContent);
}

describe("action_update_lead preview", () => {
  it("lists the fields the node writes with the server's labels, in the definition's order", () => {
    renderUpdateLead({ district: "{{last.bairro}}", zip_code: "{{last.cep}}", city: "  " });

    expect(rows()).toEqual(["CEP{{last.cep}}", "Bairro{{last.bairro}}"]);
  });

  it("shows a field the server added to the definition", () => {
    renderUpdateLead({ neighbourhood_code: "{{last.codigo}}" });

    expect(rows()).toEqual(["Código do bairro{{last.codigo}}"]);
  });

  it("names custom fields by key", () => {
    renderUpdateLead({ custom_fields: { interesse: "{{last.interesse}}", vazio: "" } });

    expect(screen.getByText(`updateLead.customField {"key":"interesse"}`)).toBeInTheDocument();
    expect(screen.queryByText(`updateLead.customField {"key":"vazio"}`)).toBeNull();
  });

  it("folds the rows past the first few into a count", () => {
    renderUpdateLead({
      zip_code: "a",
      street: "b",
      number: "c",
      complement: "d",
      district: "e",
      city: "f",
    });

    expect(screen.getAllByTestId("update-lead-field")).toHaveLength(4);
    expect(screen.getByText(`updateLead.more {"count":2}`)).toBeInTheDocument();
  });

  it("flags a node that writes nothing", () => {
    renderUpdateLead({ custom_fields: {} });
    expect(screen.getByText("updateLead.empty")).toBeInTheDocument();
  });

  it("claims nothing about the node when its definition is not loaded", () => {
    renderUpdateLead({ city: "{{last.cidade}}" }, null);

    expect(screen.queryByTestId("update-lead-field")).toBeNull();
    expect(screen.queryByText("updateLead.empty")).toBeNull();
  });

  it("leaves other nodes to the legacy preview", () => {
    expect(renderActionContentPreview("action_http_request", {})).toBeUndefined();
  });
});
