import { describe, expect, it } from "vitest";

import {
  chosenTriggerSpec,
  declaredReadIssues,
  defaultWindowOpen,
  draftFromInput,
  emptyTriggerDraft,
  hasExamplesToFill,
  orderedTriggerSpecs,
  readTriggerInputIssues,
  readTriggerInputSpec,
  readTriggerInputSpecs,
  readTriggerLastInput,
  triggerDisplayLabel,
  triggerFieldControl,
  triggerIssueView,
  triggerStartOf,
  withFieldValue,
  withExamples,
  withJsonText,
  type TriggerInputField,
  type TriggerInputSpec,
} from "./trigger-input";

function field(overrides: Partial<TriggerInputField> = {}): TriggerInputField {
  return { key: "nome", type: "text", required: false, description: "", example: undefined, readBy: [], ...overrides };
}

function spec(overrides: Partial<TriggerInputSpec> = {}): TriggerInputSpec {
  return {
    nodeId: "t1",
    triggerType: "trigger_agent_call",
    label: "Chamado por agente IA",
    shape: "fields",
    fields: [],
    sample: null,
    readKeys: [],
    issues: [],
    window: null,
    windowEditable: false,
    acceptedEvents: [],
    ...overrides,
  };
}

const AGENT_CALL_WIRE = {
  nodeId: "t1",
  triggerType: "trigger_agent_call",
  label: "Chamado por agente IA",
  shape: "fields",
  fields: [
    { key: "cpf", type: "text", required: true, description: "CPF do candidato", example: "123", readBy: ["n2", "n3"] },
    { key: "agent.name", type: "text", required: false, description: "", example: "Agente de teste", readBy: null },
    { key: "curso", type: "text", required: false, description: "", example: null, options: [{ value: "adm", label: "Administração" }], readBy: [] },
  ],
  sample: null,
  readKeys: null,
  issues: [{ code: "read_not_declared", key: "telefone" }],
  windowEditable: true,
};

describe("readTriggerInputSpec", () => {
  it("reads the spec the backend sends, taking a Go nil list as empty", () => {
    expect(readTriggerInputSpec(AGENT_CALL_WIRE)).toEqual({
      nodeId: "t1",
      triggerType: "trigger_agent_call",
      label: "Chamado por agente IA",
      shape: "fields",
      fields: [
        { key: "cpf", type: "text", required: true, description: "CPF do candidato", example: "123", readBy: ["n2", "n3"] },
        { key: "agent.name", type: "text", required: false, description: "", example: "Agente de teste", readBy: [] },
        { key: "curso", type: "text", required: false, description: "", example: null, options: [{ value: "adm", label: "Administração" }], readBy: [] },
      ],
      sample: null,
      readKeys: [],
      issues: [{ code: "read_not_declared", key: "telefone" }],
      window: null,
      windowEditable: true,
      acceptedEvents: [],
    });
  });

  it.each([
    ["a shape the editor does not know", { ...AGENT_CALL_WIRE, shape: "form" }],
    ["a field type the editor does not know", { ...AGENT_CALL_WIRE, fields: [{ ...AGENT_CALL_WIRE.fields[0], type: "time" }] }],
    ["a field without a key", { ...AGENT_CALL_WIRE, fields: [{ ...AGENT_CALL_WIRE.fields[0], key: "" }] }],
    ["a field whose required flag is not a boolean", { ...AGENT_CALL_WIRE, fields: [{ ...AGENT_CALL_WIRE.fields[0], required: "yes" }] }],
    ["options that are not value and label pairs", { ...AGENT_CALL_WIRE, fields: [{ ...AGENT_CALL_WIRE.fields[0], options: ["adm"] }] }],
    ["no node id", { ...AGENT_CALL_WIRE, nodeId: "" }],
    ["a sample that is not an object", { ...AGENT_CALL_WIRE, sample: "x" }],
    ["a window the editor does not know", { ...AGENT_CALL_WIRE, window: "ajar" }],
    ["accepted events that are not text", { ...AGENT_CALL_WIRE, acceptedEvents: [1] }],
    ["a window choice flag that is not a boolean", { ...AGENT_CALL_WIRE, windowEditable: "yes" }],
    ["no window choice flag", { ...AGENT_CALL_WIRE, windowEditable: undefined }],
  ])("refuses %s instead of guessing", (_why, wire) => {
    expect(readTriggerInputSpec(wire)).toBeNull();
  });

  it("keeps the readable specs and names the unreadable ones", () => {
    const read = readTriggerInputSpecs([AGENT_CALL_WIRE, { ...AGENT_CALL_WIRE, nodeId: "t2", shape: "form" }, 7]);
    expect(read.specs.map((item) => item.nodeId)).toEqual(["t1"]);
    expect(read.unreadable).toBe(2);
  });

  it("reads a missing list as no triggers, not as an error", () => {
    expect(readTriggerInputSpecs(undefined)).toEqual({ specs: [], unreadable: 0 });
    expect(readTriggerInputSpecs(null)).toEqual({ specs: [], unreadable: 0 });
  });
});

