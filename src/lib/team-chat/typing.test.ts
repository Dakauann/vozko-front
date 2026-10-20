import { describe, expect, it } from "vitest";

import { REMOTE_TYPING_MS, typersAfterMessage, typersAfterSignal, typersAt } from "./typing";

describe("remote typing", () => {
  it("keeps a typer for a few seconds after each signal", () => {
    const typers = typersAfterSignal({}, "u-bia", 1_000);
    expect(typersAt(typers, 1_000 + REMOTE_TYPING_MS - 1)).toEqual(["u-bia"]);
    expect(typersAt(typers, 1_000 + REMOTE_TYPING_MS)).toEqual([]);
  });

  it("drops a typer as soon as their message arrives", () => {
    const typers = typersAfterSignal(typersAfterSignal({}, "u-bia", 1_000), "u-caio", 1_000);
    expect(typersAt(typersAfterMessage(typers, "u-bia"), 1_500)).toEqual(["u-caio"]);
    expect(typersAfterMessage(typers, "u-nobody")).toBe(typers);
  });
});
