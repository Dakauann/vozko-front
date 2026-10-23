import { isPlainObject, signatureTime, sortedValue } from "./json-value";

export interface TriggerTestInput {
  id: string;
  name: string;
  input: Record<string, unknown>;
  savedAt: string;
}

export interface TestInputSave {
  id: string;
  name: string;
  input: Record<string, unknown>;
  at: Date;
}

export function scenarioInputOf(input: unknown): Record<string, unknown> | null {
  return isPlainObject(input) ? input : null;
}

export function testInputNameTaken(list: readonly TriggerTestInput[], name: string, exceptId?: string): boolean {
  const wanted = name.trim();
  return list.some((scenario) => scenario.name === wanted && scenario.id !== exceptId);
}

export function savedTestInput(list: TriggerTestInput[], save: TestInputSave): TriggerTestInput[] {
  const name = save.name.trim();
  if (!name) return list;
  const savedAt = save.at.toISOString();
  const existing = list.find((scenario) => scenario.name === name);
  if (existing) return list.map((scenario) => (scenario === existing ? { ...scenario, input: save.input, savedAt } : scenario));
  return [...list, { id: save.id, name, input: save.input, savedAt }];
}

export function renamedTestInput(list: TriggerTestInput[], id: string, name: string): TriggerTestInput[] {
  const wanted = name.trim();
  if (!wanted || testInputNameTaken(list, wanted, id)) return list;
  return list.map((scenario) => (scenario.id === id ? { ...scenario, name: wanted } : scenario));
}

export function withoutTestInput(list: readonly TriggerTestInput[], id: string): TriggerTestInput[] {
  return list.filter((scenario) => scenario.id !== id);
}

export function withNodeTestInputs<T extends Record<string, unknown>>(data: T, list: TriggerTestInput[]): T {
  const { testInputs: _previous, ...rest } = data;
  void _previous;
  return (list.length > 0 ? { ...rest, testInputs: list } : rest) as T;
}

export function testInputsSignature(list: readonly TriggerTestInput[] | undefined | null): string {
  if (!list || list.length === 0) return "";
  return JSON.stringify(
    list.map((scenario) => ({ id: scenario.id, name: scenario.name, input: sortedValue(scenario.input), at: signatureTime(scenario.savedAt) })),
  );
}
