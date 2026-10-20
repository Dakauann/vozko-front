import { describe, expect, it } from "vitest";

import { answersByScreen, answerText, responseColumns } from "./answers";
import { formAccess } from "./access";
import { exportParams, responseQueryFrom } from "./filters";
import { formBuilderHref, formDetailHref, responseRate, workflowHref } from "./links";
import { indexProblems } from "./problems";
import type { Document, Field } from "./types";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

const document: Document = {
  schema: 1,
  categories: [],
  screens: [
    {
      key: "s_one00000",
      title: "Dados",
      submitLabel: "Continuar",
      route: { next: "s_two00000" },
      blocks: [
        { key: "b_title000", display: { kind: "heading", text: "Olá" } },
        { key: "b_name0000", field: { key: "f_name0000", kind: "short_text", label: "Nome", required: true, sensitive: false } },
        { key: "b_plan0000", field: { key: "f_plan0000", kind: "multi_choice_checkbox", question: "Quais planos interessam?", label: "Planos", required: false, sensitive: false, options: [{ id: "o_a", title: "Básico" }, { id: "o_b", title: "Pro" }] } },
      ],
    },
    {
      key: "s_two00000",
      title: "Fim",
      submitLabel: "Enviar",
      route: {},
      blocks: [
        { key: "b_when0000", field: { key: "f_when0000", kind: "date_range", label: "Período", required: false, sensitive: false } },
        { key: "b_ok000000", field: { key: "f_ok000000", kind: "opt_in", label: "Aceito", required: false, sensitive: false } },
        { key: "b_doc00000", field: { key: "f_doc00000", kind: "document", label: "Comprovante", required: false, sensitive: true } },
      ],
    },
  ],
};

const words = { yes: "Sim", no: "Não", range: (start: string, end: string) => `${start} a ${end}`, date: (iso: string) => iso.split("-").reverse().join("/") };

function field(key: string): Field {
  return document.screens.flatMap((screen) => screen.blocks).find((block) => block.field?.key === key)!.field!;
}

describe("responseColumns", () => {
  it("makes one column per field of the version, in screen order, named by the question first", () => {
    expect(responseColumns(document).map((column) => [column.key, column.label])).toEqual([
      ["f_name0000", "Nome"],
      ["f_plan0000", "Quais planos interessam?"],
      ["f_when0000", "Período"],
      ["f_ok000000", "Aceito"],
      ["f_doc00000", "Comprovante"],
    ]);
  });
});

describe("answerText", () => {
  it("shows every answer shape the way people read it", () => {
    expect(answerText({ key: "f_name0000", kind: "short_text", text: "Ana" }, field("f_name0000"), words)).toBe("Ana");
    expect(answerText({ key: "f_plan0000", kind: "multi_choice_checkbox", optionIds: ["o_b", "o_a"] }, field("f_plan0000"), words)).toBe("Pro, Básico");
    expect(answerText({ key: "f_when0000", kind: "date_range", range: { start: "2026-10-01", end: "2026-10-05" } }, field("f_when0000"), words)).toBe("01/10/2026 a 05/10/2026");
    expect(answerText({ key: "f_ok000000", kind: "opt_in", checked: false }, field("f_ok000000"), words)).toBe("Não");
    expect(answerText({ key: "f_doc00000", kind: "document", files: [{ id: "x", name: "rg.pdf", mimeType: "application/pdf" }] }, field("f_doc00000"), words)).toBe("rg.pdf");
    expect(answerText(undefined, field("f_name0000"), words)).toBe("");
  });

  it("keeps an option id it cannot find instead of hiding the answer", () => {
    expect(answerText({ key: "f_plan0000", kind: "multi_choice_checkbox", optionIds: ["o_gone"] }, field("f_plan0000"), words)).toBe("o_gone");
  });
});

