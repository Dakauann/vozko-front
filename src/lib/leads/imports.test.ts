import { describe, expect, it } from "vitest";

import {
  assignImportField,
  defaultImportPolicy,
  groupImportFields,
  importColumnsBody,
  importIssueEntries,
  importIssueTotal,
  initialImportMapping,
  isLeadImportActive,
  leadImportPercent,
  leadImportStep,
  messageKeyOf,
  importPlacementRows,
  leadImportSummaryOf,
  readLeadImportJob,
  readLeadImportList,
  readLeadImportSummary,
  recognisedColumnCount,
  type LeadImportCounts,
  type LeadImportField,
  type LeadImportJob,
  type LeadImportPlacement,
} from "./imports";

function counts(overrides: Partial<LeadImportCounts> = {}): LeadImportCounts {
  return {
    rows: 0,
    created: 0,
    enriched: 0,
    unchanged: 0,
    skipped: 0,
    rejected: 0,
    conflicting: 0,
    blocked: 0,
    addressesAdded: 0,
    addressesLocated: 0,
    addressesFilled: 0,
    linksPlanned: 0,
    linksCreated: 0,
    issues: {},
    ...overrides,
  };
}

function job(overrides: Partial<LeadImportJob> = {}): LeadImportJob {
  return {
    id: "imp-1",
    status: "uploaded",
    fileName: "contatos.csv",
    sizeBytes: 1200,
    totalRows: 8214,
    processed: 0,
    preview: {
      headers: ["telefone", "nome", "bairro"],
      sample: [["5511999990000", "Ana", "Centro"]],
      columns: [
        { index: 0, header: "telefone", field: "number" },
        { index: 1, header: "nome", field: "name" },
        { index: 2, header: "bairro", field: "" },
      ],
    },
    fields: [],
    options: { fillEmpty: true, seedInbox: false, seedConversations: false },
    createdAt: "2026-10-08T12:00:00Z",
    expiresAt: "2026-10-15T12:00:00Z",
    ...overrides,
  };
}

const fields: LeadImportField[] = [
  { key: "number", group: "identity", allowed: true, sensitive: false, repeatable: false },
  { key: "phone:mobile", group: "phones", allowed: true, sensitive: false, repeatable: true },
  { key: "name", group: "contact", allowed: true, sensitive: false, repeatable: false },
  { key: "district", group: "address", requires: "leads:read_addresses", allowed: false, sensitive: false, repeatable: false },
  { key: "custom_field:interesse", group: "custom", label: "Interesse", allowed: true, sensitive: false, repeatable: false },
  { key: "relative_number", group: "family", requires: "leads:update", allowed: true, sensitive: false, repeatable: false },
];

describe("lead import status", () => {
  it.each([
    ["uploaded", false],
    ["analyzing", true],
    ["analyzed", false],
    ["importing", true],
    ["done", false],
    ["failed", false],
  ] as const)("%s is active %s", (status, active) => {
    expect(isLeadImportActive(status)).toBe(active);
  });

  it.each([
    [job({ status: "uploaded" }), "columns"],
    [job({ status: "analyzing" }), "columns"],
    [job({ status: "analyzed" }), "columns"],
    [job({ status: "importing" }), "importing"],
    [job({ status: "done" }), "done"],
    [job({ status: "failed" }), "columns"],
    [job({ status: "failed", startedAt: "2026-10-08T12:01:00Z" }), "importing"],
  ] as const)("places a job in its step", (value, step) => {
    expect(leadImportStep(value)).toBe(step);
  });

  it("measures progress against the rows of the file", () => {
    expect(leadImportPercent(job({ processed: 5093, totalRows: 8214 }))).toBe(62);
    expect(leadImportPercent(job({ processed: 10, totalRows: 0 }))).toBe(0);
    expect(leadImportPercent(job({ processed: 9000, totalRows: 8214 }))).toBe(100);
  });
});

