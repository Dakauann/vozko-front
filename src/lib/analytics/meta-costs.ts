import type {
    MetaCostRates,
    MetaInvoiceAccount,
    MetaInvoiceCurrency,
    MetaNumberChargeState,
    MetaNumberServiceCost,
    MetaServiceMessageAnswers,
    MetaServiceMessageCostReport,
    MetaUnlinkedServiceMessages,
    Money,
} from "@/lib/analytics/types";

const MICROS_PER_UNIT = 1_000_000;

const INTL_LOCALES: Record<string, string> = {
    pt: "pt-BR",
    en: "en-US",
    es: "es-ES",
    de: "de-DE",
};

export type MetaCostTone = "default" | "healthy" | "warning" | "fault" | "info" | "brand";

export function intlLocale(locale: string): string {
    return INTL_LOCALES[locale.split("-")[0].toLowerCase()] ?? locale;
}

export function formatMicros(
    micros: number | null | undefined,
    currency: MetaInvoiceCurrency,
    locale: string,
    options: { signed?: boolean; maximumFractionDigits?: number } = {},
): string | null {
    if (micros === null || micros === undefined || !Number.isFinite(micros)) return null;
    const maximumFractionDigits = options.maximumFractionDigits ?? 2;
    return new Intl.NumberFormat(intlLocale(locale), {
        style: "currency",
        currency,
        minimumFractionDigits: Math.min(2, maximumFractionDigits),
        maximumFractionDigits,
        signDisplay: options.signed ? "exceptZero" : "auto",
    }).format(micros / MICROS_PER_UNIT);
}

export function formatMoneyBrl(
    money: Money | null | undefined,
    locale: string,
    options: { signed?: boolean } = {},
): string | null {
    return formatMicros(money?.brlMicros, "BRL", locale, options);
}

export function formatExchangeRate(
    rates: MetaCostRates | null | undefined,
    locale: string,
): string | null {
    const micros = rates?.usdToBrlMicros ?? 0;
    if (micros <= 0) return null;
    return formatMicros(micros, "BRL", locale);
}

export function shareOf(part: number, whole: number): number | null {
    if (!(whole > 0)) return null;
    return part / whole;
}

export function formatShare(
    share: number | null,
    locale: string,
    fractionDigits = 0,
): string | null {
    if (share === null || !Number.isFinite(share)) return null;
    return new Intl.NumberFormat(intlLocale(locale), {
        style: "percent",
        minimumFractionDigits: fractionDigits,
        maximumFractionDigits: fractionDigits,
    }).format(share);
}

export function formatPercentPoints(
    percent: number | null | undefined,
    locale: string,
): string | null {
    if (percent === null || percent === undefined || !Number.isFinite(percent)) return null;
    return new Intl.NumberFormat(intlLocale(locale), {
        style: "percent",
        minimumFractionDigits: 1,
        maximumFractionDigits: 1,
        signDisplay: "exceptZero",
    }).format(percent / 100);
}

export type AnswerSegmentKey = "charged" | "free" | "noAnswer";

export interface AnswerSegment {
    key: AnswerSegmentKey;
    count: number;
    share: number | null;
}

export interface AnswerBreakdown {
    total: number;
    segments: AnswerSegment[];
}

const ANSWER_ORDER: AnswerSegmentKey[] = ["charged", "free", "noAnswer"];

export function answerBreakdown(
    answers: MetaServiceMessageAnswers | null | undefined,
): AnswerBreakdown | null {
    if (!answers) return null;
    const total = answers.charged + answers.free + answers.noAnswer;
    return {
        total,
        segments: ANSWER_ORDER.map((key) => ({
            key,
            count: answers[key],
            share: shareOf(answers[key], total),
        })),
    };
}

export type MoneySign = "negative" | "zero" | "positive";

export function moneySign(money: Money | null | undefined): MoneySign | null {
    const brl = money?.brlMicros;
    if (brl === null || brl === undefined) return null;
    if (brl < 0) return "negative";
    if (brl > 0) return "positive";
    return "zero";
}

