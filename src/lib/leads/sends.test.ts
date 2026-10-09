import { describe, expect, it } from "vitest";

import deMessages from "@/i18n/messages/de.json";
import enMessages from "@/i18n/messages/en.json";
import esMessages from "@/i18n/messages/es.json";
import ptMessages from "@/i18n/messages/pt.json";
import type { CustomFieldDefinition } from "@/lib/crm/custom-fields";

import {
  LEAD_FIELD_SOURCES,
  LEAD_SEND_ERROR_CODES,
  SEND_COUNTED_REASONS,
  SEND_SKIP_REASONS,
  bindingChoices,
  bindingFieldKey,
  bindingPreviewValues,
  bindingsReady,
  customSource,
  defaultBindings,
  leadSendStates,
  messageSendParams,
  parseSendQuote,
  parseSendReview,
  countedRows,
  quoteCurrency,
  reasonRows,
  reviewSkipRows,
  sendBudgetView,
  sendChannelOf,
  sendRequestOf,
  sizedBindings,
  templateSendParams,
  type LeadSendBlocker,
  type SendReview,
  type VariableBinding,
} from "./sends";

function field(key: string, extra: Partial<CustomFieldDefinition> = {}): CustomFieldDefinition {
  return {
    id: key,
    workspaceId: "ws-1",
    objectType: "lead",
    key,
    label: key.toUpperCase(),
    type: "text",
    required: false,
    sensitive: false,
    position: 0,
    readable: true,
    createdAt: "",
    updatedAt: "",
    ...extra,
  };
}

const QUOTE = {
  count: 1122,
  parts: 1,
  splitRequired: false,
  maxPerCampaign: 150000,
  category: "MARKETING",
  unitPriceMicros: 62500,
  costMicros: 70125000,
  balanceMicros: 230000000,
  currency: "USD",
  affordable: true,
  capRemaining: 38878,
  fits: 1122,
};

const REVIEW = {
  channel: "official",
  parts: [{ campaignId: "c-1", name: "Matrículas", status: "STOPPED", entries: 1204, eligible: 1122 }],
  entries: 1204,
  eligible: 1122,
  skipped: { no_identity: 41, blocked: 6, opted_out: 9, cooldown: 19, missing_variable: 7, over_cap: 0 },
  counted: { window_open: 52, no_consent_recorded: 310 },
  quote: QUOTE,
  started: false,
};

describe("variable bindings", () => {
  it("offers the lead fields, then the readable fields that are not sensitive", () => {
    const choices = bindingChoices([
      field("bairro_antigo"),
      field("saude", { sensitive: true }),
      field("oculto", { readable: false }),
    ]);
    expect(choices.map((choice) => choice.source)).toEqual([
      "literal",
      ...Object.keys(LEAD_FIELD_SOURCES),
      "lead.custom:bairro_antigo",
    ]);
    expect(choices.at(-1)?.field?.label).toBe("BAIRRO_ANTIGO");
  });

  it("reads the field key back from a custom source", () => {
    expect(bindingFieldKey(customSource("interesse"))).toBe("interesse");
    expect(bindingFieldKey("lead.first_name")).toBeNull();
  });

  it("starts the first variable on the first name and the rest as fixed text to fill", () => {
    expect(defaultBindings(3)).toEqual([
      { source: "lead.first_name" },
      { source: "literal", value: "" },
      { source: "literal", value: "" },
    ]);
    expect(defaultBindings(0)).toEqual([]);
  });

  it("keeps the chosen bindings when the variable count changes", () => {
    const chosen: VariableBinding[] = [{ source: "lead.district" }, { source: "literal", value: "Prisma" }];
    expect(sizedBindings(chosen, 3)).toEqual([...chosen, { source: "literal", value: "" }]);
    expect(sizedBindings(chosen, 1)).toEqual([{ source: "lead.district" }]);
  });

  it("is ready only with one binding per variable and no empty fixed text", () => {
    expect(bindingsReady([{ source: "lead.first_name" }], 1)).toBe(true);
    expect(bindingsReady([{ source: "literal", value: "  " }], 1)).toBe(false);
    expect(bindingsReady([{ source: "lead.first_name" }], 2)).toBe(false);
    expect(bindingsReady([], 0)).toBe(true);
  });

  it("shows fixed text as written and a lead field by its label", () => {
    const values = bindingPreviewValues(
      [{ source: "literal", value: " Prisma " }, { source: "lead.district" }],
      (source) => (source === "lead.district" ? "Bairro" : source),
    );
    expect(values).toEqual(["Prisma", "[Bairro]"]);
  });
});

