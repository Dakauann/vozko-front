"use client";

import { ChatSurface, MessageBubble } from "../message-node-primitives";

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
