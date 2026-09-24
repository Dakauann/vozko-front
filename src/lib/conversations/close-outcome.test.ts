import { describe, expect, it } from "vitest";

import type { OutcomeCaptureSpec } from "@/lib/workspace/workspace-config/types";

import { closeOutcomeLabel, reservedOutcomeKey } from "./close-outcome";

const capture: OutcomeCaptureSpec = {
  enabled: true,
  requireOnFinish: true,
  durableThreshold: 30,
  outcomes: [
    { code: "sale", label: "Venda fechada", isDurable: true, position: 1 },
    { code: "no_answer", label: "Sem resposta", isDurable: false, position: 2 },
  ],
};

const reserved = (key: string) => `reserved:${key}`;

describe("closeOutcomeLabel", () => {
  it("names a catalogue outcome by its label", () => {
    expect(closeOutcomeLabel("sale", capture, reserved)).toBe("Venda fechada");
  });

  it("names the reserved outcomes of closes that chose none", () => {
    expect(closeOutcomeLabel("_system_auto_close", capture, reserved)).toBe("reserved:systemAutoClose");
    expect(closeOutcomeLabel("_ai_unspecified", capture, reserved)).toBe("reserved:aiUnspecified");
    expect(closeOutcomeLabel("_workflow_unspecified", capture, reserved)).toBe("reserved:workflowUnspecified");
  });

  it("keeps a code the catalogue no longer lists instead of hiding it", () => {
    expect(closeOutcomeLabel("retired", capture, reserved)).toBe("retired");
    expect(closeOutcomeLabel("sale", null, reserved)).toBe("sale");
  });

  it("has nothing to show for a close without an outcome", () => {
    expect(closeOutcomeLabel("", capture, reserved)).toBeNull();
    expect(closeOutcomeLabel(undefined, capture, reserved)).toBeNull();
  });
});

describe("reservedOutcomeKey", () => {
  it("only recognises the reserved codes", () => {
    expect(reservedOutcomeKey("_ai_unspecified")).toBe("aiUnspecified");
    expect(reservedOutcomeKey("sale")).toBeNull();
    expect(reservedOutcomeKey("_unknown_reserved")).toBeNull();
  });
});
