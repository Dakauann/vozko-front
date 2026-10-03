import { describe, expect, it } from "vitest";

import { destinationView, formPreviewState } from "./editor-destination";
import type { LeadForm } from "./forms";

const ad = {
  greeting: " Olá! ",
  iceBreakers: ["Preço?", " ", "Entrega?"],
  leadFormId: "f1",
  link: "https://www.loja.com.br/oferta?x=1",
  displayLink: "",
};

describe("destinationView", () => {
  it("shows the chat the person opens for each messaging destination", () => {
    expect(destinationView("WHATSAPP", ad)).toEqual({ kind: "chat", channel: "whatsapp", greeting: "Olá!", iceBreakers: ["Preço?", "Entrega?"] });
    expect(destinationView("MESSENGER", ad)).toMatchObject({ kind: "chat", channel: "messenger" });
    expect(destinationView("INSTAGRAM_DIRECT", ad)).toMatchObject({ kind: "chat", channel: "instagram" });
  });

  it("shows the instant form", () => {
    expect(destinationView("ON_AD", ad)).toEqual({ kind: "form", formId: "f1" });
  });

  it("shows the website address, preferring the display link", () => {
    expect(destinationView("WEBSITE", ad)).toEqual({ kind: "website", link: ad.link, address: "www.loja.com.br" });
    expect(destinationView("WEBSITE", { ...ad, displayLink: "loja.com" })).toMatchObject({ address: "loja.com" });
    expect(destinationView("CATALOG", { ...ad, link: "" })).toEqual({ kind: "website", link: "", address: "" });
  });

  it("keeps a malformed link readable", () => {
    expect(destinationView("WEBSITE", { ...ad, link: "loja sem https" })).toMatchObject({ address: "loja sem https" });
  });

  it("names the other destinations without a landing screen", () => {
    expect(destinationView("APP", ad)).toEqual({ kind: "app" });
    expect(destinationView("ON_POST", ad)).toEqual({ kind: "post" });
    expect(destinationView("NONE", ad)).toEqual({ kind: "none" });
    expect(destinationView("", ad)).toEqual({ kind: "none" });
  });
});

describe("formPreviewState", () => {
  it("turns a published form into the builder preview", () => {
    const form: LeadForm = {
      metaId: "f1",
      pageId: "p1",
      name: "Orçamento",
      status: "ACTIVE",
      leadsCount: 0,
      privacyUrl: "https://loja.com/privacidade",
      questions: [{ type: "FULL_NAME" }, { type: "CUSTOM", label: "Qual produto?", options: ["A", "B"] }],
    };
    const state = formPreviewState(form);
    expect(state.name).toBe("Orçamento");
    expect(state.privacyUrl).toBe("https://loja.com/privacidade");
    expect(state.introOn).toBe(false);
    expect(state.questions.map((question) => [question.type, question.label, question.options])).toEqual([
      ["FULL_NAME", "", []],
      ["CUSTOM", "Qual produto?", ["A", "B"]],
    ]);
    expect(new Set(state.questions.map((question) => question.id)).size).toBe(2);
  });

  it("copes with a form without questions", () => {
    expect(formPreviewState({ metaId: "f", pageId: "p", name: "x", status: "ACTIVE", leadsCount: 0, questions: null }).questions).toEqual([]);
  });
});
