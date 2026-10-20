import { describe, expect, it } from "vitest";

import { edgeSourceHandle, missingOutputHandles } from "./edge-outputs";

describe("edgeSourceHandle", () => {
  it.each([
    ["a labeled edge leaves the output of the same id", "erro", ["sucesso", "erro"], "erro"],
    ["an unlabeled edge leaves the default output when the node has one", "", ["1", "default"], "default"],
    ["an unlabeled edge leaves the only output", "", ["sucesso"], "sucesso"],
    ["an unlabeled edge on several outputs keeps no handle", "", ["sucesso", "erro"], undefined],
    ["default on a node with a single unnamed output uses that output", "default", [], undefined],
    ["a label the node does not have stays, so it can be shown as missing", "3", ["1", "2"], "3"],
  ] as const)("%s", (_, label, outputs, want) => {
    expect(edgeSourceHandle(label, [...outputs])).toBe(want);
  });
});

describe("missingOutputHandles", () => {
  it("lists each connected handle the node no longer has, once and in order", () => {
    expect(missingOutputHandles(["1", "2"], ["2", "gone", null, undefined, "", "gone", "old"])).toEqual(["gone", "old"]);
  });

  it("finds nothing missing when every edge leaves a current output", () => {
    expect(missingOutputHandles(["1", "2", "no_match"], ["1", "2"])).toEqual([]);
  });

  it("treats every named handle as missing on a node with a single unnamed output", () => {
    expect(missingOutputHandles([], [null, "sucesso"])).toEqual(["sucesso"]);
  });
});
