import { LITERAL_SOURCE, type BindingSource, type VariableBinding } from "@/lib/leads/sends";
import type { RcsCard, RcsContent, RcsSuggestion } from "@/lib/rcs/types";
import { renderTemplateText } from "@/lib/whatsapp-templates/params";

export function slotToken(slot: number): string {
  return `{{${slot}}}`;
}

export function slotNames(count: number): string[] {
  return Array.from({ length: count }, (_, index) => String(index + 1));
}

export function slotForSource(bindings: readonly VariableBinding[], source: BindingSource): { slot: number; bindings: VariableBinding[] } {
  const existing = source === LITERAL_SOURCE ? -1 : bindings.findIndex((binding) => binding.source === source);
  if (existing >= 0) return { slot: existing + 1, bindings: [...bindings] };
  const next: VariableBinding = source === LITERAL_SOURCE ? { source, value: "" } : { source };
  return { slot: bindings.length + 1, bindings: [...bindings, next] };
}

export interface TextSelection {
  start: number;
  end: number;
}

export function insertToken(text: string, selection: TextSelection | null, token: string): { text: string; caret: number } {
  if (!selection) {
    const glue = text && !/\s$/.test(text) ? " " : "";
    const next = `${text}${glue}${token}`;
    return { text: next, caret: next.length };
  }
  const next = text.slice(0, selection.start) + token + text.slice(selection.end);
  return { text: next, caret: selection.start + token.length };
}

function slotsIn(values: readonly string[]): string[] {
  return slotNames(Math.max(values.length, 0));
}

function fill(text: string | undefined, values: readonly string[]): string | undefined {
  if (text === undefined) return undefined;
  return renderTemplateText(text, [...values], slotsIn(values));
}

function fillSuggestion(suggestion: RcsSuggestion, values: readonly string[]): RcsSuggestion {
  const next: RcsSuggestion = { ...suggestion, label: fill(suggestion.label, values) ?? "" };
  if (suggestion.url !== undefined) next.url = fill(suggestion.url, values);
  return next;
}

function fillCard(card: RcsCard, values: readonly string[]): RcsCard {
  const next: RcsCard = { ...card };
  if (card.title !== undefined) next.title = fill(card.title, values);
  if (card.description !== undefined) next.description = fill(card.description, values);
  if (card.suggestions) next.suggestions = card.suggestions.map((suggestion) => fillSuggestion(suggestion, values));
  return next;
}

export function previewContent(content: RcsContent, values: readonly string[]): RcsContent {
  const next: RcsContent = { ...content };
  if (content.text !== undefined) next.text = fill(content.text, values);
  if (content.cards) next.cards = content.cards.map((card) => fillCard(card, values));
  if (content.suggestions) next.suggestions = content.suggestions.map((suggestion) => fillSuggestion(suggestion, values));
  return next;
}
