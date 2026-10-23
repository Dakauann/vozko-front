import { beforeEach, describe, expect, it, vi } from "vitest";

const api = vi.hoisted(() => ({ client: vi.fn(), download: vi.fn() }));
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => api.client(...args) }));
vi.mock("@/lib/api/download-file", () => ({ downloadApiFile: (...args: unknown[]) => api.download(...args) }));

import {
  addAudienceRowAction,
  countAudienceAction,
  downloadAudienceSampleAction,
  listAudienceFieldsAction,
  listAudienceLeadsAction,
  listTemplateFieldsAction,
  pasteAudienceListAction,
  previewAudienceListAction,
  removeAudienceRowAction,
  saveTemplateSuggestionsAction,
  searchAudienceRowsAction,
  uploadAudienceListAction,
} from "./campaign-audience";

const COUNT = {
  channel: "email",
  source: "leads",
  matched: 1,
  withContact: 1,
  sendable: 1,
  out: {},
  outTotal: 0,
  requiredVariables: 0,
  variables: [],
  blockers: [],
  selection: { selected: 1, confirmCount: 1 },
  list: null,
};

beforeEach(() => {
  api.client.mockReset();
  api.download.mockReset();
});

describe("campaign audience actions", () => {
  it("counts with the channel fields beside the spec", async () => {
    api.client.mockResolvedValue({ data: COUNT });
    const answer = await countAudienceAction("email", { source: "leads", selection: { mode: "everyone" } }, { subject: "Oi" });
    expect(answer.data?.matched).toBe(1);
    expect(api.client).toHaveBeenCalledWith("/campaign-audience/email/count", {
      method: "POST",
      body: JSON.stringify({ source: "leads", selection: { mode: "everyone" }, subject: "Oi" }),
    });
  });

  it("hands the caller's abort signal to the request so a stale count stops", async () => {
    api.client.mockResolvedValue({ data: COUNT });
    const controller = new AbortController();
    await countAudienceAction("whatsapp", { source: "leads", selection: { mode: "everyone" } }, {}, controller.signal);
    expect(api.client).toHaveBeenCalledWith("/campaign-audience/whatsapp/count", expect.objectContaining({ signal: controller.signal }));
  });

  it("keeps the coded refusal of a count", async () => {
    api.client.mockResolvedValue({ error: { message: "x", code: "selection_changed", status: 409, details: { expected: 1, matched: 2 } } });
    const answer = await countAudienceAction("whatsapp", { source: "list", listId: "l" }, { templateId: "t" });
    expect(answer.error).toEqual({ message: "x", code: "selection_changed", status: 409, details: { expected: 1, matched: 2 } });
  });

  it("uploads the file as multipart with the list context", async () => {
    api.client.mockResolvedValue({ error: { message: "x", code: "audience_file_empty", status: 400 } });
    const file = new File(["a"], "lista.xlsx");
    await uploadAudienceListAction("whatsapp", file, { templateId: "t" });
    const [path, init] = api.client.mock.calls[0];
    expect(path).toBe("/campaign-audience/whatsapp/lists");
    const body = (init as RequestInit).body as FormData;
    expect(body.get("file")).toBe(file);
    expect(body.get("context")).toBe(JSON.stringify({ templateId: "t" }));
  });

  it("pastes text as json and an empty paste starts an empty list", async () => {
    api.client.mockResolvedValue({ error: { message: "x" } });
    await pasteAudienceListAction("unofficial", "", { instanceId: "i" });
    expect(api.client).toHaveBeenCalledWith("/campaign-audience/unofficial/lists", {
      method: "POST",
      body: JSON.stringify({ instanceId: "i", fileName: "colado.csv", text: "" }),
    });
  });

  it("previews, searches and edits rows under the list", async () => {
    api.client.mockResolvedValue({ error: { message: "x" } });
    await previewAudienceListAction("email", "l 1", {});
    await searchAudienceRowsAction("email", "l 1", {}, { search: "ana", missingOnly: true, page: 2, limit: 50 });
    await addAudienceRowAction("email", "l 1", { contact: "a@b.co" });
    await removeAudienceRowAction("email", "l 1", "r1");
    expect(api.client.mock.calls.map(([path, init]) => [path, (init as RequestInit).method])).toEqual([
      ["/campaign-audience/email/lists/l%201/preview", "POST"],
      ["/campaign-audience/email/lists/l%201/rows/search", "POST"],
      ["/campaign-audience/email/lists/l%201/rows", "POST"],
      ["/campaign-audience/email/lists/l%201/rows/r1", "DELETE"],
    ]);
    expect(JSON.parse(api.client.mock.calls[1][1].body)).toEqual({ search: "ana", missingOnly: true, page: 2, limit: 50 });
  });

  it("lists the leads behind a number with the count body and the filters", async () => {
    api.client.mockResolvedValue({ data: { data: [], meta: { page: 1, pageSize: 50, totalPages: 0, totalItems: 0 } } });
    const answer = await listAudienceLeadsAction("whatsapp", { source: "leads", selection: { mode: "everyone" } }, { templateId: "t" }, { status: "out", reason: "blocked", search: "ana", page: 2, limit: 50 });
    expect(answer.data?.totalItems).toBe(0);
    expect(api.client).toHaveBeenCalledWith("/campaign-audience/whatsapp/leads", {
      method: "POST",
      body: JSON.stringify({ source: "leads", selection: { mode: "everyone" }, templateId: "t", status: "out", reason: "blocked", search: "ana", page: 2, limit: 50 }),
    });
  });

  it("downloads the sample with the chosen format", async () => {
    api.download.mockResolvedValue({ error: null });
    await downloadAudienceSampleAction("whatsapp", { templateId: "t", variables: [{ key: "1", source: "lead.first_name" }] }, "xlsx");
    expect(api.download).toHaveBeenCalledWith("/campaign-audience/whatsapp/sample", "modelo-publico.xlsx", {
      body: { templateId: "t", variables: [{ key: "1", source: "lead.first_name" }], format: "xlsx" },
    });
  });

  it("reads the fields of a channel and of the template builder", async () => {
    api.client.mockResolvedValue({ data: [{ source: "lead.first_name", kind: "lead", column: "primeiro_nome" }] });
    expect((await listAudienceFieldsAction("unofficial")).data).toHaveLength(1);
    expect((await listTemplateFieldsAction()).data).toHaveLength(1);
    expect(api.client.mock.calls.map(([path]) => path)).toEqual(["/campaign-audience/unofficial/fields", "/campaign-audience/template-fields"]);
  });

  it("replaces the suggestions of a template", async () => {
    api.client.mockResolvedValue({ data: { templateId: "tpl 1", suggestions: [] } });
    await saveTemplateSuggestionsAction("tpl 1", [{ slot: 1, source: "lead.first_name" }]);
    expect(api.client).toHaveBeenCalledWith("/whatsapp/templates/tpl%201/variable-suggestions", {
      method: "PUT",
      body: JSON.stringify({ suggestions: [{ slot: 1, source: "lead.first_name" }] }),
    });
  });
});
