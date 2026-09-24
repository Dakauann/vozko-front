import { describe, expect, it } from "vitest";

import {
  isHandoffEvent,
  resolveEventParticipants,
  parseEventDetails,
  type ConversationEvent,
} from "@/lib/conversations/events";


const ANA = "11111111-1111-4111-8111-111111111111";
const BRUNO = "22222222-2222-4222-8222-222222222222";

function ev(over: Partial<ConversationEvent>): ConversationEvent {
  return {
    id: "e1",
    workspace_id: "ws",
    entry_id: "entry",
    entry_type: "whatsapp",
    event_type: "replied",
    actor_id: ANA,
    actor_kind: "human",
    created_at: "2026-09-02T12:00:00Z",
    ...over,
  };
}

function participants(
  event: ConversationEvent,
  memberNames?: Record<string, string>,
) {
  return resolveEventParticipants(
    event,
    parseEventDetails(event.details),
    memberNames,
  );
}

describe("resolveEventParticipants", () => {
  it("names the sender of a human reply from the resolved field", () => {
    expect(participants(ev({ actor_name: "ana" })).actor).toBe("ana");
  });

  it("falls back to the workspace member map for events stored before the backend resolved names", () => {
    expect(participants(ev({}), { [ANA]: "ana" }).actor).toBe("ana");
  });

  it("names both sides of a handoff", () => {
    const who = participants(
      ev({
        event_type: "assigned",
        actor_name: "ana",
        from_name: "bruno",
        to_name: "ana",
      }),
    );
    expect(who).toEqual({ actor: "ana", from: "bruno", to: "ana" });
  });

  it("resolves handoff ids out of details when the backend could not", () => {
    const who = participants(
      ev({
        event_type: "assigned",
        details: JSON.stringify({
          from_user_id: BRUNO,
          to_user_id: ANA,
          trigger: "manual",
        }),
      }),
      { [ANA]: "ana", [BRUNO]: "bruno" },
    );
    expect(who.from).toBe("bruno");
    expect(who.to).toBe("ana");
  });

  it("never shows a raw id as a name", () => {
    const who = participants(
      ev({
        event_type: "assigned",
        details: JSON.stringify({ to_user_id: ANA, to_username: BRUNO }),
      }),
    );
    expect(who.actor).toBeNull();
    expect(who.to).toBeNull();
  });

  it("gives a system event no actor name", () => {
    const who = participants(
      ev({ actor_id: "system", actor_kind: "system", actor_name: "system" }),
    );
    expect(who.actor).toBeNull();
  });

  it("keeps one side of an unassignment", () => {
    const who = participants(
      ev({ event_type: "unassigned", from_name: "bruno" }),
    );
    expect(who.from).toBe("bruno");
    expect(who.to).toBeNull();
  });
});

describe("isHandoffEvent", () => {
  it("covers assignment and transfer, not replies", () => {
    expect(isHandoffEvent("assigned")).toBe(true);
    expect(isHandoffEvent("auto_assigned")).toBe(true);
    expect(isHandoffEvent("unassigned")).toBe(true);
    expect(isHandoffEvent("transfer_completed")).toBe(true);
    expect(isHandoffEvent("replied")).toBe(false);
    expect(isHandoffEvent("stage_changed")).toBe(false);
  });
});

describe("voice transfer targets", () => {
  it("shows a non-person target verbatim rather than dropping it", () => {
    const who = participants(
      ev({
        event_type: "transfer_completed",
        entry_type: "voice",
        details: JSON.stringify({ target: "Support queue", transfer_id: "t1" }),
      }),
    );
    expect(who.to).toBe("Support queue");
  });

  it("still resolves a uuid target to a member name", () => {
    const who = participants(
      ev({
        event_type: "transfer_completed",
        details: JSON.stringify({ target: BRUNO }),
      }),
      { [BRUNO]: "bruno" },
    );
    expect(who.to).toBe("bruno");
  });
});

describe("workflow actors", () => {
  const FLOW = "44444444-4444-4444-8444-444444444444";

  it("names the workflow that handed a conversation off", () => {
    const who = participants(
      ev({
        event_type: "assigned",
        actor_id: `workflow:${FLOW}`,
        actor_kind: "workflow",
        actor_name: "Triagem",
        from_name: "Triagem",
        to_name: "ana",
      }),
    );
    expect(who).toEqual({ actor: "Triagem", from: "Triagem", to: "ana" });
  });

  it("never prints a raw workflow id as a name", () => {
    const who = participants(
      ev({
        event_type: "assigned",
        actor_id: `workflow:${FLOW}`,
        actor_kind: "workflow",
        details: JSON.stringify({ from_user_id: `workflow:${FLOW}`, to_user_id: ANA }),
      }),
      { [ANA]: "ana", [`workflow:${FLOW}`]: `workflow:${FLOW}` },
    );
    expect(who.actor).toBeNull();
    expect(who.from).toBeNull();
    expect(who.to).toBe("ana");
  });
});
