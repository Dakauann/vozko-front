import { describe, expect, it } from "vitest";

import { secretCreateBlock, secretFieldOfCode, type SecretNameList } from "./secret-create";

function list(names: string[], state: Partial<SecretNameList> = {}): SecretNameList {
  return { names: new Set(names), loading: false, failed: false, ...state };
}

describe("secretCreateBlock", () => {
  it("allows a valid new name once the list has loaded", () => {
    expect(secretCreateBlock("api_key", list(["other"]))).toBeNull();
  });

  it("refuses an invalid name before anything else", () => {
    expect(secretCreateBlock("Senha", list([], { loading: true }))).toBe("invalid");
  });

  it("refuses a name already stored, since saving would overwrite the credential", () => {
    expect(secretCreateBlock("api_key", list(["api_key"]))).toBe("taken");
  });

  it("refuses while the list is still loading, because an empty list proves nothing", () => {
    expect(secretCreateBlock("api_key", list([], { loading: true }))).toBe("unverified");
  });

  it("refuses after a failed list read, so an unreadable list never allows an overwrite", () => {
    expect(secretCreateBlock("api_key", list([], { failed: true }))).toBe("unverified");
  });
});

describe("secretFieldOfCode", () => {
  it.each([
    ["invalid_name", "name"],
    ["value_required", "value"],
    ["value_too_long", "value"],
    ["internal", null],
    [undefined, null],
  ] as const)("maps backend code %j to the field %j it belongs to", (code, field) => {
    expect(secretFieldOfCode(code)).toBe(field);
  });
});
