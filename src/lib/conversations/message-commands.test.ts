import { describe, expect, it } from "vitest";

import {
  messageActionErrorKey,
  messageCommand,
  noPendingMessageActions,
  settleMessageActions,
  takeRefusedMessageAction,
  trackMessageAction,
  type PendingMessageAction,
} from "./message-commands";

const target = { entryId: "e1", entryType: "whatsapp" as const, messageId: "m1" };

describe("messageCommand", () => {
  it("builds the react command, with an empty emoji to take the reaction back", () => {
    expect(messageCommand({ kind: "react", ...target, emoji: "👍" }, "r1")).toEqual({
      type: "react_message",
      payload: { entry_id: "e1", entry_type: "whatsapp", message_id: "m1", emoji: "👍", request_id: "r1" },
    });
    expect(messageCommand({ kind: "react", ...target, emoji: "" }, "r2").payload.emoji).toBe("");
  });

  it("builds the edit and delete commands", () => {
    expect(messageCommand({ kind: "edit", ...target, text: "novo" }, "r3")).toEqual({
      type: "edit_message",
      payload: { entry_id: "e1", entry_type: "whatsapp", message_id: "m1", text: "novo", request_id: "r3" },
    });
    expect(messageCommand({ kind: "delete", ...target }, "r4")).toEqual({
      type: "delete_message",
      payload: { entry_id: "e1", entry_type: "whatsapp", message_id: "m1", request_id: "r4" },
    });
  });
});

describe("pending message actions", () => {
  const react: PendingMessageAction = { kind: "react", ...target };

  it("hands back the refused action by its request id, once", () => {
    const pending = trackMessageAction(noPendingMessageActions, "r1", react);
    const first = takeRefusedMessageAction(pending, "r1");
    expect(first.refused).toEqual(react);
    expect(takeRefusedMessageAction(first.pending, "r1").refused).toBeNull();
  });

  it("does not claim an error for a request it never sent, so other refusals keep their own handling", () => {
    expect(takeRefusedMessageAction(noPendingMessageActions, "other").refused).toBeNull();
    expect(takeRefusedMessageAction(noPendingMessageActions, undefined).refused).toBeNull();
  });

  it("forgets the actions on a message once the server says how the message is now", () => {
    let pending = trackMessageAction(noPendingMessageActions, "r1", react);
    pending = trackMessageAction(pending, "r2", { kind: "edit", entryId: "e1", entryType: "whatsapp", messageId: "m2" });
    pending = settleMessageActions(pending, "e1", "whatsapp", "m1");
    expect(takeRefusedMessageAction(pending, "r1").refused).toBeNull();
    expect(takeRefusedMessageAction(pending, "r2").refused).not.toBeNull();
  });

  it("keeps the same ledger when nothing settles", () => {
    const pending = trackMessageAction(noPendingMessageActions, "r1", react);
    expect(settleMessageActions(pending, "e1", "whatsapp", "other")).toBe(pending);
  });
});

describe("messageActionErrorKey", () => {
  it("names a reason for every code the server sends", () => {
    expect(messageActionErrorKey("not_allowed", "edit")).toBe("notAllowed");
    expect(messageActionErrorKey("not_found", "delete")).toBe("notFound");
    expect(messageActionErrorKey("invalid", "edit")).toBe("invalid");
    expect(messageActionErrorKey("unsupported", "react")).toBe("unsupported");
    expect(messageActionErrorKey("failed", "react")).toBe("failed");
  });

  it("explains an expired window by what it blocks, because reacting on official WhatsApp needs the 24 hour window", () => {
    expect(messageActionErrorKey("window_expired", "react")).toBe("reactWindowExpired");
    expect(messageActionErrorKey("window_expired", "edit")).toBe("editWindowExpired");
    expect(messageActionErrorKey("window_expired", "delete")).toBe("deleteWindowExpired");
  });

  it("falls back to a generic failure for a code it does not know", () => {
    expect(messageActionErrorKey("something_new", "edit")).toBe("failed");
    expect(messageActionErrorKey(undefined, "edit")).toBe("failed");
  });
});
