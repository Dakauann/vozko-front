import type { EntryType } from "./types";

export type MessageActionKind = "react" | "edit" | "delete";

interface MessageTarget {
  entryId: string;
  entryType: EntryType;
  messageId: string;
}

export type MessageActionRequest =
  | (MessageTarget & { kind: "react"; emoji: string })
  | (MessageTarget & { kind: "edit"; text: string })
  | (MessageTarget & { kind: "delete" });

export type PendingMessageAction = MessageTarget & { kind: MessageActionKind };

export type PendingMessageActions = ReadonlyMap<string, PendingMessageAction>;

export interface MessageCommand {
  type: "react_message" | "edit_message" | "delete_message";
  payload: Record<string, string>;
}

export type MessageActionErrorKey =
  | "notAllowed"
  | "notFound"
  | "invalid"
  | "unsupported"
  | "failed"
  | "reactWindowExpired"
  | "editWindowExpired"
  | "deleteWindowExpired";

export const noPendingMessageActions: PendingMessageActions = new Map();

const COMMAND_TYPE: Record<MessageActionKind, MessageCommand["type"]> = {
  react: "react_message",
  edit: "edit_message",
  delete: "delete_message",
};

const CODE_KEYS: Record<string, MessageActionErrorKey> = {
  not_allowed: "notAllowed",
  not_found: "notFound",
  invalid: "invalid",
  unsupported: "unsupported",
  failed: "failed",
};

const WINDOW_EXPIRED_KEYS: Record<MessageActionKind, MessageActionErrorKey> = {
  react: "reactWindowExpired",
  edit: "editWindowExpired",
  delete: "deleteWindowExpired",
};

function requestBody(request: MessageActionRequest): Record<string, string> {
  if (request.kind === "react") return { emoji: request.emoji };
  if (request.kind === "edit") return { text: request.text };
  return {};
}

export function messageCommand(request: MessageActionRequest, requestId: string): MessageCommand {
  return {
    type: COMMAND_TYPE[request.kind],
    payload: {
      entry_id: request.entryId,
      entry_type: request.entryType,
      message_id: request.messageId,
      ...requestBody(request),
      request_id: requestId,
    },
  };
}

export function pendingOf(request: MessageActionRequest): PendingMessageAction {
  return { kind: request.kind, entryId: request.entryId, entryType: request.entryType, messageId: request.messageId };
}

export function trackMessageAction(
  pending: PendingMessageActions,
  requestId: string,
  action: PendingMessageAction,
): PendingMessageActions {
  const next = new Map(pending);
  next.set(requestId, action);
  return next;
}

export function takeRefusedMessageAction(
  pending: PendingMessageActions,
  requestId: string | undefined,
): { pending: PendingMessageActions; refused: PendingMessageAction | null } {
  const refused = requestId ? (pending.get(requestId) ?? null) : null;
  if (!refused || !requestId) return { pending, refused: null };
  const next = new Map(pending);
  next.delete(requestId);
  return { pending: next, refused };
}

export function settleMessageActions(
  pending: PendingMessageActions,
  entryId: string,
  entryType: string,
  messageId: string,
): PendingMessageActions {
  const settled = [...pending].filter(
    ([, action]) => action.entryId === entryId && action.entryType === entryType && action.messageId === messageId,
  );
  if (settled.length === 0) return pending;
  const next = new Map(pending);
  for (const [requestId] of settled) next.delete(requestId);
  return next;
}

export function messageActionErrorKey(code: string | undefined, kind: MessageActionKind): MessageActionErrorKey {
  if (code === "window_expired") return WINDOW_EXPIRED_KEYS[kind];
  return (code && CODE_KEYS[code]) || "failed";
}