export function marginTone(money: Money | null | undefined): "fault" | "healthy" | "default" {
    const sign = moneySign(money);
    if (sign === "negative") return "fault";
    if (sign === "positive") return "healthy";
    return "default";
}

const NUMBER_STATE_KEYS: Record<MetaNumberChargeState, string> = {
    charging: "numberState.charging",
    free: "numberState.free",
    no_answer: "numberState.noAnswer",
};

const NUMBER_STATE_TONES: Record<MetaNumberChargeState, MetaCostTone> = {
    charging: "healthy",
    free: "info",
    no_answer: "default",
};

export function numberStateLabelKey(state: string): string {
    return NUMBER_STATE_KEYS[state as MetaNumberChargeState] ?? NUMBER_STATE_KEYS.no_answer;
}

export function numberStateTone(state: string): MetaCostTone {
    return NUMBER_STATE_TONES[state as MetaNumberChargeState] ?? "default";
}

export function formatDayMonth(iso: string | null | undefined, locale: string): string | null {
    if (!iso) return null;
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return null;
    return new Intl.DateTimeFormat(intlLocale(locale), {
        day: "2-digit",
        month: "2-digit",
    }).format(date);
}

export type NumberTableRow =
    | ({ kind: "number"; rowKey: string } & MetaNumberServiceCost)
    | ({ kind: "unlinked"; rowKey: string; phoneLabel: string } & MetaUnlinkedServiceMessages);

export function numberTableRows(
    report: Pick<MetaServiceMessageCostReport, "numbers" | "unlinked"> | null | undefined,
): NumberTableRow[] {
    const numbers: NumberTableRow[] = (report?.numbers ?? []).map((item) => ({
        ...item,
        kind: "number",
        rowKey: `number:${item.phoneId}`,
    }));
    const unlinked: NumberTableRow[] = (report?.unlinked ?? []).map((item) => ({
        ...item,
        kind: "unlinked",
        rowKey: `unlinked:${item.phoneNumberId}`,
        phoneLabel: item.displayPhoneNumber.trim() || item.phoneNumberId,
    }));
    return [...numbers, ...unlinked];
}

const INVOICE_REASON_KEYS: Record<string, string> = {
    dialog360: "invoiceReason.dialog360",
    no_token: "invoiceReason.noToken",
    meta_unreadable: "invoiceReason.metaUnreadable",
};

export function invoiceStatusLabelKey(
    account: Pick<MetaInvoiceAccount, "state" | "reason">,
): string {
    if (account.state === "matched") return "invoiceState.matched";
    if (account.state === "check") return "invoiceState.check";
    return (account.reason && INVOICE_REASON_KEYS[account.reason]) || "invoiceState.unavailable";
}

export function invoiceStatusTone(state: string): MetaCostTone {
    if (state === "matched") return "healthy";
    if (state === "check") return "warning";
    return "default";
}

export interface InvoiceCounts {
    ours: string;
    meta: string | null;
    metaCharged: string | null;
    difference: string | null;
    differencePct: string | null;
    chargedService: string | null;
    freeService: string | null;
}

export function invoiceCounts(account: MetaInvoiceAccount, locale: string): InvoiceCounts {
    const integer = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 });
    const ours = integer.format(account.ourTemplates);
    if (account.state === "unavailable") {
        return { ours, meta: null, metaCharged: null, difference: null, differencePct: null, chargedService: null, freeService: null };
    }
    return {
        ours,
        meta: integer.format(account.metaTemplates),
        metaCharged: integer.format(account.metaChargedTemplates),
        difference: new Intl.NumberFormat(intlLocale(locale), { signDisplay: "exceptZero" }).format(account.difference),
        differencePct: formatPercentPoints(account.differencePct, locale),
        chargedService: integer.format(account.metaChargedService),
        freeService: integer.format(account.metaFreeService),
    };
}
