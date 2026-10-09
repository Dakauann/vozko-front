import { describe, expect, it } from "vitest";

import { ifMatchHeader, isVersionConflict, VERSION_CONFLICT } from "./versioned-save";

describe("ifMatchHeader", () => {
  it("sends the version the screen holds", () => {
    expect(ifMatchHeader(7)).toEqual({ "If-Match": "7" });
  });

  it("sends no header when the version is unknown, so the server refuses with version_required", () => {
    expect(ifMatchHeader(undefined)).toEqual({});
  });
});

describe("isVersionConflict", () => {
  it.each([
    [{ status: 409, code: VERSION_CONFLICT }, true],
    [{ status: 409, code: "other" }, false],
    [{ status: 409 }, false],
    [{ status: 428, code: VERSION_CONFLICT }, false],
    [{}, false],
  ])("reads %j as a conflict: %s", (error, expected) => {
    expect(isVersionConflict(error)).toBe(expected);
  });
});
