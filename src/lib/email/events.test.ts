import { describe, expect, it } from "vitest";

import { emailForwardSkippedKey } from "./events";

describe("emailForwardSkippedKey", () => {
  it("names each reason the server sends", () => {
    expect(emailForwardSkippedKey({ reason: "balance_insufficient" })).toBe("emailForwardSkipped.balance_insufficient");
    expect(emailForwardSkippedKey({ reason: "send_failed" })).toBe("emailForwardSkipped.send_failed");
  });

  it("falls back to the general sentence for a reason it does not know, or none", () => {
    expect(emailForwardSkippedKey({ reason: "reason_from_a_newer_backend" })).toBe("emailForwardSkipped.other");
    expect(emailForwardSkippedKey({ reason: "toString" })).toBe("emailForwardSkipped.other");
    expect(emailForwardSkippedKey({})).toBe("emailForwardSkipped.other");
  });
});
