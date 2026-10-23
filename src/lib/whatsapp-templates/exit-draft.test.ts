import { describe, expect, it } from "vitest";

import type { DraggableComponent } from "@/components/whatsapp/DragDropBuilder";

import {
  EMPTY_LEAD_EXIT_DRAFT,
  applyLeadExit,
  collectExitSetup,
  allowedKindsOf,
  draftVerdictRequest,
  editExitSetup,
  exitSetupFields,
  leadExitPieceUsed,
  leadExitRoom,
  planOf,
  withExitWord,
  withSavedExit,
  withoutExitSetup,
} from "./exit-draft";
import type { ButtonActionView } from "./exit";

const ids = () => {
  let next = 0;
  return (prefix: string) => `${prefix}-${++next}`;
};

const body: DraggableComponent = { id: "body", type: "BODY", data: { text: "Olá" } };

function buttons(...list: NonNullable<DraggableComponent["data"]["buttons"]>): DraggableComponent {
  return { id: "buttons", type: "BUTTONS", data: { buttons: list } };
}

describe("applyLeadExit with a button", () => {
  const plan = { mode: "button", text: "Não quero", action: { kind: "opt_out", params: {}, confirmation: "" } } as const;

  it("creates the buttons component when the template has none", () => {
    const next = applyLeadExit([body], plan, ids());
    expect(next.map((c) => c.type)).toEqual(["BODY", "BUTTONS"]);
    expect(next[1].data.buttons).toEqual([
      { id: "btn-2", type: "QUICK_REPLY", text: "Não quero", action: plan.action, exitPiece: true },
    ]);
  });

  it("keeps quick replies together by placing the new one after the last quick reply", () => {
    const next = applyLeadExit(
      [body, buttons({ id: "a", type: "QUICK_REPLY", text: "Sim" }, { id: "b", type: "URL", text: "Site", url: "https://x" })],
      plan,
      ids(),
    );
    expect(next[1].data.buttons?.map((b) => b.id)).toEqual(["a", "btn-1", "b"]);
  });
});

describe("applyLeadExit with a word", () => {
  const plan = { mode: "word", word: "parar", footerText: "Responda /parar para sair", confirmation: "Feito." } as const;

  it("writes the footer text that shows the command, which is the only source of the word", () => {
    const next = applyLeadExit([body, buttons()], plan, ids());
    expect(next.map((c) => c.type)).toEqual(["BODY", "FOOTER", "BUTTONS"]);
    expect(next[1].data).toEqual({ text: "Responda /parar para sair", exitConfirmation: "Feito.", exitPiece: true });
  });

  it("reuses the footer that already exists", () => {
    const footer: DraggableComponent = { id: "footer", type: "FOOTER", data: { text: "Antigo" } };
    const next = applyLeadExit([body, footer], plan, ids());
    expect(next).toHaveLength(2);
    expect(next[1]).toMatchObject({ id: "footer", data: { text: "Responda /parar para sair", exitPiece: true } });
    expect(next[1].data).not.toHaveProperty("exitWords");
  });
});

describe("leadExitPieceUsed", () => {
  it("is used once the piece placed a button or a footer", () => {
    expect(leadExitPieceUsed([body])).toBe(false);
    const action = { kind: "opt_out" as const, params: {}, confirmation: "" };
    expect(leadExitPieceUsed([body, buttons({ id: "a", type: "QUICK_REPLY", text: "Sair", action, exitPiece: true })])).toBe(true);
    expect(leadExitPieceUsed([body, { id: "f", type: "FOOTER", data: { text: "Responda /sair", exitPiece: true } }])).toBe(true);
  });

  it("is free again once the user undid what the piece placed", () => {
    expect(leadExitPieceUsed([body, buttons({ id: "a", type: "QUICK_REPLY", text: "Sair", exitPiece: true })])).toBe(false);
    expect(leadExitPieceUsed([body, { id: "f", type: "FOOTER", data: { text: " ", exitPiece: true } }])).toBe(false);
  });
});

describe("leadExitRoom", () => {
  it("allows a new button only while the builder has room for one", () => {
    expect(leadExitRoom([body]).button).toBe(true);
    const full = buttons(
      { id: "a", type: "QUICK_REPLY", text: "1" },
      { id: "b", type: "QUICK_REPLY", text: "2" },
      { id: "c", type: "QUICK_REPLY", text: "3" },
    );
    expect(leadExitRoom([body, full]).button).toBe(false);
    expect(leadExitRoom([body, { id: "call", type: "CALL_PERMISSION_REQUEST", data: {} }]).button).toBe(false);
  });
});

