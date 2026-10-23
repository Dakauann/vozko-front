import { describe, expect, it } from "vitest";

import { isStaleDraft, problemsOf } from "./errors";
import {
  parseAutomations,
  parseDistribution,
  parseDocument,
  parseFormDetail,
  parseFormSummaries,
  parseOptions,
  parseProblems,
  parsePublishResult,
  parsePublishTargets,
  parseResponseDetail,
  parseResponsePage,
  parseSend,
  parseSendableForms,
  parseStats,
} from "./parse";
import type { Document } from "./types";

const document: Document = {
  schema: 1,
  categories: ["LEAD_GENERATION"],
  screens: [
    {
      key: "s_inicio01",
      title: "Seus dados",
      submitLabel: "Continuar",
      route: { branchOn: "f_interess", branches: [{ optionId: "o_aaaaaaaa", next: "s_final001" }], next: "s_final001" },
      blocks: [
        { key: "b_titulo01", display: { kind: "heading", text: "Bem-vindo" } },
        {
          key: "b_nome0001",
          field: { key: "f_nome0001", kind: "short_text", label: "Nome", required: true, sensitive: false, binding: { target: "name" } },
        },
        {
          key: "b_interess",
          field: {
            key: "f_interess",
            kind: "single_choice_radio",
            label: "Interesse",
            required: true,
            sensitive: false,
            options: [
              { id: "o_aaaaaaaa", title: "Comprar" },
              { id: "o_bbbbbbbb", title: "Alugar", description: "Por mês" },
            ],
          },
        },
        {
          key: "b_detalhe1",
          field: { key: "f_detalhe1", kind: "long_text", label: "Detalhes", help: "Opcional", required: false, sensitive: true, max: 300 },
          visibleIf: { fieldKey: "f_interess", value: "o_bbbbbbbb", negate: true },
        },
      ],
    },
    { key: "s_final001", title: "", submitLabel: "Enviar", route: {}, blocks: [] },
  ],
};

const version = { id: "v-1", workspaceId: "w-1", formId: "f-1", number: 3, document, createdAt: "2026-10-19T12:00:00Z" };
const form = { id: "f-1", workspaceId: "w-1", name: "Captação", kind: "built", draftVersionId: "v-1", createdAt: "2026-10-18T12:00:00Z", updatedAt: "2026-10-19T12:00:00Z" };
const publication = {
  id: "p-1",
  workspaceId: "w-1",
  formId: "f-1",
  wabaId: "waba-1",
  metaWabaId: "123",
  metaFlowId: "flow-9",
  metaName: "Captação · Vozko f-1",
  versionId: "v-1",
  status: "published",
  createdAt: "2026-10-18T12:00:00Z",
  updatedAt: "2026-10-19T12:00:00Z",
};

describe("parseDocument", () => {
  it("round-trips every builder property without losing any", () => {
    expect(parseDocument(JSON.parse(JSON.stringify(document)))).toEqual(document);
  });

  it("keeps empty titles and labels the person is still typing", () => {
    const draft = { schema: 1, categories: [], screens: [{ key: "s_a", title: "", submitLabel: "", route: {}, blocks: [{ key: "b_a", field: { key: "f_a", kind: "email", label: "", required: false, sensitive: false } }] }] };
    expect(parseDocument(draft)?.screens[0].blocks[0].field?.label).toBe("");
  });

  it("refuses unknown kinds and blocks without content", () => {
    const withKind = (kind: string) => ({ ...document, screens: [{ ...document.screens[1], blocks: [{ key: "b_a", field: { key: "f_a", kind, label: "x" } }] }] });
    expect(parseDocument(withKind("password"))).toBeNull();
    expect(parseDocument({ ...document, screens: [{ ...document.screens[1], blocks: [{ key: "b_a" }] }] })).toBeNull();
    expect(parseDocument({ screens: [] })).toBeNull();
  });

  it("drops categories it does not know", () => {
    expect(parseDocument({ ...document, categories: ["SURVEY", "MADE_UP"] })?.categories).toEqual(["SURVEY"]);
  });
});

describe("parseFormDetail", () => {
  it("reads the form, its draft, the published version and publications", () => {
    const detail = parseFormDetail({ form, draft: version, published: version, publications: [publication] });
    expect(detail?.form.name).toBe("Captação");
    expect(detail?.published?.number).toBe(3);
    expect(detail?.publications[0]).toMatchObject({ metaWabaId: "123", status: "published", metaFlowId: "flow-9" });
  });

  it("works without a published version", () => {
    expect(parseFormDetail({ form, draft: version, publications: [] })?.published).toBeUndefined();
  });

  it("refuses a publication with a status Meta never sends", () => {
    expect(parseFormDetail({ form, draft: version, publications: [{ ...publication, status: "approved" }] })).toBeNull();
  });
});

