import { describe, expect, it } from "vitest";

import { insertAtSelection, toggleMarker } from "./composer-format";
import { parseWhatsAppFormat } from "@/lib/whatsapp-format";

describe("wrapping the composer selection in WhatsApp markers", () => {
  it("wraps the selected words and keeps them selected", () => {
    expect(toggleMarker({ text: "hello big world", start: 6, end: 9 }, "*")).toEqual({ text: "hello *big* world", start: 7, end: 10 });
  });

  it("produces text the WhatsApp parser reads as formatted", () => {
    const { text } = toggleMarker({ text: "hello big world", start: 6, end: 9 }, "_");
    expect(parseWhatsAppFormat(text)).toContainEqual({ type: "element", tag: "em", children: [{ type: "text", value: "big" }] });
  });

  it("leaves surrounding spaces outside the markers, since WhatsApp ignores markers next to a space", () => {
    expect(toggleMarker({ text: "say  hi  now", start: 3, end: 9 }, "~")).toEqual({ text: "say  ~hi~  now", start: 6, end: 8 });
  });

  it("unwraps a selection that is already wrapped", () => {
    expect(toggleMarker({ text: "hello *big* world", start: 7, end: 10 }, "*")).toEqual({ text: "hello big world", start: 6, end: 9 });
  });

  it("unwraps when the markers themselves are selected", () => {
    expect(toggleMarker({ text: "hello *big* world", start: 6, end: 11 }, "*")).toEqual({ text: "hello big world", start: 6, end: 9 });
  });

  it("drops a pair of markers with the caret between them when nothing is selected", () => {
    expect(toggleMarker({ text: "hi ", start: 3, end: 3 }, "*")).toEqual({ text: "hi **", start: 4, end: 4 });
  });

  it("wraps a selection made only of spaces as an empty pair at its start", () => {
    expect(toggleMarker({ text: "a   b", start: 1, end: 4 }, "_")).toEqual({ text: "a__   b", start: 2, end: 2 });
  });
});

describe("inserting at the composer cursor", () => {
  it("inserts at the caret and puts the caret after the insert", () => {
    expect(insertAtSelection({ text: "oi tudo", start: 2, end: 2 }, " 👋")).toEqual({ text: "oi 👋 tudo", start: 5, end: 5 });
  });

  it("replaces the selected words", () => {
    expect(insertAtSelection({ text: "oi tudo bem", start: 3, end: 7 }, "😀")).toEqual({ text: "oi 😀 bem", start: 5, end: 5 });
  });

  it("clamps a stale selection to the text so nothing is lost", () => {
    expect(insertAtSelection({ text: "oi", start: 9, end: 12 }, "!")).toEqual({ text: "oi!", start: 3, end: 3 });
  });
});
