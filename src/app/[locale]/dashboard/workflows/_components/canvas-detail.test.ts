import { describe, expect, it } from "vitest";
import type { ReactFlowState } from "@xyflow/react";

import {
  compactContentHeight,
  detailTierAt,
  detailTierSelector,
  edgeLabelHandle,
  edgeLabelsSelector,
  handleCenters,
  isPanGesture,
  labelsOutputsOnNode,
  summaryLineCount,
} from "./canvas-detail";

function state(zoom: number): ReactFlowState {
  return { transform: [0, 0, zoom] } as unknown as ReactFlowState;
}

describe("detailTierAt", () => {
  it("keeps the full preview from 0.6 up, where its text is still readable", () => {
    expect(detailTierAt(0.6)).toBe("full");
    expect(detailTierAt(1)).toBe("full");
    expect(detailTierAt(1.75)).toBe("full");
  });

  it("swaps to the simplified preview between 0.3 and 0.6 instead of shrinking the full one", () => {
    expect(detailTierAt(0.59)).toBe("simplified");
    expect(detailTierAt(0.45)).toBe("simplified");
    expect(detailTierAt(0.3)).toBe("simplified");
  });

  it("keeps only the title and a one line summary below 0.3", () => {
    expect(detailTierAt(0.29)).toBe("minimal");
    expect(detailTierAt(0.1)).toBe("minimal");
  });
});

describe("detailTierSelector", () => {
  it("returns the same value inside a tier, so nodes re-render only when a tier is crossed", () => {
    expect(detailTierSelector(state(0.61))).toBe(detailTierSelector(state(1.5)));
    expect(detailTierSelector(state(0.31))).toBe(detailTierSelector(state(0.58)));
    expect(detailTierSelector(state(0.12))).toBe(detailTierSelector(state(0.28)));
    expect(detailTierSelector(state(0.5))).not.toBe(detailTierSelector(state(0.7)));
  });
});

describe("edgeLabelsSelector", () => {
  it("hides edge labels below half zoom and keeps them at normal zoom", () => {
    expect(edgeLabelsSelector(state(0.49))).toBe(false);
    expect(edgeLabelsSelector(state(0.5))).toBe(true);
    expect(edgeLabelsSelector(state(1))).toBe(true);
  });
});

describe("edgeLabelHandle", () => {
  const branches = [
    { id: "ok_5", label: "ok_5" },
    { id: "erro_5", label: "erro_5" },
    { id: "default", label: "Sem Correspondência" },
  ];

  it("skips the label of the default handle on a node that has a single way out", () => {
    expect(edgeLabelHandle("default", [{ id: "default", label: "" }], false)).toBeNull();
    expect(edgeLabelHandle("default", [], false)).toBeNull();
  });

  it("skips a label the source node already shows next to its handle, so branches never stack a second copy beside the node", () => {
    expect(edgeLabelHandle("ok_5", branches, true)).toBeNull();
    expect(edgeLabelHandle("default", branches, true)).toBeNull();
  });

  it("keeps the label when the source node draws no label at that handle", () => {
    expect(edgeLabelHandle("ok_5", branches, false)).toBe("ok_5");
    expect(edgeLabelHandle("sucesso", [{ id: "sucesso", label: "" }, { id: "falha", label: "Falha" }], true)).toBe("sucesso");
  });

  it("keeps the label of a connection whose output the node no longer has", () => {
    expect(edgeLabelHandle("gone", branches, true)).toBe("gone");
  });

  it("drops empty labels", () => {
    expect(edgeLabelHandle("", branches, true)).toBeNull();
    expect(edgeLabelHandle(undefined, branches, true)).toBeNull();
  });
});

describe("labelsOutputsOnNode", () => {
  it("is true for nodes that draw a labelled row per output and false for message previews, which draw none", () => {
    expect(labelsOutputsOnNode("condition_text_match")).toBe(true);
    expect(labelsOutputsOnNode("action_send_interactive")).toBe(true);
    expect(labelsOutputsOnNode("action_send_email")).toBe(false);
    expect(labelsOutputsOnNode(undefined)).toBe(false);
  });
});

describe("handleCenters", () => {
  const measured = [
    { id: "sim", y: 40, height: 9 },
    { id: "nao", y: 60, height: 9 },
  ];

  it("places compact handles where the full card measured them, so edges do not move", () => {
    expect(handleCenters(["sim", "nao"], measured)).toEqual({ sim: 44.5, nao: 64.5 });
  });

  it("needs nothing when the node has a single unnamed output", () => {
    expect(handleCenters([], undefined)).toEqual({});
  });

  it("refuses the compact card until every branch handle has been measured", () => {
    expect(handleCenters(["sim", "talvez"], measured)).toBeNull();
    expect(handleCenters(["sim"], null)).toBeNull();
  });
});

describe("isPanGesture", () => {
  it("promotes the canvas layer for a pointer drag, which only translates it", () => {
    expect(isPanGesture({ type: "mousedown" })).toBe(true);
    expect(isPanGesture({ type: "pointerdown" })).toBe(true);
    expect(isPanGesture({ type: "touchstart", touches: { length: 1 } })).toBe(true);
  });

  it("leaves zooms and programmatic moves alone, since a promoted layer re-rasters on every scale step", () => {
    expect(isPanGesture({ type: "wheel" })).toBe(false);
    expect(isPanGesture({ type: "touchstart", touches: { length: 2 } })).toBe(false);
    expect(isPanGesture(null)).toBe(false);
  });
});

describe("compactContentHeight", () => {
  it("stops the simplified content above the first branch label, so text never runs into the labels", () => {
    expect(compactContentHeight("simplified", 300, [200, 240])).toBe(200 - 14 - 36);
  });

  it("uses the whole card when no branch is labelled", () => {
    expect(compactContentHeight("simplified", 120, [])).toBe(120 - 36);
    expect(compactContentHeight("minimal", 300, [200, 240])).toBe(300 - 48);
  });

  it("never goes below zero on a short card", () => {
    expect(compactContentHeight("minimal", 30, [])).toBe(0);
  });
});

describe("summaryLineCount", () => {
  it("clamps the summary to whole lines, so no line is cut in half", () => {
    expect(summaryLineCount(100, false)).toBe(4);
    expect(summaryLineCount(100, true)).toBe(3);
  });

  it("drops the text when only the heading fits", () => {
    expect(summaryLineCount(30, true)).toBe(0);
  });
});
