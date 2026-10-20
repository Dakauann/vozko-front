import { describe, expect, it } from "vitest";

import {
  PIN_MAX_BYTES,
  isPinnableStep,
  isWithheldPin,
  parsePinDraft,
  pinEdgeOptions,
  pinFromStep,
  pinSignature,
  pinSourceOf,
  pinText,
  type NodePin,
} from "./node-pin";

const AT = new Date("2026-10-20T12:00:00.000Z");

function pin(overrides: Partial<NodePin> = {}): NodePin {
  return { output: { status_code: 200 }, source: "simulation", pinned_at: AT.toISOString(), ...overrides };
}

describe("isPinnableStep", () => {
  it.each([
    ["executed", true],
    ["skipped", true],
    ["failed", false],
    ["waiting", false],
    ["cancelled", false],
  ])("only offers %s steps, because a pin cannot express a failure", (status, expected) => {
    expect(isPinnableStep({ status })).toBe(expected);
  });
});

describe("pinSourceOf", () => {
  it("reads the three sources the backend accepts", () => {
    expect(pinSourceOf("manual")).toEqual({ kind: "manual" });
    expect(pinSourceOf("simulation")).toEqual({ kind: "simulation" });
    expect(pinSourceOf("run: r-1 ")).toEqual({ kind: "run", runId: "r-1" });
  });

  it("refuses anything else instead of guessing", () => {
    expect(pinSourceOf("run:")).toBeNull();
    expect(pinSourceOf("import")).toBeNull();
    expect(pinSourceOf("")).toBeNull();
  });
});

describe("pinFromStep", () => {
  it("copies the output and the branch the step followed, marked as a simulation pin", () => {
    const made = pinFromStep({ status: "executed", output: { body: "ok" }, branch: "success" }, ["success", "error"], AT);
    expect(made).toEqual({ output: { body: "ok" }, edge: "success", source: "simulation", pinned_at: "2026-10-20T12:00:00.000Z" });
  });

  it("follows the default connection when the branch is not one of the node's labelled connections", () => {
    const made = pinFromStep({ status: "executed", output: {}, branch: "default" }, ["error"], AT);
    expect(made?.edge).toBeUndefined();
  });

  it("gives nothing for a failed step", () => {
    expect(pinFromStep({ status: "failed", output: { x: 1 } }, [], AT)).toBeNull();
  });

  it("pins an empty output when a skipped step recorded none", () => {
    expect(pinFromStep({ status: "skipped" }, [], AT)?.output).toEqual({});
  });
});

describe("parsePinDraft", () => {
  const base = { edge: "", edges: ["success", "error"], source: "manual", at: AT };

  it("builds a manual pin from a JSON object", () => {
    expect(parsePinDraft({ ...base, text: '{"status_code": 201}', edge: "success" })).toEqual({
      pin: { output: { status_code: 201 }, edge: "success", source: "manual", pinned_at: AT.toISOString() },
    });
  });

  it("drops an empty edge so the pin follows the default connection", () => {
    const parsed = parsePinDraft({ ...base, text: "{}" });
    expect("pin" in parsed && parsed.pin.edge).toBeUndefined();
  });

  it.each([
    ["{not json", "invalid_json"],
    ["[1, 2]", "not_object"],
    ["null", "not_object"],
    ['"texto"', "not_object"],
  ])("refuses %s", (text, error) => {
    expect(parsePinDraft({ ...base, text })).toEqual({ error });
  });

  it("refuses an edge the node does not have, since the simulation would fail on it", () => {
    expect(parsePinDraft({ ...base, text: "{}", edge: "gone" })).toEqual({ error: "unknown_edge" });
  });

  it("refuses an output over the backend size cap, counted in UTF-8 bytes", () => {
    const fits = "a".repeat(PIN_MAX_BYTES - 20);
    expect("pin" in parsePinDraft({ ...base, text: JSON.stringify({ v: fits }) })).toBe(true);
    const tooBig = "é".repeat(PIN_MAX_BYTES / 2);
    expect(parsePinDraft({ ...base, text: JSON.stringify({ v: tooBig }) })).toEqual({ error: "too_large" });
  });
});

describe("pinEdgeOptions", () => {
  it("lists the distinct labelled connections leaving the node, in order", () => {
    const edges = [
      { source: "n1", target: "a", label: "success" },
      { source: "n1", target: "b", label: "error" },
      { source: "n1", target: "c", label: "success" },
      { source: "n1", target: "d" },
      { source: "n2", target: "e", label: "other" },
    ];
    expect(pinEdgeOptions(edges, "n1")).toEqual(["success", "error"]);
  });
});

describe("pinText", () => {
  it("pretty prints the output for the editor", () => {
    expect(pinText(pin({ output: { a: 1 } }))).toBe('{\n  "a": 1\n}');
  });
});

describe("pinSignature", () => {
  it("is the same after the server rewrites the timestamp and reorders keys, so a saved pin does not read as unsaved", () => {
    const local = pin({ output: { b: 2, a: { d: 1, c: 2 } }, pinned_at: "2026-10-20T12:00:00.000Z" });
    const server = pin({ output: { a: { c: 2, d: 1 }, b: 2 }, pinned_at: "2026-10-20T12:00:00Z" });
    expect(pinSignature(local)).toBe(pinSignature(server));
  });

  it("changes with the output, the edge or the source", () => {
    const a = pinSignature(pin());
    expect(pinSignature(pin({ output: { status_code: 500 } }))).not.toBe(a);
    expect(pinSignature(pin({ edge: "error" }))).not.toBe(a);
    expect(pinSignature(pin({ source: "manual" }))).not.toBe(a);
  });

  it("is empty without a pin", () => {
    expect(pinSignature(undefined)).toBe("");
  });

  it("tells a withheld pin apart from an empty manual output, so neither reads as the other", () => {
    const withheld = pin({ output: null, withheld: true, source: "run:r1" });
    expect(pinSignature(withheld)).not.toBe(pinSignature(pin({ output: {}, source: "run:r1" })));
  });
});

describe("isWithheldPin", () => {
  it("is true only for a pin the server withheld from this viewer", () => {
    expect(isWithheldPin(pin({ output: null, withheld: true, source: "run:r1" }))).toBe(true);
    expect(isWithheldPin(pin())).toBe(false);
    expect(isWithheldPin(undefined)).toBe(false);
  });
});
