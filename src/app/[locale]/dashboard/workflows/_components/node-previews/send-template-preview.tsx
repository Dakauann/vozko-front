"use client";

import { ChatSurface, MessageBubble } from "../message-node-primitives";
import { templateDisplayName, templateParamLines } from "./node-summary";

export function SendTemplatePreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const displayName = templateDisplayName(config);
  const paramLines = templateParamLines(config);

  return (
    <ChatSurface>
      <MessageBubble
        headerText={displayName.trim() || undefined}
        body={paramLines.join("\n") || undefined}
        emptyBodyLabel={
          displayName.trim() ? "Modelo aprovado do WhatsApp" : "Nenhum template"
        }
        footer="Template"
      />
    </ChatSurface>
  );
}
