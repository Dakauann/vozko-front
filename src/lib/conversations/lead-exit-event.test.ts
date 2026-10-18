import { describe, expect, it } from "vitest";

import { isLeadExitEvent, leadExitView } from "./lead-exit-event";

describe("lead exit conversation lines", () => {
  it("knows the two exit event types and nothing else", () => {
    expect(isLeadExitEvent("lead_exit_action")).toBe(true);
    expect(isLeadExitEvent("lead_send_refused")).toBe(true);
    expect(isLeadExitEvent("assigned")).toBe(false);
  });

  it("says the lead tapped the exit button and the opt-out was recorded, with the one confirmation", () => {
    const view = leadExitView("lead_exit_action", {
      trigger: "button",
      kind: "opt_out",
      outcome: "changed",
      button_text: "SAIR",
      button_index: "1",
      confirmation: "sent",
    });
    expect(view).toEqual({
      tone: "ok",
      trigger: { key: "trigger.button", values: { button: "SAIR" } },
      result: { key: "changed.opt_out", values: {} },
      reason: null,
      confirmation: "confirmation.sent",
    });
  });

  it("names the word for a typed exit and says nothing changed when the lead had already left", () => {
    const view = leadExitView("lead_exit_action", { trigger: "workspace_word", kind: "opt_out", outcome: "unchanged", word: "parar", confirmation: "none" });
    expect(view?.trigger).toEqual({ key: "trigger.workspace_word", values: { word: "/parar" } });
    expect(view?.result.key).toBe("unchanged.opt_out");
    expect(view?.tone).toBe("neutral");
    expect(view?.confirmation).toBeNull();
  });

  it("names the word an unofficial campaign message showed", () => {
    const view = leadExitView("lead_exit_action", { trigger: "campaign_word", kind: "opt_out", outcome: "changed", word: "sair", campaign_id: "camp-u", confirmation: "none" });
    expect(view?.trigger).toEqual({ key: "trigger.campaign_word", values: { word: "/sair" } });
    expect(view?.result.key).toBe("changed.opt_out");
    expect(view?.confirmation).toBeNull();
  });

  it("carries the coded reason of a refused or failed action", () => {
    const refused = leadExitView("lead_exit_action", { trigger: "button", kind: "start_workflow", outcome: "refused", reason: "workflow_not_active", button_text: "Quero" });
    expect(refused?.result.key).toBe("refused");
    expect(refused?.reason).toBe("workflow_not_active");
    expect(refused?.tone).toBe("refused");

    const failed = leadExitView("lead_exit_action", { trigger: "template_word", kind: "opt_out", outcome: "failed", reason: "lead_exit_action_failed", word: "sair" });
    expect(failed?.trigger).toEqual({ key: "trigger.template_word", values: { word: "/sair" } });
    expect(failed?.result.key).toBe("failed");
    expect(failed?.tone).toBe("refused");
  });

  it("describes routing actions by what they did", () => {
    expect(leadExitView("lead_exit_action", { trigger: "button", kind: "classify", outcome: "changed", option: "Quente", button_text: "Tenho interesse" })?.result).toEqual({
      key: "changed.classify",
      values: { option: "Quente" },
    });
    expect(leadExitView("lead_exit_action", { trigger: "button", kind: "hand_off", outcome: "unchanged" })?.result.key).toBe("unchanged.other");
    expect(leadExitView("lead_exit_action", { trigger: "button", kind: "teleport", outcome: "changed" })?.result.key).toBe("changed.other");
  });

  it("says why a workflow send was refused", () => {
    expect(leadExitView("lead_send_refused", { reason: "lead_opted_out", workflow_id: "wf-1" })).toEqual({
      tone: "refused",
      trigger: null,
      result: { key: "sendRefused.lead_opted_out", values: {} },
      reason: null,
      confirmation: null,
    });
    expect(leadExitView("lead_send_refused", { reason: "lead_blocked" })?.result.key).toBe("sendRefused.lead_blocked");
    expect(leadExitView("lead_send_refused", {})?.result.key).toBe("sendRefused.other");
  });

  it("reads no line from other events", () => {
    expect(leadExitView("assigned", { trigger: "button" })).toBeNull();
  });
});
