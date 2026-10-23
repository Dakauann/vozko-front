import { describe, expect, it } from "vitest";

import {
  parseAudienceCount,
  parseAudienceLeadPage,
  parseBindableFields,
  parseListPreview,
  parseRowPage,
  parseSavedRow,
  parseTemplateSuggestions,
} from "./parse";

const COUNT = {
  channel: "whatsapp",
  source: "leads",
  matched: 1284,
  withContact: 1198,
  sendable: null,
  out: { no_identity: 86, missing_variable: 212 },
  outTotal: 298,
  requiredVariables: 3,
  variables: [
    { key: "1", source: "lead.first_name", missing: 41, policy: "text", text: "cliente", suggested: true, choiceRequired: false },
    { key: "3", source: "lead.custom:serie", missing: 18, policy: "", suggested: false, choiceRequired: true },
  ],
  blockers: ["variable_choice_required"],
  selection: { selected: 1284, confirmCount: 1284, fingerprint: "9f2c" },
  list: null,
};

const PREVIEW = {
  id: "list-1",
  channel: "whatsapp",
  contact: "phone",
  fileName: "matriculas.xlsx",
  lines: 1211,
  rows: 1204,
  existing: 1176,
  new: 28,
  header: true,
  columns: {
    contact: "telefone",
    name: "nome",
    variables: [
      { slot: 1, column: "primeiro_nome", field: "lead.first_name", fill: "column" },
      { slot: 2, field: "lead.district", fill: "lead" },
    ],
    metadata: [{ key: "serie", label: "Série" }],
  },
  variableColumns: 3,
  skipped: { total: 2, byReason: { invalid_number: 1, duplicate: 1 }, lines: [{ line: 14, reason: "invalid_number", raw: "119" }, { line: 88, reason: "duplicate", raw: "5511", duplicateOf: 12 }] },
  expiresAt: "2026-10-22T14:00:00Z",
};

describe("parseAudienceCount", () => {
  it("reads the server count with a null sendable while a choice is pending", () => {
    const count = parseAudienceCount(COUNT);
    expect(count?.sendable).toBeNull();
    expect(count?.variables[1]).toMatchObject({ key: "3", policy: "", choiceRequired: true });
    expect(count?.selection).toEqual({ selected: 1284, confirmCount: 1284, fingerprint: "9f2c" });
    expect(count?.blockers).toEqual(["variable_choice_required"]);
  });

  it("reads a list count", () => {
    const count = parseAudienceCount({ ...COUNT, source: "list", sendable: 1191, selection: null, list: { id: "list-1", rows: 1204, existing: 1176, new: 28 }, blockers: [] });
    expect(count?.list).toEqual({ id: "list-1", rows: 1204, existing: 1176, new: 28 });
    expect(count?.sendable).toBe(1191);
  });

  it("refuses an answer it cannot trust", () => {
    expect(parseAudienceCount({ ...COUNT, matched: -1 })).toBeNull();
    expect(parseAudienceCount({ ...COUNT, channel: "fax" })).toBeNull();
    expect(parseAudienceCount({ ...COUNT, variables: [{ key: "1" }] })).toBeNull();
    expect(parseAudienceCount({ ...COUNT, blockers: ["unknown_blocker"] })).toBeNull();
    expect(parseAudienceCount(null)).toBeNull();
  });
});

describe("parseAudienceCount slots", () => {
  it("reads the name and the header mark of each slot in the send order", () => {
    const count = parseAudienceCount({
      ...COUNT,
      variables: [
        { key: "1", name: "loja", header: true, missing: 0, policy: "", suggested: false, choiceRequired: false },
        { key: "2", name: "nome", header: false, source: "lead.first_name", missing: 3, policy: "", suggested: true, choiceRequired: true },
      ],
    });
    expect(count?.variables.map(({ key, name, header }) => ({ key, name, header }))).toEqual([
      { key: "1", name: "loja", header: true },
      { key: "2", name: "nome", header: false },
    ]);
  });

  it("names a slot after its position when the server sends no name", () => {
    expect(parseAudienceCount(COUNT)?.variables[0]).toMatchObject({ key: "1", name: "1", header: false });
  });

  it("reads the blockers of a count made before the template or the message", () => {
    expect(parseAudienceCount({ ...COUNT, variables: [], blockers: ["template_required"] })?.blockers).toEqual(["template_required"]);
    expect(parseAudienceCount({ ...COUNT, variables: [], blockers: ["message_required"] })?.blockers).toEqual(["message_required"]);
  });
});

describe("parseAudienceCount metadata", () => {
  it("reads the metadata a flow or agent needs and the metadata blockers", () => {
    const count = parseAudienceCount({ ...COUNT, blockers: ["list_metadata_missing", "leads_metadata_unavailable"], metadataMissing: [{ key: "escola", missing: 2, lines: [3, 4] }] });
    expect(count?.metadataMissing).toEqual([{ key: "escola", missing: 2, lines: [3, 4] }]);
    expect(count?.blockers).toEqual(["list_metadata_missing", "leads_metadata_unavailable"]);
  });

  it("reads a count without metadata as none missing and refuses a broken gap", () => {
    expect(parseAudienceCount(COUNT)?.metadataMissing).toEqual([]);
    expect(parseAudienceCount({ ...COUNT, metadataMissing: [{ key: "escola", missing: -1, lines: [] }] })).toBeNull();
  });
});

