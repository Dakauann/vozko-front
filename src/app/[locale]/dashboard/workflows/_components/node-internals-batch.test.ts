import { describe, expect, it, vi } from "vitest";

import { queueNodeInternals } from "./node-internals-batch";

describe("queueNodeInternals", () => {
  it("measures every node that asked in the same commit with one store update", async () => {
    const update = vi.fn();
    queueNodeInternals(update, "n1");
    queueNodeInternals(update, "n2");
    queueNodeInternals(update, "n1");
    expect(update).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(update).toHaveBeenCalledTimes(1);
    expect(update).toHaveBeenCalledWith(["n1", "n2"]);
  });

  it("keeps separate canvases apart", async () => {
    const first = vi.fn();
    const second = vi.fn();
    queueNodeInternals(first, "a");
    queueNodeInternals(second, "b");
    await Promise.resolve();
    expect(first).toHaveBeenCalledWith(["a"]);
    expect(second).toHaveBeenCalledWith(["b"]);
  });
});
