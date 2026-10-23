export interface StartEmailConversationPayload {
  lead_id?: string;
  address?: string;
  sender_id?: string;
  subject: string;
  text?: string;
  design_id?: string;
  idempotency_key: string;
}

export interface StartedEmailConversation {
  conversation_id: string;
  entry_type: "email";
  message_id: string;
  lead_id?: string;
  repeated: boolean;
  recorded: boolean;
}

export interface EmailOutreachQuote {
  unit_micros: number;
  unit_brl: number;
  exchange_rate: number;
  exchange_rate_updated_at: string;
}

export interface EmailOutreachError {
  code: string;
  message: string;
  status?: number;
  details?: Record<string, unknown>;
}

export type EmailBodyMode = "text" | "design";

export interface EmailComposition {
  senderId: string;
  subject: string;
  mode: EmailBodyMode;
  text: string;
  designId: string;
}

export type EmailRecipient = { kind: "lead"; leadId: string } | { kind: "address"; address: string };

export function emailConversationPayload(recipient: EmailRecipient, composition: EmailComposition, idempotencyKey: string): StartEmailConversationPayload {
  return {
    ...(recipient.kind === "lead" ? { lead_id: recipient.leadId } : { address: recipient.address.trim() }),
    ...(composition.senderId ? { sender_id: composition.senderId } : {}),
    subject: composition.subject,
    ...(composition.mode === "text" ? { text: composition.text } : { design_id: composition.designId }),
    idempotency_key: idempotencyKey,
  };
}

export function isComposable(recipient: EmailRecipient, composition: EmailComposition): boolean {
  const hasRecipient = recipient.kind === "lead" ? recipient.leadId !== "" : recipient.address.trim() !== "";
  const hasBody = composition.mode === "text" ? composition.text.trim() !== "" : composition.designId !== "";
  return hasRecipient && composition.subject.trim() !== "" && hasBody;
}

export function missingBalanceMicros(error: EmailOutreachError | null): number | null {
  if (error?.code !== "email_balance_insufficient") return null;
  const missing = error.details?.missing_micros;
  return typeof missing === "number" && missing > 0 ? missing : null;
}
