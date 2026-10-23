import { describe, expect, it } from "vitest";

import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

import {
  draftSuggestions,
  nextVariableSlot,
  variableNameTaken,
  withFieldVariable,
  withFreeVariable,
  withHeaderFieldVariable,
  withNamedFieldVariable,
  withNamedFreeVariable,
  withSuggestions,
} from "./suggestions";
import { toTemplateComponents } from "./draft";

function body(data: DraggableComponent["data"]): DraggableComponent {
  return { id: "body", type: "BODY", data };
}

function header(data: DraggableComponent["data"]): DraggableComponent {
  return { id: "header", type: "HEADER", data: { format: "TEXT", ...data } };
}

describe("nextVariableSlot", () => {
  it("counts the positional variables already in the text", () => {
    expect(nextVariableSlot("")).toBe(1);
    expect(nextVariableSlot("Olá {{1}}, unidade {{2}}")).toBe(3);
  });
});

describe("withFieldVariable", () => {
  it("appends the next variable, keeps the suggested field and prefills an empty example", () => {
    expect(withFieldVariable({ text: "Olá ", variableExamples: [] }, "lead.first_name", "Maria")).toEqual({
      text: "Olá {{1}}",
      variableSuggestions: { "1": "lead.first_name" },
      variableExamples: ["Maria"],
    });
  });

  it("keeps an example the user already typed", () => {
    expect(withFieldVariable({ text: "Oi {{1}} ", variableExamples: ["Ana", "Centro"], variableSuggestions: { "1": "lead.first_name" } }, "lead.district", "Jardim").variableExamples).toEqual(["Ana", "Centro"]);
  });
});

describe("withFreeVariable", () => {
  it("appends the next variable and forgets a stale suggestion for that slot", () => {
    expect(withFreeVariable({ text: "Oi ", variableSuggestions: { "1": "lead.city" } })).toEqual({ text: "Oi {{1}}", variableSuggestions: {} });
  });
});

describe("variableNameTaken", () => {
  it("tells a name the template already uses from a new one", () => {
    expect(variableNameTaken("Olá {{nome}}", "nome")).toBe(true);
    expect(variableNameTaken("Olá {{nome}}", "serie_2027")).toBe(false);
  });
});

describe("withNamedFreeVariable", () => {
  it("appends the named variable and forgets a stale suggestion for that name", () => {
    expect(withNamedFreeVariable({ text: "Olá {{nome}} ", variableSuggestions: { nome: "lead.first_name", serie: "lead.city" } }, "serie")).toEqual({
      text: "Olá {{nome}} {{serie}}",
      variableSuggestions: { nome: "lead.first_name" },
    });
  });
});

describe("withNamedFieldVariable", () => {
  it("names the variable after the field column and prefills its example", () => {
    expect(withNamedFieldVariable({ text: "Olá {{nome}} ", namedVariableExamples: {} }, "lead.district", "bairro", "Jardim")).toEqual({
      text: "Olá {{nome}} {{bairro}}",
      variableSuggestions: { bairro: "lead.district" },
      namedVariableExamples: { bairro: "Jardim" },
    });
  });

  it("picks another name when the column is taken and keeps a typed example", () => {
    const patch = withNamedFieldVariable({ text: "{{bairro}} e ", namedVariableExamples: { bairro: "Centro" }, variableSuggestions: { bairro: "lead.district" } }, "lead.district", "bairro", "Jardim");
    expect(patch.text).toBe("{{bairro}} e {{bairro_2}}");
    expect(patch.variableSuggestions).toEqual({ bairro: "lead.district", bairro_2: "lead.district" });
    expect(patch.namedVariableExamples).toEqual({ bairro: "Centro", bairro_2: "Jardim" });
  });
});

describe("withHeaderFieldVariable", () => {
  it("adds a numbered header variable next to a numbered body", () => {
    expect(withHeaderFieldVariable({ format: "TEXT", text: "Oferta para " }, "positional", "lead.first_name", "primeiro_nome", "Maria")).toEqual({
      text: "Oferta para {{1}}",
      variableSuggestions: { "1": "lead.first_name" },
      variableExamples: ["Maria"],
    });
  });

  it("adds a named header variable next to a named body", () => {
    expect(withHeaderFieldVariable({ format: "TEXT", text: "Oi " }, "named", "lead.first_name", "primeiro_nome", "Maria")).toEqual({
      text: "Oi {{primeiro_nome}}",
      variableSuggestions: { primeiro_nome: "lead.first_name" },
      namedVariableExamples: { primeiro_nome: "Maria" },
    });
  });
});

