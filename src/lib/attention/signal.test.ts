import { describe, expect, it, vi } from "vitest";

import { setAttentionSink, setViewing, signalAttention, viewingNow } from "./signal";

describe("attention signal", () => {
  it("reaches the sink while one is set and drops signals otherwise", () => {
    const sink = vi.fn();
    const remove = setAttentionSink(sink);
    signalAttention({ id: "a", source: "notification", group: "a", title: "t", body: "b" });
    remove();
    signalAttention({ id: "b", source: "notification", group: "b", title: "t", body: "b" });
    expect(sink).toHaveBeenCalledTimes(1);
  });

  it("passes each signal id on only once, however often it arrives", () => {
    const sink = vi.fn();
    const remove = setAttentionSink(sink);
    const signal = { id: "dup", source: "team_message" as const, group: "t", title: "t", body: "b" };
    signalAttention(signal);
    signalAttention({ ...signal });
    signalAttention({ ...signal, id: "other" });
    remove();
    expect(sink.mock.calls.map((call) => call[0].id)).toEqual(["dup", "other"]);
  });

  it("remembers what the person is looking at per source", () => {
    setViewing("team_message", "t-1");
    setViewing("customer_message", "e-1");
    setViewing("team_message", null);
    expect(viewingNow()).toEqual({ team_message: null, customer_message: "e-1" });
  });
});
