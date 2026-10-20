const MODERATION_KEY = "mercadolivre_moderation";
const FROM_AGENT_KEY = "mercadolivre_from_agent";
const MEDIA_UNAVAILABLE_KEY = "mercadolivre_media_unavailable";
const FILE_NAME_KEY = "mercadolivre_file_name";

export const MERCADOLIVRE_MODERATION_REASONS = [
  "OUT_OF_PLACE_LANGUAGE",
  "SOCIAL_NETWORK_LINK",
  "LINK_SHORT_URL",
  "AUTOMATIC_MESSAGE",
  "PERSONAL_DATA",
  "LINK_MERCADOPAGO",
  "ML_LINKS_PAYPAL",
  "EVASION_CLAIM_SELLER",
] as const;

export type MercadoLivreModerationReason = (typeof MERCADOLIVRE_MODERATION_REASONS)[number] | "unknown";

export type MercadoLivreModerationState = "pending_review" | "pending_translation" | "blocked" | "unknown";

export interface MercadoLivreModeration {
  state: MercadoLivreModerationState;
  reason: MercadoLivreModerationReason | null;
}

type Metadata = Record<string, unknown> | null | undefined;

const BLOCKED_STATUSES = new Set(["moderated", "rejected"]);
const KNOWN_STATUSES = new Set(["available", "pending_review", "pending_translation", "moderated", "rejected"]);

function textField(record: Record<string, unknown>, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value.trim() : "";
}

function reasonOf(raw: string): MercadoLivreModerationReason {
  return (MERCADOLIVRE_MODERATION_REASONS as readonly string[]).includes(raw) ? (raw as MercadoLivreModerationReason) : "unknown";
}

export function readModeration(metadata: Metadata): MercadoLivreModeration | null {
  if (!metadata || !Object.hasOwn(metadata, MODERATION_KEY)) return null;
  const value = metadata[MODERATION_KEY];
  if (!value || typeof value !== "object") return { state: "unknown", reason: null };
  const record = value as Record<string, unknown>;
  const status = textField(record, "status");
  const moderation = textField(record, "moderation").toLowerCase();
  if (BLOCKED_STATUSES.has(status) || moderation === "rejected") {
    return { state: "blocked", reason: reasonOf(textField(record, "reason")) };
  }
  if (!KNOWN_STATUSES.has(status)) return { state: "unknown", reason: null };
  if (status === "pending_review" || status === "pending_translation") return { state: status, reason: null };
  return null;
}

export function isFromMercadoLivreAgent(metadata: Metadata): boolean {
  return metadata?.[FROM_AGENT_KEY] === true;
}

export function readMediaUnavailable(metadata: Metadata): { fileName: string | null } | null {
  if (metadata?.[MEDIA_UNAVAILABLE_KEY] !== true) return null;
  const name = metadata[FILE_NAME_KEY];
  return { fileName: typeof name === "string" && name.trim() !== "" ? name : null };
}
