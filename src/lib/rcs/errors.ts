import type { CodedRefusal } from "@/lib/api/coded-error";
import type { RcsSenderInput } from "@/lib/rcs/types";

export const RCS_ERROR_CODES = [
  "rcs_billing_category_fixed",
  "rcs_button_invalid",
  "rcs_card_empty",
  "rcs_card_text_too_long",
  "rcs_card_title_too_long",
  "rcs_cnpj_invalid",
  "rcs_contact_email_domain",
  "rcs_content_empty",
  "rcs_content_mixed",
  "rcs_description_not_isv",
  "rcs_gambling_authorization",
  "rcs_media_invalid",
  "rcs_media_not_found",
  "rcs_media_unreachable",
  "rcs_pause_not_yours",
  "rcs_pause_reason_invalid",
  "rcs_sector_refused",
  "rcs_sender_incomplete",
  "rcs_sender_not_found",
  "rcs_sender_not_launched",
  "rcs_sender_transition",
  "rcs_text_too_long",
  "rcs_too_many_buttons",
  "rcs_too_many_cards",
] as const;

export type RcsErrorCode = (typeof RCS_ERROR_CODES)[number];

export type RcsSenderField = keyof RcsSenderInput;

export const RCS_SENDER_FIELDS: readonly RcsSenderField[] = [
  "brand_name",
  "description",
  "logo_url",
  "banner_url",
  "color",
  "use_case",
  "sector",
  "gambling_authorization_url",
  "contact_name",
  "contact_email",
  "contact_phone",
  "website_url",
  "privacy_url",
  "terms_url",
  "cnpj",
  "billing_category",
];

const FIELD_OF_CODE: Partial<Record<RcsErrorCode, RcsSenderField>> = {
  rcs_description_not_isv: "description",
  rcs_contact_email_domain: "contact_email",
  rcs_sector_refused: "sector",
  rcs_gambling_authorization: "gambling_authorization_url",
  rcs_billing_category_fixed: "billing_category",
  rcs_cnpj_invalid: "cnpj",
};

export function rcsErrorField(error: Pick<CodedRefusal, "code" | "details">): RcsSenderField | null {
  const field = error.details?.field;
  if (typeof field === "string" && (RCS_SENDER_FIELDS as readonly string[]).includes(field)) return field as RcsSenderField;
  const code = error.code as RcsErrorCode | undefined;
  return (code && FIELD_OF_CODE[code]) || null;
}
