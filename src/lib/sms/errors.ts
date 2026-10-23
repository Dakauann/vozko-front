export const SMS_ERROR_CODES = [
  "sms_no_shared_number",
  "sms_number_taken",
  "sms_route_invalid",
  "sms_route_not_found",
  "sms_route_paused",
  "sms_text_empty",
  "sms_text_too_long",
] as const;

export type SmsErrorCode = (typeof SMS_ERROR_CODES)[number];

export type SmsField = "text" | "route";

export const SMS_FIELD_OF_CODE: Record<SmsErrorCode, SmsField> = {
  sms_no_shared_number: "route",
  sms_number_taken: "route",
  sms_route_invalid: "route",
  sms_route_not_found: "route",
  sms_route_paused: "route",
  sms_text_empty: "text",
  sms_text_too_long: "text",
};

export function smsFieldOf(code: string): SmsField | null {
  return Object.hasOwn(SMS_FIELD_OF_CODE, code) ? SMS_FIELD_OF_CODE[code as SmsErrorCode] : null;
}
