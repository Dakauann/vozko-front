import { describe, expect, it } from "vitest";

import {
  buildFormDraft,
  buildIntro,
  customQuestion,
  customQuestionKey,
  emptyFormBuilder,
  hasContactQuestion,
  humanizeKey,
  leadContact,
  moveQuestion,
  questionKey,
  standardQuestion,
  toggleStandard,
} from "./forms";

describe("customQuestionKey", () => {
  it("mirrors the backend key: folded, underscored, lettered by position", () => {
    expect(customQuestionKey("Qual é o seu orçamento?", 0)).toBe("qual_e_o_seu_orcamento_a");
    expect(customQuestionKey("  Melhor-horário  ", 3)).toBe("melhor_horario_d");
    expect(customQuestionKey("???", 1)).toBe("pergunta_b");
    expect(customQuestionKey("x", 27)).toBe("x_b");
  });
});

describe("questionKey", () => {
  it("uses Meta's field names for standard questions", () => {
    expect(questionKey({ type: "PHONE", label: "" }, 0)).toBe("phone_number");
    expect(questionKey({ type: "ZIP", label: "" }, 0)).toBe("zip_code");
    expect(questionKey({ type: "CUSTOM", label: "Cor favorita" }, 2)).toBe("cor_favorita_c");
  });
});

describe("question list editing", () => {
  it("toggles a standard question on and off", () => {
    const start = [standardQuestion("FULL_NAME")];
    const added = toggleStandard(start, "CITY");
    expect(added.map((question) => question.type)).toEqual(["FULL_NAME", "CITY"]);
    expect(toggleStandard(added, "FULL_NAME").map((question) => question.type)).toEqual(["CITY"]);
  });

  it("moves a question and ignores moves past the edges", () => {
    const list = [standardQuestion("FULL_NAME"), standardQuestion("EMAIL"), customQuestion()];
    expect(moveQuestion(list, 2, -1).map((question) => question.type)).toEqual(["FULL_NAME", "CUSTOM", "EMAIL"]);
    expect(moveQuestion(list, 0, -1)).toBe(list);
    expect(moveQuestion(list, 2, 1)).toBe(list);
  });

  it("requires a phone or email question", () => {
    expect(hasContactQuestion([{ type: "FULL_NAME" }])).toBe(false);
    expect(hasContactQuestion([{ type: "FULL_NAME" }, { type: "EMAIL" }])).toBe(true);
  });
});

describe("buildFormDraft", () => {
  it("trims text, drops empty optionals and blank options", () => {
    const state = emptyFormBuilder();
    const custom = { ...customQuestion(), label: " Melhor horário ", options: ["Manhã", " ", "Tarde "] };
    const draft = buildFormDraft(
      { ...state, name: " Leads julho ", questions: [...state.questions, custom], privacyUrl: " https://x.com/p ", thankYouTitle: "  " },
      "acc",
      "page",
    );
    expect(draft.name).toBe("Leads julho");
    expect(draft.privacyUrl).toBe("https://x.com/p");
    expect(draft.thankYouTitle).toBe("");
    expect(draft.intro).toBeUndefined();
    expect(draft.thankYouUrl).toBe("");
    expect(draft.questions).toEqual([
      { type: "FULL_NAME" },
      { type: "PHONE" },
      { type: "EMAIL" },
      { type: "CUSTOM", label: "Melhor horário", options: ["Manhã", "Tarde"] },
    ]);
    expect(draft.adAccountId).toBe("acc");
    expect(draft.pageId).toBe("page");
  });
});

describe("leadContact", () => {
  it("reads name, phone and email like the backend and keeps the rest", () => {
    const view = leadContact({ Full_Name: "Ana Souza", phone_number: "+55 11 98888-7777", email: "ana@x.com", melhor_horario_d: "Manhã", city: " " });
    expect(view.name).toBe("Ana Souza");
    expect(view.phone).toBe("+55 11 98888-7777");
    expect(view.email).toBe("ana@x.com");
    expect(view.others).toEqual([{ key: "melhor_horario_d", value: "Manhã" }]);
  });

  it("joins first and last name and survives missing answers", () => {
    expect(leadContact({ first_name: "Ana", last_name: "Souza", phone: "1199" }).name).toBe("Ana Souza");
    expect(leadContact(null)).toEqual({ name: null, phone: null, email: null, others: [] });
  });
});

describe("humanizeKey", () => {
  it("turns a key back into a readable label", () => {
    expect(humanizeKey("melhor_horario_d")).toBe("Melhor horario");
    expect(humanizeKey("company_name")).toBe("Company name");
  });
});

describe("buildIntro", () => {
  it("sends no intro unless it is turned on", () => {
    expect(buildIntro({ ...emptyFormBuilder(), introTitle: "Olá" })).toBeUndefined();
  });

  it("sends a paragraph as one line", () => {
    const state = { ...emptyFormBuilder(), introOn: true, introTitle: " Fale com a gente ", introParagraph: " Respondemos em minutos. " };
    expect(buildIntro(state)).toEqual({ title: "Fale com a gente", style: "PARAGRAPH", content: ["Respondemos em minutos."] });
  });

  it("sends list bullets without blank items", () => {
    const state = { ...emptyFormBuilder(), introOn: true, introTitle: "Por que", introStyle: "LIST" as const, introItems: ["Rápido", " ", "Grátis "] };
    expect(buildIntro(state)).toEqual({ title: "Por que", style: "LIST", content: ["Rápido", "Grátis"] });
  });

  it("keeps an empty intro so the server can say what is missing", () => {
    expect(buildIntro({ ...emptyFormBuilder(), introOn: true })).toEqual({ title: "", style: "PARAGRAPH", content: [] });
  });
});

describe("buildFormDraft thank-you screen", () => {
  it("always sends the thank-you link and button text, trimmed", () => {
    const draft = buildFormDraft({ ...emptyFormBuilder("Visitar site"), thankYouUrl: " https://loja.com " }, "acc", "page");
    expect(draft.thankYouUrl).toBe("https://loja.com");
    expect(draft.thankYouButtonText).toBe("Visitar site");
  });

  it("starts the button text from the given default", () => {
    expect(emptyFormBuilder("Visit website").thankYouButtonText).toBe("Visit website");
    expect(emptyFormBuilder().thankYouButtonText).toBe("");
  });
});
