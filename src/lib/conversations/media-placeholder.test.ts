import { rgbaToThumbHash } from "thumbhash";
import { describe, expect, it } from "vitest";

import { placeholderDataUrl } from "./media-placeholder";

function encodedSample(): string {
  const width = 8;
  const height = 6;
  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i += 1) {
    rgba.set([20 * (i % width), 120, 200, 255], i * 4);
  }
  return btoa(String.fromCharCode(...rgbaToThumbHash(width, height, rgba)));
}

describe("placeholderDataUrl", () => {
  it("turns a stored thumbhash into an inline blurred picture", () => {
    expect(placeholderDataUrl(encodedSample())).toMatch(/^data:image\/png;base64,/);
  });

  it("shows no placeholder for a missing or damaged value", () => {
    expect(placeholderDataUrl(undefined)).toBeNull();
    expect(placeholderDataUrl("")).toBeNull();
    expect(placeholderDataUrl("%%%not base64")).toBeNull();
  });
});