describe("parseFormSummaries", () => {
  it("reads the list with publication marks and counts", () => {
    const items = parseFormSummaries({
      items: [{ form, publications: [{ metaWabaId: "123", status: "throttled", versionId: "v-1" }], sent: 10, responses: 4, lastResponseAt: "2026-10-19T10:00:00Z" }],
    });
    expect(items).toEqual([
      { form: expect.objectContaining({ id: "f-1" }), publications: [{ metaWabaId: "123", status: "throttled", versionId: "v-1" }], sent: 10, responses: 4, lastResponseAt: "2026-10-19T10:00:00Z" },
    ]);
  });
});

describe("parseProblems and problemsOf", () => {
  const problems = [{ screen: "s_inicio01", block: "b_nome0001", property: "label", code: "too_long", limit: 20 }, { code: "unreachable", screen: "s_final001" }];

  it("reads the check answer", () => {
    expect(parseProblems({ problems })).toEqual(problems);
    expect(parseProblems({ problems: null })).toEqual([]);
  });

  it("reads problems from a 422 refusal only", () => {
    expect(problemsOf({ status: 422, code: "whatsapp_form_invalid", details: { problems } })).toEqual(problems);
    expect(problemsOf({ status: 409, code: "whatsapp_form_stale_draft", details: { problems } })).toEqual([]);
    expect(problemsOf({ status: 422 })).toEqual([]);
  });

  it("knows a stale draft refusal", () => {
    expect(isStaleDraft({ status: 409, code: "whatsapp_form_stale_draft" })).toBe(true);
    expect(isStaleDraft({ status: 409, code: "version_conflict" })).toBe(false);
  });
});

describe("parsePublishResult", () => {
  it("reads each account outcome and the refreshed form", () => {
    const result = parsePublishResult({
      outcomes: [
        { metaWabaId: "123", status: "published" },
        { metaWabaId: "456", status: "failed", error: "Meta refused", code: "meta_validation", problems: [{ code: "meta_validation", block: "b_nome0001", message: "bad" }] },
      ],
      form: { form, draft: version, publications: [publication] },
    });
    expect(result?.outcomes[1]).toEqual({ metaWabaId: "456", status: "failed", error: "Meta refused", code: "meta_validation", problems: [{ code: "meta_validation", block: "b_nome0001", message: "bad" }] });
    expect(result?.form.form.id).toBe("f-1");
  });

  it("keeps an outcome refused before Meta had a status for it", () => {
    const result = parsePublishResult({
      outcomes: [{ metaWabaId: "789", error: "not available", code: "whatsapp_form_provider_unsupported" }],
      form: { form, draft: version, publications: [publication] },
    });
    expect(result?.outcomes).toEqual([{ metaWabaId: "789", error: "not available", code: "whatsapp_form_provider_unsupported" }]);
  });
});

describe("parsePublishTargets", () => {
  it("reads whether each account takes forms and has a verified business", () => {
    expect(parsePublishTargets([{ metaWabaId: "123", supported: true, businessVerified: false }, { metaWabaId: "456", supported: false }])).toEqual([
      { metaWabaId: "123", supported: true, businessVerified: false },
      { metaWabaId: "456", supported: false, businessVerified: false },
    ]);
  });
});

const response = {
  id: "r-1",
  workspaceId: "w-1",
  formId: "f-1",
  versionId: "v-1",
  sendId: "send-1",
  origin: "inbox",
  match: "token",
  inboundMessageId: "m-1",
  conversationId: "c-1",
  entryId: "e-1",
  entryType: "whatsapp",
  leadId: "l-1",
  businessPhoneId: "ph-1",
  contactNumber: "5511987654321",
  answers: {
    values: {
      f_nome0001: { key: "f_nome0001", kind: "short_text", text: "Ana" },
      f_interess: { key: "f_interess", kind: "single_choice_radio", optionIds: ["o_aaaaaaaa"] },
      f_aceite01: { key: "f_aceite01", kind: "opt_in", checked: false },
      f_periodo1: { key: "f_periodo1", kind: "date_range", range: { start: "2026-10-01", end: "2026-10-05" } },
      f_foto0001: { key: "f_foto0001", kind: "photo", files: [{ id: "file-1", name: "a.jpg", mimeType: "image/jpeg", sha256: "abc" }] },
    },
  },
  applyStatus: "partial",
  report: { changed: ["name"], conflicts: ["email"], files: [{ key: "f_foto0001", fileId: "file-1", mediaId: "media-1" }], triggered: true },
  submittedAt: "2026-10-19T12:00:00Z",
  createdAt: "2026-10-19T12:00:01Z",
};

