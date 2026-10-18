import { describe, expect, it } from "vitest";

import { forgetSetupWarnings, recallSetupWarnings, rememberSetupWarnings } from "./setup-warnings-store";

describe("setup warnings store", () => {
  it("keeps the warnings of a new group for this session", () => {
    rememberSetupWarnings("g-new", [{ step: "promote_numbers", reason: "offline" }]);
    expect(recallSetupWarnings("g-new")).toEqual([{ step: "promote_numbers", reason: "offline" }]);
    expect(recallSetupWarnings("g-other")).toEqual([]);
  });

  it("ignores an empty list and forgets on request", () => {
    rememberSetupWarnings("g-empty", []);
    expect(recallSetupWarnings("g-empty")).toEqual([]);
    rememberSetupWarnings("g-done", [{ step: "description", reason: "" }]);
    forgetSetupWarnings("g-done");
    expect(recallSetupWarnings("g-done")).toEqual([]);
  });
});