describe("readTriggerInputIssues", () => {
  it("reads code and key pairs and keeps an issue without a key as a general one", () => {
    expect(readTriggerInputIssues([{ code: "required", key: "cpf" }, { code: "too_large" }, { key: "x" }, "bad"])).toEqual([
      { code: "required", key: "cpf" },
      { code: "too_large", key: "" },
    ]);
    expect(readTriggerInputIssues(undefined)).toEqual([]);
  });
});

describe("readTriggerLastInput", () => {
  it("reads the last real call with its masked keys", () => {
    expect(readTriggerLastInput({ input: { cpf: "•••" }, maskedKeys: ["cpf"], runId: "r1", startedAt: "2026-10-22T10:00:00Z" })).toEqual({
      input: { cpf: "•••" },
      maskedKeys: ["cpf"],
      runId: "r1",
      startedAt: "2026-10-22T10:00:00Z",
    });
    expect(readTriggerLastInput({ input: {}, maskedKeys: null, runId: "r1", startedAt: "x" })?.maskedKeys).toEqual([]);
  });

  it("refuses an answer without a run", () => {
    expect(readTriggerLastInput({ input: {}, maskedKeys: [] })).toBeNull();
    expect(readTriggerLastInput(null)).toBeNull();
  });
});

describe("trigger chooser", () => {
  const specs = [spec({ nodeId: "a" }), spec({ nodeId: "b" }), spec({ nodeId: "c" })];

  it("puts the default trigger first and keeps graph order for the rest", () => {
    expect(orderedTriggerSpecs(specs, "b").map((item) => item.nodeId)).toEqual(["b", "a", "c"]);
    expect(orderedTriggerSpecs(specs, null).map((item) => item.nodeId)).toEqual(["a", "b", "c"]);
  });

  it("picks the chosen trigger, else the default, else the first", () => {
    expect(chosenTriggerSpec(specs, "c", "b")?.nodeId).toBe("c");
    expect(chosenTriggerSpec(specs, "gone", "b")?.nodeId).toBe("b");
    expect(chosenTriggerSpec(specs, null, "gone")?.nodeId).toBe("a");
    expect(chosenTriggerSpec([], null, null)).toBeNull();
  });
});

describe("triggerFieldControl", () => {
  it.each([
    [field({ type: "text" }), "text"],
    [field({ type: "number" }), "number"],
    [field({ type: "boolean" }), "switch"],
    [field({ type: "object" }), "json"],
    [field({ type: "list" }), "json"],
    [field({ type: "text", options: [{ value: "a", label: "A" }] }), "select"],
    [field({ type: "text", options: [] }), "text"],
  ])("gives %o the %s control", (input, control) => {
    expect(triggerFieldControl(input)).toBe(control);
  });
});

describe("declaredReadIssues", () => {
  it("lists the keys the flow reads but the trigger does not declare", () => {
    expect(declaredReadIssues(spec({ issues: [{ code: "read_not_declared", key: "telefone" }, { code: "other", key: "x" }] }))).toEqual(["telefone"]);
  });
});