describe("draftSuggestions", () => {
  it("sends only suggestions of slots still in the body text", () => {
    const components = [body({ text: "Olá {{1}}, {{3}} ok", variableSuggestions: { "1": "lead.first_name", "2": "lead.city", "3": "lead.custom:serie" } })];
    expect(draftSuggestions(components)).toEqual([
      { slot: 1, source: "lead.first_name" },
      { slot: 3, source: "lead.custom:serie" },
    ]);
  });

  it("sends named variables by their position in the order they appear", () => {
    const components = [body({ text: "Olá {{nome}}, da {{loja}} em {{bairro}}", variableSuggestions: { nome: "lead.first_name", bairro: "lead.district", sumiu: "lead.city" } })];
    expect(draftSuggestions(components)).toEqual([
      { slot: 1, source: "lead.first_name" },
      { slot: 3, source: "lead.district" },
    ]);
    expect(draftSuggestions([])).toEqual([]);
  });

  it("puts the header variable first and shifts the body slots after it", () => {
    const components = [
      header({ text: "Oferta para {{1}}", variableSuggestions: { "1": "lead.first_name" } }),
      body({ text: "Unidade {{1}} e série {{2}}", variableSuggestions: { "2": "lead.custom:serie" } }),
    ];
    expect(draftSuggestions(components)).toEqual([
      { slot: 1, source: "lead.first_name" },
      { slot: 3, source: "lead.custom:serie" },
    ]);
  });

  it("ignores a media header", () => {
    const components = [{ id: "h", type: "HEADER" as const, data: { format: "IMAGE", variableSuggestions: { "1": "lead.city" } } }, body({ text: "Oi {{1}}", variableSuggestions: { "1": "lead.first_name" } })];
    expect(draftSuggestions(components)).toEqual([{ slot: 1, source: "lead.first_name" }]);
  });
});

describe("withSuggestions", () => {
  it("seeds the body with the saved suggestions", () => {
    const seeded = withSuggestions([body({ text: "Olá {{1}}" }), { id: "f", type: "FOOTER", data: { text: "x" } }], [{ slot: 1, source: "lead.first_name" }]);
    expect(seeded[0].data.variableSuggestions).toEqual({ "1": "lead.first_name" });
    expect(seeded[1].data.variableSuggestions).toBeUndefined();
  });

  it("seeds the header and the named body from the send order and saves them back the same", () => {
    const components = [header({ text: "Oi {{loja}}" }), body({ text: "Olá {{nome}} em {{bairro}}" })];
    const saved = [
      { slot: 1, source: "lead.custom:loja" },
      { slot: 3, source: "lead.district" },
    ];
    const seeded = withSuggestions(components, saved);
    expect(seeded[0].data.variableSuggestions).toEqual({ loja: "lead.custom:loja" });
    expect(seeded[1].data.variableSuggestions).toEqual({ bairro: "lead.district" });
    expect(draftSuggestions(seeded)).toEqual(saved);
  });
});

describe("the template sent to Meta", () => {
  it("never carries the suggested fields of a header or a named body", () => {
    const sent = toTemplateComponents([
      header({ text: "Oi {{loja}}", namedVariableExamples: { loja: "Centro" }, variableSuggestions: { loja: "lead.custom:loja" } }),
      body({ text: "Olá {{nome}} tudo bem", namedVariableExamples: { nome: "Maria" }, variableSuggestions: { nome: "lead.first_name" } }),
    ]);
    expect(JSON.stringify(sent)).not.toContain("lead.");
  });

  it("never carries the suggested fields", () => {
    const [component] = toTemplateComponents([body({ text: "Olá {{1}} tudo bem", variableExamples: ["Maria"], variableSuggestions: { "1": "lead.first_name" } })]);
    expect(JSON.stringify(component)).not.toContain("lead.first_name");
    expect(component).toEqual({ type: "BODY", text: "Olá {{1}} tudo bem", example: { body_text: [["Maria"]] } });
  });
});
