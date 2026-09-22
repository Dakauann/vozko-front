"use client";

import { ChatSurface, MessageBubble } from "../message-node-primitives";

export function SendTemplatePreview({
  config,
}: {
  config: Record<string, unknown>;
}) {
  const displayName =
    (config._display_template_id as string) ||
    (config.template_name as string) ||
    (config.template_id as string) ||
    "";

  const rawParams = config.params;
  const params =
    rawParams && typeof rawParams === "object"
      ? (rawParams as Record<string, unknown>)
      : {};
  const paramLines = Object.entries(params)
    .map(([k, v]) => [k, String(v ?? "").trim()] as const)
    .filter(([, v]) => v)
    .map(([k, v]) => `${k}: ${v}`);

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
