import { describe, expect, it } from "vitest";

import {
  applySimIntent,
  applySimMessage,
  connectingSimSession,
  initialSimSession,
  isLiveSimStatus,
  simCommand,
  simEventWindowStart,
  simulationUrl,
  type SimSession,
} from "./sim-session";

function receive(session: SimSession, ...messages: Array<[string, unknown?]>): SimSession {
  return messages.reduce((current, [type, payload]) => applySimMessage(current, { type, payload }), session);
}

const STEP = {
  id: "s1",
  runId: "r1",
  nodeId: "n1",
  nodeType: "action_http_request",
  status: "executed",
  executedAt: "2026-10-20T12:00:00Z",
  attempt: 1,
  durationMs: 12,
  output: { status_code: 200 },
  branch: "success",
  stepIndex: 0,
};

describe("simulationUrl", () => {
  it("asks the server to wait for start, so breakpoints and the real call confirmation are in place first", () => {
    const url = new URL(simulationUrl("wss://api.test", "wf 1", "ws-1"));
    expect(url.pathname).toBe("/ws/workflows/wf%201/simulate");
    expect(url.searchParams.get("await_start")).toBe("1");
    expect(url.searchParams.get("workspace_id")).toBe("ws-1");
  });

  it("leaves the workspace out when there is none", () => {
    expect(new URL(simulationUrl("ws://x", "wf", "")).searchParams.has("workspace_id")).toBe(false);
  });
});

describe("simCommand", () => {
  it("frames a command with and without data", () => {
    expect(JSON.parse(simCommand("step"))).toEqual({ type: "step" });
    expect(JSON.parse(simCommand("run_until", { nodeId: "n4" }))).toEqual({ type: "run_until", data: { nodeId: "n4" } });
  });
});

