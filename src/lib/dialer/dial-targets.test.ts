import { describe, expect, it } from "vitest";

import {
  DIAL_BLOCKERS,
  callableNumber,
  dialBlocker,
  dialTargetsFailure,
  numberRefusal,
  readDialTargets,
  type DialTargets,
} from "@/lib/dialer/dial-targets";

function targets(overrides: Partial<DialTargets> = {}): DialTargets {
  return {
    leadId: "lead-1",
    numbers: [
      { number: "5584994409684", identity: true },
      { number: "551133334444", identity: false, label: "landline", phoneId: "phone-1" },
    ],
    callable: "5584994409684",
    trunks: [{ id: "t1", name: "Matriz" }],
    ...overrides,
  };
}

describe("readDialTargets", () => {
  it("keeps the server answer as given", () => {
    const body = {
      leadId: "lead-1",
      refusal: "blocked",
      numbers: [{ number: "5584994409684", identity: true, refusal: "blocked" }],
      trunks: [],
      trunkRefusal: "no_dialable_trunk",
    };
    expect(readDialTargets(body)).toEqual(body);
  });

  it("keeps the number the lines were planned for and the phone each number belongs to", () => {
    const body = {
      leadId: "lead-1",
      callable: "551133334444",
      numbers: [{ number: "551133334444", identity: false, label: "landline", phoneId: "phone-1" }],
      trunks: [{ id: "t1", name: "Matriz" }],
    };
    expect(readDialTargets(body)).toEqual(body);
  });

  it("reads missing lists as empty", () => {
    expect(readDialTargets({ leadId: "" })).toEqual({ leadId: "", numbers: [], trunks: [] });
  });

  it("turns a refusal it does not know into a refusal, never into a callable number", () => {
    const read = readDialTargets({
      leadId: "lead-1",
      refusal: "brand_new_reason",
      numbers: [{ number: "100", identity: true, refusal: "brand_new_reason" }],
      trunks: [{ id: "t1", name: "Matriz" }],
      trunkRefusal: "another_new_reason",
    });
    expect(read.refusal).toBe("refused");
    expect(read.numbers[0].refusal).toBe("refused");
    expect(read.trunkRefusal).toBe("refused");
    expect(callableNumber(read)).toBeNull();
  });
});

describe("callableNumber", () => {
  it("is the number the server planned the lines for", () => {
    const plan = targets({
      numbers: [{ number: "1", identity: true, refusal: "opted_out" }, { number: "2", identity: false }, { number: "3", identity: false }],
      callable: "3",
    });
    expect(callableNumber(plan)?.number).toBe("3");
  });

  it("is nothing when the server planned no number", () => {
    expect(callableNumber(targets({ callable: undefined }))).toBeNull();
  });

  it("is nothing when the planned number is not among the numbers or is refused", () => {
    expect(callableNumber(targets({ callable: "999" }))).toBeNull();
    expect(callableNumber(targets({ numbers: [{ number: "5584994409684", identity: true, refusal: "blocked" }] }))).toBeNull();
  });

  it("is nothing when every number is refused", () => {
    expect(callableNumber(targets({ numbers: [{ number: "1", identity: true, refusal: "blocked" }] }))).toBeNull();
  });
});

describe("numberRefusal", () => {
  it("names the refusal of the number being dialed", () => {
    const plan = targets({ numbers: [{ number: "5584994409684", identity: true, refusal: "opted_out" }] });
    expect(numberRefusal(plan, "5584994409684")).toBe("opted_out");
  });

  it("refuses a number the lead does not hold", () => {
    expect(numberRefusal(targets(), "5511000000000")).toBe("number_not_held");
  });

  it("lets a callable number through", () => {
    expect(numberRefusal(targets(), "551133334444")).toBeNull();
  });
});

describe("dialTargetsFailure", () => {
  const cases = [
    { status: 403, code: "forbidden", want: "forbidden" },
    { status: 403, code: undefined, want: "forbidden" },
    { status: 404, code: "lead_not_found", want: "lead_not_found" },
    { status: 503, code: "not_configured", want: "unavailable" },
    { status: 500, code: undefined, want: "unavailable" },
    { status: undefined, code: "timeout", want: "unavailable" },
  ] as const;

  for (const { status, code, want } of cases) {
    it(`reads ${status ?? "no status"} ${code ?? ""} as ${want}`, () => {
      expect(dialTargetsFailure({ status, code })).toBe(want);
    });
  }
});

