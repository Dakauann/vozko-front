import { describe, expect, it } from "vitest";

import {
  renamedTestInput,
  scenarioInputOf,
  savedTestInput,
  testInputNameTaken,
  testInputsSignature,
  withNodeTestInputs,
  withoutTestInput,
  type TriggerTestInput,
} from "./test-inputs";

const AT = new Date("2026-10-22T12:00:00.000Z");
const first: TriggerTestInput = { id: "s1", name: "Candidato completo", input: { cpf: "123" }, savedAt: "2026-10-21T10:00:00.000Z" };

describe("savedTestInput", () => {
  it("appends a new scenario with the trimmed name and the save time", () => {
    expect(savedTestInput([first], { id: "s2", name: "  Sem CPF ", input: { nome: "Ana" }, at: AT })).toEqual([
      first,
      { id: "s2", name: "Sem CPF", input: { nome: "Ana" }, savedAt: "2026-10-22T12:00:00.000Z" },
    ]);
  });

  it("updates the scenario with the same name in place instead of adding a twin", () => {
    expect(savedTestInput([first], { id: "s2", name: "Candidato completo", input: { cpf: "9" }, at: AT })).toEqual([
      { id: "s1", name: "Candidato completo", input: { cpf: "9" }, savedAt: "2026-10-22T12:00:00.000Z" },
    ]);
  });

  it("saves nothing without a name", () => {
    const list = [first];
    expect(savedTestInput(list, { id: "s2", name: "  ", input: {}, at: AT })).toBe(list);
  });
});

describe("renamedTestInput and withoutTestInput", () => {
  const second: TriggerTestInput = { id: "s2", name: "Sem CPF", input: {}, savedAt: "2026-10-21T10:00:00.000Z" };

  it("renames one scenario and keeps the rest", () => {
    expect(renamedTestInput([first, second], "s2", " Só nome ")).toEqual([first, { ...second, name: "Só nome" }]);
  });

  it("refuses a rename to a blank or taken name, returning the same list", () => {
    const list = [first, second];
    expect(renamedTestInput(list, "s2", "Candidato completo")).toBe(list);
    expect(renamedTestInput(list, "s2", " ")).toBe(list);
    expect(testInputNameTaken(list, "Candidato completo", "s2")).toBe(true);
    expect(testInputNameTaken(list, "Candidato completo", "s1")).toBe(false);
  });

  it("removes one scenario", () => {
    expect(withoutTestInput([first, second], "s1")).toEqual([second]);
  });
});

describe("withNodeTestInputs", () => {
  it("writes the list on the node data and drops the field when it empties", () => {
    const data = { nodeType: "trigger_agent_call", config: {} };
    expect(withNodeTestInputs(data, [first])).toEqual({ ...data, testInputs: [first] });
    expect(withNodeTestInputs({ ...data, testInputs: [first] }, [])).toEqual(data);
  });
});

describe("testInputsSignature", () => {
  it("is empty without scenarios, so a node without them reads the same as before", () => {
    expect(testInputsSignature(undefined)).toBe("");
    expect(testInputsSignature([])).toBe("");
  });

  it("ignores key order and a server rewrite of the save time", () => {
    const local = [{ ...first, input: { a: 1, b: { c: 2, d: 3 } } }];
    const server = [{ ...first, savedAt: "2026-10-21T10:00:00Z", input: { b: { d: 3, c: 2 }, a: 1 } }];
    expect(testInputsSignature(server)).toBe(testInputsSignature(local));
  });

  it("changes when a name, an input or the order changes", () => {
    const second: TriggerTestInput = { id: "s2", name: "B", input: {}, savedAt: first.savedAt };
    const base = testInputsSignature([first, second]);
    expect(testInputsSignature([{ ...first, name: "X" }, second])).not.toBe(base);
    expect(testInputsSignature([{ ...first, input: { cpf: "1" } }, second])).not.toBe(base);
    expect(testInputsSignature([second, first])).not.toBe(base);
  });
});

describe("scenarioInputOf", () => {
  it("keeps a JSON object, the only input a scenario can hold", () => {
    expect(scenarioInputOf({ cpf: "1" })).toEqual({ cpf: "1" });
  });

  it("refuses a list or a plain value instead of letting the draft save fail", () => {
    expect(scenarioInputOf([1])).toBeNull();
    expect(scenarioInputOf("x")).toBeNull();
    expect(scenarioInputOf(undefined)).toBeNull();
  });
});
