import { describe, expect, it } from "vitest";

import { QUICK_REACTIONS, groupReactions, reactionToSend, reactorOf } from "./reactions";
import type { MessageReaction } from "./types";

const at = "2026-10-18T12:00:00Z";
const fromContact = (emoji: string): MessageReaction => ({ emoji, direction: "inbound", at });
const fromUs = (emoji: string, actor_id?: string): MessageReaction => ({ emoji, direction: "outbound", at, ...(actor_id ? { actor_id } : {}) });

describe("groupReactions", () => {
  it("groups by emoji with a count, in the order the emojis first appeared", () => {
    const groups = groupReactions([fromContact("❤️"), fromUs("👍", "u-ana"), fromContact("👍")]);
    expect(groups.map((group) => [group.emoji, group.count])).toEqual([
      ["❤️", 1],
      ["👍", 2],
    ]);
    expect(groups[1].reactions).toHaveLength(2);
  });

  it("ignores empty reactions and an absent list", () => {
    expect(groupReactions([fromContact(""), fromContact("  ")])).toEqual([]);
    expect(groupReactions(undefined)).toEqual([]);
  });
});

describe("reactionToSend", () => {
  it("sends the chosen emoji when the business has not reacted with it", () => {
    expect(reactionToSend([fromContact("👍")], "👍")).toBe("👍");
    expect(reactionToSend([fromUs("❤️")], "👍")).toBe("👍");
  });

  it("takes the reaction back when the business already reacted with the same emoji", () => {
    expect(reactionToSend([fromUs("👍", "u-ana")], "👍")).toBe("");
  });
});

describe("reactorOf", () => {
  const people = { selfId: "u-ana", memberNames: new Map([["u-bruno", "Bruno"]]), contactName: "Maria" };

  it("says you for your own reaction", () => {
    expect(reactorOf(fromUs("👍", "u-ana"), people)).toEqual({ kind: "self" });
  });

  it("names the teammate who reacted, and falls back to the team when nobody is named", () => {
    expect(reactorOf(fromUs("👍", "u-bruno"), people)).toEqual({ kind: "name", name: "Bruno" });
    expect(reactorOf(fromUs("👍", "u-unknown"), people)).toEqual({ kind: "team" });
    expect(reactorOf(fromUs("👍"), people)).toEqual({ kind: "team" });
  });

  it("names the contact for an inbound reaction", () => {
    expect(reactorOf(fromContact("👍"), people)).toEqual({ kind: "name", name: "Maria" });
    expect(reactorOf(fromContact("👍"), { ...people, contactName: "" })).toEqual({ kind: "contact" });
  });
});

describe("QUICK_REACTIONS", () => {
  it("offers six quick emojis", () => {
    expect(QUICK_REACTIONS).toHaveLength(6);
  });
});
