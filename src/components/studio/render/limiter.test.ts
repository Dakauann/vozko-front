import { describe, expect, it } from "vitest";

import { limiter } from "./limiter";

function gate() {
  let open = () => undefined as void;
  const opened = new Promise<void>((resolve) => (open = resolve));
  return { opened, open };
}

describe("raster queue", () => {
  it("runs a few tasks at once and skips queued ones nobody wants any more", async () => {
    const queue = limiter(1);
    const first = gate();
    const ran: string[] = [];
    const running = queue(async () => {
      ran.push("first");
      await first.opened;
      return "first";
    }, new AbortController().signal);
    const stale = new AbortController();
    const skipped = queue(async () => {
      ran.push("stale");
      return "stale";
    }, stale.signal);
    const wanted = queue(async () => {
      ran.push("wanted");
      return "wanted";
    }, new AbortController().signal);
    stale.abort();
    first.open();
    await expect(running).resolves.toBe("first");
    await expect(skipped).rejects.toThrow("aborted");
    await expect(wanted).resolves.toBe("wanted");
    expect(ran).toEqual(["first", "wanted"]);
  });
});
