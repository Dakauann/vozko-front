import { describe, expect, it } from "vitest";

import { matteGroups } from "./matte-runs";
import type { SceneNode } from "./scene";

function node(id: string, extra: Partial<SceneNode> = {}): SceneNode {
  return { id, source: { kind: "image", assetId: id }, box: { x: 0, y: 0, width: 1, height: 1, rotation: 0 }, fit: "fill", opacity: 1, visible: true, ...extra };
}

describe("matte groups", () => {
  it("groups the clipped nodes of a base by matte, starting a new group whenever the matte changes", () => {
    const groups = matteGroups([
      node("base"),
      node("a", { clipOf: "base" }),
      node("b", { clipOf: "base" }),
      node("c", { clipOf: "base", clipMatte: { channel: "luma", invert: false } }),
      node("d", { clipOf: "base" }),
      node("other"),
      node("e", { clipOf: "other", clipMatte: { channel: "alpha", invert: true } }),
    ]);
    expect([...groups.entries()].map(([id, group]) => [id, group.base, group.order, group.matte])).toEqual([
      ["a", "base", 0, { channel: "alpha", invert: false }],
      ["b", "base", 0, { channel: "alpha", invert: false }],
      ["c", "base", 1, { channel: "luma", invert: false }],
      ["d", "base", 2, { channel: "alpha", invert: false }],
      ["e", "other", 0, { channel: "alpha", invert: true }],
    ]);
  });

  it("lets effect nodes sit inside a run without breaking it", () => {
    const groups = matteGroups([node("base"), node("a", { clipOf: "base" }), node("fx", { source: { kind: "effect" } }), node("b", { clipOf: "base" })]);
    expect(groups.get("b")?.order).toBe(0);
  });
});
