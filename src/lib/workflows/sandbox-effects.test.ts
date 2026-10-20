import { describe, expect, it } from "vitest";

import { sandboxEffectsOf } from "./sandbox-effects";
import type { WorkflowRunLog } from "./types";

function step(overrides: Partial<WorkflowRunLog> = {}): WorkflowRunLog {
  return {
    id: "s1",
    runId: "sim",
    nodeId: "n1",
    nodeType: "action_add_label",
    status: "executed",
    executedAt: "2026-10-20T12:00:00Z",
    attempt: 1,
    durationMs: 3,
    ...overrides,
  };
}

const change = { kind: "label", action: "add", target_id: "l1", target_name: "Quente", description: "Adicionaria a etiqueta Quente" };

describe("sandboxEffectsOf", () => {
  it("lists what a simulated CRM node would do, by its description", () => {
    expect(sandboxEffectsOf(step({ simulated: true, output: { would_do: [change] } })).wouldDo).toEqual([
      { kind: "label", description: "Adicionaria a etiqueta Quente" },
    ]);
  });

  it("shows no would-do for a step that really ran, even when its output carries the key", () => {
    expect(sandboxEffectsOf(step({ output: { would_do: [change] } })).wouldDo).toEqual([]);
  });

  it("skips would-do entries without a description and a malformed list", () => {
    expect(sandboxEffectsOf(step({ simulated: true, output: { would_do: [{ kind: "stage" }, "x", change] } })).wouldDo).toHaveLength(1);
    expect(sandboxEffectsOf(step({ simulated: true, output: { would_do: "Adicionaria" } })).wouldDo).toEqual([]);
  });

  it("maps the messages a send node sent to CRM messages, dropping entries that are not messages", () => {
    const effects = sandboxEffectsOf(
      step({
        nodeType: "action_send_message",
        output: {
          sent_messages: [
            { id: "m1", entryType: "whatsapp", channel: "whatsapp", messageType: "ai_response", direction: "OUTBOUND", text: "Olá", createdAt: "2026-10-20T12:00:00Z" },
            { text: "sem id" },
          ],
        },
      }),
    );
    expect(effects.sentMessages).toHaveLength(1);
    expect(effects.sentMessages[0]).toMatchObject({ id: "m1", text: "Olá", direction: "OUTBOUND" });
  });

  it("carries the step notice and nothing else for a plain step", () => {
    expect(sandboxEffectsOf(step({ notice: "saída fixada indisponível para você" }))).toEqual({
      wouldDo: [],
      sentMessages: [],
      notice: "saída fixada indisponível para você",
    });
    expect(sandboxEffectsOf(step({ notice: "  " }))).toEqual({ wouldDo: [], sentMessages: [] });
  });
});