describe("lead import mapping", () => {
  it("starts from the server's suggestions", () => {
    expect(initialImportMapping(job())).toEqual(["number", "name", ""]);
  });

  it("leaves a suggested field the person may not map unassigned", () => {
    const suggested = job({
      fields,
      preview: {
        ...job().preview,
        columns: [
          { index: 0, header: "telefone", field: "number" },
          { index: 1, header: "nome", field: "name" },
          { index: 2, header: "bairro", field: "district" },
        ],
      },
    });
    expect(initialImportMapping(suggested)).toEqual(["number", "name", ""]);
  });

  it("prefers the mapping of the last dry run", () => {
    const simulated = job({
      settings: {
        columns: [{ index: 2, header: "bairro", field: "district" }],
        onExisting: "skip",
        seedInbox: false,
        seedConversations: false,
      },
    });
    expect(initialImportMapping(simulated)).toEqual(["", "", "district"]);
  });

  it("drops suggestions that point outside the headers", () => {
    const odd = job({
      preview: { headers: ["telefone"], sample: [], columns: [{ index: 3, header: "", field: "name" }] },
    });
    expect(initialImportMapping(odd)).toEqual([""]);
  });

  it("moves a single use field and repeats a repeatable one", () => {
    expect(assignImportField(["number", "name", ""], 2, "name", fields)).toEqual(["number", "", "name"]);
    expect(assignImportField(["phone:mobile", "", ""], 1, "phone:mobile", fields)).toEqual([
      "phone:mobile",
      "phone:mobile",
      "",
    ]);
  });

  it("sends only the mapped columns", () => {
    expect(importColumnsBody(["number", "", "district"])).toEqual([
      { index: 0, field: "number" },
      { index: 2, field: "district" },
    ]);
    expect(recognisedColumnCount(["number", "", "district"])).toBe(2);
  });

  it("groups the catalog in a fixed order and keeps the server order inside a group", () => {
    const groups = groupImportFields([...fields].reverse());
    expect(groups.map((g) => g.group)).toEqual(["identity", "phones", "contact", "address", "custom", "family"]);
    expect(groups[0].fields.map((f) => f.key)).toEqual(["number"]);
  });

  it("keeps the groups it does not know after the known ones, in server order", () => {
    const groups = groupImportFields([
      { key: "school", group: "education", allowed: true, sensitive: false, repeatable: false },
      ...fields,
      { key: "church", group: "community", allowed: true, sensitive: false, repeatable: false },
      { key: "class", group: "education", allowed: true, sensitive: false, repeatable: false },
    ]);
    expect(groups.map((g) => g.group)).toEqual([
      "identity",
      "phones",
      "contact",
      "address",
      "custom",
      "family",
      "education",
      "community",
    ]);
    expect(groups.find((g) => g.group === "education")?.fields.map((f) => f.key)).toEqual(["school", "class"]);
  });

  it("defaults the policy to what the person may do", () => {
    expect(defaultImportPolicy(job())).toBe("fill_empty");
    expect(defaultImportPolicy(job({ options: { fillEmpty: false, seedInbox: false, seedConversations: false } }))).toBe("skip");
    expect(
      defaultImportPolicy(
        job({ settings: { columns: [], onExisting: "skip", seedInbox: false, seedConversations: false } }),
      ),
    ).toBe("skip");
  });

  it("turns field and permission keys into message keys", () => {
    expect(messageKeyOf("phone:landline")).toBe("phone_landline");
    expect(messageKeyOf("birth_date")).toBe("birth_date");
    expect(messageKeyOf("leads:read_addresses")).toBe("leads_read_addresses");
  });
});

describe("lead import issues", () => {
  it("lists reasons from the most frequent and totals them", () => {
    const value = counts({ issues: { phone_invalid: 3, duplicate: 9, email_invalid: 0 } });
    expect(importIssueEntries(value)).toEqual([
      ["duplicate", 9],
      ["phone_invalid", 3],
    ]);
    expect(importIssueTotal(value)).toBe(12);
    expect(importIssueTotal(undefined)).toBe(0);
  });
});

describe("readLeadImportJob", () => {
  it("accepts a job the server sent", () => {
    expect(readLeadImportJob(job())).toEqual(job());
  });

  it.each([null, {}, { id: "x" }, { id: "x", status: "weird", preview: { headers: [] } }, "text"])(
    "refuses %j",
    (value) => {
      expect(readLeadImportJob(value)).toBeNull();
    },
  );

  it("fills the lists a lenient server left out", () => {
    const loose = readLeadImportJob({ ...job(), fields: undefined, preview: { headers: ["a"] } });
    expect(loose?.fields).toEqual([]);
    expect(loose?.preview.sample).toEqual([]);
    expect(loose?.preview.columns).toEqual([]);
  });
});

describe("readLeadImportJob placement and script", () => {
  const placement: LeadImportPlacement = { onMap: 30, approximate: 20, pending: 7, notFound: 1, quotaExceeded: 2, refused: 0 };

  it("keeps a placement the server measured", () => {
    expect(readLeadImportJob({ ...job({ status: "done" }), placement })?.placement).toEqual(placement);
  });

  it("drops a placement with a count it cannot read, so the screen says n/d", () => {
    expect(readLeadImportJob({ ...job({ status: "done" }), placement: { ...placement, pending: "7" } })?.placement).toBeUndefined();
    expect(readLeadImportJob({ ...job({ status: "done" }), placement: { onMap: 1 } })?.placement).toBeUndefined();
    expect(readLeadImportJob({ ...job({ status: "done" }), placement: { ...placement, refused: -1 } })?.placement).toBeUndefined();
  });

  it("keeps the stored example conversation script for the importer", () => {
    const script = { bodies: ["Oi {{1}}"], maxMessages: 3, context: "escola", attachment: { mediaId: "m-1", kind: "image" } };
    const settings = { columns: [], onExisting: "fill_empty", seedInbox: true, seedConversations: true, seedScript: script };
    expect(readLeadImportJob({ ...job(), settings })?.settings?.seedScript).toEqual(script);
  });

  it("drops a stored script without any message", () => {
    const settings = { columns: [], onExisting: "fill_empty", seedInbox: true, seedConversations: true, seedScript: { bodies: [], maxMessages: 3 } };
    expect(readLeadImportJob({ ...job(), settings })?.settings?.seedScript).toBeUndefined();
  });
});