describe("dialBlocker", () => {
  const ready = { readiness: null, status: "ready" as const, failure: null };

  const cases = [
    { name: "no permission comes first", input: { ...ready, readiness: "noPermission" as const, status: "loading" as const }, want: "noPermission" },
    { name: "the answer is still loading", input: { ...ready, status: "loading" as const }, want: "checking" },
    { name: "the answer failed", input: { ...ready, status: "error" as const, failure: "forbidden" as const }, want: "forbidden" },
    { name: "an error without a reason", input: { ...ready, status: "error" as const }, want: "unavailable" },
    { name: "the lead is refused", input: { ...ready, targets: targets({ refusal: "blocked", trunks: [] }) }, want: "blocked" },
    { name: "the lead has no number", input: { ...ready, targets: targets({ numbers: [], refusal: "no_number", trunks: [] }) }, want: "no_number" },
    { name: "every number is refused without a lead reason", input: { ...ready, targets: targets({ numbers: [{ number: "1", identity: true, refusal: "invalid_number" }] }) }, want: "no_number" },
    { name: "the caller may not call through lines", input: { ...ready, targets: targets({ trunks: [], trunkRefusal: "unauthorized" }) }, want: "unauthorized" },
    { name: "no line is connected", input: { ...ready, targets: targets({ trunks: [], trunkRefusal: "no_dialable_trunk" }) }, want: "no_dialable_trunk" },
    { name: "no line and no reason", input: { ...ready, targets: targets({ trunks: [] }) }, want: "no_dialable_trunk" },
    { name: "the call service is connecting", input: { ...ready, readiness: "connecting" as const, targets: targets() }, want: "connecting" },
    { name: "a call is live", input: { ...ready, readiness: "busy" as const, targets: targets() }, want: "busy" },
    { name: "a ready answer without targets", input: { ...ready }, want: "unavailable" },
    { name: "nothing stands in the way", input: { ...ready, targets: targets() }, want: null },
  ];

  for (const { name, input, want } of cases) {
    it(`answers ${want ?? "nothing"} when ${name}`, () => {
      expect(dialBlocker(input)).toBe(want);
    });
  }

  it("checks one number of the lead on its own", () => {
    const plan = targets({ numbers: [{ number: "1", identity: true }, { number: "2", identity: false, refusal: "blocked" }], callable: "1" });
    expect(dialBlocker({ ...ready, targets: plan, number: "1" })).toBeNull();
    expect(dialBlocker({ ...ready, targets: plan, number: "2" })).toBe("blocked");
    expect(dialBlocker({ ...ready, targets: plan, number: "3" })).toBe("number_not_held");
    expect(dialBlocker({ ...ready, targets: { ...plan, trunks: [], trunkRefusal: "unauthorized" }, number: "1" })).toBe("unauthorized");
    expect(dialBlocker({ ...ready, readiness: "busy", targets: plan, number: "1" })).toBe("busy");
    expect(dialBlocker({ ...ready, status: "loading", targets: plan, number: "1" })).toBe("checking");
  });

  it("names the lines when the lines alone are forbidden", () => {
    expect(dialBlocker({ ...ready, status: "error", failure: "forbidden", linesOnly: true })).toBe("linesForbidden");
    expect(dialBlocker({ ...ready, status: "error", failure: "unavailable", linesOnly: true })).toBe("unavailable");
  });

  it("checks the lines alone when no lead is named", () => {
    const lines = targets({ leadId: "", numbers: [] });
    expect(dialBlocker({ ...ready, targets: lines, linesOnly: true })).toBeNull();
    expect(dialBlocker({ ...ready, targets: { ...lines, trunks: [], trunkRefusal: "no_dialable_trunk" }, linesOnly: true })).toBe("no_dialable_trunk");
  });

  it("lists every blocker it can answer", () => {
    expect([...DIAL_BLOCKERS].sort()).toEqual(
      [
        "noPermission",
        "connecting",
        "busy",
        "checking",
        "forbidden",
        "linesForbidden",
        "lead_not_found",
        "unavailable",
        "blocked",
        "opted_out",
        "invalid_number",
        "no_number",
        "number_not_held",
        "unauthorized",
        "no_dialable_trunk",
        "refused",
      ].sort(),
    );
  });
});
