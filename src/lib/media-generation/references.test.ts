import { describe, expect, it } from "vitest";

import { withReference } from "./references";
import { MAX_REFERENCE_IMAGES } from "./types";

const ref = (mediaId: string) => ({ mediaId, url: `https://cdn/${mediaId}.png` });

describe("withReference", () => {
  it("adds a new reference at the end", () => {
    expect(withReference([ref("a")], ref("b"))).toEqual([ref("a"), ref("b")]);
  });

  it("keeps the list when the image is already a reference", () => {
    const current = [ref("a")];
    expect(withReference(current, ref("a"))).toBe(current);
  });

  it("refuses more than the model accepts", () => {
    const full = Array.from({ length: MAX_REFERENCE_IMAGES }, (_, i) => ref(String(i)));
    expect(withReference(full, ref("extra"))).toBe(full);
  });
});
