import { describe, expect, it } from "vitest";

import { qualityTone, TEMPLATE_QUALITIES } from "./health";

describe("template quality", () => {
  it("speaks Meta's four ratings, pending included", () => {
    expect(TEMPLATE_QUALITIES).toEqual(["GREEN", "YELLOW", "RED", "UNKNOWN"]);
  });

  it("colours each rating as a status, pending as neutral", () => {
    expect(qualityTone("GREEN")).toBe("healthy");
    expect(qualityTone("YELLOW")).toBe("warning");
    expect(qualityTone("RED")).toBe("fault");
    expect(qualityTone("UNKNOWN")).toBe("muted");
  });

  it("treats a rating it does not know as pending, never as healthy", () => {
    expect(qualityTone("PURPLE")).toBe("muted");
  });
});
