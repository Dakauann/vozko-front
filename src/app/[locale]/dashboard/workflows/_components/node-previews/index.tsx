"use client";

import type { ReactNode } from "react";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { SendTextPreview } from "./send-text-preview";
import { SendEmailPreview } from "./send-email-preview";
import { SendTemplatePreview } from "./send-template-preview";
import { SendMediaPreview } from "./send-media-preview";

export { MediaNodePreview } from "./media-node-preview";
export { renderConditionContentPreview } from "./conditions";

// renderMessageContentPreview is the registry that maps a message-sending node to
// its own "renders like the real thing" preview. Each renderer lives in its own
// file (send-*-preview.tsx); everything else falls through (undefined) to the
// legacy NodeContentPreview switch. A message node with nothing configured still
// returns an element (an EmptyPreview), never undefined.
export function renderMessageContentPreview(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode | undefined {
  switch (nodeType) {
    case "action_send_text":
      return <SendTextPreview config={config} />;
    case "action_send_email":
      return <SendEmailPreview config={config} />;
    case "action_send_template":
      return <SendTemplatePreview config={config} />;
    case "action_send_media":
      return <SendMediaPreview config={config} />;
    default:
      return undefined;
  }
}
