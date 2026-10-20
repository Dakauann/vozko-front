import { describe, expect, it } from "vitest";

import { statusTone } from "./status-tone";

describe("statusTone", () => {
  it.each([
    ["running", "outline", "bg-primary"],
    ["waiting", "warning", undefined],
    ["completed", "healthy", undefined],
    ["error", "fault", undefined],
    ["cancelled", "muted", undefined],
  ])("gives the run status %s one tone, wherever it is shown", (status, tone, dot) => {
    expect(statusTone(status)).toEqual(dot ? { tone, dot } : { tone });
  });

  it.each([
    ["paused", "warning"],
    ["waiting_reply", "warning"],
    ["waiting_key", "warning"],
    ["confirming", "warning"],
    ["connecting", "warning"],
    ["ready", "muted"],
    ["waiting_trigger", "muted"],
  ])("gives the test session status %s the tone of the run state it stands for", (status, tone) => {
    expect(statusTone(status).tone).toBe(tone);
  });

  it("falls back to muted for a status it does not know", () => {
    expect(statusTone("mystery")).toEqual({ tone: "muted" });
  });
});
