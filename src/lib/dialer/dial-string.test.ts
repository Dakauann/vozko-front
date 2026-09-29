import { describe, expect, it } from "vitest";

import { appendDialKey, callOutcome, isDialable, DIAL_KEYS } from "./dial-string";

describe("dial string", () => {
  it("accepts what the trunk can dial and nothing else", () => {
    for (const value of ["+55 (11) 99999-0000", "1001", "*100#", "011 4003.1234"]) {
      expect(isDialable(value)).toBe(true);
    }
    for (const value of ["", "   ", "+", "abc", "100@evil.example", "12+34", "1;user=phone"]) {
      expect(isDialable(value)).toBe(false);
    }
  });

  it("appends keypad keys and caps the length", () => {
    expect(appendDialKey("11", "9")).toBe("119");
    expect(appendDialKey("", "+")).toBe("+");
    expect(appendDialKey("1", "+")).toBe("1");
    expect(appendDialKey("9".repeat(32), "1")).toBe("9".repeat(32));
    expect(DIAL_KEYS).toHaveLength(12);
  });

  it("maps server end reasons to a known outcome", () => {
    expect(callOutcome("busy")).toBe("busy");
    expect(callOutcome("no_answer")).toBe("no_answer");
    expect(callOutcome("insufficient_balance")).toBe("insufficient_balance");
    expect(callOutcome("connection_lost")).toBe("connection_lost");
    expect(callOutcome("something_new")).toBe("ended");
    expect(callOutcome(undefined)).toBe("ended");
  });
});
