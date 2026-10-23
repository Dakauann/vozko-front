export type WebhookStartOn = "conversation" | "lead";

export type WebhookExampleKey = "entry" | "phone" | "leadPhone" | "leadEmail";

export interface WebhookExample {
  key: WebhookExampleKey;
  label: string;
  compact: string;
  pretty: string;
}

const SAMPLE_EVENT = "pedido_pago";

export function webhookStartOn(value: unknown): WebhookStartOn {
  return value === "lead" ? "lead" : "conversation";
}

export function acceptedWebhookEvents(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "").map((item) => item.trim());
}

function example(key: WebhookExampleKey, label: string, body: Record<string, string>): WebhookExample {
  return { key, label, compact: JSON.stringify(body), pretty: JSON.stringify(body, null, 2) };
}

export function webhookExamples(startOn: WebhookStartOn, events: readonly string[]): WebhookExample[] {
  if (startOn === "conversation") {
    return [
      example("entry", "entry_id", { entry_id: "c7f1e2a0-9b3d-4a1e-8f2c-1d2e3f4a5b6c", entry_type: "whatsapp" }),
      example("phone", "phone", { phone: "+5511998887777" }),
    ];
  }
  const event = { event: events[0] ?? SAMPLE_EVENT, external_id: "pedido-123" };
  return [
    example("leadPhone", "phone", { phone: "+5511998887777", name: "Ana Souza", ...event }),
    example("leadEmail", "email", { email: "ana@exemplo.com", ...event }),
  ];
}

export function addListValue(list: readonly string[], raw: string): string[] {
  const value = raw.trim();
  if (!value || list.includes(value)) return [...list];
  return [...list, value];
}
