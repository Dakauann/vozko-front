import { describe, expect, it } from "vitest";

import { firstFrameSrc } from "./first-frame";

describe("firstFrameSrc", () => {
  it("asks the browser to paint the first frame of a video before it plays", () => {
    expect(firstFrameSrc("https://cdn.example.com/ad.mp4")).toBe("https://cdn.example.com/ad.mp4#t=0.001");
  });

  it("keeps a signed url intact", () => {
    expect(firstFrameSrc("https://cdn.example.com/ad.mp4?sig=abc&exp=1")).toBe("https://cdn.example.com/ad.mp4?sig=abc&exp=1#t=0.001");
  });

  it("leaves a url that already names a fragment alone", () => {
    expect(firstFrameSrc("https://cdn.example.com/ad.mp4#t=3")).toBe("https://cdn.example.com/ad.mp4#t=3");
  });
});