describe("send parameters", () => {
  const template = {
    name: " Matrículas 2027 ",
    departmentId: "",
    departmentRequired: false,
    split: false,
    businessPhoneId: "bp-1",
    templateId: "tpl-1",
    bindings: [{ source: "lead.first_name" as const }, { source: "literal" as const, value: " Prisma " }],
    slots: 2,
  };

  it("builds the template parameters with trimmed text", () => {
    expect(templateSendParams(template)).toEqual({
      name: "Matrículas 2027",
      businessPhoneId: "bp-1",
      templateId: "tpl-1",
      bindings: [{ source: "lead.first_name" }, { source: "literal", value: "Prisma" }],
    });
  });

  it("waits for every required choice before asking the server", () => {
    expect(templateSendParams({ ...template, name: " " })).toBeNull();
    expect(templateSendParams({ ...template, templateId: "" })).toBeNull();
    expect(templateSendParams({ ...template, businessPhoneId: "" })).toBeNull();
    expect(templateSendParams({ ...template, slots: 3 })).toBeNull();
    expect(templateSendParams({ ...template, departmentRequired: true })).toBeNull();
  });

  it("sends the department and the split only when chosen", () => {
    expect(templateSendParams({ ...template, departmentRequired: true, departmentId: "d-1", split: true })).toMatchObject({
      departmentId: "d-1",
      split: true,
    });
  });

  it("builds the unofficial parameters with the pacing", () => {
    const params = messageSendParams(
      {
        name: "Aviso",
        departmentId: "d-1",
        departmentRequired: true,
        split: false,
        instanceId: "in-1",
        message: { kind: "text", bodies: ["Oi {{1}}"] },
        sendDelayMinMs: 3000,
        sendDelayMaxMs: 12000,
        dailyCap: 0,
        bindings: [{ source: "lead.first_name" }],
        slots: 1,
      },
      true,
    );
    expect(params).toEqual({
      name: "Aviso",
      departmentId: "d-1",
      instanceId: "in-1",
      message: { kind: "text", bodies: ["Oi {{1}}"] },
      sendDelayMinMs: 3000,
      sendDelayMaxMs: 12000,
      bindings: [{ source: "lead.first_name" }],
    });
  });

  it("refuses an unofficial message that is not complete", () => {
    const draft = {
      name: "Aviso",
      departmentId: "",
      departmentRequired: false,
      split: false,
      instanceId: "in-1",
      message: { kind: "text" as const, bodies: [""] },
      sendDelayMinMs: 0,
      sendDelayMaxMs: 0,
      dailyCap: 0,
      bindings: [],
      slots: 0,
    };
    expect(messageSendParams(draft, false)).toBeNull();
    expect(messageSendParams({ ...draft, instanceId: "" }, true)).toBeNull();
  });

  it("names the channel of each send action and the campaigns of a review", () => {
    expect(sendChannelOf("send_template")).toBe("official");
    expect(sendChannelOf("send_unofficial")).toBe("unofficial");
    const review = parseSendReview(REVIEW) as SendReview;
    expect(sendRequestOf(review, 40)).toEqual({ channel: "official", campaignIds: ["c-1"], firstN: 40 });
    expect(sendRequestOf(review)).toEqual({ channel: "official", campaignIds: ["c-1"] });
  });
});

