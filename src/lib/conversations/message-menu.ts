import type { MessageActions } from "./message-actions";
import type { ConversationMessage } from "./types";

export type MessageMenuItem = "reply" | "react" | "copy" | "edit" | "resend" | "delete";

export interface MessageMenuHandlers {
  canReply: boolean;
  canResend: boolean;
}

export function messageMenuItems(
  message: ConversationMessage,
  actions: MessageActions,
  handlers: MessageMenuHandlers,
): MessageMenuItem[] {
  if (message.retracted_at) return [];
  const offered: Record<MessageMenuItem, boolean> = {
    reply: handlers.canReply && !message.local_send,
    react: actions.react,
    copy: message.text.trim() !== "",
    edit: actions.edit,
    resend: handlers.canResend && actions.resend,
    delete: actions.delete,
  };
  return (Object.keys(offered) as MessageMenuItem[]).filter((item) => offered[item]);
}
