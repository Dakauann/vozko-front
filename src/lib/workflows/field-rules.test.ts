import { describe, expect, it } from "vitest";

import { fieldRequired, fieldVisible } from "./field-rules";
import type { ConfigField } from "./types";

const stage: ConfigField = {
  key: "stage_id",
  label: "Etapa",
  type: "select",
  visibleWhen: { field: "action", values: ["create", "move"] },
  requiredWhen: { field: "action", values: ["move"] },
};

describe("field rules", () => {
  it("shows a field only for the listed choices", () => {
    expect(fieldVisible(stage, { action: "move" })).toBe(true);
    expect(fieldVisible(stage, { action: "lose" })).toBe(false);
    expect(fieldVisible({ key: "x", label: "x", type: "text" }, {})).toBe(true);
  });

  it("requires a field only when it is visible and the rule matches", () => {
    expect(fieldRequired(stage, { action: "move" })).toBe(true);
    expect(fieldRequired(stage, { action: "create" })).toBe(false);
    expect(fieldRequired({ ...stage, required: true }, { action: "lose" })).toBe(false);
    expect(fieldRequired({ key: "x", label: "x", type: "text", required: true }, {})).toBe(true);
  });
});
