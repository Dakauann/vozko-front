import { describe, expect, it } from "vitest";

import { leadLookupFor } from "../lookup";

describe("leadLookupFor", () => {
  it("looks a typed phone up by its number, digits only", () => {
    expect(leadLookupFor(" (11) 90002-3301 ")).toEqual({ kind: "number", number: "11900023301" });
  });

  it("looks anything else up by the name", () => {
    expect(leadLookupFor(" João Souza ")).toEqual({ kind: "name", name: "João Souza" });
  });

  it("waits for enough text before looking anything up", () => {
    expect(leadLookupFor("Jo")).toBeNull();
    expect(leadLookupFor("   ")).toBeNull();
    expect(leadLookupFor("1234")).toEqual({ kind: "name", name: "1234" });
  });
});