describe("applySimMessage", () => {
  it("waits for a start after sim_ready and keeps the nodes that would call out", () => {
    const ready = receive(connectingSimSession(), ["sim_ready", { workflowId: "wf", triggerType: "trigger_webhook", realCallNodes: ["n1"] }]);
    expect(ready.status).toBe("ready");
    expect(ready.realCallNodes).toEqual(["n1"]);
    expect(ready.triggerType).toBe("trigger_webhook");
  });

  it("keeps the reproduction details from sim_started for the banner", () => {
    const started = receive(connectingSimSession(), [
      "sim_started",
      { runId: "sim-1", workflowId: "wf", realCallNodes: [], reproducing: { runId: "r9", workflowVersion: 3, pinnedNodes: ["n1"] } },
    ]);
    expect(started.status).toBe("running");
    expect(started.runId).toBe("sim-1");
    expect(started.reproducing).toEqual({ runId: "r9", workflowVersion: 3, pinnedNodes: ["n1"] });
  });

  it("records each executed node as a full step record, in order", () => {
    const session = receive(connectingSimSession(), ["sim_started", { runId: "x" }], ["node_executed", STEP], [
      "node_executed",
      { ...STEP, id: "s2", nodeId: "n2", stepIndex: 1, pinned: true },
    ]);
    expect(session.steps.map((step) => [step.nodeId, step.stepIndex, step.pinned ?? false])).toEqual([
      ["n1", 0, false],
      ["n2", 1, true],
    ]);
    expect(session.steps[0].output).toEqual({ status_code: 200 });
    expect(session.currentNodeId).toBe("n2");
    expect(session.events.filter((event) => event.type === "step")).toHaveLength(2);
  });

  it("pauses before the node with the state at that moment", () => {
    const paused = receive(connectingSimSession(), ["sim_started", { runId: "x" }], [
      "paused",
      { nodeId: "n3", nodeType: "action_code", stepIndex: 2, reason: "breakpoint", state: { cpf: "••••12" } },
    ]);
    expect(paused.status).toBe("paused");
    expect(paused.pause).toEqual({ nodeId: "n3", nodeType: "action_code", stepIndex: 2, reason: "breakpoint", state: { cpf: "••••12" } });
    expect(paused.stateVars).toEqual({ cpf: "••••12" });
    expect(paused.currentNodeId).toBe("n3");
  });

  it("keeps the session open on a refused command and shows why", () => {
    const refused = receive(connectingSimSession(), ["sim_started", { runId: "x" }], [
      "command_refused",
      { command: "step", error: "não pausado" },
    ]);
    expect(refused.status).toBe("running");
    expect(refused.refusal).toEqual({ command: "step", error: "não pausado" });
  });

  it("goes back to waiting for a start when the reproduction is refused", () => {
    const ready = receive(connectingSimSession(), ["sim_ready", { realCallNodes: [] }]);
    const sent = applySimIntent(ready, { kind: "start_sent", reproduceRunId: "r1" });
    const refused = receive(sent, ["command_refused", { command: "reproduce_run", error: "Esta execução é de outro fluxo." }]);
    expect(refused.status).toBe("ready");
    expect(refused.refusal?.command).toBe("reproduce_run");
  });

  it("tells a cancel from a pause that timed out", () => {
    const paused = receive(connectingSimSession(), ["paused", { nodeId: "n1", nodeType: "x", stepIndex: 0, reason: "step", state: {} }]);
    const timedOut = receive(paused, ["run_cancelled", { reason: "paused_timeout" }]);
    expect(timedOut.status).toBe("cancelled");
    expect(timedOut.cancelReason).toBe("paused_timeout");
    expect(timedOut.pause).toBeNull();
  });

  it("tells a test that never started in time apart from a cancel", () => {
    const ready = receive(connectingSimSession(), ["sim_ready", { realCallNodes: [] }]);
    const expired = receive(ready, ["run_cancelled", { reason: "start_timeout" }]);
    expect(expired.status).toBe("cancelled");
    expect(expired.cancelReason).toBe("start_timeout");
  });

  it("waits on a form until the customer answers it", () => {
    const running = applySimIntent(receive(connectingSimSession(), ["sim_ready", {}]), { kind: "start_sent" });
    const waiting = receive(running, ["waiting_form", { nodeId: "f1", formId: "form-9", timeoutSeconds: 300 }]);
    expect(waiting.status).toBe("waiting_form");
    expect(isLiveSimStatus(waiting.status)).toBe(true);
    expect(waiting.waitingForm).toEqual({ nodeId: "f1", formId: "form-9" });
    expect(waiting.currentNodeId).toBe("f1");
    expect(waiting.events.at(-1)).toEqual({ type: "waiting_form", nodeId: "f1", formId: "form-9", timeoutSeconds: 300 });

    const answered = applySimIntent(waiting, { kind: "replied" });
    expect(answered.status).toBe("running");
    expect(answered.waitingForm).toBeNull();
  });

  it("ignores a form wait without a form id, since there is nothing to answer", () => {
    const running = applySimIntent(receive(connectingSimSession(), ["sim_ready", {}]), { kind: "start_sent" });
    expect(receive(running, ["waiting_form", { nodeId: "f1" }]).waitingForm).toBeNull();
  });

  it("reads a cancel without a reason as a plain cancel", () => {
    expect(receive(connectingSimSession(), ["run_cancelled"]).cancelReason).toBe("cancelled");
  });

  it("ends with an error and its message on run_error", () => {
    const failed = receive(connectingSimSession(), ["run_error", { error: "boom", status: "error" }]);
    expect(failed.status).toBe("error");
    expect(failed.events.at(-1)).toEqual({ type: "error", message: "boom" });
  });

  it("reads the error payload object the server sends when it cannot simulate", () => {
    const failed = receive(connectingSimSession(), ["error", { error: "workflow not found" }]);
    expect(failed.events.at(-1)).toEqual({ type: "error", message: "workflow not found" });
  });

  it("keeps the latest variables from state updates and from the completion", () => {
    const done = receive(connectingSimSession(), ["state_update", { vars: { a: 1 } }], ["run_completed", { vars: { a: 2 } }]);
    expect(done.status).toBe("completed");
    expect(done.stateVars).toEqual({ a: 2 });
  });

  it("keeps the CRM message the channel would send next to the old summary", () => {
    const sent = receive(connectingSimSession(), [
      "message_sent",
      {
        direction: "outbound",
        text: "Continuar?",
        msgType: "button",
        nodeId: "n2",
        messageId: "m1",
        message: { id: "m1", entryType: "whatsapp", channel: "whatsapp", messageType: "ai_response", direction: "OUTBOUND", text: "Continuar?", metadata: { buttons: { body_text: "Continuar?", buttons: [{ id: "s", title: "Sim" }] } } },
      },
    ]);
    const event = sent.events.at(-1);
    expect(event).toMatchObject({ type: "message", direction: "outbound", msgType: "button", messageId: "m1" });
    expect(event?.type === "message" && event.message).toMatchObject({ id: "m1", message_type: "ai_response", direction: "OUTBOUND" });
  });

  it("leaves a voice audio without a CRM message", () => {
    const sent = receive(connectingSimSession(), ["message_sent", { direction: "outbound", text: "Menu", msgType: "audio", messageId: "a1", audioUrl: "https://files/menu.mp3" }]);
    const event = sent.events.at(-1);
    expect(event?.type === "message" && event.message).toBeFalsy();
  });

  it("shows the contact reply the server received as an inbound CRM message", () => {
    const received = receive(connectingSimSession(), [
      "message_received",
      { direction: "inbound", message: { id: "in-1", entryType: "whatsapp", channel: "whatsapp", messageType: "user_message", direction: "INBOUND", text: "Sim" } },
    ]);
    const event = received.events.at(-1);
    expect(event).toMatchObject({ type: "message", direction: "inbound", text: "Sim", msgType: "user_message", messageId: "in-1" });
    expect(event?.type === "message" && event.message?.direction).toBe("INBOUND");
  });

  it("drops a received reply without a message", () => {
    const before = connectingSimSession();
    expect(applySimMessage(before, { type: "message_received", payload: { direction: "inbound" } })).toBe(before);
  });

  it("keeps waiting on an ignored interactive reply and says so in the timeline", () => {
    const running = applySimIntent(receive(connectingSimSession(), ["waiting_reply", { nodeId: "n2", timeoutSeconds: 30 }]), { kind: "replied" });
    const ignored = receive(running, ["reply_ignored", { nodeId: "n2", reason: "interactive_reply_unhandled" }]);
    expect(ignored.status).toBe("waiting_reply");
    expect(ignored.currentNodeId).toBe("n2");
    expect(ignored.events.at(-1)).toEqual({ type: "reply_ignored", nodeId: "n2" });
  });

  it("ignores messages it does not know", () => {
    const before = connectingSimSession();
    expect(applySimMessage(before, { type: "wait_skipped", payload: {} })).toBe(before);
  });
});

