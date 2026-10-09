import { describe, expect, it } from "vitest";

import { initials } from "./initials";

describe("initials", () => {
  it("takes the first and last name letters", () => {
    expect(initials("Maria da Silva Souza")).toBe("MS");
    expect(initials("  ana ")).toBe("A");
  });

  it("marks a missing name with a question mark", () => {
    expect(initials("")).toBe("?");
    expect(initials(null)).toBe("?");
  });
});
