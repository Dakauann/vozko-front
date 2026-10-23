import { RCS_LIMITS } from "@/lib/rcs/limits";
import type { RcsCard, RcsContent, RcsContentKind } from "@/lib/rcs/types";

export type RcsEditorMode = RcsContentKind;

export const RCS_EDITOR_MODES: readonly RcsEditorMode[] = ["text", "media", "rich_card", "carousel"];

export function editorModeOf(content: RcsContent): RcsEditorMode {
  const count = content.cards?.length ?? 0;
  if (count >= RCS_LIMITS.minCarouselCards) return "carousel";
  if (count === 1) return "rich_card";
  return content.media ? "media" : "text";
}

function withSuggestions(content: RcsContent, next: RcsContent): RcsContent {
  return content.suggestions?.length ? { ...next, suggestions: content.suggestions } : next;
}

function cardFromMessage(content: RcsContent): RcsCard {
  const card: RcsCard = {};
  if (content.media) card.media = content.media;
  if (content.text) card.description = content.text;
  return card;
}

function messageFromCard(card: RcsCard | undefined, keepMedia: boolean): RcsContent {
  const next: RcsContent = {};
  const text = card?.description || card?.title;
  if (text) next.text = text;
  if (keepMedia && card?.media) next.media = card.media;
  return next;
}

export function switchMode(content: RcsContent, mode: RcsEditorMode): RcsContent {
  const current = editorModeOf(content);
  if (current === mode) return content;
  const first = content.cards?.[0];
  switch (mode) {
    case "text":
      return withSuggestions(content, first ? messageFromCard(first, false) : content.text ? { text: content.text } : {});
    case "media":
      return withSuggestions(content, first ? messageFromCard(first, true) : { ...(content.text ? { text: content.text } : {}), ...(content.media ? { media: content.media } : {}) });
    case "rich_card":
      return withSuggestions(content, { cards: [first ?? cardFromMessage(content)] });
    case "carousel": {
      const existing = content.cards?.length ? content.cards : [cardFromMessage(content)];
      const padded = [...existing];
      while (padded.length < RCS_LIMITS.minCarouselCards) padded.push({});
      return withSuggestions(content, { cards: padded });
    }
  }
}

export function replaceItem<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((current, at) => (at === index ? item : current));
}

export function removeItem<T>(list: readonly T[], index: number): T[] {
  return list.filter((_, at) => at !== index);
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

function cardsOf(content: RcsContent): RcsCard[] {
  return content.cards ?? [];
}

export function canAddCard(content: RcsContent): boolean {
  return cardsOf(content).length < RCS_LIMITS.maxCarouselCards;
}

export function canRemoveCard(content: RcsContent): boolean {
  return cardsOf(content).length > RCS_LIMITS.minCarouselCards;
}

export function updateCard(content: RcsContent, index: number, card: RcsCard): RcsContent {
  return { ...content, cards: replaceItem(cardsOf(content), index, card) };
}

export function addCard(content: RcsContent): RcsContent {
  if (!canAddCard(content)) return content;
  return { ...content, cards: [...cardsOf(content), {}] };
}

export function duplicateCard(content: RcsContent, index: number): RcsContent {
  const list = cardsOf(content);
  if (!canAddCard(content) || !list[index]) return content;
  const copy = structuredClone(list[index]);
  return { ...content, cards: [...list.slice(0, index + 1), copy, ...list.slice(index + 1)] };
}

export function removeCard(content: RcsContent, index: number): RcsContent {
  if (!canRemoveCard(content)) return content;
  return { ...content, cards: removeItem(cardsOf(content), index) };
}

export function moveCard(content: RcsContent, from: number, to: number): RcsContent {
  return { ...content, cards: moveItem(cardsOf(content), from, to) };
}