describe("send answers", () => {
  it("reads a quote and refuses a malformed one", () => {
    expect(parseSendQuote(QUOTE)).toEqual(QUOTE);
    expect(parseSendQuote({ ...QUOTE, fits: -1 })).toBeNull();
    expect(parseSendQuote({ ...QUOTE, capRemaining: undefined })).toEqual({ ...QUOTE, capRemaining: undefined });
    expect(parseSendQuote({ ...QUOTE, unitPriceMicros: "1" })).toBeNull();
  });

  it("reads a review and refuses an unknown channel or a bad count", () => {
    expect(parseSendReview(REVIEW)?.eligible).toBe(1122);
    expect(parseSendReview({ ...REVIEW, channel: "sms" })).toBeNull();
    expect(parseSendReview({ ...REVIEW, skipped: { blocked: "6" } })).toBeNull();
    expect(parseSendReview({ ...REVIEW, parts: [{ campaignId: "c-1" }] })).toBeNull();
    expect(parseSendReview({ ...REVIEW, quote: null })).toBeNull();
  });

  it("lists the skipped reasons with a count in the order the review shows them", () => {
    const review = parseSendReview({ ...REVIEW, skipped: { ...REVIEW.skipped, gone_elsewhere: 2 } }) as SendReview;
    expect(reviewSkipRows(review)).toEqual([
      { reason: "no_identity", count: 41 },
      { reason: "blocked", count: 6 },
      { reason: "opted_out", count: 9 },
      { reason: "cooldown", count: 19 },
      { reason: "missing_variable", count: 7 },
      { reason: "gone_elsewhere", count: 2 },
    ]);
  });

  it("reads the missing variables per slot and the cooldown days, and refuses malformed ones", () => {
    const missingVariables = [
      { slot: 1, source: "lead.first_name", count: 3 },
      { slot: 2, count: 2 },
    ];
    const review = parseSendReview({ ...REVIEW, missingVariables, cooldownDays: 30 });
    expect(review?.missingVariables).toEqual(missingVariables);
    expect(review?.cooldownDays).toBe(30);
    const older = parseSendReview(REVIEW);
    expect(older?.missingVariables).toEqual([]);
    expect(older && "cooldownDays" in older).toBe(false);
    expect(parseSendReview({ ...REVIEW, missingVariables: [{ slot: 0, count: 1 }] })).toBeNull();
    expect(parseSendReview({ ...REVIEW, missingVariables: [{ slot: 1, count: -1 }] })).toBeNull();
    expect(parseSendReview({ ...REVIEW, missingVariables: [{ slot: 1, source: 7, count: 1 }] })).toBeNull();
    expect(parseSendReview({ ...REVIEW, missingVariables: { slot: 1 } })).toBeNull();
    expect(parseSendReview({ ...REVIEW, cooldownDays: "30" })).toBeNull();
  });

  it("states the cooldown days on the cooldown row when the entries recorded them", () => {
    const review = parseSendReview({ ...REVIEW, cooldownDays: 3 }) as SendReview;
    expect(reviewSkipRows(review).find((row) => row.reason === "cooldown")).toEqual({ reason: "cooldown", count: 19, days: 3 });
    const older = parseSendReview(REVIEW) as SendReview;
    expect(reviewSkipRows(older).find((row) => row.reason === "cooldown")).toEqual({ reason: "cooldown", count: 19 });
  });

  it("names the one missing variable in place of the total when it explains every skipped lead", () => {
    const review = parseSendReview({ ...REVIEW, missingVariables: [{ slot: 2, source: "lead.district", count: 7 }] }) as SendReview;
    expect(reviewSkipRows(review).filter((row) => row.reason === "missing_variable")).toEqual([
      { reason: "missing_variable", count: 7, slot: { slot: 2, source: "lead.district" } },
    ]);
  });

  it("keeps the lead total and lists each slot under it when the slots do not add up to it", () => {
    const review = parseSendReview({
      ...REVIEW,
      missingVariables: [
        { slot: 1, source: "lead.first_name", count: 5 },
        { slot: 2, source: "lead.district", count: 4 },
        { slot: 3, count: 0 },
      ],
    }) as SendReview;
    expect(reviewSkipRows(review).filter((row) => row.reason === "missing_variable")).toEqual([
      { reason: "missing_variable", count: 7 },
      { reason: "missing_variable", count: 5, slot: { slot: 1, source: "lead.first_name" }, nested: true },
      { reason: "missing_variable", count: 4, slot: { slot: 2, source: "lead.district" }, nested: true },
    ]);
    const unnamed = parseSendReview({ ...REVIEW, missingVariables: [{ slot: 2, count: 7 }] }) as SendReview;
    expect(reviewSkipRows(unnamed).filter((row) => row.reason === "missing_variable")).toEqual([
      { reason: "missing_variable", count: 7, slot: { slot: 2 } },
    ]);
    const partial = parseSendReview({ ...REVIEW, missingVariables: [{ slot: 2, source: "lead.district", count: 3 }] }) as SendReview;
    expect(reviewSkipRows(partial).filter((row) => row.reason === "missing_variable")).toEqual([
      { reason: "missing_variable", count: 7 },
      { reason: "missing_variable", count: 3, slot: { slot: 2, source: "lead.district" }, nested: true },
    ]);
  });

  it("orders reason counts by a known list, then the unknown ones, and drops empty ones", () => {
    expect(reasonRows({ gone: 2, odd: 1, unchanged: 0 }, ["unchanged", "gone"])).toEqual([
      { reason: "gone", count: 2 },
      { reason: "odd", count: 1 },
    ]);
  });

  it("keeps only the counted reasons the review knows how to explain", () => {
    expect(countedRows({ no_consent_recorded: 4, window_open: 52, odd: 3 })).toEqual([
      { reason: "window_open", count: 52 },
      { reason: "no_consent_recorded", count: 4 },
    ]);
    expect(countedRows({ window_open: 0 })).toEqual([]);
  });

  it("prices a quote in its own currency and falls back to the balance currency", () => {
    expect(quoteCurrency(QUOTE)).toBe("USD");
    expect(quoteCurrency({ ...QUOTE, currency: "BRL" })).toBe("BRL");
    expect(quoteCurrency({ ...QUOTE, currency: undefined })).toBe("USD");
    expect(quoteCurrency({ ...QUOTE, currency: "" })).toBe("USD");
  });

  it("tells a send that fits from one that fits only the first N and one that cannot go", () => {
    const review = parseSendReview(REVIEW) as SendReview;
    expect(sendBudgetView(review)).toEqual({ kind: "fits" });
    const short = { ...review, quote: { ...review.quote, fits: 1040, refusal: "unaffordable" } };
    expect(sendBudgetView(short)).toEqual({ kind: "partial", fits: 1040, refusal: "unaffordable" });
    const none = { ...review, quote: { ...review.quote, fits: 0, refusal: "over_cap" } };
    expect(sendBudgetView(none)).toEqual({ kind: "blocked", refusal: "over_cap" });
    const unpriced = { ...review, quote: { ...review.quote, fits: 1122, refusal: "send_pricing_unavailable" } };
    expect(sendBudgetView(unpriced)).toEqual({ kind: "blocked", refusal: "send_pricing_unavailable" });
    expect(sendBudgetView({ ...review, eligible: 0 })).toEqual({ kind: "blocked", refusal: "send_nothing_eligible" });
  });
});

