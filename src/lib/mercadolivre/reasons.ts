import type { TextLimit } from "@/lib/conversations/types";
import { MERCADOLIVRE_MAX_MESSAGE_CHARACTERS, validateMessageText, type MessageTextError } from "@/lib/mercadolivre/message-text";
import type { MercadoLivreReasonOption, MercadoLivreReasonSendBody } from "@/lib/mercadolivre/types";

export type ReasonAvailability = "available" | "cap_reached" | "unavailable";

export type ReasonChoice =
  | { kind: "template"; templateId: string; values: Record<string, string> }
  | { kind: "text"; text: string };

export type ReasonSendError =
  | MessageTextError
  | "cap_reached"
  | "unavailable"
  | "text_not_accepted"
  | "template_unknown"
  | "missing_value"
  | "invalid_value";

export const REASON_ERROR_CODES = [
  "forbidden",
  "reason_unknown",
  "reason_unavailable",
  "reason_cap_reached",
  "reason_content",
  "text_charset",
  "text_too_long",
  "reconnect_required",
  "account_unavailable",
  "mercadolivre_unreachable",
] as const;

export type ReasonErrorCode = (typeof REASON_ERROR_CODES)[number];

export const DOCUMENTED_REASONS = ["OTHER", "REQUEST_VARIANTS", "DELIVERY_PROMISE"] as const;

export type DocumentedReason = (typeof DOCUMENTED_REASONS)[number];

export function reasonAvailability(option: MercadoLivreReasonOption): ReasonAvailability {
  if (!option.enabled || !option.actionable) return "unavailable";
  if (option.capAvailable <= 0) return "cap_reached";
  return "available";
}

export function reasonAcceptsText(option: MercadoLivreReasonOption): boolean {
  return (option.charLimit ?? 0) > 0 || option.templates.length === 0;
}

export function reasonTextLimit(option: MercadoLivreReasonOption): TextLimit {
  const own = option.charLimit ?? 0;
  const max = own > 0 ? Math.min(own, MERCADOLIVRE_MAX_MESSAGE_CHARACTERS) : MERCADOLIVRE_MAX_MESSAGE_CHARACTERS;
  return { max, unit: "characters", charset: "mercadolivre" };
}

export function reasonTextError(option: MercadoLivreReasonOption, text: string): MessageTextError | null {
  const result = validateMessageText(text);
  if (result.error) return result.error;
  return result.length > reasonTextLimit(option).max ? "too_long" : null;
}

const WHOLE_NUMBER = /^\d+$/;

function templateVars(
  option: MercadoLivreReasonOption,
  templateId: string,
  values: Record<string, string>,
): { vars: MercadoLivreReasonSendBody["vars"] } | { error: ReasonSendError } {
  const template = option.templates.find((candidate) => candidate.id === templateId);
  if (!template) return { error: "template_unknown" };
  const vars: MercadoLivreReasonSendBody["vars"] = [];
  for (const variable of template.vars) {
    const raw = (values[variable.id] ?? "").trim();
    if (raw === "") return { error: "missing_value" };
    if (!WHOLE_NUMBER.test(raw)) return { error: "invalid_value" };
    vars.push({ id: variable.id, value: Number(raw) });
  }
  return { vars };
}

export function reasonSendBody(
  option: MercadoLivreReasonOption,
  choice: ReasonChoice,
): { body: MercadoLivreReasonSendBody } | { error: ReasonSendError } {
  const availability = reasonAvailability(option);
  if (availability !== "available") return { error: availability };
  if (choice.kind === "text") {
    if (!reasonAcceptsText(option)) return { error: "text_not_accepted" };
    const text = choice.text.trim();
    const error = reasonTextError(option, text);
    if (error) return { error };
    return { body: { optionId: option.id, templateId: "", text, vars: [] } };
  }
  const result = templateVars(option, choice.templateId, choice.values);
  if ("error" in result) return result;
  return { body: { optionId: option.id, templateId: choice.templateId, text: "", vars: result.vars } };
}

export function reasonErrorKey(code: string | undefined): `errors.${ReasonErrorCode}` | "errors.generic" {
  if (code && (REASON_ERROR_CODES as readonly string[]).includes(code)) return `errors.${code as ReasonErrorCode}`;
  return "errors.generic";
}

export function reasonLabelKey(optionId: string): `option.${DocumentedReason}` | null {
  return (DOCUMENTED_REASONS as readonly string[]).includes(optionId) ? `option.${optionId as DocumentedReason}` : null;
}
