import { describe, expect, it } from "vitest";

import { hasToolSettings } from "./tool-settings";

describe("hasToolSettings", () => {
  it("is true for a tool whose settings are required", () => {
    expect(hasToolSettings({ requiresConfig: true, configSchema: { key: { type: "string", description: "", required: true } } })).toBe(true);
  });

  it("is true for optional settings too, so an admin can reach them", () => {
    // transfer_to_human's department is optional; without this it could
    // never be set from the agent form.
    expect(
      hasToolSettings({
        requiresConfig: false,
        configSchema: { department_id: { type: "string", description: "", required: false } },
      }),
    ).toBe(true);
  });

  it("is false for a tool with nothing to set", () => {
    expect(hasToolSettings({ requiresConfig: false })).toBe(false);
    expect(hasToolSettings({ requiresConfig: false, configSchema: {} })).toBe(false);
  });
});
