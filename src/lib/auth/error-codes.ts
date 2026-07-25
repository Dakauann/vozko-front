export const AUTH_ERROR_CODES = {
    INVALID_CREDENTIALS: "AUTH_INVALID_CREDENTIALS",
    ACCOUNT_INACTIVE: "AUTH_ACCOUNT_INACTIVE",

    EMAIL_ALREADY_EXISTS: "AUTH_EMAIL_ALREADY_EXISTS",
    DOCUMENT_ALREADY_EXISTS: "AUTH_DOCUMENT_ALREADY_EXISTS",
    WEAK_PASSWORD: "AUTH_WEAK_PASSWORD",
    INVALID_CUSTOMER_TYPE: "AUTH_INVALID_CUSTOMER_TYPE",
    MISSING_DOCUMENT: "AUTH_MISSING_DOCUMENT",
    INVALID_DOCUMENT: "AUTH_INVALID_DOCUMENT",
    INVALID_NAME: "AUTH_INVALID_NAME",
    MISSING_VERIFICATION_CODE: "AUTH_MISSING_VERIFICATION_CODE",
    INVALID_VERIFICATION_CODE: "AUTH_INVALID_VERIFICATION_CODE",
    VERIFICATION_CODE_USED: "AUTH_VERIFICATION_CODE_USED",

    RATE_LIMIT_EXCEEDED: "AUTH_RATE_LIMIT_EXCEEDED",
    EMAIL_DELIVERY_FAILED: "AUTH_EMAIL_DELIVERY_FAILED",

    INVALID_RESET_TOKEN: "AUTH_INVALID_RESET_TOKEN",
    RESET_TOKEN_USED: "AUTH_RESET_TOKEN_USED",

    INVALID_REFRESH_TOKEN: "AUTH_INVALID_REFRESH_TOKEN",
    TOKEN_REFRESH_FAILED: "AUTH_TOKEN_REFRESH_FAILED",

    VALIDATION_FAILED: "AUTH_VALIDATION_FAILED",
    INVALID_BODY: "AUTH_INVALID_BODY",
    INTERNAL: "AUTH_INTERNAL_ERROR",
    UNAUTHORIZED: "AUTH_UNAUTHORIZED",
} as const;

export type AuthErrorCode =
    (typeof AUTH_ERROR_CODES)[keyof typeof AUTH_ERROR_CODES];

export function authErrorTranslationKey(code?: string | null): string {
    switch (code) {
        case AUTH_ERROR_CODES.INVALID_CREDENTIALS:
            return "auth.errors.invalid_credentials";
        case AUTH_ERROR_CODES.ACCOUNT_INACTIVE:
            return "auth.errors.account_inactive";
        case AUTH_ERROR_CODES.EMAIL_ALREADY_EXISTS:
            return "auth.errors.email_exists";
        case AUTH_ERROR_CODES.DOCUMENT_ALREADY_EXISTS:
            return "auth.errors.document_exists";
        case AUTH_ERROR_CODES.WEAK_PASSWORD:
            return "auth.errors.weak_password";
        case AUTH_ERROR_CODES.INVALID_CUSTOMER_TYPE:
            return "auth.errors.invalid_customer_type";
        case AUTH_ERROR_CODES.MISSING_DOCUMENT:
            return "auth.errors.missing_document";
        case AUTH_ERROR_CODES.INVALID_DOCUMENT:
            return "auth.errors.invalid_document";
        case AUTH_ERROR_CODES.INVALID_NAME:
            return "auth.errors.invalid_name";
        case AUTH_ERROR_CODES.MISSING_VERIFICATION_CODE:
            return "auth.errors.missing_verification_code";
        case AUTH_ERROR_CODES.INVALID_VERIFICATION_CODE:
            return "auth.errors.invalid_verification_code";
        case AUTH_ERROR_CODES.VERIFICATION_CODE_USED:
            return "auth.errors.verification_code_used";
        case AUTH_ERROR_CODES.RATE_LIMIT_EXCEEDED:
            return "auth.errors.rate_limit";
        case AUTH_ERROR_CODES.EMAIL_DELIVERY_FAILED:
            return "auth.errors.email_delivery_failed";
        case AUTH_ERROR_CODES.INVALID_RESET_TOKEN:
            return "auth.errors.invalid_reset_token";
        case AUTH_ERROR_CODES.RESET_TOKEN_USED:
            return "auth.errors.reset_token_used";
        case AUTH_ERROR_CODES.INVALID_REFRESH_TOKEN:
            return "auth.errors.invalid_refresh_token";
        case AUTH_ERROR_CODES.TOKEN_REFRESH_FAILED:
            return "auth.errors.token_refresh_failed";
        case AUTH_ERROR_CODES.VALIDATION_FAILED:
            return "auth.errors.validation_failed";
        case AUTH_ERROR_CODES.INVALID_BODY:
            return "auth.errors.invalid_body";
        case AUTH_ERROR_CODES.INTERNAL:
            return "auth.errors.generic";
        case AUTH_ERROR_CODES.UNAUTHORIZED:
            return "auth.errors.unauthorized";
        default:
            return "auth.errors.generic";
    }
}
