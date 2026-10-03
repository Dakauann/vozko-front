import { describe, expect, it } from "vitest";

import {
  activeGroups,
  failedOutcomes,
  fieldState,
  mergeOutcomes,
  multiAnalysis,
  multiCrumbs,
  multiFields,
  multiLoad,
  multiObjects,
  multiProblems,
  multiSavePlan,
  parseMultiTarget,
  planIsEmpty,
  resetGroup,
  statusState,
  withOutcomes,
  type MultiEditInput,
  type MultiGroup,
  type MultiValues,
} from "./editor-multi";
import { fixtureRow } from "./manager-test-fixtures";
import type { AdEditableObject, AdLevel, AdRow } from "./types";

const TZ = "America/Sao_Paulo";

const row = (overrides: Partial<AdRow> = {}): AdRow => fixtureRow({ level: "adset", ...overrides });

const object = (overrides: Partial<Omit<AdEditableObject, "row">> & { row?: Partial<AdRow> } = {}): AdEditableObject => {
  const { row: rowOverrides, ...rest } = overrides;
  return {
    row: row(rowOverrides),
    budget: { kind: "DAILY", amount: 5000 },
    bid: { strategy: "LOWEST_COST_WITHOUT_CAP" },
    targeting: { locations: [{ kind: "country", key: "BR", name: "Brasil" }], ageMin: 18, ageMax: 65, genders: [], advantageAudience: false },
    placements: { automatic: true },
    schedule: null,
    creative: null,
    identity: null,
    ...rest,
  };
};

const twoAdSets = () => [
  object({ row: { metaId: "1", name: "Um", optimizationGoal: "CONVERSATIONS", destinationType: "WHATSAPP" } }),
  object({ row: { metaId: "2", name: "Dois", optimizationGoal: "CONVERSATIONS", destinationType: "WHATSAPP" } }),
];

function editInput(level: AdLevel, details: AdEditableObject[], change: (values: MultiValues) => MultiValues, opened: MultiGroup[] = []): MultiEditInput {
  const objects = multiObjects(details, TZ, {}, "BRL");
  const first = { form: objects[0].form, text: objects[0].text };
  return { level, fields: multiFields(level, objects), opened, first, current: change(first), timezone: TZ, currency: "BRL" };
}

describe("parseMultiTarget", () => {
  it("accepts 2 to 50 unique published ids with an account", () => {
    expect(parseMultiTarget("1,2", "acc")).toEqual({ accountId: "acc", metaIds: ["1", "2"] });
    expect(parseMultiTarget("1", "acc")).toBeNull();
    expect(parseMultiTarget("1,1", "acc")).toBeNull();
    expect(parseMultiTarget("1,,2", "acc")).toBeNull();
    expect(parseMultiTarget("1,2", null)).toBeNull();
    expect(parseMultiTarget(null, "acc")).toBeNull();
    expect(parseMultiTarget("1,d1:campaign", "acc")).toBeNull();
    const many = Array.from({ length: 51 }, (_, index) => String(index)).join(",");
    expect(parseMultiTarget(many, "acc")).toBeNull();
  });
});

describe("multiLoad", () => {
  it("is ready only when every object loaded on one level", () => {
    const [one, two] = twoAdSets();
    expect(
      multiLoad([
        { metaId: "1", detail: one, message: null },
        { metaId: "2", detail: two, message: null },
      ]),
    ).toEqual({ kind: "ready", level: "adset", objects: [one, two] });
  });

  it("fails closed and lists each object when one did not load", () => {
    const [one] = twoAdSets();
    expect(
      multiLoad([
        { metaId: "1", detail: one, message: null },
        { metaId: "2", detail: null, message: "missing" },
      ]),
    ).toEqual({
      kind: "failed",
      reason: "load",
      entries: [
        { metaId: "1", name: "Um", ok: true, message: null },
        { metaId: "2", name: null, ok: false, message: "missing" },
      ],
    });
  });

  it("fails when the objects sit on different levels or the answer is for another object", () => {
    const [one] = twoAdSets();
    const campaign = object({ row: { metaId: "2", level: "campaign" } });
    expect(
      multiLoad([
        { metaId: "1", detail: one, message: null },
        { metaId: "2", detail: campaign, message: null },
      ]).kind === "failed",
    ).toBe(true);
    const result = multiLoad([
      { metaId: "1", detail: one, message: null },
      { metaId: "3", detail: campaign, message: null },
    ]);
    expect(result.kind === "failed" && result.reason).toBe("load");
  });
});