describe("applySimIntent", () => {
  it("leaves the pause as soon as a step, continue or run until is sent", () => {
    const paused = receive(connectingSimSession(), ["paused", { nodeId: "n1", nodeType: "x", stepIndex: 0, reason: "step", state: {} }]);
    const resumed = applySimIntent(paused, { kind: "resumed" });
    expect(resumed.status).toBe("running");
    expect(resumed.pause).toBeNull();
  });

  it("does nothing on resume when nothing is paused", () => {
    const running = receive(connectingSimSession(), ["sim_started", { runId: "x" }]);
    expect(applySimIntent(running, { kind: "resumed" })).toBe(running);
  });

  it("waits for the user while the real call confirmation is open", () => {
    const ready = receive(connectingSimSession(), ["sim_ready", { realCallNodes: ["n1"] }]);
    expect(applySimIntent(ready, { kind: "confirming" }).status).toBe("confirming");
  });

  it("goes back to waiting for a start when the real call confirmation is dismissed", () => {
    const confirming = applySimIntent(receive(connectingSimSession(), ["sim_ready", { realCallNodes: ["n1"] }]), { kind: "confirming" });
    expect(applySimIntent(confirming, { kind: "dismissed" }).status).toBe("ready");
  });

  it("runs again after a reply without adding a bubble, since the server echoes the reply as message_received", () => {
    const waiting = receive(connectingSimSession(), ["waiting_reply", { nodeId: "n1", timeoutSeconds: 30 }]);
    const replied = applySimIntent(waiting, { kind: "replied" });
    expect(replied.status).toBe("running");
    expect(replied.events).toEqual(waiting.events);
  });

  it("marks a dropped connection during a live session as an error, and leaves a finished one alone", () => {
    const paused = receive(connectingSimSession(), ["paused", { nodeId: "n1", nodeType: "x", stepIndex: 0, reason: "step", state: {} }]);
    expect(applySimIntent(paused, { kind: "closed" }).status).toBe("error");
    const done = receive(connectingSimSession(), ["run_completed", { vars: {} }]);
    expect(applySimIntent(done, { kind: "closed" }).status).toBe("completed");
  });

  it("cancels locally without waiting for the server", () => {
    const running = receive(connectingSimSession(), ["sim_started", { runId: "x" }]);
    const cancelled = applySimIntent(running, { kind: "cancelled" });
    expect(cancelled.status).toBe("cancelled");
    expect(cancelled.cancelReason).toBe("cancelled");
  });
});

describe("isLiveSimStatus", () => {
  it.each([
    ["idle", false],
    ["connecting", true],
    ["ready", true],
    ["confirming", true],
    ["running", true],
    ["paused", true],
    ["waiting_reply", true],
    ["completed", false],
    ["error", false],
    ["cancelled", false],
  ] as const)("reads %s", (status, live) => {
    expect(isLiveSimStatus(status)).toBe(live);
  });
});

describe("simEventWindowStart", () => {
  it("shows every event while the timeline is short", () => {
    expect(simEventWindowStart(12, 80)).toBe(0);
  });

  it("starts at the newest events of a long timeline, so the hidden count is the start", () => {
    expect(simEventWindowStart(500, 80)).toBe(420);
  });
});

describe("initialSimSession", () => {
  it("starts idle and empty", () => {
    const session = initialSimSession();
    expect(session.status).toBe("idle");
    expect(session.steps).toEqual([]);
    expect(session.pause).toBeNull();
  });
});
