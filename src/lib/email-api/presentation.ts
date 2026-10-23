import type { StatusChipTone } from "@/components/elevated-design/status-chip";
import type { EmailLogStatus, EmailWebhookDeliveryStatus, EmailWebhookEndpoint } from "@/lib/email-api/types";

export const EMAIL_API_PATH = "/dashboard/email/api";
export const EMAIL_WEBHOOKS_PATH = "/dashboard/email/api/webhooks";
export const SEND_ENDPOINT = "/email/transactional/messages";

export function emailLogEntryPath(messageId: string): string {
  return `${EMAIL_API_PATH}/${encodeURIComponent(messageId)}`;
}

const LOG_TONE: Record<EmailLogStatus, StatusChipTone> = {
  pending: "muted",
  queued: "muted",
  refused: "warning",
  sent: "neutral",
  delivered: "healthy",
  bounced: "fault",
  suppressed: "warning",
  failed: "fault",
};

export function logStatusTone(status: EmailLogStatus): StatusChipTone {
  return LOG_TONE[status] ?? "muted";
}

const DELIVERY_TONE: Record<EmailWebhookDeliveryStatus, StatusChipTone> = {
  queued: "muted",
  sending: "neutral",
  retrying: "warning",
  delivered: "healthy",
  failed: "fault",
  skipped: "muted",
};

export function deliveryStatusTone(status: EmailWebhookDeliveryStatus): StatusChipTone {
  return DELIVERY_TONE[status] ?? "muted";
}

export type EndpointHealth = "paused" | "failing" | "healthy";

export function endpointHealth(endpoint: EmailWebhookEndpoint): EndpointHealth {
  if (!endpoint.enabled) return "paused";
  if (endpoint.failing_since) return "failing";
  return "healthy";
}

const HEALTH_TONE: Record<EndpointHealth, StatusChipTone> = { paused: "muted", failing: "fault", healthy: "healthy" };

export function endpointHealthTone(health: EndpointHealth): StatusChipTone {
  return HEALTH_TONE[health];
}

export interface CurlSample {
  baseUrl: string;
  from: string;
  to: string;
  subject: string;
  html: string;
  idempotencyKey: string;
}

export function sendCurl(sample: CurlSample): string {
  const body = {
    from: sample.from,
    to: [sample.to],
    subject: sample.subject,
    html: sample.html,
    tags: [{ name: "kind", value: "password_reset" }],
    idempotency_key: sample.idempotencyKey,
  };
  const json = JSON.stringify(body, null, 2).replace(/'/g, "'\\''");
  return [
    `curl -X POST ${sample.baseUrl.replace(/\/+$/, "")}${SEND_ENDPOINT} \\`,
    `  -H "Authorization: Bearer $API_KEY" \\`,
    `  -H "Content-Type: application/json" \\`,
    `  -d '${json}'`,
  ].join("\n");
}