describe("fieldState", () => {
  it("is same when every value matches under the shared equality, else mixed", () => {
    expect(fieldState([{ metaId: "1", name: "a", value: { list: [] } }, { metaId: "2", name: "b", value: {} }])).toEqual({ kind: "same", value: { list: [] } });
    const mixed = [
      { metaId: "1", name: "a", value: 1 },
      { metaId: "2", name: "b", value: 2 },
    ];
    expect(fieldState(mixed)).toEqual({ kind: "mixed", values: mixed });
    expect(fieldState([])).toEqual({ kind: "mixed", values: [] });
  });
});

describe("multiFields", () => {
  it("offers the published editor groups of the level and marks differences", () => {
    const objects = multiObjects(twoAdSets(), TZ, {}, "BRL");
    const fields = multiFields("adset", objects);
    expect(fields.map((field) => field.group)).toEqual(["name", "budgetBid", "endDay", "targeting", "placements"]);
    expect(fields.find((field) => field.group === "name")?.state.kind).toBe("mixed");
    expect(fields.find((field) => field.group === "budgetBid")?.state).toEqual({
      kind: "same",
      value: [{ kind: "DAILY", input: "50,00" }, { strategy: "LOWEST_COST_WITHOUT_CAP", amountInput: "", roasInput: "" }],
    });
    expect(fields.every((field) => field.blocker === null)).toBe(true);
  });

  it("offers the schedule only when every object has a lifetime budget", () => {
    const lifetime = twoAdSets().map((detail) => ({ ...detail, budget: { kind: "LIFETIME" as const, amount: 9000 } }));
    expect(multiFields("adset", multiObjects(lifetime, TZ, {}, "BRL")).map((field) => field.group)).toContain("schedule");
  });

  it("blocks groups that cannot take one value for all", () => {
    const [one, two] = twoAdSets();
    const fields = multiFields(
      "adset",
      multiObjects([one, { ...two, budget: null, targeting: null, row: { ...two.row, destinationType: "WEBSITE" } }], TZ, {}, "BRL"),
    );
    const blocker = (group: MultiGroup) => fields.find((field) => field.group === group)?.blocker;
    expect(blocker("budgetBid")).toBe("budgetShape");
    expect(blocker("targeting")).toBe("missing");
    expect(blocker("placements")).toBe("destination");
    const goals = multiFields("adset", multiObjects([one, { ...two, row: { ...two.row, optimizationGoal: "LINK_CLICKS" } }], TZ, {}, "BRL"));
    expect(goals.find((field) => field.group === "budgetBid")?.blocker).toBe("goal");
  });

  it("adds the ad text fields on ads", () => {
    const ads = [
      object({ row: { metaId: "1", level: "ad" }, budget: null, bid: null, targeting: null, placements: null, creative: { format: "IMAGE", primaryText: "Oi", headline: "T" } }),
      object({ row: { metaId: "2", level: "ad" }, budget: null, bid: null, targeting: null, placements: null, creative: { format: "IMAGE", primaryText: "Olá", headline: "T" } }),
    ];
    const fields = multiFields("ad", multiObjects(ads, TZ, {}, "BRL"));
    expect(fields.map((field) => field.group)).toEqual(["name", "primaryText", "headline", "description", "link"]);
    expect(fields.find((field) => field.group === "primaryText")?.state.kind).toBe("mixed");
    expect(fields.find((field) => field.group === "headline")?.state).toEqual({ kind: "same", value: "T" });
  });
});

