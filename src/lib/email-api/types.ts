export const EMAIL_LOG_STATUSES = ["pending", "refused", "queued", "sent", "delivered", "bounced", "suppressed", "failed"] as const;

export type EmailLogStatus = (typeof EMAIL_LOG_STATUSES)[number];

export type EmailLogRole = "to" | "cc" | "bcc";

export interface EmailLogEntry {
  id: string;
  send_id: string;
  idempotency_key: string;
  origin: "api" | "system";
  from: string;
  to: string;
  role: EmailLogRole;
  subject: string;
  tags: Record<string, string>;
  status: EmailLogStatus;
  error_code?: string;
  last_event?: string;
  last_event_at: string | null;
  created_at: string;
}

export interface EmailLogPage {
  data: EmailLogEntry[];
  next_cursor?: string;
}

export interface EmailLogEvent {
  kind: string;
  occurred_at: string;
  link?: string;
  is_bot: boolean;
}

export interface EmailLogDetail extends EmailLogEntry {
  events: EmailLogEvent[];
}

export interface EmailLogFilters {
  status: EmailLogStatus | "";
  recipient: string;
  tagName: string;
  tagValue: string;
}

export interface EmailWebhookEndpoint {
  id: string;
  url: string;
  events: string[];
  enabled: boolean;
  secret_hint: string;
  failing_since: string | null;
  last_success_at: string | null;
  last_failure_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EmailWebhookEndpointWithSecret extends EmailWebhookEndpoint {
  secret: string;
}

export interface EmailWebhookList {
  endpoints: EmailWebhookEndpoint[];
  events: string[];
  limit: number;
}

export interface EmailWebhookInput {
  url: string;
  events: string[];
  enabled: boolean;
}

export type EmailWebhookDeliveryStatus = "queued" | "sending" | "retrying" | "delivered" | "failed" | "skipped";

export interface EmailWebhookAttempt {
  attempt: number;
  status_code: number;
  duration_ms: number;
  error?: string;
  next_attempt_at: string | null;
  attempted_at: string;
}

export interface EmailWebhookDelivery {
  id: string;
  event_id: string;
  event_type: string;
  message_id: string;
  status: EmailWebhookDeliveryStatus;
  attempts: number;
  next_attempt_at: string | null;
  last_status_code: number;
  last_error?: string;
  retryable: boolean;
  created_at: string;
  delivered_at: string | null;
  attempt_log: EmailWebhookAttempt[];
}

export interface EmailWebhookDeliveryPage {
  data: EmailWebhookDelivery[];
  next_cursor?: string;
}
