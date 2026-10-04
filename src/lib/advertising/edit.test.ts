import { describe, expect, it } from "vitest";

import {
  bidInputOf,
  budgetInputOf,
  buildObjectEdit,
  editExpected,
  editFormOf,
  editInputProblems,
  endAtOf,
  endDayOf,
  startDayOf,
  EDIT_GROUP_FIELDS,
  editGroupsFor,
  expandPlacements,
  fieldChanged,
  fieldEdit,
  manualPlacements,
  type EditForm,
} from "./edit";
import type { AdEditableObject, AdRow } from "./types";

const TZ = "America/Sao_Paulo";

const row = (overrides: Partial<AdRow> = {}): AdRow => ({
  metaId: "1",
  level: "adset",
  name: "Conjunto",
  status: "ACTIVE",
  effectiveStatus: "ACTIVE",
  delivery: "active",
  isOn: true,
  canToggle: true,
  dailyBudget: 5000,
  lifetimeBudget: 0,
  issues: [],
  metrics: {
    currency: "BRL",
    spend: 0,
    impressions: 0,
    clicks: 0,
    linkClicks: 0,
    results: 0,
    resultAction: "",
    mixedResults: false,
    costPerResult: null,
    conversations: 0,
    costPerConversation: null,
    cpc: null,
    cpm: null,
    ctr: null,
  },
  outcome: { conversations: 0, leads: 0, wonDeals: 0, revenue: 0, costPerConversation: null, costPerLead: null, roas: null },
  ...overrides,
});

const detail = (overrides: Partial<AdEditableObject> = {}): AdEditableObject => ({
  row: row({ endTime: "2026-10-11T03:00:00Z" }),
  budget: { kind: "DAILY", amount: 5000 },
  bid: { strategy: "LOWEST_COST_WITHOUT_CAP" },
  targeting: { locations: [{ kind: "country", key: "BR", name: "Brasil" }], ageMin: 18, ageMax: 65, genders: [], advantageAudience: false },
  placements: { automatic: true },
  schedule: null,
  creative: null,
  identity: null,
  ...overrides,
});

describe("start day", () => {
  it("shows the day the object started, in the account timezone", () => {
    expect(startDayOf("2026-10-04T02:27:00Z", TZ)).toBe("2026-10-03");
    expect(startDayOf(null, TZ)).toBe("");
  });
});

describe("end day", () => {
  it("shows the last day the object runs, in the account timezone", () => {
    expect(endDayOf("2026-10-11T03:00:00Z", TZ)).toBe("2026-10-10");
    expect(endDayOf(undefined, TZ)).toBe("");
  });

  it("ends at midnight after the chosen day", () => {
    expect(endAtOf("2026-10-10", TZ)).toBe("2026-10-11T03:00:00.000Z");
    expect(endAtOf("", TZ)).toBeNull();
  });
});

describe("buildObjectEdit", () => {
  const original = editFormOf(detail(), TZ, {}, "BRL");

  it("reads budgets and bids into editable inputs", () => {
    expect(original.budget).toEqual({ kind: "DAILY", input: "50,00" });
    expect(original.bid).toEqual({ strategy: "LOWEST_COST_WITHOUT_CAP", amountInput: "", roasInput: "" });
    expect(bidInputOf({ strategy: "LOWEST_COST_WITH_MIN_ROAS", roasFloor: 2.5 }, "BRL").roasInput).toBe("2,5");
    expect(budgetInputOf(null, "BRL")).toBeNull();
  });

  it("sends nothing when nothing changed", () => {
    expect(buildObjectEdit(original, { ...original, name: " Conjunto " }, TZ, "BRL")).toEqual({});
    expect(buildObjectEdit(original, { ...original, budget: { kind: "DAILY", input: "50" } }, TZ, "BRL")).toEqual({});
  });

  it("sends only the fields that changed", () => {
    const current: EditForm = { ...original, name: "Novo", budget: { kind: "DAILY", input: "90" } };
    expect(buildObjectEdit(original, current, TZ, "BRL")).toEqual({ name: "Novo", budget: { kind: "DAILY", amount: 9000 } });
  });

  it("keeps the budget kind the object was created with", () => {
    const current: EditForm = { ...original, budget: { kind: "LIFETIME", input: "90" } };
    expect(buildObjectEdit(original, current, TZ, "BRL").budget).toEqual({ kind: "DAILY", amount: 9000 });
  });

  it("sends a clean bid with only the value its strategy uses", () => {
    const current: EditForm = { ...original, bid: { strategy: "COST_CAP", amountInput: "15", roasInput: "2" } };
    expect(buildObjectEdit(original, current, TZ, "BRL")).toEqual({ bid: { strategy: "COST_CAP", amount: 1500 } });
  });

  it("flags inputs that cannot be sent", () => {
    expect(editInputProblems({ ...original, name: " ", budget: { kind: "DAILY", input: "abc" } }, "BRL")).toEqual(["name", "budget"]);
    expect(editInputProblems({ ...original, bid: { strategy: "COST_CAP", amountInput: "", roasInput: "" } }, "BRL")).toEqual(["bidAmount"]);
    expect(editInputProblems({ ...original, bid: { strategy: "LOWEST_COST_WITH_MIN_ROAS", amountInput: "", roasInput: "0" } }, "BRL")).toEqual([
      "roasFloor",
    ]);
    expect(editInputProblems(original, "BRL")).toEqual([]);
  });

  it("treats empty lists and missing lists as the same targeting", () => {
    const current: EditForm = { ...original, targeting: { ...original.targeting!, genders: undefined, interests: [] } };
    expect(buildObjectEdit(original, current, TZ, "BRL")).toEqual({});
  });

  it("sends the whole targeting when any part of it changed", () => {
    const targeting = { ...original.targeting!, ageMin: 25 };
    expect(buildObjectEdit(original, { ...original, targeting }, TZ, "BRL")).toEqual({ targeting });
  });

  it("converts a new end day to the instant Meta expects", () => {
    expect(buildObjectEdit(original, { ...original, endDay: "2026-10-20" }, TZ, "BRL")).toEqual({ endAt: "2026-10-21T03:00:00.000Z" });
  });

  it("sends schedule and placements only when they changed", () => {
    const schedule = [{ days: [1, 2], startMinute: 480, endMinute: 1080 }];
    const placements = { automatic: false, platforms: ["facebook"] };
    expect(buildObjectEdit(original, { ...original, schedule, placements }, TZ, "BRL")).toEqual({ schedule, placements });
  });

  it("leaves ad level forms without budget, bid or targeting", () => {
    const form = editFormOf(detail({ row: row({ level: "ad" }), budget: null }), TZ, {}, "BRL");
    expect(form.bid).toBeNull();
    expect(form.budget).toBeNull();
    expect(form.targeting).toBeNull();
    expect(buildObjectEdit(form, { ...form, name: "Anúncio" }, TZ, "BRL")).toEqual({ name: "Anúncio" });
  });
});

