import { describe, expect, it } from "vitest";

import { withoutStageTwins, type ConversationEvent } from "./events";

function event(id: string, type: string, stage: string, at: string): ConversationEvent {
  return {
    id,
    workspace_id: "ws",
    entry_id: "e1",
    entry_type: "whatsapp",
    event_type: type as ConversationEvent["event_type"],
    actor_id: "system",
    details: JSON.stringify({ stage_name: stage }),
    created_at: at,
  };
}

describe("withoutStageTwins", () => {
  it("drops the tag entry written alongside a stage move", () => {
    const events = [
      event("move", "stage_changed", "agendado", "2026-09-29T03:16:34.650Z"),
      event("twin", "tag_added", "agendado", "2026-09-29T03:16:34.652Z"),
    ];
    expect(withoutStageTwins(events).map((e) => e.id)).toEqual(["move"]);
  });

  it("keeps an older move that was only recorded as a tag", () => {
    const events = [event("old", "tag_added", "recebido", "2026-05-01T10:00:00Z")];
    expect(withoutStageTwins(events).map((e) => e.id)).toEqual(["old"]);
  });

  it("keeps a tag for a different stage or a different moment", () => {
    const events = [
      event("move", "stage_changed", "agendado", "2026-09-29T03:16:34Z"),
      event("other-stage", "tag_added", "desistiu", "2026-09-29T03:16:34Z"),
      event("later", "tag_added", "agendado", "2026-09-29T03:20:00Z"),
    ];
    expect(withoutStageTwins(events).map((e) => e.id)).toEqual(["move", "other-stage", "later"]);
  });

  it("leaves every other event alone", () => {
    const events = [event("reply", "replied", "", "2026-09-29T03:16:34Z")];
    expect(withoutStageTwins(events)).toEqual(events);
  });
});
