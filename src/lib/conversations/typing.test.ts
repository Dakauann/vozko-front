import { describe, expect, it } from "vitest";

import { emptyTyping, reduceTyping, typistsIn, type TypingEvent, type TypingState } from "./typing";

const typing = (entryId: string, userId: string, isTyping = true): TypingEvent => ({
  type: "typing",
  entryId,
  entryType: "whatsapp",
  userId,
  isTyping,
});

const left = (entryId: string): TypingEvent => ({ type: "entry_left", entryId, entryType: "whatsapp" });

function run(events: TypingEvent[], from: TypingState = emptyTyping): TypingState {
  return events.reduce(reduceTyping, from);
}

describe("typing state keyed by entry", () => {
  const cases: { name: string; events: TypingEvent[]; entryId: string; expected: string[] }[] = [
    {
      name: "a teammate typing shows only in the conversation they type in",
      events: [typing("e-1", "ana")],
      entryId: "e-1",
      expected: ["ana"],
    },
    {
      name: "typing in a pop-out conversation never leaks into another thread",
      events: [typing("e-2", "ana")],
      entryId: "e-1",
      expected: [],
    },
    {
      name: "several teammates in one conversation are all kept",
      events: [typing("e-1", "ana"), typing("e-1", "bruno")],
      entryId: "e-1",
      expected: ["ana", "bruno"],
    },
    {
      name: "a stop clears only that teammate",
      events: [typing("e-1", "ana"), typing("e-1", "bruno"), typing("e-1", "ana", false)],
      entryId: "e-1",
      expected: ["bruno"],
    },
    {
      name: "leaving a conversation forgets everyone typing there",
      events: [typing("e-1", "ana"), typing("e-1", "bruno"), left("e-1")],
      entryId: "e-1",
      expected: [],
    },
    {
      name: "leaving one conversation keeps typing in another",
      events: [typing("e-1", "ana"), typing("e-2", "bruno"), left("e-1")],
      entryId: "e-2",
      expected: ["bruno"],
    },
    {
      name: "a stop for someone who was never typing changes nothing",
      events: [typing("e-1", "ana", false)],
      entryId: "e-1",
      expected: [],
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      expect([...typistsIn(run(c.events), c.entryId, "whatsapp")].sort()).toEqual(c.expected);
    });
  }

  it("tells channels apart when two entries share an id", () => {
    const state = reduceTyping(emptyTyping, { ...typing("e-1", "ana"), entryType: "instagram" });

    expect(typistsIn(state, "e-1", "whatsapp").size).toBe(0);
    expect(typistsIn(state, "e-1", "instagram").size).toBe(1);
  });

  it("keeps the same state object when nothing changed, so the thread does not re-render", () => {
    const state = run([typing("e-1", "ana")]);

    expect(reduceTyping(state, typing("e-1", "ana"))).toBe(state);
    expect(reduceTyping(state, typing("e-1", "bruno", false))).toBe(state);
    expect(reduceTyping(state, left("e-9"))).toBe(state);
  });

  it("never mutates the state it was given", () => {
    const state = run([typing("e-1", "ana")]);
    run([typing("e-1", "bruno"), left("e-1")], state);

    expect([...typistsIn(state, "e-1", "whatsapp")]).toEqual(["ana"]);
  });
});
