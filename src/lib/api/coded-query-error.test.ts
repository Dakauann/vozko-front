import { describe, expect, it } from "vitest";

import { SectionError } from "@/lib/analytics/section-query";

import { codedQueryError } from "./coded-query-error";

describe("codedQueryError", () => {
  it("is null while the query has not failed", () => {
    expect(codedQueryError(null)).toBeNull();
  });

  it("keeps the code and status of a coded refusal", () => {
    expect(codedQueryError(new SectionError("no", 403, "button_action_forbidden"))).toEqual({ message: "no", code: "button_action_forbidden", status: 403 });
  });

  it("keeps only the message of any other failure", () => {
    expect(codedQueryError(new Error("network down"))).toEqual({ message: "network down" });
    expect(codedQueryError("boom")).toEqual({ message: "boom" });
  });
});
