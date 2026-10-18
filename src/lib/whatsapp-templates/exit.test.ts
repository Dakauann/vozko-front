import { describe, expect, it } from "vitest";

import {
  EXIT_WORD_PREFIX,
  MARKETING_TEMPLATE_NEEDS_EXIT,
  ROUTE_KINDS,
  changeOf,
  choicesOf,
  exitRiskFields,
  exitWordLabel,
  exitWordsLabel,
  isExitKind,
  offeredKinds,
  actionInputs,
  seenTexts,
  withButtonAction,
  type ButtonActionView,
  type TemplateButtonActions,
} from "./exit";

function stored(overrides: Partial<ButtonActionView>): ButtonActionView {
  return {
    buttonIndex: 0,
    buttonText: "Falar com atendente",
    kind: "hand_off",
    params: { departmentId: "dep-1" },
    confirmation: "",
    stale: false,
    version: 2,
    ...overrides,
  };
}

const CURRENT: TemplateButtonActions = {
  templateId: "tpl-1",
  template: { name: "aviso_vencimento", language: "pt_BR" },
  version: 3,
  buttons: [],
  actions: [stored({}), stored({ buttonIndex: 1, buttonText: "Ver horários", kind: "start_workflow", params: { workflowId: "wf-1" } })],
  exitConfirmation: "Combinado.",
  allowedKinds: ["opt_out", "hand_off", "start_workflow"],
};

describe("isExitKind", () => {
  it.each([
    ["opt_out", true],
    ["consent_grant", true],
    ["hand_off", false],
    ["start_workflow", false],
    ["call_list", false],
    ["classify", false],
    ["create_deal", false],
    ["unknown", false],
  ])("%s is an exit: %s", (kind, expected) => {
    expect(isExitKind(kind)).toBe(expected);
  });
});

describe("ROUTE_KINDS", () => {
  it("offers only the kinds a campaign may route to", () => {
    expect(ROUTE_KINDS).toEqual(["hand_off", "start_workflow", "call_list", "classify", "create_deal"]);
  });
});

describe("changeOf", () => {
  it("turns what is stored into the request that keeps it", () => {
    expect(changeOf(CURRENT)).toEqual({
      actions: [
        { buttonIndex: 0, buttonText: "Falar com atendente", kind: "hand_off", params: { departmentId: "dep-1" }, confirmation: "" },
        { buttonIndex: 1, buttonText: "Ver horários", kind: "start_workflow", params: { workflowId: "wf-1" }, confirmation: "" },
      ],
      exitConfirmation: "Combinado.",
    });
  });
});

describe("withButtonAction", () => {
  it("replaces the action of that button and keeps the others", () => {
    const next = withButtonAction(changeOf(CURRENT), 0, "Falar com atendente", { kind: "opt_out", params: {}, confirmation: "Você saiu." });
    expect(next.actions).toEqual([
      { buttonIndex: 1, buttonText: "Ver horários", kind: "start_workflow", params: { workflowId: "wf-1" }, confirmation: "" },
      { buttonIndex: 0, buttonText: "Falar com atendente", kind: "opt_out", params: {}, confirmation: "Você saiu." },
    ]);
    expect(next.exitConfirmation).toBe("Combinado.");
  });

  it("removes the action when the button is set back to no action", () => {
    const next = withButtonAction(changeOf(CURRENT), 1, "Ver horários", null);
    expect(next.actions.map((action) => action.buttonIndex)).toEqual([0]);
  });
});

describe("actionInputs", () => {
  it("lists only the buttons that have a route for this send, with the text the person saw", () => {
    expect(
      actionInputs(
        {
          0: { kind: "hand_off", params: { userId: "u-1" }, confirmation: "" },
          2: null,
        },
        { 0: "Falar com atendente" },
      ),
    ).toEqual([{ buttonIndex: 0, buttonText: "Falar com atendente", kind: "hand_off", params: { userId: "u-1" }, confirmation: "" }]);
  });

  it("sends an empty text for a button nobody saw, so the server refuses it", () => {
    expect(actionInputs({ 4: { kind: "opt_out", params: {}, confirmation: "" } }, {})[0].buttonText).toBe("");
  });
});

describe("seenTexts", () => {
  const buttons = [
    { index: 0, text: "Falar com atendente", action: null, stale: false },
    { index: 1, text: "Parar", action: null, stale: true },
  ];
  const actions = [stored({ buttonIndex: 1, buttonText: "SAIR", kind: "opt_out", params: {}, stale: true })];

  it("keeps a stale action on the text it was saved with until the person confirms it", () => {
    expect(seenTexts(buttons, actions, new Set())).toEqual({ 0: "Falar com atendente", 1: "SAIR" });
  });

  it("binds a confirmed or changed stale action to the button text shown now", () => {
    expect(seenTexts(buttons, actions, new Set([1]))).toEqual({ 0: "Falar com atendente", 1: "Parar" });
  });

  it("keeps the saved text of an action whose button is gone", () => {
    const gone = [stored({ buttonIndex: 3, buttonText: "Antigo", stale: true })];
    expect(seenTexts(buttons, gone, new Set([3]))[3]).toBe("Antigo");
  });
});

describe("MARKETING_TEMPLATE_NEEDS_EXIT", () => {
  it("is the code the server refuses a marketing template without a shown exit with", () => {
    expect(MARKETING_TEMPLATE_NEEDS_EXIT).toBe("marketing_template_needs_exit");
  });
});

describe("exitRiskFields", () => {
  it("carries the acknowledgement only when the user gave it", () => {
    expect(exitRiskFields(true)).toEqual({ exitRiskAcknowledged: true });
    expect(exitRiskFields(false)).toEqual({});
  });
});

describe("offeredKinds", () => {
  it("offers only the kinds the server allows this viewer, in the order asked", () => {
    expect(offeredKinds(ROUTE_KINDS, ["opt_out", "start_workflow", "hand_off"])).toEqual(["hand_off", "start_workflow"]);
  });

  it("offers nothing the server did not list", () => {
    expect(offeredKinds(ROUTE_KINDS, [])).toEqual([]);
  });
});

describe("choicesOf", () => {
  it("indexes what is stored by button so the screen can edit it", () => {
    expect(choicesOf(CURRENT.actions)).toEqual({
      0: { kind: "hand_off", params: { departmentId: "dep-1" }, confirmation: "" },
      1: { kind: "start_workflow", params: { workflowId: "wf-1" }, confirmation: "" },
    });
  });
});

describe("exitWordLabel", () => {
  it("shows a stored word with the fixed slash the lead has to send", () => {
    expect(EXIT_WORD_PREFIX).toBe("/");
    expect(exitWordLabel("sair")).toBe("/sair");
  });

  it("shows a word saved before the fixed slash with a single slash", () => {
    expect(exitWordLabel("/sair")).toBe("/sair");
  });

  it("joins several words for a line of text", () => {
    expect(exitWordsLabel(["sair", "parar"])).toBe("/sair, /parar");
  });
});
