import { describe, expect, it } from "vitest";

import { applyViewers, emptyViewers, forgetViewers, otherViewers, typingOperatorNames } from "./viewers";

const ana = { user_id: "u-ana", name: "Ana" };
const bruno = { user_id: "u-bruno", name: "Bruno" };

describe("viewers per conversation", () => {
  it("keeps who is viewing each conversation, replacing the list on every announcement", () => {
    let state = applyViewers(emptyViewers, { entry_id: "e1", entry_type: "whatsapp", viewers: [ana, bruno] });
    state = applyViewers(state, { entry_id: "e1", entry_type: "whatsapp", viewers: [bruno] });
    expect(otherViewers(state, "e1", "whatsapp", "someone-else")).toEqual([bruno]);
  });

  it("never lists yourself", () => {
    const state = applyViewers(emptyViewers, { entry_id: "e1", entry_type: "whatsapp", viewers: [ana, bruno] });
    expect(otherViewers(state, "e1", "whatsapp", "u-ana")).toEqual([bruno]);
  });

  it("keeps conversations apart, including the same id on another channel", () => {
    const state = applyViewers(emptyViewers, { entry_id: "e1", entry_type: "whatsapp", viewers: [ana] });
    expect(otherViewers(state, "e1", "telegram", "x")).toEqual([]);
    expect(otherViewers(state, "e2", "whatsapp", "x")).toEqual([]);
  });

  it("drops malformed viewers and fills a missing name with nothing rather than inventing one", () => {
    const state = applyViewers(emptyViewers, {
      entry_id: "e1",
      entry_type: "whatsapp",
      viewers: [ana, { user_id: "" }, null, { user_id: "u-carla" }] as never,
    });
    expect(otherViewers(state, "e1", "whatsapp", "x")).toEqual([ana, { user_id: "u-carla", name: "" }]);
  });

  it("forgets a conversation that was left", () => {
    const state = forgetViewers(applyViewers(emptyViewers, { entry_id: "e1", entry_type: "whatsapp", viewers: [ana] }), "e1", "whatsapp");
    expect(otherViewers(state, "e1", "whatsapp", "x")).toEqual([]);
    expect(forgetViewers(state, "e1", "whatsapp")).toBe(state);
  });
});

describe("typingOperatorNames", () => {
  it("names the teammates typing, from the people viewing the conversation", () => {
    expect(typingOperatorNames(["u-ana", "u-bruno"], [ana, bruno], "me")).toEqual(["Ana", "Bruno"]);
  });

  it("leaves out yourself, people it cannot name and the contact typing", () => {
    expect(typingOperatorNames(["me", "5511999990000", "u-ana"], [ana, { user_id: "u-x", name: "" }], "me")).toEqual(["Ana"]);
  });
});
