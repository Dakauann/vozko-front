import { describe, expect, it } from "vitest";

import { renameCustomField, unknownCustomFieldOf } from "./custom-field-fix";
import type { LintIssue } from "./types";

const issue: LintIssue = { code: "NODE_UNKNOWN_CUSTOM_FIELD", severity: "blocking", nodeId: "n29", field: "custom_fields", path: "Advogado Escolhido", message: "" };

describe("unknownCustomFieldOf", () => {
  it("names the node and the key the node still writes", () => {
    expect(unknownCustomFieldOf(issue, { custom_fields: { "Advogado Escolhido": "{{advgesp}}" } })).toEqual({ nodeId: "n29", key: "Advogado Escolhido" });
  });

  it("offers nothing once the key is gone from the node or for another issue", () => {
    expect(unknownCustomFieldOf(issue, { custom_fields: { advogado_escolhido: "{{advgesp}}" } })).toBeNull();
    expect(unknownCustomFieldOf({ ...issue, code: "NODE_SENSITIVE_CUSTOM_FIELD" }, { custom_fields: { "Advogado Escolhido": "x" } })).toBeNull();
  });
});

describe("renameCustomField", () => {
  it("moves the value to the created field's key and keeps the rest of the node", () => {
    const config = { name: "{{nome}}", custom_fields: { "Advogado Escolhido": "{{advgesp}}", origem: "site" } };

    expect(renameCustomField(config, "Advogado Escolhido", "advogado_escolhido")).toEqual({
      name: "{{nome}}",
      custom_fields: { advogado_escolhido: "{{advgesp}}", origem: "site" },
    });
  });
});
