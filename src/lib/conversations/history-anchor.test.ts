import { describe, expect, it } from "vitest";

import { loadAfterPayload, loadAroundPayload, presentPayload } from "./history-anchor";

describe("history requests", () => {
  it("asks for the page around a quoted message by its id, one request instead of paging back", () => {
    expect(loadAroundPayload("e1", "whatsapp", { messageId: "m1" })).toEqual({
      entry_id: "e1",
      entry_type: "whatsapp",
      message_id: "m1",
    });
  });

  it("asks for the page around a moment for a deep link", () => {
    expect(loadAroundPayload("e1", "whatsapp", { timestamp: "2026-10-18T10:00:00Z" })).toEqual({
      entry_id: "e1",
      entry_type: "whatsapp",
      timestamp: "2026-10-18T10:00:00Z",
    });
  });

  it("returns to the present with a page around a moment past every message, which the server answers without has_after", () => {
    const now = new Date("2026-10-18T10:00:00.000Z");
    expect(presentPayload("e1", "whatsapp", now)).toEqual({
      entry_id: "e1",
      entry_type: "whatsapp",
      timestamp: "2026-10-19T10:00:00.000Z",
      page_size: 100,
    });
  });

  it("pages forward from the newest held message", () => {
    expect(loadAfterPayload("e1", "whatsapp", "2026-10-18T10:00:00.123456789Z")).toEqual({
      entry_id: "e1",
      entry_type: "whatsapp",
      after: "2026-10-18T10:00:00.123456789Z",
      page_size: 100,
    });
  });
});
