import { describe, expect, it } from "vitest";

import {
  addCard,
  canAddCard,
  canRemoveCard,
  duplicateCard,
  editorModeOf,
  moveCard,
  moveItem,
  removeCard,
  removeItem,
  replaceItem,
  switchMode,
  updateCard,
} from "@/lib/rcs/content-edit";
import { IMAGE_MEDIA, carouselFixture } from "@/lib/rcs/test-fixtures";
import type { RcsCard, RcsContent } from "@/lib/rcs/types";

const media = { ...IMAGE_MEDIA };

function cards(count: number): RcsCard[] {
  return Array.from({ length: count }, (_, index) => ({ title: `Cartão ${index + 1}` }));
}

describe("editorModeOf", () => {
  it("opens the editor that matches the message shape", () => {
    expect(editorModeOf({})).toBe("text");
    expect(editorModeOf({ text: "Oi" })).toBe("text");
    expect(editorModeOf({ text: "Oi", media })).toBe("media");
    expect(editorModeOf({ cards: cards(1) })).toBe("rich_card");
    expect(editorModeOf({ cards: cards(3) })).toBe("carousel");
  });
});

describe("switchMode", () => {
  it("moves the text into the card description when a text becomes a card", () => {
    expect(switchMode({ text: "Promoção", suggestions: [{ kind: "reply", label: "Sim" }] }, "rich_card")).toEqual({
      cards: [{ description: "Promoção" }],
      suggestions: [{ kind: "reply", label: "Sim" }],
    });
  });

  it("keeps the media and caption when a media message becomes a card", () => {
    expect(switchMode({ text: "Legenda", media }, "rich_card")).toEqual({ cards: [{ media, description: "Legenda" }] });
  });

  it("adds a blank second card when a card becomes a carousel", () => {
    expect(switchMode({ cards: [{ title: "A" }] }, "carousel")).toEqual({ cards: [{ title: "A" }, {}] });
  });

  it("keeps only the first card when a carousel becomes a card", () => {
    expect(switchMode(carouselFixture(), "rich_card").cards).toEqual([carouselFixture().cards![0]]);
  });

  it("brings the card text and media back when a card becomes a media message", () => {
    expect(switchMode({ cards: [{ media, title: "Pão", description: "Quentinho" }] }, "media")).toEqual({ text: "Quentinho", media });
  });

  it("drops the media when going back to plain text", () => {
    expect(switchMode({ text: "Oi", media }, "text")).toEqual({ text: "Oi" });
  });

  it("leaves the message alone when the mode does not change", () => {
    const content: RcsContent = { text: "Oi" };
    expect(switchMode(content, "text")).toBe(content);
  });
});

describe("card list editing", () => {
  it("adds a blank card up to the carousel ceiling", () => {
    expect(addCard({ cards: cards(2) }).cards).toHaveLength(3);
    expect(canAddCard({ cards: cards(10) })).toBe(false);
    expect(addCard({ cards: cards(10) }).cards).toHaveLength(10);
  });

  it("never removes a carousel below two cards", () => {
    expect(canRemoveCard({ cards: cards(2) })).toBe(false);
    expect(removeCard({ cards: cards(2) }, 0).cards).toHaveLength(2);
    expect(removeCard({ cards: cards(3) }, 1).cards?.map((card) => card.title)).toEqual(["Cartão 1", "Cartão 3"]);
  });

  it("duplicates a card right after itself", () => {
    expect(duplicateCard({ cards: cards(2) }, 0).cards?.map((card) => card.title)).toEqual(["Cartão 1", "Cartão 1", "Cartão 2"]);
  });

  it("does not duplicate past the ceiling", () => {
    expect(duplicateCard({ cards: cards(10) }, 0).cards).toHaveLength(10);
  });

  it("reorders cards", () => {
    expect(moveCard({ cards: cards(3) }, 0, 2).cards?.map((card) => card.title)).toEqual(["Cartão 2", "Cartão 3", "Cartão 1"]);
    expect(moveCard({ cards: cards(3) }, 0, -1).cards?.map((card) => card.title)).toEqual(["Cartão 1", "Cartão 2", "Cartão 3"]);
  });

  it("replaces one card", () => {
    expect(updateCard({ cards: cards(2) }, 1, { title: "Novo" }).cards?.[1]).toEqual({ title: "Novo" });
  });
});

describe("list helpers", () => {
  it("replace, remove and move items without touching the input", () => {
    const list = ["a", "b", "c"];
    expect(replaceItem(list, 1, "x")).toEqual(["a", "x", "c"]);
    expect(removeItem(list, 0)).toEqual(["b", "c"]);
    expect(moveItem(list, 2, 0)).toEqual(["c", "a", "b"]);
    expect(list).toEqual(["a", "b", "c"]);
  });
});