describe("answersByScreen", () => {
  it("groups the fields of each screen with their answers and skips screens without fields", () => {
    const groups = answersByScreen(document, { values: { f_name0000: { key: "f_name0000", kind: "short_text", text: "Ana" } } });
    expect(groups.map((group) => [group.screen.key, group.items.map((item) => [item.field.key, item.answer?.text])])).toEqual([
      ["s_one00000", [["f_name0000", "Ana"], ["f_plan0000", undefined]]],
      ["s_two00000", [["f_when0000", undefined], ["f_ok000000", undefined], ["f_doc00000", undefined]]],
    ]);
  });
});

describe("formAccess", () => {
  const granted = (grants: string[]) => (resource: ResourceType, action: ResourceAction) => grants.includes(`${resource}:${action}`);

  it("gates every action on its own permission", () => {
    expect(formAccess(granted([]))).toEqual({
      view: false,
      create: false,
      edit: false,
      publish: false,
      archive: false,
      send: false,
      responses: false,
      sensitive: false,
      exportResponses: false,
      deleteResponses: false,
    });
    const attendant = formAccess(granted(["whatsapp_forms:read", "whatsapp_forms:send", "whatsapp_form_responses:read"]));
    expect(attendant).toMatchObject({ view: true, send: true, responses: true, edit: false, publish: false, archive: false, sensitive: false, exportResponses: false, deleteResponses: false });
  });

  it("never grants response actions without reading responses, nor form actions without reading forms", () => {
    const access = formAccess(granted(["whatsapp_forms:update", "whatsapp_forms:configure", "whatsapp_form_responses:export", "whatsapp_form_responses:read_sensitive", "whatsapp_form_responses:delete"]));
    expect(access).toMatchObject({ edit: false, publish: false, exportResponses: false, sensitive: false, deleteResponses: false });
  });

  it("opens everything for a manager", () => {
    const all = [
      ...["create", "read", "update", "delete", "configure", "send"].map((action) => `whatsapp_forms:${action}`),
      ...["read", "read_sensitive", "export", "delete"].map((action) => `whatsapp_form_responses:${action}`),
    ];
    expect(Object.values(formAccess(granted(all))).every(Boolean)).toBe(true);
  });
});

describe("response filters", () => {
  it("reads only valid filters from the URL and sends them to export as lists", () => {
    const params: Record<string, string> = { from: "2026-10-01", to: "nope", origin: "campaign", phoneId: "ph-1", match: "maybe", q: "  ana " };
    const query = responseQueryFrom((name) => params[name] ?? "");
    expect(query).toMatchObject({ origin: "campaign", phoneId: "ph-1", search: "ana" });
    expect(query.from).toMatch(/^2026-(09-30|10-01)T/);
    expect(query).not.toHaveProperty("to");
    expect(query).not.toHaveProperty("match");
    expect(exportParams("f-1", query)).toEqual({ formId: "f-1", from: query.from, origins: ["campaign"], phoneIds: ["ph-1"] });
  });
});

describe("indexProblems", () => {
  it("flags blocks and their screens, and keeps form-level problems apart", () => {
    const index = indexProblems([
      { screen: "s_one00000", block: "b_name0000", property: "label", code: "too_long", limit: 20 },
      { screen: "s_two00000", property: "route", code: "unreachable" },
      { code: "no_input" },
    ]);
    expect([...index.flaggedBlocks]).toEqual(["b_name0000"]);
    expect([...index.flaggedScreens]).toEqual(["s_one00000", "s_two00000"]);
    expect(index.byScreen.get("s_two00000")).toHaveLength(1);
    expect(index.general).toEqual([{ code: "no_input" }]);
  });
});

describe("form links", () => {
  it("builds the form pages from the screen table and refuses unsafe ids", () => {
    expect(formDetailHref("f-1", "sends")).toBe("/dashboard/whatsapp-forms/f-1?view=sends");
    expect(formBuilderHref("f-1")).toBe("/dashboard/whatsapp-forms/f-1/edit");
    expect(formBuilderHref("../admin")).toBe("/dashboard");
    expect(workflowHref("wf-1")).toBe("/dashboard/workflows/wf-1");
  });

  it("gives no response rate before anything was sent", () => {
    expect(responseRate({ sent: 0, responses: 2 })).toBeNull();
    expect(responseRate({ sent: 8, responses: 2 })).toBe(25);
  });
});
