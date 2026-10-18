import { describe, expect, it } from "vitest";

import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

import {
  computeParameterFormat,
  replacedHeaderMedia,
  toDraftComponents,
  toTemplateComponents,
  validateDraftMessage,
} from "./draft";
import type { TemplateComponent } from "./types";

const t = (key: string, values?: Record<string, string | number>) => (values ? `${key} ${JSON.stringify(values)}` : key);

const body = (text: string, extra: DraggableComponent["data"] = {}): DraggableComponent => ({ id: "b", type: "BODY", data: { text, ...extra } });

describe("toDraftComponents", () => {
  it("maps stored Meta components to the draft, with body examples and header media", () => {
    const out = toDraftComponents(
      [
        { type: "HEADER", format: "IMAGE", example: { header_handle: ["https://meta/handle"] } },
        { type: "BODY", text: "Olá {{1}}", example: { body_text: [["Maria"]] } },
        { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "Quero reativar" }] },
      ],
      "https://files.test/banner.jpg",
    );
    expect(out[0].data.example).toBe("https://files.test/banner.jpg");
    expect(out[1].data.variableExamples).toEqual(["Maria"]);
    expect(out[2].data.buttons?.[0]).toMatchObject({ type: "QUICK_REPLY", text: "Quero reativar" });
  });

  it("keeps the Meta handle when there is no stored media", () => {
    const out = toDraftComponents([{ type: "HEADER", format: "VIDEO", example: { header_handle: ["https://meta/h"] } }]);
    expect(out[0].data.example).toBe("https://meta/h");
  });

  it("reads named examples, header text examples and the URL button example", () => {
    const out = toDraftComponents([
      { type: "HEADER", format: "TEXT", text: "Oi {{1}}", example: { header_text: ["Ana"] } },
      {
        type: "BODY",
        text: "Pedido {{pedido}} pronto",
        example: { body_text_named_params: [{ param_name: "pedido", example: "123" }] },
      },
      { type: "BUTTONS", buttons: [{ type: "URL", text: "Abrir", url: "https://x.test/{{1}}", example: ["https://x.test/a"] }] },
    ]);
    expect(out[0].data).toMatchObject({ format: "TEXT", text: "Oi {{1}}", variableExamples: ["Ana"] });
    expect(out[1].data.namedVariableExamples).toEqual({ pedido: "123" });
    expect(out[2].data.buttons?.[0]).toMatchObject({ type: "URL", url: "https://x.test/{{1}}", example: "https://x.test/a" });
  });

  it("gives every piece and button its own id", () => {
    const out = toDraftComponents([
      { type: "BODY", text: "a" },
      { type: "BUTTONS", buttons: [{ type: "QUICK_REPLY", text: "1" }, { type: "QUICK_REPLY", text: "2" }] },
    ]);
    expect(new Set(out.map((c) => c.id)).size).toBe(2);
    expect(new Set(out[1].data.buttons?.map((b) => b.id)).size).toBe(2);
  });
});

describe("toTemplateComponents", () => {
  it("writes back what toDraftComponents read", () => {
    const stored: TemplateComponent[] = [
      { type: "HEADER", format: "TEXT", text: "Oi {{1}}", example: { header_text: ["Ana"] } },
      { type: "BODY", text: "Olá {{1}}, tudo bem?", example: { body_text: [["Maria"]] } },
      { type: "FOOTER", text: "Responda /sair" },
      {
        type: "BUTTONS",
        buttons: [
          { type: "QUICK_REPLY", text: "Quero" },
          { type: "URL", text: "Abrir", url: "https://x.test/{{1}}", example: ["https://x.test/a"] },
        ],
      },
    ];
    expect(toTemplateComponents(toDraftComponents(stored))).toEqual(stored);
  });

  it("sends the media header URL as the example handle", () => {
    const out = toTemplateComponents([{ id: "h", type: "HEADER", data: { format: "IMAGE", example: "https://files.test/a.jpg" } }]);
    expect(out[0]).toEqual({ type: "HEADER", format: "IMAGE", example: { header_handle: ["https://files.test/a.jpg"] } });
  });

  it("writes named examples in the order of the text", () => {
    const out = toTemplateComponents([body("Oi {{nome}}, pedido {{pedido}} ok", { namedVariableExamples: { pedido: "9", nome: "Ana" } })]);
    expect(out[0].example).toEqual({
      body_text_named_params: [
        { param_name: "nome", example: "Ana" },
        { param_name: "pedido", example: "9" },
      ],
    });
  });

  it("never writes an empty location header text", () => {
    const out = toTemplateComponents([{ id: "h", type: "HEADER", data: { format: "LOCATION" } }]);
    expect(out[0]).toEqual({ type: "HEADER", format: "LOCATION" });
  });
});

