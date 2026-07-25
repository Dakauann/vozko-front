"use client";

import { ChatSurface, MessageBubble } from "../message-node-primitives";

// action_send_text: how the plain WhatsApp text lands, as a chat bubble on the
// WhatsApp chat backdrop (same language as the send-button node).
export function SendTextPreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const text = (config.text as string) || "";
  return (
    <ChatSurface>
      <MessageBubble body={text} emptyBodyLabel="Nenhuma mensagem" />
    </ChatSurface>
  );
}
