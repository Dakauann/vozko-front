import { describe, expect, it } from "vitest";

import { insertToken, previewContent, slotForSource, slotNames, slotToken } from "@/lib/rcs/variables";
import type { VariableBinding } from "@/lib/leads/sends";

describe("slotForSource", () => {
  it("reuses the slot already bound to the same lead field", () => {
    const bindings: VariableBinding[] = [{ source: "lead.first_name" }, { source: "lead.city" }];
    expect(slotForSource(bindings, "lead.city")).toEqual({ slot: 2, bindings });
  });

  it("appends a new binding for a field not used yet", () => {
    const bindings: VariableBinding[] = [{ source: "lead.first_name" }];
    expect(slotForSource(bindings, "lead.city")).toEqual({ slot: 2, bindings: [{ source: "lead.first_name" }, { source: "lead.city" }] });
  });

  it("never reuses a fixed text slot", () => {
    const bindings: VariableBinding[] = [{ source: "literal", value: "Oi" }];
    expect(slotForSource(bindings, "literal").slot).toBe(2);
  });
});

describe("insertToken", () => {
  it("puts the token at the caret and moves the caret after it", () => {
    expect(insertToken("Olá , tudo bem?", { start: 4, end: 4 }, slotToken(1))).toEqual({ text: "Olá {{1}}, tudo bem?", caret: 9 });
  });

  it("replaces the selected text", () => {
    expect(insertToken("Olá NOME", { start: 4, end: 8 }, "{{2}}")).toEqual({ text: "Olá {{2}}", caret: 9 });
  });

  it("appends at the end when there is no caret", () => {
    expect(insertToken("Olá", null, "{{1}}")).toEqual({ text: "Olá {{1}}", caret: 9 });
  });
});

describe("slotNames", () => {
  it("lists positional slot names", () => {
    expect(slotNames(3)).toEqual(["1", "2", "3"]);
    expect(slotNames(0)).toEqual([]);
  });
});

describe("previewContent", () => {
  it("fills every text of the message with the preview values", () => {
    const rendered = previewContent(
      {
        text: "Oi {{1}}",
        cards: [{ title: "{{1}}, veja", description: "Em {{2}}", suggestions: [{ kind: "reply", label: "Sou {{1}}" }] }],
        suggestions: [{ kind: "open_url", label: "Abrir", url: "https://a.example/{{2}}" }],
      },
      ["[Nome]", "[Cidade]"],
    );
    expect(rendered.text).toBe("Oi [Nome]");
    expect(rendered.cards?.[0]).toMatchObject({ title: "[Nome], veja", description: "Em [Cidade]" });
    expect(rendered.cards?.[0].suggestions?.[0].label).toBe("Sou [Nome]");
    expect(rendered.suggestions?.[0].url).toBe("https://a.example/[Cidade]");
  });

  it("keeps a token without a value visible", () => {
    expect(previewContent({ text: "Oi {{1}}" }, []).text).toBe("Oi {{1}}");
  });
});
