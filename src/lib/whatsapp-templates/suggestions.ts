import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";
import type { TemplateSuggestion } from "@/lib/campaign-audience/types";

import { detectVariables } from "./draft";

type ComponentData = DraggableComponent["data"];

type VariablePatch = Pick<ComponentData, "text" | "variableSuggestions" | "variableExamples" | "namedVariableExamples">;

export type VariableFormat = "positional" | "named";

interface ComponentSlots {
  component: DraggableComponent;
  format: VariableFormat;
  names: string[];
  count: number;
}

const POSITIONAL = /\{\{\d+\}\}/g;

export function nextVariableSlot(text: string): number {
  return (text.match(POSITIONAL) || []).length + 1;
}

function withoutSlot(suggestions: Record<string, string> | undefined, slot: number): Record<string, string> {
  return Object.fromEntries(Object.entries(suggestions ?? {}).filter(([key]) => key !== String(slot)));
}

function withPositionalExample(examples: readonly string[] | undefined, slot: number, example: string): string[] {
  const next = [...(examples || [])];
  while (next.length < slot) next.push("");
  if (!next[slot - 1]?.trim()) next[slot - 1] = example;
  return next;
}

function withNamedExample(examples: Record<string, string> | undefined, name: string, example: string): Record<string, string> {
  const current = examples ?? {};
  return current[name]?.trim() ? { ...current } : { ...current, [name]: example };
}

function freeName(base: string, taken: readonly string[]): string {
  if (!taken.includes(base)) return base;
  let suffix = 2;
  while (taken.includes(`${base}_${suffix}`)) suffix++;
  return `${base}_${suffix}`;
}

export function withFreeVariable(data: ComponentData): VariablePatch {
  const text = data.text || "";
  const slot = nextVariableSlot(text);
  return { text: `${text}{{${slot}}}`, variableSuggestions: withoutSlot(data.variableSuggestions, slot) };
}

export function variableNameTaken(text: string, name: string): boolean {
  return detectVariables(text).variables.includes(name);
}

export function withNamedFreeVariable(data: ComponentData, name: string): VariablePatch {
  const text = data.text || "";
  const suggestions = Object.fromEntries(Object.entries(data.variableSuggestions ?? {}).filter(([key]) => key !== name));
  return { text: `${text}{{${name}}}`, variableSuggestions: suggestions };
}

export function withFieldVariable(data: ComponentData, source: string, example: string): VariablePatch {
  const text = data.text || "";
  const slot = nextVariableSlot(text);
  return {
    text: `${text}{{${slot}}}`,
    variableSuggestions: { ...withoutSlot(data.variableSuggestions, slot), [String(slot)]: source },
    variableExamples: withPositionalExample(data.variableExamples, slot, example),
  };
}

export function withNamedFieldVariable(data: ComponentData, source: string, column: string, example: string): VariablePatch {
  const text = data.text || "";
  const name = freeName(column, detectVariables(text).variables);
  return {
    text: `${text}{{${name}}}`,
    variableSuggestions: { ...(data.variableSuggestions ?? {}), [name]: source },
    namedVariableExamples: withNamedExample(data.namedVariableExamples, name, example),
  };
}

export function withHeaderFieldVariable(data: ComponentData, format: VariableFormat, source: string, column: string, example: string): VariablePatch {
  return format === "named" ? withNamedFieldVariable(data, source, column, example) : withFieldVariable(data, source, example);
}

function textComponent(components: readonly DraggableComponent[], type: "HEADER" | "BODY"): DraggableComponent | undefined {
  return components.find((candidate) => candidate.type === type && (type === "BODY" || candidate.data.format === "TEXT"));
}

function slotsOf(component: DraggableComponent | undefined): ComponentSlots | null {
  if (!component) return null;
  const { type, variables } = detectVariables(component.data.text || "");
  const count = type === "positional" ? Math.max(0, ...variables.map(Number)) : variables.length;
  return { component, format: type, names: variables, count };
}

function positionOf(slots: ComponentSlots, name: string): number {
  return slots.format === "positional" ? Number(name) : slots.names.indexOf(name) + 1;
}

function nameAt(slots: ComponentSlots, position: number): string | undefined {
  if (slots.format === "positional") return slots.names.includes(String(position)) ? String(position) : undefined;
  return slots.names[position - 1];
}

function sendOrder(components: readonly DraggableComponent[]): { slots: ComponentSlots; offset: number }[] {
  const header = slotsOf(textComponent(components, "HEADER"));
  const body = slotsOf(textComponent(components, "BODY"));
  const offset = header?.count ?? 0;
  return [...(header ? [{ slots: header, offset: 0 }] : []), ...(body ? [{ slots: body, offset }] : [])];
}

export function variableFormatOf(components: readonly DraggableComponent[]): VariableFormat {
  return sendOrder(components).some(({ slots }) => slots.format === "named" && slots.names.length > 0) ? "named" : "positional";
}

export function draftSuggestions(components: readonly DraggableComponent[]): TemplateSuggestion[] {
  return sendOrder(components).flatMap(({ slots, offset }) => {
    const suggestions = slots.component.data.variableSuggestions ?? {};
    return slots.names.flatMap((name) => (suggestions[name] ? [{ slot: offset + positionOf(slots, name), source: suggestions[name] }] : []));
  });
}

export function withSuggestions(components: readonly DraggableComponent[], suggestions: readonly TemplateSuggestion[]): DraggableComponent[] {
  const seeded = new Map<string, Record<string, string>>();
  for (const { slots, offset } of sendOrder(components)) {
    const own: Record<string, string> = {};
    for (const { slot, source } of suggestions) {
      const position = slot - offset;
      const name = position >= 1 && position <= slots.count ? nameAt(slots, position) : undefined;
      if (name) own[name] = source;
    }
    seeded.set(slots.component.id, own);
  }
  return components.map((component) => {
    const own = seeded.get(component.id);
    return own ? { ...component, data: { ...component.data, variableSuggestions: own } } : component;
  });
}
