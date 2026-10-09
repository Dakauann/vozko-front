import { describe, expect, it } from "vitest";

import { STILL_END_MARGIN_SEC, stillSeconds } from "./stills";

describe("still times", () => {
  it("keeps a still inside the media so the last frame is still decodable", () => {
    expect(stillSeconds(2, 10)).toBe(2);
    expect(stillSeconds(12, 10)).toBe(10 - STILL_END_MARGIN_SEC);
    expect(stillSeconds(1, 0.01)).toBe(0);
    expect(stillSeconds(-1, 10)).toBe(0);
  });
});
