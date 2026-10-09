import type { SendCapActionError } from "@/lib/balance/send-cap-types";
import { codedErrorMessage, type CodedTranslator } from "@/lib/api/coded-error";

export function describeSendCapError(t: CodedTranslator, error: SendCapActionError): string {
    return codedErrorMessage(t, error, error.message || t("errors.default"));
}
