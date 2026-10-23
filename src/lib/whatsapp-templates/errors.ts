
const I18N_PREFIX = "whatsappTemplates.errors";
const EXIT_I18N_PREFIX = "templateExit.errors";

export const TEMPLATE_ERROR_CODES = [
    "template_unknown_error",

    "template_not_found",
    "template_access_denied",
    "template_header_media_outside_storage",
    "template_phone_outside_workspace",
    "template_already_exists",
    "template_external_id_required",
    "template_category_unavailable",
    "template_header_media_not_applicable",
    "template_lookup_unavailable",

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
    "template_flow_button_needs_flow",
    "template_flow_button_needs_screen",
    "template_invalid_flow_action",
    "template_multiple_flow_buttons",
    "template_flow_token_required",
    "template_flow_not_published",
    "template_form_not_sendable",

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
    "template_variable_name_invalid",

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
    "template_send_params_mismatch",
    "template_quote_out_of_range",

    "template_not_editable",
    "template_edit_category_locked",
    "template_edit_unsupported",
    "template_edit_window",
    "template_in_use",
    "template_edit_not_owner",

    "template_tracked_button_not_url",
    "template_tracked_button_dynamic",
    "template_tracked_button_destination",
    "template_tracked_link_unreadable",
    "template_tracking_unavailable",

    "template_provider_rejected",
    "template_provider_unavailable",
] as const;

type TemplateErrorCode = (typeof TEMPLATE_ERROR_CODES)[number];

const CODE_SET = new Set<string>(TEMPLATE_ERROR_CODES);

function isTemplateErrorCode(code: string | undefined): code is TemplateErrorCode {
    return !!code && CODE_SET.has(code);
}

const PROVIDER_AUTHORED: ReadonlySet<string> = new Set([
    "template_provider_rejected",
]);

interface Translator {
    (key: string, values?: Record<string, string>): string;
    has: (key: string) => boolean;
}

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
    if (code && t.has(`${EXIT_I18N_PREFIX}.${code}`)) {
        return t(`${EXIT_I18N_PREFIX}.${code}`);
    }
    if (trimmed) {
        return trimmed;
    }
    return t(`${I18N_PREFIX}.template_unknown_error`);
}

const TRACKED_BUTTON_REFUSALS: ReadonlySet<string> = new Set([
    "template_tracked_button_not_url",
    "template_tracked_button_dynamic",
    "template_tracked_button_destination",
    "template_tracked_link_unreadable",
]);

const BUTTON_INDEX = /^(0|[1-9][0-9]*)$/;

export function trackedButtonRefusal(code: string | undefined, expected: Record<string, string> | undefined): number | null {
    if (!code || !TRACKED_BUTTON_REFUSALS.has(code)) return null;
    const index = expected?.buttonIndex;
    if (typeof index !== "string" || !BUTTON_INDEX.test(index)) return null;
    return Number(index);
}

const TEMPLATE_EDIT_WINDOW = "template_edit_window";

interface TemplateEditRefusal {
    code?: string;
    error: string;
    expected?: Record<string, string>;
}

function nextEditAt(refusal: TemplateEditRefusal): Date | null {
    const at = refusal.expected?.nextEditAt;
    if (!at) return null;
    const parsed = new Date(at);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function templateEditErrorMessage(
    t: Translator,
    refusal: TemplateEditRefusal,
    formatWhen: (at: Date) => string,
): string {
    const at = refusal.code === TEMPLATE_EDIT_WINDOW ? nextEditAt(refusal) : null;
    if (at) {
        return t("whatsappTemplates.contentEdit.windowUntil", { when: formatWhen(at) });
    }
    return templateErrorMessage(t, refusal.code, refusal.error);
}
