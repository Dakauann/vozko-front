import { describe, expect, it } from "vitest";

import { callListKeys } from "./use-call-lists";

describe("callListKeys", () => {
  it("files every item page of a list under one prefix, so one invalidation reaches them all", () => {
    const prefix = callListKeys.itemsOf("ws-1", "list-1");
    for (const state of ["pending", "reserved", "closed"] as const) {
      expect(callListKeys.items("ws-1", "list-1", state).slice(0, prefix.length)).toEqual([...prefix]);
    }
    expect(callListKeys.items("ws-1", "list-2", "pending").slice(0, prefix.length)).not.toEqual([...prefix]);
  });
});