describe("parseListPreview", () => {
  it("reads the metadata rows lack", () => {
    expect(parseListPreview({ ...PREVIEW, metadataMissing: [{ key: "turma", missing: 2, lines: [41, 97] }] })?.metadataMissing).toEqual([{ key: "turma", missing: 2, lines: [41, 97] }]);
    expect(parseListPreview(PREVIEW)?.metadataMissing).toEqual([]);
  });

  it("reads the server preview", () => {
    const preview = parseListPreview(PREVIEW);
    expect(preview?.columns.variables).toEqual([
      { slot: 1, column: "primeiro_nome", field: "lead.first_name", fill: "column" },
      { slot: 2, field: "lead.district", fill: "lead" },
    ]);
    expect(preview?.skipped.lines[1]).toEqual({ line: 88, reason: "duplicate", raw: "5511", duplicateOf: 12 });
    expect(preview?.columns.metadata).toEqual([{ key: "serie", label: "Série" }]);
  });

  it("refuses a preview with an unknown fill", () => {
    expect(parseListPreview({ ...PREVIEW, columns: { ...PREVIEW.columns, variables: [{ slot: 1, fill: "magic" }] } })).toBeNull();
  });
});

describe("parseRowPage", () => {
  it("reads the paginated rows", () => {
    const page = parseRowPage({
      data: [{ id: "r1", line: 0, contact: "5511900010142", name: "Maria", variables: ["Maria", ""], metadata: { serie: "1" }, missing: [2], metadataMissing: ["turma"], existing: true }],
      meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 1 },
    });
    expect(page?.items[0]).toMatchObject({ id: "r1", missing: [2], metadataMissing: ["turma"], existing: true });
    expect(page?.totalItems).toBe(1);
  });

  it("refuses rows without meta", () => {
    expect(parseRowPage({ data: [] })).toBeNull();
  });
});

describe("parseSavedRow", () => {
  it("reads a saved row", () => {
    expect(parseSavedRow({ id: "r1", line: 0, contact: "5511", name: "", variables: [], metadata: {} })).toEqual({ id: "r1", line: 0, contact: "5511", name: "", variables: [], metadata: {} });
  });
});

describe("parseAudienceLeadPage", () => {
  it("reads the leads behind a number with their status, reason and values", () => {
    const page = parseAudienceLeadPage({
      data: [
        { leadId: "l1", line: 0, name: "Bia Melo", contact: "5511900000002", status: "out", reason: "missing_variable", missing: ["2"], metadataMissing: [], variables: ["Bia", ""] },
        { leadId: "", line: 14, name: "Ana", contact: "5511900000003", status: "ready", reason: "", missing: [], metadataMissing: ["turma"], variables: ["Ana"] },
      ],
      meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 2 },
    });
    expect(page?.items[0]).toEqual({ leadId: "l1", line: 0, name: "Bia Melo", contact: "5511900000002", status: "out", reason: "missing_variable", missing: ["2"], metadataMissing: [], variables: ["Bia", ""] });
    expect(page?.items[1]).toMatchObject({ leadId: "", line: 14, status: "ready", metadataMissing: ["turma"] });
    expect(page?.totalItems).toBe(2);
  });

  it("refuses an unknown status", () => {
    expect(parseAudienceLeadPage({ data: [{ leadId: "l1", line: 0, name: "", contact: "", status: "maybe", reason: "", missing: [], metadataMissing: [], variables: [] }], meta: { page: 1, pageSize: 50, totalPages: 1, totalItems: 1 } })).toBeNull();
  });
});

describe("parseBindableFields", () => {
  it("reads lead and custom fields", () => {
    expect(
      parseBindableFields([
        { source: "lead.first_name", kind: "lead", column: "primeiro_nome" },
        { source: "lead.custom:serie", kind: "custom", column: "serie", key: "serie", label: "Série de interesse", type: "text" },
      ]),
    ).toEqual([
      { source: "lead.first_name", kind: "lead", column: "primeiro_nome" },
      { source: "lead.custom:serie", kind: "custom", column: "serie", key: "serie", label: "Série de interesse", type: "text" },
    ]);
  });

  it("refuses an unknown kind", () => {
    expect(parseBindableFields([{ source: "x", kind: "weird", column: "x" }])).toBeNull();
  });
});

describe("parseTemplateSuggestions", () => {
  it("reads the saved suggestions", () => {
    expect(parseTemplateSuggestions({ templateId: "tpl-1", suggestions: [{ slot: 1, source: "lead.first_name" }] })).toEqual({ templateId: "tpl-1", suggestions: [{ slot: 1, source: "lead.first_name" }] });
  });

  it("refuses a slot below one", () => {
    expect(parseTemplateSuggestions({ templateId: "tpl-1", suggestions: [{ slot: 0, source: "lead.first_name" }] })).toBeNull();
  });
});