describe("collectExitSetup", () => {
  it("reads each quick reply action by its button position and the exit confirmation", () => {
    const setup = collectExitSetup([
      body,
      { id: "f", type: "FOOTER", data: { text: "Responda /parar", exitConfirmation: "Ok." } },
      buttons(
        { id: "u", type: "URL", text: "Site", url: "https://x" },
        { id: "q", type: "QUICK_REPLY", text: "Sair", action: { kind: "opt_out", params: {}, confirmation: "Tchau." } },
        { id: "r", type: "QUICK_REPLY", text: "Mais" },
      ),
    ]);
    expect(setup).toEqual({
      buttonActions: [{ buttonIndex: 1, buttonText: "Sair", kind: "opt_out", params: {}, confirmation: "Tchau." }],
      exitConfirmation: "Ok.",
    });
  });
});

describe("draftVerdictRequest", () => {
  it("sends the texts the lead sees and the buttons in order with their actions, for the server to judge", () => {
    const request = draftVerdictRequest(
      [
        { id: "h", type: "HEADER", data: { format: "TEXT", text: "Aviso" } },
        body,
        { id: "f", type: "FOOTER", data: { text: "Responda /parar", exitConfirmation: "Ok." } },
        buttons(
          { id: "u", type: "URL", text: "Site", url: "https://x" },
          { id: "q", type: "QUICK_REPLY", text: "Sair", action: { kind: "opt_out", params: {}, confirmation: "" } },
        ),
      ],
      "MARKETING",
    );
    expect(request).toEqual({
      category: "MARKETING",
      header: "Aviso",
      body: "Olá",
      footer: "Responda /parar",
      buttons: [
        { type: "URL", text: "Site" },
        { type: "QUICK_REPLY", text: "Sair" },
      ],
      buttonActions: [{ buttonIndex: 1, buttonText: "Sair", kind: "opt_out", params: {}, confirmation: "" }],
    });
  });

  it("never sends the handle of a media header as text", () => {
    const request = draftVerdictRequest([{ id: "h", type: "HEADER", data: { format: "IMAGE", example: "https://cdn/x /sair" } }, body], "MARKETING");
    expect(request.header).toBe("");
  });

  it("sends empty texts and lists for a draft with no buttons and no exit", () => {
    expect(draftVerdictRequest([body], "UTILITY")).toEqual({ category: "UTILITY", header: "", body: "Olá", footer: "", buttons: [], buttonActions: [] });
  });
});

describe("exitSetupFields", () => {
  it("sends nothing when the user configured no exit", () => {
    expect(exitSetupFields({ buttonActions: [], exitConfirmation: "" })).toEqual({});
  });

  it("sends what the user configured", () => {
    const action = { buttonIndex: 0, buttonText: "Sair", kind: "opt_out" as const, params: {}, confirmation: "" };
    expect(exitSetupFields({ buttonActions: [action], exitConfirmation: "Ok." })).toEqual({
      buttonActions: [action],
      exitConfirmation: "Ok.",
    });
  });
});

describe("planOf", () => {
  const action = { kind: "opt_out" as const, params: {}, confirmation: "" };

  it("has no plan until the user chooses how the lead leaves", () => {
    expect(planOf(EMPTY_LEAD_EXIT_DRAFT)).toBeNull();
  });

  it("needs the button text and its exit action", () => {
    const draft = { ...EMPTY_LEAD_EXIT_DRAFT, mode: "button" as const, text: " Não quero " };
    expect(planOf(draft)).toBeNull();
    expect(planOf({ ...draft, action })).toEqual({ mode: "button", text: "Não quero", action });
  });

  it("needs the word and a footer that shows its command", () => {
    const draft = { ...EMPTY_LEAD_EXIT_DRAFT, mode: "word" as const, word: " parar ", confirmation: "Ok." };
    expect(planOf(draft)).toBeNull();
    expect(planOf({ ...draft, footerText: "Responda parar" })).toBeNull();
    expect(planOf({ ...draft, footerText: "Responda /PARAR " })).toEqual({ mode: "word", word: "parar", footerText: "Responda /PARAR", confirmation: "Ok." });
  });
});

