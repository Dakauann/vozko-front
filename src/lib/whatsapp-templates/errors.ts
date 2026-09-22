
const I18N_PREFIX = "whatsappTemplates.errors";

export const TEMPLATE_ERROR_CODES = [
    "template_unknown_error",

    "template_not_found",
    "template_already_exists",
    "template_external_id_required",
    "template_category_unavailable",
    "template_header_media_not_applicable",

    "template_name_required",
    "template_name_invalid_chars",
    "template_name_must_start_letter",
    "template_name_too_long",

    "template_header_text_too_long",
    "template_header_too_many_variables",
    "template_header_format_required",
    "template_header_media_needs_handle",

    "template_body_too_long",
    "template_body_variable_at_start",
    "template_body_variable_at_end",
    "template_body_consecutive_variables",
    "template_body_needs_example",

    "template_footer_too_long",
    "template_footer_has_variables",

    "template_too_many_buttons",
    "template_button_text_too_long",
    "template_button_text_required",
    "template_button_url_required",
    "template_button_phone_required",
    "template_buttons_not_grouped",
    "template_url_button_variable_not_end",
    "template_url_button_too_many_variables",
    "template_copy_code_needs_example",

    "template_call_permission_with_buttons",
    "template_multiple_call_permission",

    "template_otp_type_required",
    "template_invalid_otp_type",
    "template_multiple_otp_buttons",
    "template_otp_type_unsupported",
    "template_otp_button_not_authentication",
    "template_authentication_needs_otp_button",
    "template_code_expiration_out_of_range",
    "template_authentication_no_header",
    "template_authentication_body_not_editable",
    "template_authentication_footer_not_editable",
    "template_authentication_code_too_long",
    "template_authentication_code_required",

    "template_mixed_parameter_styles",

    "template_invalid_component_type",
    "template_invalid_header_format",
    "template_invalid_button_type",
    "template_invalid_category",

    "template_send_workspace_required",
    "template_send_idempotency_required",
    "template_send_in_progress",
    "template_send_phone_mismatch",
    "template_send_pricing_unavailable",
    "template_send_not_sendable",
    "template_send_billing_not_configured",
    "template_send_attempt_conflict",

    "template_provider_rejected",
    "template_provider_unavailable",
] as const;

export type TemplateErrorCode = (typeof TEMPLATE_ERROR_CODES)[number];

const CODE_SET = new Set<string>(TEMPLATE_ERROR_CODES);

export function isTemplateErrorCode(code: string | undefined): code is TemplateErrorCode {
    return !!code && CODE_SET.has(code);
}

const PROVIDER_AUTHORED: ReadonlySet<string> = new Set([
    "template_provider_rejected",
]);

type Translator = (key: string, values?: Record<string, string>) => string;

export function templateErrorMessage(
    t: Translator,
    code: string | undefined,
    serverMessage: string | undefined,
): string {
    const trimmed = serverMessage?.trim();

    if (code && PROVIDER_AUTHORED.has(code) && trimmed) {
        return trimmed;
    }
    if (isTemplateErrorCode(code)) {
        return t(`${I18N_PREFIX}.${code}`);
    }
    if (trimmed) {
        return trimmed;
    }
    return t(`${I18N_PREFIX}.template_unknown_error`);
}