describe("triggerStartOf", () => {
  const fieldsSpec = spec({
    fields: [
      field({ key: "agent.name" }),
      field({ key: "idade", type: "number" }),
      field({ key: "aceite", type: "boolean" }),
      field({ key: "endereco", type: "object" }),
      field({ key: "cursos", type: "list" }),
      field({ key: "curso", options: [{ value: "adm", label: "Administração" }] }),
    ],
  });

  it("sends only the trigger for a trigger without input", () => {
    expect(triggerStartOf(spec({ shape: "none" }), emptyTriggerDraft(spec({ shape: "none" })))).toEqual({ ok: true, start: { triggerNodeId: "t1" } });
    expect(triggerStartOf(spec({ shape: "message" }), emptyTriggerDraft(spec({ shape: "message" })))).toEqual({ ok: true, start: { triggerNodeId: "t1" } });
  });

  it("sends a flat map keyed by the literal field key, leaving blank fields out", () => {
    let draft = emptyTriggerDraft(fieldsSpec);
    draft = withFieldValue(draft, "agent.name", "Ana");
    draft = withFieldValue(draft, "idade", "31");
    draft = withFieldValue(draft, "aceite", false);
    draft = withFieldValue(draft, "endereco", '{"cidade": "SP"}');
    draft = withFieldValue(draft, "cursos", "[1, 2]");
    draft = withFieldValue(draft, "curso", "adm");
    expect(triggerStartOf(fieldsSpec, draft)).toEqual({
      ok: true,
      start: {
        triggerNodeId: "t1",
        input: { "agent.name": "Ana", idade: 31, aceite: false, endereco: { cidade: "SP" }, cursos: [1, 2], curso: "adm" },
      },
    });
    expect(triggerStartOf(fieldsSpec, emptyTriggerDraft(fieldsSpec))).toEqual({ ok: true, start: { triggerNodeId: "t1", input: {} } });
  });

  it("leaves type and required checks to the backend, sending what was typed", () => {
    let draft = emptyTriggerDraft(fieldsSpec);
    draft = withFieldValue(draft, "idade", "trinta");
    draft = withFieldValue(draft, "endereco", "[1]");
    expect(triggerStartOf(fieldsSpec, draft)).toEqual({ ok: true, start: { triggerNodeId: "t1", input: { idade: "trinta", endereco: [1] } } });
  });

  it("blocks only text that is not JSON, naming the field", () => {
    const draft = withFieldValue(emptyTriggerDraft(fieldsSpec), "endereco", "{cidade: SP}");
    expect(triggerStartOf(fieldsSpec, draft)).toEqual({ ok: false, syntax: ["endereco"] });
  });

  it("sends the parsed body for a webhook, prefilled from the sample", () => {
    const webhook = spec({ shape: "json", sample: { event: "lead.created", body: { nome: "" } } });
    const draft = emptyTriggerDraft(webhook);
    expect(JSON.parse(draft.json)).toEqual({ event: "lead.created", body: { nome: "" } });
    expect(triggerStartOf(webhook, withJsonText(draft, '{"event": "x"}'))).toEqual({ ok: true, start: { triggerNodeId: "t1", input: { event: "x" } } });
    expect(triggerStartOf(webhook, withJsonText(draft, "{"))).toEqual({ ok: false, syntax: [""] });
  });

  it("starts a webhook without a sample from an empty object", () => {
    expect(emptyTriggerDraft(spec({ shape: "json" })).json).toBe("{}");
  });
});