describe("withExitWord", () => {
  const sentence = (command: string) => `Responda ${command} para sair`;

  it("writes the ready-made footer for the word while the user did not write their own", () => {
    const typed = withExitWord({ ...EMPTY_LEAD_EXIT_DRAFT, mode: "word" }, "sai", sentence);
    expect(typed.footerText).toBe("Responda /sai para sair");
    expect(withExitWord(typed, "sair", sentence)).toMatchObject({ word: "sair", footerText: "Responda /sair para sair" });
    expect(withExitWord(typed, " ", sentence).footerText).toBe("");
  });

  it("keeps a footer the user wrote", () => {
    const own = { ...EMPTY_LEAD_EXIT_DRAFT, mode: "word" as const, word: "sair", footerText: "Para sair, envie /sair" };
    expect(withExitWord(own, "parar", sentence).footerText).toBe("Para sair, envie /sair");
  });
});

describe("withoutExitSetup", () => {
  it("drops the confirmation and the piece mark from a footer", () => {
    const footer: DraggableComponent = { id: "f", type: "FOOTER", data: { text: "Responda /parar", exitConfirmation: "Ok", exitPiece: true } };
    expect(withoutExitSetup(footer)).toEqual({ id: "f", type: "FOOTER", data: { text: "Responda /parar" } });
  });

  it("returns the same component when there is no exit setup", () => {
    const footer: DraggableComponent = { id: "f", type: "FOOTER", data: { text: "Obrigado" } };
    expect(withoutExitSetup(footer)).toBe(footer);
  });
});

describe("allowedKindsOf", () => {
  it("offers the kinds the server allows this viewer", () => {
    expect(allowedKindsOf({ allowedKinds: ["opt_out", "hand_off"] })).toEqual(["opt_out", "hand_off"]);
  });

  it("offers nothing while the allowed kinds are unknown", () => {
    expect(allowedKindsOf(null)).toEqual([]);
  });
});

describe("withSavedExit", () => {
  const saved = (exitConfirmation = "Pronto."): { actions: ButtonActionView[]; exitConfirmation: string } => ({
    actions: [
      { buttonIndex: 0, buttonText: "Parar", kind: "opt_out", params: {}, confirmation: "Saiu.", stale: false, version: 1 },
      { buttonIndex: 1, buttonText: "Falar", kind: "hand_off", params: {}, confirmation: "", stale: false, version: 1 },
    ],
    exitConfirmation,
  });

  it("puts each saved action on the quick reply that still reads the same at the same place", () => {
    const next = withSavedExit([body, buttons({ id: "a", type: "QUICK_REPLY", text: "parar " }, { id: "b", type: "QUICK_REPLY", text: "Falar" })], saved());
    expect(next[1].data.buttons).toEqual([
      { id: "a", type: "QUICK_REPLY", text: "parar ", action: { kind: "opt_out", params: {}, confirmation: "Saiu." } },
      { id: "b", type: "QUICK_REPLY", text: "Falar", action: { kind: "hand_off", params: {}, confirmation: "" } },
    ]);
  });

  it("leaves out the actions whose button moved or changed", () => {
    const next = withSavedExit([body, buttons({ id: "a", type: "QUICK_REPLY", text: "Falar" }, { id: "b", type: "URL", text: "Parar", url: "https://x" })], saved());
    expect(next[1].data.buttons?.map((b) => b.action)).toEqual([undefined, undefined]);
  });

  it("puts the saved exit confirmation on the footer", () => {
    const next = withSavedExit([body, { id: "f", type: "FOOTER", data: { text: "Responda /sair" } }], saved());
    expect(next[1].data.exitConfirmation).toBe("Pronto.");
  });
});

describe("editExitSetup", () => {
  const quickReplyExit = buttons({ id: "q", type: "QUICK_REPLY", text: "Sair", action: { kind: "opt_out", params: {}, confirmation: "" } });

  it("reads the setup the way create does when the draft has a footer", () => {
    const footer: DraggableComponent = { id: "f", type: "FOOTER", data: { text: "Responda /sair", exitConfirmation: "" } };
    expect(editExitSetup([body, footer, quickReplyExit], "Pronto.")).toEqual(collectExitSetup([body, footer, quickReplyExit]));
  });

  it("keeps the saved exit confirmation while the draft has no footer to hold it", () => {
    expect(editExitSetup([body, quickReplyExit], "Pronto.")).toEqual({
      buttonActions: [{ buttonIndex: 0, buttonText: "Sair", kind: "opt_out", params: {}, confirmation: "" }],
      exitConfirmation: "Pronto.",
    });
  });
});
