import type { SendCapActionError } from "@/lib/balance/send-cap-types";

type Translator = {
    (key: string): string;
    has: (key: string) => boolean;
};

export function describeSendCapError(t: Translator, error: SendCapActionError): string {
    const key = `errors.${error.code ?? ""}`;
    if (error.code && t.has(key)) return t(key);
    return error.message || t("errors.default");
}