describe("computeParameterFormat", () => {
  it("tells positional, named, none and mixed apart", () => {
    expect(computeParameterFormat([body("Oi {{1}} ok")])).toBe("positional");
    expect(computeParameterFormat([body("Oi {{nome}} ok")])).toBe("named");
    expect(computeParameterFormat([body("Oi")])).toBe("none");
    expect(computeParameterFormat([body("Oi {{1}} e {{nome}} ok")])).toBe("mixed");
  });
});

describe("validateDraftMessage", () => {
  it("asks for a body", () => {
    expect(validateDraftMessage([], "MARKETING", t)).toEqual({ body: "form.validation.bodyRequired" });
  });

  it("refuses a variable at the start of the body and asks for examples", () => {
    expect(validateDraftMessage([body("{{1}} oi")], "MARKETING", t).body).toBe("form.validation.noVariableAtStart");
    expect(validateDraftMessage([body("Oi {{1}} ok")], "MARKETING", t).body).toBe(
      `form.validation.examplesRequired ${JSON.stringify({ variables: "{{1}}" })}`,
    );
    expect(validateDraftMessage([body("Oi {{1}} ok", { variableExamples: ["Ana"] })], "MARKETING", t)).toEqual({});
  });

  it("asks for the media of a media header", () => {
    const header: DraggableComponent = { id: "h", type: "HEADER", data: { format: "IMAGE" } };
    expect(validateDraftMessage([header, body("Oi")], "MARKETING", t).header).toBe("form.validation.mediaHeaderRequiresExample");
  });

  it("keeps quick replies together", () => {
    const buttons: DraggableComponent = {
      id: "q",
      type: "BUTTONS",
      data: {
        buttons: [
          { id: "1", type: "QUICK_REPLY", text: "a" },
          { id: "2", type: "URL", text: "b", url: "https://x.test" },
          { id: "3", type: "QUICK_REPLY", text: "c" },
        ],
      },
    };
    expect(validateDraftMessage([body("Oi"), buttons], "MARKETING", t).buttons).toBe("form.validation.quickRepliesMustBeGrouped");
  });

  it("flags mixed variable styles", () => {
    const out = validateDraftMessage([body("Oi {{1}} e {{nome}} ok", { variableExamples: ["a"], namedVariableExamples: { nome: "b" } })], "MARKETING", t);
    expect(out.format).toBe("form.validation.mixedVariableFormat");
  });
});

describe("replacedHeaderMedia", () => {
  const original = toDraftComponents([{ type: "HEADER", format: "IMAGE", example: { header_handle: ["https://meta/h"] } }], "https://files.test/a.jpg");

  it("is nothing while the header keeps its media", () => {
    expect(replacedHeaderMedia(original, original)).toBeUndefined();
  });

  it("is the new media once the user replaced it", () => {
    const next = original.map((c) => ({ ...c, data: { ...c.data, example: "https://files.test/b.jpg" } }));
    expect(replacedHeaderMedia(original, next)).toBe("https://files.test/b.jpg");
  });

  it("is nothing once the header no longer shows media", () => {
    const next = original.map((c) => ({ ...c, data: { format: "TEXT", text: "Oi" } }));
    expect(replacedHeaderMedia(original, next)).toBeUndefined();
  });
});
