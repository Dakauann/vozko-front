import type { ConversationMessage, MediaType } from "./types";

export interface MessageCapabilities {
  react: boolean;
  edit: boolean;
  delete: boolean;
  edit_window_seconds: number;
  delete_window_seconds: number;
}

export interface MessageActions {
  react: boolean;
  edit: boolean;
  delete: boolean;
  resend: boolean;
}

export const NO_MESSAGE_CAPABILITIES: MessageCapabilities = {
  react: false,
  edit: false,
  delete: false,
  edit_window_seconds: 0,
  delete_window_seconds: 0,
};

export const NO_MESSAGE_ACTIONS: MessageActions = { react: false, edit: false, delete: false, resend: false };

const RESENDABLE_MEDIA: readonly MediaType[] = ["image", "video", "audio", "document"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readMessageCapabilities(raw: unknown): MessageCapabilities | undefined {
  if (!isRecord(raw)) return undefined;
  const { react, edit, delete: remove, edit_window_seconds, delete_window_seconds } = raw;
  if (typeof react !== "boolean" || typeof edit !== "boolean" || typeof remove !== "boolean") return undefined;
  if (typeof edit_window_seconds !== "number" || typeof delete_window_seconds !== "number") return undefined;
  return { react, edit, delete: remove, edit_window_seconds, delete_window_seconds };
}

function actionable(message: ConversationMessage): boolean {
  return !message.local_send && !message.retracted_at && Boolean(message.provider_message_id?.trim());
}

function sentByOperator(message: ConversationMessage, operatorId: string): boolean {
  const operator = operatorId.trim();
  return operator !== "" && message.sender_user_id === operator;
}

function hasButtons(message: ConversationMessage): boolean {
  const metadata = message.metadata as unknown;
  if (!isRecord(metadata) || !isRecord(metadata.buttons)) return false;
  const { buttons } = metadata.buttons;
  return Array.isArray(buttons) && buttons.length > 0;
}

function isPlainText(message: ConversationMessage): boolean {
  return (
    message.message_type === "operator" &&
    message.text.trim() !== "" &&
    !message.media_id &&
    !message.media_type &&
    !hasButtons(message)
  );
}

function withinWindow(message: ConversationMessage, windowSeconds: number, now: Date): boolean {
  const sentAt = new Date(message.created_at).getTime();
  if (!message.created_at || Number.isNaN(sentAt)) return false;
  return now.getTime() - sentAt <= windowSeconds * 1000;
}

function allowsOwnChange(
  message: ConversationMessage,
  supported: boolean,
  windowSeconds: number,
  operatorId: string,
  now: Date,
  shapeAllows: boolean,
): boolean {
  if (!supported || windowSeconds <= 0) return false;
  if (!actionable(message) || !sentByOperator(message, operatorId) || !shapeAllows) return false;
  return withinWindow(message, windowSeconds, now);
}

function reproducibleByOperatorSend(message: ConversationMessage): boolean {
  if (message.message_type !== "operator" || message.location) return false;
  if (hasButtons(message)) return !message.media_id;
  if (message.media_id) return Boolean(message.media_type && RESENDABLE_MEDIA.includes(message.media_type));
  return !message.media_type && !message.media_url && message.text.trim() !== "";
}

function resendable(message: ConversationMessage, operatorId: string): boolean {
  return (
    operatorId.trim() !== "" &&
    !message.local_send &&
    Boolean(message.sender_user_id) &&
    message.delivery_status === "failed" &&
    !message.retracted_at &&
    !message.resent_as &&
    reproducibleByOperatorSend(message)
  );
}

export function allowedActions(
  message: ConversationMessage,
  capabilities: MessageCapabilities,
  operatorId: string,
  now: Date,
): MessageActions {
  return {
    react: capabilities.react && actionable(message),
    edit: allowsOwnChange(message, capabilities.edit, capabilities.edit_window_seconds, operatorId, now, isPlainText(message)),
    delete: allowsOwnChange(message, capabilities.delete, capabilities.delete_window_seconds, operatorId, now, true),
    resend: resendable(message, operatorId),
  };
}

export function lastEditableMessage(
  messages: readonly ConversationMessage[],
  capabilities: MessageCapabilities,
  operatorId: string,
  now: Date,
): ConversationMessage | null {
  for (let index = messages.length - 1; index >= 0; index--) {
    const message = messages[index];
    if (allowedActions(message, capabilities, operatorId, now).edit) return message;
  }
  return null;
}