describe("draftFromInput", () => {
  const fieldsSpec = spec({
    fields: [field({ key: "cpf" }), field({ key: "idade", type: "number" }), field({ key: "aceite", type: "boolean" }), field({ key: "endereco", type: "object" })],
  });

  it("fills each control from a saved input and sends it back unchanged", () => {
    const input = { cpf: "123", idade: 31, aceite: true, endereco: { cidade: "SP" } };
    const draft = draftFromInput(fieldsSpec, input);
    expect(draft.values).toEqual({ cpf: "123", idade: "31", aceite: true, endereco: JSON.stringify({ cidade: "SP" }, null, 2) });
    expect(triggerStartOf(fieldsSpec, draft)).toEqual({ ok: true, start: { triggerNodeId: "t1", input } });
  });

  it("keeps values the controls cannot hold, so the backend judges them instead of the editor dropping them", () => {
    const draft = draftFromInput(fieldsSpec, { cpf: 123, aceite: "sim", antigo: "x" });
    expect(draft.extra).toEqual({ cpf: 123, aceite: "sim", antigo: "x" });
    expect(triggerStartOf(fieldsSpec, draft)).toEqual({ ok: true, start: { triggerNodeId: "t1", input: { cpf: 123, aceite: "sim", antigo: "x" } } });
  });

  it("drops a kept value once the person types in that field", () => {
    const draft = withFieldValue(draftFromInput(fieldsSpec, { cpf: 123 }), "cpf", "456");
    expect(draft.extra).toEqual({});
    expect(triggerStartOf(fieldsSpec, draft)).toEqual({ ok: true, start: { triggerNodeId: "t1", input: { cpf: "456" } } });
  });

  it("clears masked values and marks them until the person fills them", () => {
    const draft = draftFromInput(fieldsSpec, { cpf: "•••", idade: 31 }, ["cpf"]);
    expect(draft.values.cpf).toBe("");
    expect(draft.masked).toEqual(["cpf"]);
    expect(withFieldValue(draft, "cpf", "1").masked).toEqual([]);
  });

  it("writes a webhook body as JSON and keeps its masked paths listed", () => {
    const webhook = spec({ shape: "json" });
    const draft = draftFromInput(webhook, { body: { cpf: "•••" } }, ["body.cpf"]);
    expect(JSON.parse(draft.json)).toEqual({ body: { cpf: "•••" } });
    expect(draft.masked).toEqual(["body.cpf"]);
  });
});

describe("triggerIssueView", () => {
  const fieldsSpec = spec({ fields: [field({ key: "cpf" }), field({ key: "idade", type: "number" })] });

  it("puts each refused field's issues under it and the rest in the general list", () => {
    const view = triggerIssueView(fieldsSpec, [
      { code: "required", key: "cpf" },
      { code: "wrong_type", key: "idade" },
      { code: "unknown_field", key: "antigo" },
      { code: "too_large", key: "" },
      { code: "read_not_declared", key: "telefone" },
    ]);
    expect(view.byField).toEqual({ cpf: ["required"], idade: ["wrong_type"] });
    expect(view.general).toEqual([
      { code: "unknown_field", key: "antigo" },
      { code: "too_large", key: "" },
    ]);
  });

  it("lists every issue as general for a webhook body", () => {
    const view = triggerIssueView(spec({ shape: "json" }), [{ code: "event_not_accepted", key: "event" }]);
    expect(view.byField).toEqual({});
    expect(view.general).toEqual([{ code: "event_not_accepted", key: "event" }]);
  });
});

describe("trigger window and accepted events", () => {
  it("reads the window default and the accepted events the backend sends", () => {
    const read = readTriggerInputSpec({ ...AGENT_CALL_WIRE, window: "closed", acceptedEvents: ["lead.created", "lead.updated"] });
    expect(read?.window).toBe("closed");
    expect(read?.acceptedEvents).toEqual(["lead.created", "lead.updated"]);
    expect(readTriggerInputSpec({ ...AGENT_CALL_WIRE, window: "open", acceptedEvents: null })?.acceptedEvents).toEqual([]);
  });

  it("offers the window choice only when the backend says the tester may choose it", () => {
    expect(defaultWindowOpen(spec())).toBeNull();
    expect(defaultWindowOpen(spec({ window: "open", windowEditable: true }))).toBe(true);
    expect(defaultWindowOpen(spec({ window: "closed", windowEditable: true }))).toBe(false);
    expect(defaultWindowOpen(spec({ window: "open", windowEditable: false }))).toBeNull();
  });

  it("sends the window choice with the start only for a trigger whose window the tester may choose", () => {
    const closed = spec({ shape: "none", window: "closed", windowEditable: true });
    expect(triggerStartOf(closed, emptyTriggerDraft(closed), true)).toEqual({ ok: true, start: { triggerNodeId: "t1", windowOpen: true } });
    expect(triggerStartOf(closed, emptyTriggerDraft(closed))).toEqual({ ok: true, start: { triggerNodeId: "t1", windowOpen: false } });
    const webhook = spec({ shape: "json", window: "closed", windowEditable: true });
    expect(triggerStartOf(webhook, withJsonText(emptyTriggerDraft(webhook), "{}"), false)).toEqual({ ok: true, start: { triggerNodeId: "t1", input: {}, windowOpen: false } });
    const fields = spec({ fields: [field({ key: "cpf" })], window: "open", windowEditable: true });
    expect(triggerStartOf(fields, withFieldValue(emptyTriggerDraft(fields), "cpf", "1"), false)).toEqual({
      ok: true,
      start: { triggerNodeId: "t1", input: { cpf: "1" }, windowOpen: false },
    });
    expect(triggerStartOf(spec({ shape: "none" }), emptyTriggerDraft(spec({ shape: "none" })), true)).toEqual({ ok: true, start: { triggerNodeId: "t1" } });
    const message = spec({ shape: "message", window: "open", windowEditable: false });
    expect(triggerStartOf(message, emptyTriggerDraft(message), false)).toEqual({ ok: true, start: { triggerNodeId: "t1" } });
  });
});