describe("placements", () => {
  const catalog = { facebook: ["feed", "story"], instagram: ["stream", "reels"] };

  it("spells out every position of a platform Meta returned without a list", () => {
    expect(expandPlacements({ automatic: false, platforms: ["facebook"] }, catalog)).toEqual({
      automatic: false,
      platforms: ["facebook"],
      positions: { facebook: ["feed", "story"] },
    });
    expect(expandPlacements({ automatic: true }, catalog)).toEqual({ automatic: true });
  });

  it("does not report a change when the expanded form is saved untouched", () => {
    const form = editFormOf(detail({ placements: { automatic: false, platforms: ["instagram"] } }), TZ, catalog, "BRL");
    expect(buildObjectEdit(form, { ...form }, TZ, "BRL")).toEqual({});
  });

  it("starts manual placements from every platform and position", () => {
    expect(manualPlacements({ automatic: true, devices: ["mobile"] }, catalog)).toEqual({
      automatic: false,
      platforms: ["facebook", "instagram"],
      positions: { facebook: ["feed", "story"], instagram: ["stream", "reels"] },
      devices: ["mobile"],
    });
  });
});

describe("editExpected", () => {
  it("reads 422 expectations with or without the edit prefix", () => {
    expect(editExpected({ "edit.targeting.age": "invalid", budget: "too_many_changes" })).toEqual({
      "targeting.age": "invalid",
      budget: "too_many_changes",
    });
    expect(editExpected(undefined)).toEqual({});
  });
});

describe("field helpers", () => {
  const original = editFormOf(detail(), TZ, {}, "BRL");

  it("offers the field groups each level can edit", () => {
    expect(editGroupsFor("campaign")).toEqual(["name", "budgetBid"]);
    expect(editGroupsFor("adset")).toEqual(["name", "budgetBid", "endDay", "schedule", "targeting", "placements"]);
    expect(editGroupsFor("ad")).toEqual(["name"]);
    expect(EDIT_GROUP_FIELDS.budgetBid).toEqual(["budget", "bid"]);
  });

  it("reports a field as changed only when its sendable value differs", () => {
    expect(fieldChanged("budget", original, { ...original, budget: { kind: "DAILY", input: "50" } }, TZ, "BRL")).toBe(false);
    expect(fieldChanged("budget", original, { ...original, budget: { kind: "DAILY", input: "abc" } }, TZ, "BRL")).toBe(false);
    expect(fieldChanged("budget", original, { ...original, budget: { kind: "DAILY", input: "60" } }, TZ, "BRL")).toBe(true);
    expect(fieldChanged("endDay", original, { ...original, endDay: "" }, TZ, "BRL")).toBe(false);
  });

  it("builds a field's edit from the current form even when it did not change", () => {
    expect(fieldEdit("budget", original, original, TZ, "BRL")).toEqual({ budget: { kind: "DAILY", amount: 5000 } });
    expect(fieldEdit("schedule", original, original, TZ, "BRL")).toEqual({});
  });
});