describe("readLeadImportSummary", () => {
  const summary = {
    id: "imp-2",
    status: "importing",
    fileName: "base.csv",
    sizeBytes: 10,
    totalRows: 100,
    processed: 40,
    createdAt: "2026-10-08T12:00:00Z",
    expiresAt: "2026-10-15T12:00:00Z",
  };

  it("accepts a list item that has no preview", () => {
    expect(readLeadImportSummary(summary)).toEqual(summary);
  });

  it.each([null, {}, { ...summary, id: "" }, { ...summary, status: "paused" }])("refuses %j", (value) => {
    expect(readLeadImportSummary(value)).toBeNull();
  });
});

describe("leadImportSummaryOf", () => {
  it("keeps only what the list of imports carries", () => {
    const full = job({
      status: "done",
      startedAt: "2026-10-08T12:05:00Z",
      result: counts({ created: 2 }),
      placement: { onMap: 1, approximate: 0, pending: 0, notFound: 0, quotaExceeded: 0, refused: 0 },
    });
    expect(leadImportSummaryOf(full)).toEqual({
      id: "imp-1",
      status: "done",
      fileName: "contatos.csv",
      sizeBytes: 1200,
      totalRows: 8214,
      processed: 0,
      result: counts({ created: 2 }),
      createdAt: "2026-10-08T12:00:00Z",
      startedAt: "2026-10-08T12:05:00Z",
      expiresAt: "2026-10-15T12:00:00Z",
    });
  });

  it("is read back by the list reader", () => {
    expect(readLeadImportSummary(leadImportSummaryOf(job()))).toEqual(leadImportSummaryOf(job()));
  });
});

describe("readLeadImportList", () => {
  const limits = { maxBytes: 20971520, maxMegabytes: 20, maxRows: 200000, maxSeededConversations: 200, retentionDays: 7, maxUnusedUploads: 5 };
  const item = { id: "a", status: "done", fileName: "a.csv", sizeBytes: 1, totalRows: 1, processed: 1, createdAt: "x", expiresAt: "y" };

  it("reads the importer's imports and the caps the server enforces", () => {
    expect(readLeadImportList({ items: [item], limits })).toEqual({ items: [item], limits });
  });

  it("skips items it cannot read and keeps the others", () => {
    expect(readLeadImportList({ items: [{ id: "b" }, item], limits })?.items.map((entry) => entry.id)).toEqual(["a"]);
  });

  it("answers no limits when the server sent caps it cannot use", () => {
    expect(readLeadImportList({ items: [item], limits: { ...limits, maxRows: 0 } })?.limits).toBeNull();
    expect(readLeadImportList({ items: [item] })?.limits).toBeNull();
  });

  it("refuses a body without a list", () => {
    expect(readLeadImportList({ limits })).toBeNull();
    expect(readLeadImportList(null)).toBeNull();
  });
});

describe("importPlacementRows", () => {
  it("splits the addresses into the map's buckets with their share", () => {
    const rows = importPlacementRows({ onMap: 52, approximate: 30, pending: 8, notFound: 0, quotaExceeded: 2, refused: 0 }, 8);
    expect(rows).toEqual([
      { key: "precise", value: 52, percent: 52 },
      { key: "approximate", value: 30, percent: 30 },
      { key: "pending", value: 10, percent: 10 },
      { key: "noAddress", value: 8, percent: 8 },
    ]);
  });

  it("adds the addresses that were not located only when there are some", () => {
    const rows = importPlacementRows({ onMap: 5, approximate: 0, pending: 0, notFound: 3, quotaExceeded: 0, refused: 2 }, 0);
    expect(rows.map((row) => [row.key, row.value])).toEqual([
      ["precise", 5],
      ["approximate", 0],
      ["pending", 0],
      ["notLocated", 5],
      ["noAddress", 0],
    ]);
  });

  it("leaves every bucket unknown for an import that was never measured", () => {
    expect(importPlacementRows(undefined, undefined)).toEqual([
      { key: "precise", value: null, percent: null },
      { key: "approximate", value: null, percent: null },
      { key: "pending", value: null, percent: null },
      { key: "noAddress", value: null, percent: null },
    ]);
  });

  it("measures the shares without a count it does not know", () => {
    const rows = importPlacementRows({ onMap: 3, approximate: 1, pending: 0, notFound: 0, quotaExceeded: 0, refused: 0 }, undefined);
    expect(rows.find((row) => row.key === "precise")?.percent).toBe(75);
    expect(rows.find((row) => row.key === "noAddress")).toEqual({ key: "noAddress", value: null, percent: null });
  });

  it("gives no share when nothing was counted", () => {
    const rows = importPlacementRows({ onMap: 0, approximate: 0, pending: 0, notFound: 0, quotaExceeded: 0, refused: 0 }, 0);
    expect(rows.every((row) => row.percent === 0)).toBe(true);
  });
});
