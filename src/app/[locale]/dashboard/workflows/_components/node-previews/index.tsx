"use client";

import type { ReactNode } from "react";
import type { WorkflowNodeType } from "@/lib/workflows/types";

import { SendTextPreview } from "./send-text-preview";
import { SendEmailPreview } from "./send-email-preview";
import { SendTemplatePreview } from "./send-template-preview";
import { SendMediaPreview } from "./send-media-preview";

export { renderConditionContentPreview } from "./conditions";
export { renderActionContentPreview } from "./actions";

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

export function renderMessageGlance(
  nodeType: WorkflowNodeType,
  config: Record<string, unknown>,
): ReactNode | undefined {
  if (nodeType !== "action_send_media") return undefined;
  return <SendMediaPreview config={config} detail="glance" />;
}