describe("send availability", () => {
  const connected = { official: { connected: true }, unofficial: { connected: true } } as const;

  it("is open with the capability and a connected number", () => {
    expect(leadSendStates({ template: "granted", unofficial: "granted", numbers: connected })).toEqual({
      send_template: { enabled: true },
      send_message: { enabled: true },
    });
  });

  it("names the missing capability of each channel", () => {
    const states = leadSendStates({ template: "denied", unofficial: "granted", numbers: connected });
    expect(states.send_template).toEqual({ enabled: false, reason: "permissionSendTemplate" });
    expect(states.send_message).toEqual({ enabled: true });
    expect(leadSendStates({ template: "granted", unofficial: "denied", numbers: connected }).send_message).toEqual({
      enabled: false,
      reason: "permissionSendUnofficial",
    });
  });

  it("refuses while access is still loading", () => {
    expect(leadSendStates({ template: "loading", unofficial: "loading", numbers: connected }).send_template).toEqual({ enabled: false, reason: "checkingAccess" });
  });

  it("says when the channel has no connected number", () => {
    const states = leadSendStates({
      template: "granted",
      unofficial: "granted",
      numbers: { official: { connected: false }, unofficial: { connected: false } },
    });
    expect(states.send_template).toEqual({ enabled: false, reason: "noOfficialNumber" });
    expect(states.send_message).toEqual({ enabled: false, reason: "noUnofficialNumber" });
  });

  it("refuses while the numbers are being checked and when they cannot be read", () => {
    const states = leadSendStates({ template: "granted", unofficial: "granted", numbers: { official: "loading", unofficial: "failed" } });
    expect(states.send_template).toEqual({ enabled: false, reason: "checkingNumbers" });
    expect(states.send_message).toEqual({ enabled: false, reason: "numbersUnavailable" });
  });

  it("names the permission before the numbers", () => {
    const missing = leadSendStates({ template: "denied", unofficial: "granted", numbers: { official: "loading", unofficial: { connected: false } } });
    expect(missing.send_template).toEqual({ enabled: false, reason: "permissionSendTemplate" });
    expect(missing.send_message).toEqual({ enabled: false, reason: "noUnofficialNumber" });
  });

  it("has no workspace policy reason left", () => {
    expect(SEND_SKIP_REASONS).not.toContain("no_consent");
    expect(LEAD_SEND_ERROR_CODES).not.toContain("send_political_activity");
  });
});