describe("multiSavePlan", () => {
  it("is empty until something changes", () => {
    const input = editInput("adset", twoAdSets(), (values) => values);
    expect(activeGroups(input)).toEqual([]);
    expect(planIsEmpty(multiSavePlan(input))).toBe(true);
  });

  it("sends only the changed fields of a shared group", () => {
    const input = editInput("adset", twoAdSets(), (values) => ({ ...values, form: { ...values.form, budget: { kind: "DAILY", input: "70" } } }));
    expect(multiSavePlan(input)).toEqual({ edit: { budget: { kind: "DAILY", amount: 7000 } }, changes: [] });
  });

  it("sends a mixed group only after it was opened, with its whole value", () => {
    const renamed = (values: MultiValues) => ({ ...values, form: { ...values.form, name: "Novo" } });
    expect(planIsEmpty(multiSavePlan(editInput("adset", twoAdSets(), renamed)))).toBe(true);
    expect(multiSavePlan(editInput("adset", twoAdSets(), (values) => values, ["name"]))).toEqual({ edit: { name: "Um" }, changes: [] });
    expect(multiSavePlan(editInput("adset", twoAdSets(), renamed, ["name"]))).toEqual({ edit: { name: "Novo" }, changes: [] });
  });

  it("never sends a blocked group", () => {
    const [one, two] = twoAdSets();
    const input = editInput(
      "adset",
      [one, { ...two, row: { ...two.row, optimizationGoal: "LINK_CLICKS" } }],
      (values) => ({ ...values, form: { ...values.form, budget: { kind: "DAILY", input: "70" } } }),
      ["budgetBid"],
    );
    expect(planIsEmpty(multiSavePlan(input))).toBe(true);
  });

  it("turns ad text fields into bulk set changes", () => {
    const ads = [
      object({ row: { metaId: "1", level: "ad" }, creative: { format: "IMAGE", primaryText: "Oi" } }),
      object({ row: { metaId: "2", level: "ad" }, creative: { format: "IMAGE", primaryText: "Olá" } }),
    ];
    const input = editInput("ad", ads, (values) => ({ ...values, text: { ...values.text, primaryText: " Novo ", headline: "Título" } }), ["primaryText"]);
    expect(multiSavePlan(input)).toEqual({
      edit: {},
      changes: [
        { field: "primaryText", mode: "set", value: "Novo" },
        { field: "headline", mode: "set", value: "Título" },
      ],
    });
  });

  it("reports input problems only for groups that will be sent", () => {
    const blankName = (values: MultiValues) => ({ ...values, form: { ...values.form, name: " " } });
    expect(multiProblems(editInput("adset", twoAdSets(), blankName))).toEqual([]);
    expect(multiProblems(editInput("adset", twoAdSets(), blankName, ["name"]))).toEqual(["name"]);
  });

  it("puts a group back to the first object's value", () => {
    const input = editInput("adset", twoAdSets(), (values) => ({ ...values, form: { ...values.form, name: "Novo", endDay: "2026-12-01" } }));
    expect(resetGroup("name", input.current, input.first).form).toEqual({ ...input.first.form, endDay: "2026-12-01" });
  });
});

describe("outcomes", () => {
  it("counts an object as saved only when every request succeeded for it", () => {
    const saved = row({ metaId: "1", name: "Salvo" });
    const merged = mergeOutcomes(
      ["1", "2"],
      [
        [
          { metaId: "1", ok: true, object: saved, message: null },
          { metaId: "2", ok: true, object: undefined, message: null },
        ],
        [{ metaId: "1", ok: true, object: undefined, message: null }],
      ],
    );
    expect(merged).toEqual([
      { metaId: "1", ok: true, object: saved, message: null },
      { metaId: "2", ok: false, object: undefined, message: null },
    ]);
    expect(mergeOutcomes(["1"], [])).toEqual([{ metaId: "1", ok: false, object: undefined, message: null }]);
    expect(failedOutcomes(["1"], "erro")).toEqual([{ metaId: "1", ok: false, object: undefined, message: "erro" }]);
  });

  it("applies returned rows to the loaded objects", () => {
    const [one, two] = twoAdSets();
    const paused = { ...one.row, isOn: false };
    const next = withOutcomes([one, two], [{ metaId: "1", ok: true, object: paused, message: null }]);
    expect(next[0].row).toBe(paused);
    expect(next[1]).toBe(two);
  });
});

describe("multiCrumbs and status", () => {
  it("counts distinct parents like Meta's breadcrumb", () => {
    const ads = [
      row({ metaId: "1", level: "ad", campaignId: "c1", adSetId: "s1" }),
      row({ metaId: "2", level: "ad", campaignId: "c1", adSetId: "s2" }),
    ];
    expect(multiCrumbs(ads)).toEqual([
      { level: "campaign", count: 1 },
      { level: "adset", count: 2 },
      { level: "ad", count: 2 },
    ]);
    expect(multiCrumbs([row({ metaId: "1", level: "campaign" }), row({ metaId: "2", level: "campaign" })])).toEqual([{ level: "campaign", count: 2 }]);
    expect(multiCrumbs([row({ metaId: "1", campaignId: "c1" }), row({ metaId: "2" })])).toEqual([{ level: "adset", count: 2 }]);
  });

  it("reads mixed statuses", () => {
    expect(statusState([row({ metaId: "1" }), row({ metaId: "2" })])).toEqual({ kind: "same", value: true });
    expect(statusState([row({ metaId: "1" }), row({ metaId: "2", isOn: false })]).kind).toBe("mixed");
  });
});

describe("multiAnalysis", () => {
  it("shows each fact once, with every object's value when they differ", () => {
    const facts = multiAnalysis(twoAdSets(), TZ);
    expect(facts.find((fact) => fact.key === "name")?.state).toEqual({
      kind: "mixed",
      values: [
        { metaId: "1", name: "Um", value: { kind: "text", text: "Um" } },
        { metaId: "2", name: "Dois", value: { kind: "text", text: "Dois" } },
      ],
    });
    expect(facts.find((fact) => fact.key === "budget")?.state).toEqual({ kind: "same", value: { kind: "budget", budget: { kind: "DAILY", amount: 5000 } } });
  });
});
