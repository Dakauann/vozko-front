import { describe, expect, it } from "vitest";

import { parseTargetList } from "../TargetListEditor";

/** Not Brazil-pinned: this is the unofficial channel's validator. */
const anyE164 = (digits: string) => digits.length >= 10 && digits.length <= 15;

describe("parseTargetList", () => {
  it("reads a plain pasted column", () => {
    const out = parseTargetList("5584999990001\n5584999990002", 0, anyE164);
    expect(out.targets.map((t) => t.number)).toEqual([
      "5584999990001",
      "5584999990002",
    ]);
  });

  it("accepts the separators a pasted spreadsheet column brings", () => {
    const out = parseTargetList(
      '5584999990001,Ana\n5584999990002;Bia\n"5584999990003"\tCarla',
      0,
      anyE164,
    );
    expect(out.targets).toHaveLength(3);
    expect(out.targets.map((t) => t.name)).toEqual(["Ana", "Bia", "Carla"]);
  });

  it("strips formatting from the number", () => {
    const out = parseTargetList("+55 (84) 99999-0001", 0, anyE164);
    expect(out.targets[0].number).toBe("5584999990001");
  });

  it("takes columns after the name as variables, in order", () => {
    const out = parseTargetList("5584999990001,Ana,R$ 90,10/09", 2, anyE164);
    expect(out.targets[0].variables).toEqual(["R$ 90", "10/09"]);
  });

  // Silently dropping a row is how a campaign quietly reaches 420 of 500 people
  // and nobody can find the missing 80.
  it("reports duplicates rather than dropping them", () => {
    const out = parseTargetList("5584999990001\n+55 84 99999-0001", 0, anyE164);
    expect(out.targets).toHaveLength(1);
    expect(out.duplicates).toBe(1);
    expect(out.skipped[0]).toMatchObject({ line: 2, reason: "duplicate" });
  });

  it("reports unreadable numbers with their line number", () => {
    const out = parseTargetList("5584999990001\nnot a number\n123", 0, anyE164);
    expect(out.targets).toHaveLength(1);
    expect(out.invalid).toBe(2);
    expect(out.skipped.map((s) => s.line)).toEqual([2, 3]);
  });

  // A row without enough values would send a raw {{2}} to a customer.
  it("rejects rows missing a required variable", () => {
    const out = parseTargetList(
      "5584999990001,Ana,R$ 90,10/09\n5584999990002,Bia",
      2,
      anyE164,
    );
    expect(out.targets).toHaveLength(1);
    expect(out.missingVariables).toBe(1);
    expect(out.skipped[0]).toMatchObject({ reason: "missingVariables" });
  });

  it("ignores blank lines rather than counting them as errors", () => {
    const out = parseTargetList("5584999990001\n\n   \n5584999990002", 0, anyE164);
    expect(out.targets).toHaveLength(2);
    expect(out.invalid).toBe(0);
    expect(out.skipped).toHaveLength(0);
  });

  it("keeps the order the operator supplied", () => {
    // A partially-sent run is only comprehensible if the order is stable.
    const out = parseTargetList(
      "5584999990003\n5584999990001\n5584999990002",
      0,
      anyE164,
    );
    expect(out.targets.map((t) => t.number)).toEqual([
      "5584999990003",
      "5584999990001",
      "5584999990002",
    ]);
  });

  // A pt-BR spreadsheet exports with semicolons precisely because the comma is
  // the decimal separator. Splitting on comma would turn one amount into two
  // columns and shift every variable after it.
  it("keeps a decimal comma inside a quoted value", () => {
    const out = parseTargetList(
      '5584999990001,Ana,"R$ 1.234,56"',
      1,
      anyE164,
    );
    expect(out.targets[0].variables).toEqual(["R$ 1.234,56"]);
  });

  it("prefers semicolons over commas when both appear", () => {
    const out = parseTargetList("5584999990001;Ana;R$ 1.234,56", 1, anyE164);
    expect(out.targets[0].name).toBe("Ana");
    expect(out.targets[0].variables).toEqual(["R$ 1.234,56"]);
  });

  it("prefers tabs, which a copied spreadsheet column uses", () => {
    const out = parseTargetList("5584999990001\tAna\tR$ 90", 1, anyE164);
    expect(out.targets[0].variables).toEqual(["R$ 90"]);
  });

  it("unescapes a doubled quote inside a quoted value", () => {
    const out = parseTargetList('5584999990001,Ana,"say ""hi"""', 1, anyE164);
    expect(out.targets[0].variables).toEqual(['say "hi"']);
  });

  it("honours a stricter validator", () => {
    // The official channel pins Brazil; the parser itself must not decide.
    const brazilOnly = (digits: string) => /^55\d{10,11}$/.test(digits);
    const out = parseTargetList("5584999990001\n12025550123", 0, brazilOnly);
    expect(out.targets).toHaveLength(1);
    expect(out.invalid).toBe(1);
  });
});
