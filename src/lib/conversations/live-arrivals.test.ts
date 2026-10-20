import { describe, expect, it } from "vitest";

import { idleArrivals, trackArrivals, type ArrivalTracker } from "./live-arrivals";

const msg = (id: string, minute: number) => ({
  id,
  created_at: new Date(Date.UTC(2026, 9, 18, 10, minute)).toISOString(),
});

function after(steps: { key: string | null; messages: { id: string; created_at: string }[] }[]): ArrivalTracker {
  return steps.reduce((tracker, step) => trackArrivals(tracker, step.key, step.messages), idleArrivals);
}

describe("live arrivals", () => {
  const first = [msg("a", 1), msg("b", 2)];

  const cases: { name: string; steps: { key: string | null; messages: { id: string; created_at: string }[] }[]; live: string[] }[] = [
    { name: "the first page of a conversation never animates", steps: [{ key: "w-1", messages: first }], live: [] },
    {
      name: "a message appended after the newest one arrived live",
      steps: [{ key: "w-1", messages: first }, { key: "w-1", messages: [...first, msg("c", 3)] }],
      live: ["c"],
    },
    {
      name: "older history loaded above never animates",
      steps: [{ key: "w-1", messages: first }, { key: "w-1", messages: [msg("z", 0), ...first] }],
      live: [],
    },
    {
      name: "switching conversations never animates the new thread",
      steps: [{ key: "w-1", messages: first }, { key: "w-2", messages: [msg("x", 5), msg("y", 6)] }],
      live: [],
    },
    {
      name: "the first page after an empty thread does not count as live",
      steps: [{ key: "w-1", messages: [] }, { key: "w-1", messages: first }],
      live: [],
    },
    {
      name: "jumping to an older stretch of the thread never animates",
      steps: [{ key: "w-1", messages: first }, { key: "w-1", messages: [msg("o1", -30), msg("o2", -29)] }],
      live: [],
    },
    {
      name: "a status change on loaded messages ends the previous arrival",
      steps: [
        { key: "w-1", messages: first },
        { key: "w-1", messages: [...first, msg("c", 3)] },
        { key: "w-1", messages: [...first, { ...msg("c", 3) }] },
      ],
      live: [],
    },
    {
      name: "closing the thread clears everything",
      steps: [{ key: "w-1", messages: first }, { key: null, messages: [] }],
      live: [],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect([...after(c.steps).live]).toEqual(c.live);
    });
  }

  it("remembers the list it was computed from, so a caller can tell when to recompute", () => {
    const messages = [msg("a", 1)];
    expect(trackArrivals(idleArrivals, "w-1", messages).source).toBe(messages);
  });
});
