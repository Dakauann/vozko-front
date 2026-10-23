import { apiClient } from "@/lib/api/browser-client";
import type { ConversationMessage } from "@/lib/conversations/types";

export const EMAIL_HTML_ERROR_CODES = [
  "conversation_not_found",
  "email_html_failed",
  "email_html_unavailable",
  "email_message_not_found",
  "unauthorized",
] as const;

export type EmailHTMLErrorCode = (typeof EMAIL_HTML_ERROR_CODES)[number] | "default";

export interface EmailHTMLView {
  html: string;
  text: string;
  has_html: boolean;
  inbound: boolean;
  images_blocked: boolean;
}

export type EmailHTMLResult = { view: EmailHTMLView } | { error: EmailHTMLErrorCode };

function knownCode(code: string | undefined): EmailHTMLErrorCode {
  return EMAIL_HTML_ERROR_CODES.find((known) => known === code) ?? "default";
}

export function emailHasHTML(message: Pick<ConversationMessage, "metadata">): boolean {
  const metadata = message.metadata as Record<string, unknown> | undefined;
  return typeof metadata?.email_html_media_id === "string" || typeof metadata?.email_campaign_merge === "object";
}

export function emailSubject(message: Pick<ConversationMessage, "metadata">): string | null {
  const value = (message.metadata as Record<string, unknown> | undefined)?.email_subject;
  return typeof value === "string" && value.trim() !== "" ? value.trim() : null;
}

export async function fetchEmailHTML(entryId: string, messageId: string, showImages: boolean): Promise<EmailHTMLResult> {
  const query = showImages ? "?images=show" : "";
  const response = await apiClient<EmailHTMLView>(
    `/conversations/email/${encodeURIComponent(entryId)}/messages/${encodeURIComponent(messageId)}/email-html${query}`,
    { method: "GET" },
  );
  if (response.error || !response.data) return { error: knownCode(response.error?.code) };
  return { view: response.data };
}

export function emailFrameDocument(html: string, remoteImages: boolean): string {
  const images = remoteImages ? "https: http: data:" : "data:";
  return [
    "<!doctype html><html><head><meta charset=\"utf-8\">",
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${images}; style-src 'unsafe-inline'">`,
    "<base target=\"_blank\">",
    "<style>body{margin:0;padding:16px;font-family:system-ui,sans-serif;color:#1f2328;background:#ffffff;word-break:break-word}img{max-width:100%;height:auto}</style>",
    "</head><body>",
    html,
    "</body></html>",
  ].join("");
}
