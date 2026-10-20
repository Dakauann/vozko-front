import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import {
  NO_MESSAGE_ACTIONS,
  NO_MESSAGE_CAPABILITIES,
  allowedActions,
  lastEditableMessage,
  readMessageCapabilities,
  type MessageActions,
  type MessageCapabilities,
} from "./message-actions";
import { normalizeWireMessage } from "./message-wire";
import type { ConversationMessage } from "./types";

const FIXTURE = resolve(__dirname, "../../../../vozko-back/domain/conversation/testdata/message_actions.json");

interface FixtureCase {
  name: string;
  capabilities: string;
  operator_id?: string;
  message: Record<string, unknown>;
  expected: MessageActions;
}

interface Fixture {
  now: string;
  operator_id: string;
  capabilities: Record<string, MessageCapabilities>;
  cases: FixtureCase[];
}

const fixture = JSON.parse(readFileSync(FIXTURE, "utf8")) as Fixture;
const NOW = new Date(fixture.now);
const FULL = fixture.capabilities.full;

function operatorOf(testCase: FixtureCase): string {
  return testCase.operator_id ?? fixture.operator_id;
}

function ownText(id: string, createdAt: string, overrides: Record<string, unknown> = {}): ConversationMessage {
  return normalizeWireMessage({
    id,
    messageType: "operator",
    text: `texto ${id}`,
    externalMessageId: `pm-${id}`,
    sentBy: { kind: "human", id: "user-ana" },
    sender_user_id: "user-ana",
    createdAt,
    ...overrides,
  });
}

describe("allowedActions mirrors the server rule", () => {
  it("reads a fixture with cases", () => {
    expect(fixture.cases.length).toBeGreaterThan(0);
  });

  it.each(fixture.cases.map((testCase) => [testCase.name, testCase] as const))("%s", (_name, testCase) => {
    const capabilities = fixture.capabilities[testCase.capabilities];
    expect(capabilities).toBeDefined();
    const message = normalizeWireMessage(testCase.message);
    expect(allowedActions(message, capabilities, operatorOf(testCase), NOW)).toEqual(testCase.expected);
  });
});

describe("allowedActions on what only the client holds", () => {
  it("allows nothing on a bubble that is still being sent", () => {
    const pending: ConversationMessage = {
      ...ownText("p1", fixture.now),
      local_send: { requestId: "r1", state: "failed" },
      delivery_status: "failed",
    };
    expect(allowedActions(pending, FULL, "user-ana", NOW)).toEqual(NO_MESSAGE_ACTIONS);
  });

  it("allows only what a conversation without known capabilities can do, which is resending a failed text", () => {
    const failed = ownText("f1", fixture.now, { deliveryStatus: "failed" });
    expect(allowedActions(failed, NO_MESSAGE_CAPABILITIES, "user-ana", NOW)).toEqual({ ...NO_MESSAGE_ACTIONS, resend: true });
  });

  it("never resends a location, because the operator send cannot rebuild it", () => {
    const location = ownText("l1", fixture.now, { deliveryStatus: "failed", location: { latitude: -23.5, longitude: -46.6 } });
    expect(allowedActions(location, NO_MESSAGE_CAPABILITIES, "user-ana", NOW).resend).toBe(false);
  });
});

describe("readMessageCapabilities", () => {
  it("keeps the capabilities the server announced", () => {
    expect(readMessageCapabilities(FULL)).toEqual(FULL);
  });

  it("refuses anything that is not a capability set, so unknown means nothing is offered", () => {
    expect(readMessageCapabilities(undefined)).toBeUndefined();
    expect(readMessageCapabilities({ react: "yes" })).toBeUndefined();
    expect(readMessageCapabilities({ react: true, edit: true, delete: false, edit_window_seconds: "900", delete_window_seconds: 0 })).toBeUndefined();
  });
});

describe("lastEditableMessage", () => {
  it("picks the newest message of the operator that the channel still lets them edit", () => {
    const messages = [
      ownText("old", "2026-10-18T11:50:00Z"),
      ownText("newest", "2026-10-18T11:58:00Z"),
      normalizeWireMessage({ id: "customer", messageType: "user_message", text: "oi", externalMessageId: "pm-c", createdAt: "2026-10-18T11:59:00Z" }),
    ];
    expect(lastEditableMessage(messages, FULL, "user-ana", NOW)?.id).toBe("newest");
  });

  it("skips a teammate's message and a media message", () => {
    const messages = [
      ownText("mine", "2026-10-18T11:50:00Z"),
      ownText("media", "2026-10-18T11:55:00Z", { mediaId: "media-1", mediaType: "image" }),
      ownText("teammate", "2026-10-18T11:58:00Z", { sentBy: { kind: "human", id: "user-bruno" }, sender_user_id: "user-bruno" }),
    ];
    expect(lastEditableMessage(messages, FULL, "user-ana", NOW)?.id).toBe("mine");
  });

  it("finds nothing when the channel does not edit", () => {
    expect(lastEditableMessage([ownText("mine", "2026-10-18T11:58:00Z")], fixture.capabilities.react_only, "user-ana", NOW)).toBeNull();
  });
});