describe("parseResponsePage", () => {
  it("reads rows with every answer shape, the report and the cursor", () => {
    const page = parseResponsePage({ items: [{ ...response, leadName: "Ana Souza" }], next: "cursor-2" });
    expect(page?.next).toBe("cursor-2");
    const row = page?.items[0];
    expect(row?.leadName).toBe("Ana Souza");
    expect(row?.answers.values.f_aceite01.checked).toBe(false);
    expect(row?.answers.values.f_periodo1.range).toEqual({ start: "2026-10-01", end: "2026-10-05" });
    expect(row?.answers.values.f_foto0001.files?.[0].name).toBe("a.jpg");
    expect(row?.report).toEqual({ changed: ["name"], conflicts: ["email"], files: [{ key: "f_foto0001", fileId: "file-1", mediaId: "media-1" }], triggered: true });
  });

  it("reads an unmatched answer without form or lead", () => {
    const unmatched: Record<string, unknown> = { ...response, match: "unmatched_no_token" };
    delete unmatched.formId;
    delete unmatched.leadId;
    delete unmatched.origin;
    const row = parseResponsePage({ items: [unmatched] })?.items[0];
    expect(row?.match).toBe("unmatched_no_token");
    expect(row?.formId).toBeUndefined();
  });

  it("refuses an unknown match result", () => {
    expect(parseResponsePage({ items: [{ ...response, match: "guess" }] })).toBeNull();
  });
});

describe("parseResponseDetail", () => {
  it("reads the response with its version and the reveal flag", () => {
    const detail = parseResponseDetail({ response, form: { id: "f-1", name: "Captação" }, version, leadName: "Ana", revealed: false });
    expect(detail).toMatchObject({ form: { id: "f-1", name: "Captação" }, leadName: "Ana", revealed: false });
    expect(detail?.version.document.screens).toHaveLength(2);
  });
});

describe("parseStats and parseDistribution", () => {
  it("reads counts and keeps a missing median missing", () => {
    const stats = parseStats({ sends: { sent: 8, failed: 1, mystery: 4 }, delivered: 7, read: 5, responses: 3, byOrigin: [{ origin: "inbox", sent: 8, responses: 3 }], byDay: [{ day: "2026-10-19", sent: 8, responses: 3 }] });
    expect(stats).toEqual({ sends: { sent: 8, failed: 1 }, delivered: 7, read: 5, responses: 3, byOrigin: [{ origin: "inbox", sent: 8, responses: 3 }], byDay: [{ day: "2026-10-19", sent: 8, responses: 3 }] });
    expect(parseStats({ sends: {}, byOrigin: [], byDay: [], medianSecondsToRespond: 42.5 })?.medianSecondsToRespond).toBe(42.5);
  });

  it("reads option counts", () => {
    expect(parseDistribution({ counts: { o_aaaaaaaa: 3, o_bbbbbbbb: 0 } })).toEqual({ o_aaaaaaaa: 3, o_bbbbbbbb: 0 });
  });
});

describe("parseSend, sendable forms and automations", () => {
  it("reads a send", () => {
    expect(parseSend({ id: "s-1", formId: "f-1", origin: "inbox", status: "sent", businessPhoneId: "ph-1", contactNumber: "55", createdAt: "2026-10-19T12:00:00Z", sentAt: "2026-10-19T12:00:01Z" })).toMatchObject({ status: "sent", sentAt: "2026-10-19T12:00:01Z" });
  });

  it("reads forms sendable from a number", () => {
    expect(parseSendableForms({ items: [{ formId: "f-1", name: "Captação", versionId: "v-1", metaFlowId: "flow-9", firstScreen: "S_INICIO01" }] })).toEqual([
      { formId: "f-1", name: "Captação", versionId: "v-1", metaFlowId: "flow-9", firstScreen: "S_INICIO01" },
    ]);
  });

  it("reads automations by use", () => {
    expect(parseAutomations({ items: [{ workflowId: "wf-1", name: "Novo lead", active: true, use: "trigger" }] })).toEqual([{ workflowId: "wf-1", name: "Novo lead", active: true, use: "trigger" }]);
    expect(parseAutomations({ items: [{ workflowId: "wf-1", use: "other" }] })).toBeNull();
  });
});

describe("parseOptions", () => {
  it("reads limits, bindings, custom fields and starters", () => {
    const options = parseOptions({
      fieldKinds: ["short_text", "email", "future_kind"],
      displayKinds: ["heading"],
      categories: ["SURVEY"],
      limits: { labels: { short_text: 20, email: 20 }, options: { single_choice_radio: [1, 20] }, displayText: { heading: 80 }, help: 80, optionTitle: 30, submitLabel: 35, documentMimeTypes: ["application/pdf"] },
      bindings: [{ target: "email", fieldKinds: ["email"] }],
      customFields: [{ key: "cidade", label: "Cidade", type: "select", options: ["SP", "RJ"], fieldKinds: ["single_choice_radio", "single_choice_dropdown"] }],
      starters: [{ key: "lead_capture", name: "Captação de lead", description: "Nome e email", document }],
      flowJsonVersion: "7.3",
    });
    expect(options?.fieldKinds).toEqual(["short_text", "email"]);
    expect(options?.limits.labels.short_text).toBe(20);
    expect(options?.limits.options.single_choice_radio).toEqual([1, 20]);
    expect(options?.limits.submitLabel).toBe(35);
    expect(options?.customFields[0].options).toEqual(["SP", "RJ"]);
    expect(options?.starters[0].document).toEqual(document);
    expect(options?.flowJsonVersion).toBe("7.3");
  });

  it("refuses an answer without limits", () => {
    expect(parseOptions({ fieldKinds: [] })).toBeNull();
  });
});
