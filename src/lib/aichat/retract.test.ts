import { describe, expect, it } from "vitest";

import { takeBackStreamed, type Streamed } from "./retract";

interface Item {
  kind: "text" | "thinking" | "tool";
  text: string;
}

function channelOf(item: Item): Streamed<Item> | null {
  if (item.kind === "tool") return null;
  return { channel: item.kind === "text" ? "text" : "reasoning", text: item.text, withText: (text) => ({ ...item, text }) };
}

describe("takeBackStreamed", () => {
  it("removes exactly what the failed attempt streamed from the end", () => {
    const items: Item[] = [
      { kind: "tool", text: "" },
      { kind: "thinking", text: "pensando no layout" },
      { kind: "text", text: "Vou montar " },
    ];
    expect(takeBackStreamed(items, { text: "Vou montar ", reasoning: "pensando no layout" }, channelOf)).toEqual([{ kind: "tool", text: "" }]);
  });

  it("keeps the part of a segment that came before the failed attempt", () => {
    const items: Item[] = [{ kind: "text", text: "Pronto. Vou montar " }];
    expect(takeBackStreamed(items, { text: "Vou montar ", reasoning: "" }, channelOf)).toEqual([{ kind: "text", text: "Pronto. " }]);
  });

  it("never reaches past a tool into an earlier step", () => {
    const items: Item[] = [
      { kind: "text", text: "Antes." },
      { kind: "tool", text: "" },
      { kind: "thinking", text: "rascunho" },
    ];
    expect(takeBackStreamed(items, { text: "Antes.", reasoning: "rascunho" }, channelOf)).toEqual([
      { kind: "text", text: "Antes." },
      { kind: "tool", text: "" },
    ]);
  });

  it("stops at a segment whose channel has nothing left to take back", () => {
    const items: Item[] = [
      { kind: "text", text: "Resposta anterior" },
      { kind: "thinking", text: "rascunho" },
    ];
    expect(takeBackStreamed(items, { text: "", reasoning: "rascunho" }, channelOf)).toEqual([{ kind: "text", text: "Resposta anterior" }]);
  });

  it("changes nothing when the failed attempt showed nothing", () => {
    const items: Item[] = [{ kind: "text", text: "Oi" }];
    expect(takeBackStreamed(items, { text: "", reasoning: "" }, channelOf)).toBe(items);
  });
});
