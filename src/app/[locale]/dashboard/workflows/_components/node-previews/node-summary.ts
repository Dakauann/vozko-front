import { REPLY_TO_AGENT_FIELDS_KEY, REPLY_TO_AGENT_NODE, readReplyFields } from "@/lib/workflows/agent-call";
import { configText } from "@/lib/workflows/config-text";
import { carrierNodeSummary } from "@/lib/workflows/carrier-node";
import { platformEmailSummary } from "@/lib/workflows/platform-email-node";
import { readSendFormConfig } from "@/lib/workflows/form-node";
import { isInteractivePromptType, type WorkflowNodeType } from "@/lib/workflows/types";

import { parseInteractiveConfig } from "../whatsapp-message-preview";

export interface NodeSummary {
  heading?: string;
  text?: string;
}

export function stripHtml(s: string): string {
  return s
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function templateDisplayName(config: Record<string, unknown>): string {
  return configText(config._display_template_id) || configText(config.template_name) || configText(config.template_id);
}

export function templateParamLines(config: Record<string, unknown>): string[] {
  const raw = config.params;
  const params = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return Object.entries(params)
    .map(([key, value]) => [key, String(value ?? "").trim()] as const)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}: ${value}`);
}

export function agentNameOf(config: Record<string, unknown>): string {
  return configText(config._display_agent_id) || configText(config.agent_name) || configText(config.agent_id);
}

function summary(heading: string, text: string): NodeSummary | null {
  const out: NodeSummary = {};
  if (heading) out.heading = heading;
  if (text) out.text = text;
  return heading || text ? out : null;
}

export function nodeSummary(nodeType: WorkflowNodeType, config: Record<string, unknown>): NodeSummary | null {
  if (isInteractivePromptType(nodeType)) {
    const parsed = parseInteractiveConfig(config);
    return summary(parsed.headerType === "text" ? parsed.headerText.trim() : "", parsed.body.trim());
  }
  switch (nodeType) {
    case "action_send_text":
      return summary("", configText(config.text));
    case "action_send_template":
      return summary(templateDisplayName(config), templateParamLines(config)[0] ?? "");
    case "action_send_email":
      return summary(configText(config.subject), stripHtml(configText(config.body)));
    case "action_send_form": {
      const form = readSendFormConfig(config);
      return summary(form.header || configText(config._display_form_id) || form.form_id, form.body);
    }
    case "action_ai_agent":
      return configText(config.source) === "prompt" ? summary(configText(config.model), configText(config.instructions)) : summary(agentNameOf(config), "");
    case REPLY_TO_AGENT_NODE:
      return summary(
        "",
        readReplyFields(config[REPLY_TO_AGENT_FIELDS_KEY])
          .filter((field) => field.key.trim() !== "")
          .map((field) => `${field.key}: ${field.value}`)
          .join("\n"),
      );
    case "action_send_media":
      return summary("", configText(config.caption));
    case "action_send_platform_email": {
      const email = platformEmailSummary(config);
      return summary(email.subject, email.mode === "design" ? email.designName : email.body);
    }
    case "action_send_carrier":
      return summary("", carrierNodeSummary(config)?.text ?? "");
    case "action_set_variable": {
      const variable = configText(config.variable);
      return variable ? summary("", `${variable} = ${configText(config.value)}`) : null;
    }
    case "action_http_request": {
      const url = configText(config.url);
      return url ? summary("", `${(configText(config.method) || "GET").toUpperCase()} ${url}`) : null;
    }
    default:
      return null;
  }
}
