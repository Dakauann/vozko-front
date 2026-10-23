import { configText } from "./config-text";

export const PLATFORM_EMAIL_NODE = "action_send_platform_email";

export type PlatformEmailMode = "text" | "design";

export interface PlatformEmailSummary {
  mode: PlatformEmailMode;
  subject: string;
  body: string;
  designName: string;
  to: string;
  senderName: string;
}

export function platformEmailSummary(config: Record<string, unknown>): PlatformEmailSummary {
  const mode: PlatformEmailMode = config.body_mode === "design" ? "design" : "text";
  return {
    mode,
    subject: configText(config.subject),
    body: mode === "text" ? configText(config.text) : "",
    designName: mode === "design" ? configText(config._display_design_id) : "",
    to: configText(config.to),
    senderName: configText(config._display_sender_id),
  };
}