describe("send copy", () => {
  type Tree = { [key: string]: string | Tree };
  const has = (messages: Tree, path: string) => {
    let node: string | Tree | undefined = messages;
    for (const part of path.split(".")) {
      if (node === undefined || typeof node === "string") return false;
      node = node[part];
    }
    return typeof node === "string";
  };
  const locales: [string, Tree][] = [
    ["pt", ptMessages as unknown as Tree],
    ["en", enMessages as unknown as Tree],
    ["es", esMessages as unknown as Tree],
    ["de", deMessages as unknown as Tree],
  ];
  const blockers: LeadSendBlocker[] = [
    "checkingAccess",
    "permissionSendTemplate",
    "permissionSendUnofficial",
    "checkingNumbers",
    "numbersUnavailable",
    "noOfficialNumber",
    "noUnofficialNumber",
  ];

  it("explains every refusal, skip, count, source and blocker in four locales", () => {
    for (const [locale, messages] of locales) {
      const missing = [
        ...LEAD_SEND_ERROR_CODES.map((code) => `leadSends.errors.${code}`),
        ...SEND_SKIP_REASONS.map((reason) => `leadSends.review.skipped.${reason}`),
        ...SEND_COUNTED_REASONS.map((reason) => `leadSends.review.counted.${reason}`),
        ...Object.values(LEAD_FIELD_SOURCES).map((key) => `leadSends.bindings.sources.${key}`),
        ...blockers.map((blocker) => `leadsPage.bulk.blockers.${blocker}`),
        ...blockers.map((blocker) => `leadSends.blockers.${blocker}`),
        "leadSends.leftBehind",
        "leadSends.department.loading",
        "leadSends.department.failed",
        "leadSends.message.instancesFailed",
        "leadSends.bindings.literalSummary",
        "leadSends.campaign.fromLeads",
        "leadSends.review.cooldownDays",
        "leadSends.review.missingSlot",
        "leadSends.review.missingSlotUnnamed",
        "leadSends.review.missingOverlap",
        ...Object.values(LEAD_FIELD_SOURCES).map((key) => `leadSends.review.missingField.${key}`),
        "leadSends.review.missingField.custom",
        "leadSends.selection.summary",
        "leadSends.selection.search",
        "leadSends.template.summaryCategory",
      ].filter((path) => !has(messages, path));
      expect(missing, locale).toEqual([]);
    }
  });
});