describe("date fields", () => {
  it("gives a date field the date control, by the spec type or, until the backend types it, the birthday key", () => {
    expect(triggerFieldControl(field({ type: "date" }))).toBe("date");
    expect(triggerFieldControl(field({ key: "birthday" }))).toBe("date");
    expect(triggerFieldControl(field({ key: "aniversario" }))).toBe("text");
  });

  it("reads a date field type from the spec", () => {
    expect(readTriggerInputSpec({ ...AGENT_CALL_WIRE, fields: [{ ...AGENT_CALL_WIRE.fields[0], type: "date" }] })?.fields[0].type).toBe("date");
  });

  it("sends the picked day as AAAA-MM-DD text", () => {
    const birthday = spec({ triggerType: "trigger_birthday", fields: [field({ key: "birthday" })] });
    const draft = withFieldValue(emptyTriggerDraft(birthday), "birthday", "2026-10-22");
    expect(triggerStartOf(birthday, draft)).toEqual({ ok: true, start: { triggerNodeId: "t1", input: { birthday: "2026-10-22" } } });
    expect(draftFromInput(birthday, { birthday: "2026-01-02" }).values).toEqual({ birthday: "2026-01-02" });
  });
});

describe("withExamples", () => {
  const fieldsSpec = spec({
    fields: [
      field({ key: "cpf", example: "123" }),
      field({ key: "nome", example: "Ana" }),
      field({ key: "idade", type: "number", example: "31" }),
      field({ key: "aceite", type: "boolean", example: "true" }),
      field({ key: "endereco", type: "object", example: '{"cidade":"SP"}' }),
      field({ key: "sem", example: "" }),
    ],
  });

  it("fills only the empty fields from the spec examples", () => {
    const draft = withFieldValue(emptyTriggerDraft(fieldsSpec), "nome", "Bia");
    expect(withExamples(fieldsSpec, draft).values).toEqual({ cpf: "123", nome: "Bia", idade: "31", endereco: '{"cidade":"SP"}' });
  });

  it("fills a field cleared back to blank", () => {
    const draft = withFieldValue(emptyTriggerDraft(fieldsSpec), "cpf", "  ");
    expect(withExamples(fieldsSpec, draft).values.cpf).toBe("123");
  });

  it("knows whether any empty field has an example to fill", () => {
    expect(hasExamplesToFill(fieldsSpec, emptyTriggerDraft(fieldsSpec))).toBe(true);
    expect(hasExamplesToFill(fieldsSpec, withExamples(fieldsSpec, emptyTriggerDraft(fieldsSpec)))).toBe(false);
    expect(hasExamplesToFill(spec({ shape: "json" }), emptyTriggerDraft(spec({ shape: "json" })))).toBe(false);
  });
});

describe("triggerDisplayLabel", () => {
  it("uses the node display name, else the given fallback, else the trigger type", () => {
    expect(triggerDisplayLabel(spec({ label: "Matrícula" }), "Webhook")).toBe("Matrícula");
    expect(triggerDisplayLabel(spec({ label: "" }), "Webhook")).toBe("Webhook");
    expect(triggerDisplayLabel(spec({ label: "" }), undefined)).toBe("trigger_agent_call");
  });
});
