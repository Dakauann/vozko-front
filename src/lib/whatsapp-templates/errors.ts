/**
 * Códigos de erro de template — o mesmo vocabulário que o backend emite em
 * `domain/whatsapp/template/error_codes.go`.
 *
 * Existem porque a mensagem do servidor NÃO é texto de interface. Os sentinelas
 * do Go estão em inglês, escritos para quem lê log, e o produto é usado em
 * português: um template recusado por variável no lugar errado dizia ao
 * operador "body text cannot start with a variable - add text before it". O
 * cliente não tem como traduzir aquilo — a frase não é chave, e casar por texto
 * quebraria na primeira vez que alguém melhorasse a redação.
 *
 * O código é a chave. A UI procura a tradução, e cai na mensagem do servidor
 * quando encontra um código que ainda não conhece — então um erro novo do
 * backend degrada para inglês, não para o vazio.
 */

/** Prefixo de toda chave de tradução deste vocabulário. */
const I18N_PREFIX = "whatsappTemplates.errors";

/**
 * Códigos que a UI traduz. Espelha KnownErrorCodes() do backend.
 *
 * Não é `string` solto de propósito: um código escrito errado aqui vira erro de
 * compilação, em vez de uma tradução que nunca aparece.
 */
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

/**
 * Códigos cuja mensagem vem do PROVEDOR, não daqui.
 *
 * O WhatsApp já devolve `error_user_msg` no idioma do token, escrito para o
 * usuário final. Traduzir por cima seria substituir a frase específica ("Já
 * existe um modelo com esse nome") por uma genérica nossa — perder informação
 * para ganhar consistência de tom não é uma boa troca num erro.
 */
const PROVIDER_AUTHORED: ReadonlySet<string> = new Set([
    "template_provider_rejected",
]);

type Translator = (key: string, values?: Record<string, string>) => string;

/**
 * A frase a mostrar para uma falha de template.
 *
 * Ordem, e cada passo existe por um motivo:
 *  1. código do provedor  → a mensagem do servidor, que é a do WhatsApp e já
 *     está no idioma do operador;
 *  2. código conhecido    → nossa tradução;
 *  3. código desconhecido → a mensagem do servidor (inglês, mas verdadeira);
 *  4. nada                → uma frase genérica, para nunca terminar em vazio.
 *
 * O passo 4 é o que corrige o sintoma relatado: antes, uma falha sem mensagem
 * tratável simplesmente não dizia nada.
 */
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
