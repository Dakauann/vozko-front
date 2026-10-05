import { describe, expect, it } from "vitest";

import {
    answerBreakdown,
    formatDayMonth,
    formatExchangeRate,
    formatMicros,
    formatMoneyBrl,
    formatShare,
    invoiceCounts,
    invoiceStatusLabelKey,
    invoiceStatusTone,
    marginTone,
    numberStateLabelKey,
    numberStateTone,
    numberTableRows,
    shareOf,
} from "./meta-costs";
import type { MetaInvoiceAccount } from "./types";

const NBSP = / /g;

function plain(value: string | null): string | null {
    return value === null ? null : value.replace(NBSP, " ");
}

const configured = { usdToBrlMicros: 5_420_000 };
const unconfigured = { usdToBrlMicros: 0 };

describe("money formatting", () => {
    it("formats BRL micros as reais", () => {
        expect(plain(formatMoneyBrl({ usdMicros: 248_000_000, brlMicros: 1_344_420_000 }, "pt"))).toBe(
            "R$ 1.344,42",
        );
    });

    it("returns null when the BRL value is missing so the page shows n/d", () => {
        expect(formatMoneyBrl({ usdMicros: 10_000_000, brlMicros: null }, "pt")).toBeNull();
        expect(formatMoneyBrl(undefined, "pt")).toBeNull();
    });

    it("keeps the sign on negative margins and adds one on signed differences", () => {
        expect(plain(formatMoneyBrl({ usdMicros: 0, brlMicros: -114_380_000 }, "pt"))).toBe("-R$ 114,38");
        expect(plain(formatMicros(7_690_000, "BRL", "pt", { signed: true }))).toBe("+R$ 7,69");
        expect(plain(formatMicros(0, "BRL", "pt", { signed: true }))).toBe("R$ 0,00");
    });

    it("formats the exchange rate, null when not configured", () => {
        expect(plain(formatExchangeRate(configured, "pt"))).toBe("R$ 5,42");
        expect(formatExchangeRate(unconfigured, "pt")).toBeNull();
    });
});

describe("answer percentages", () => {
    it("splits charged, free and no answer", () => {
        const breakdown = answerBreakdown({ charged: 20_061, free: 8_412, noAnswer: 9_939 });
        expect(breakdown?.total).toBe(38_412);
        expect(breakdown?.segments.map((s) => s.key)).toEqual(["charged", "free", "noAnswer"]);
        expect(plain(formatShare(breakdown?.segments[0].share ?? null, "pt", 1))).toBe("52,2%");
    });

    it("has no shares when nothing was sent", () => {
        const breakdown = answerBreakdown({ charged: 0, free: 0, noAnswer: 0 });
        expect(breakdown?.segments.every((s) => s.share === null)).toBe(true);
        expect(answerBreakdown(undefined)).toBeNull();
    });

    it("never divides by zero", () => {
        expect(shareOf(5, 0)).toBeNull();
        expect(shareOf(1, 4)).toBe(0.25);
        expect(formatShare(null, "pt")).toBeNull();
    });
});

describe("margin tone", () => {
    it("is fault when negative, healthy when positive, neutral when unknown", () => {
        expect(marginTone({ usdMicros: 0, brlMicros: -1 })).toBe("fault");
        expect(marginTone({ usdMicros: 0, brlMicros: 1 })).toBe("healthy");
        expect(marginTone({ usdMicros: -5, brlMicros: null })).toBe("default");
    });
});

describe("number state", () => {
    it("picks a label key and tone per state", () => {
        expect(numberStateLabelKey("charging")).toBe("numberState.charging");
        expect(numberStateLabelKey("free")).toBe("numberState.free");
        expect(numberStateLabelKey("no_answer")).toBe("numberState.noAnswer");
        expect(numberStateLabelKey("unexpected")).toBe("numberState.noAnswer");
        expect(numberStateTone("charging")).toBe("healthy");
        expect(numberStateTone("free")).toBe("info");
    });

    it("formats the first charged day as dd/mm", () => {
        expect(formatDayMonth("2026-09-12T15:00:00Z", "pt")).toBe("12/09");
        expect(formatDayMonth(undefined, "pt")).toBeNull();
        expect(formatDayMonth("not a date", "pt")).toBeNull();
    });

    it("lists linked numbers first, then unlinked ones labelled by raw id when the phone is missing", () => {
        const rows = numberTableRows({
            numbers: [
                {
                    phoneId: "p1",
                    displayPhoneNumber: "+55 11 94000-1201",
                    provider: "meta",
                    workspaceName: "Clínica Aurora",
                    serviceMessages: 10,
                    answered: 8,
                    charged: 6,
                    state: "charging",
                },
            ],
            unlinked: [
                { phoneNumberId: "1093", displayPhoneNumber: "", messages: 27 },
                { phoneNumberId: "2044", displayPhoneNumber: "+55 85 91000-3321", messages: 2 },
            ],
        });
        expect(rows.map((r) => r.kind)).toEqual(["number", "unlinked", "unlinked"]);
        expect(rows[1].kind === "unlinked" && rows[1].phoneLabel).toBe("1093");
        expect(rows[2].kind === "unlinked" && rows[2].phoneLabel).toBe("+55 85 91000-3321");
        expect(numberTableRows(undefined)).toEqual([]);
    });
});

describe("invoice check", () => {
    const base: MetaInvoiceAccount = {
        wabaId: "1029384756",
        name: "Clínica Aurora",
        provider: "meta",
        ourTemplates: 24_201,
        metaTemplates: 25_072,
        metaChargedTemplates: 23_990,
        metaChargedService: 0,
        metaFreeService: 9_588,
        difference: 871,
        differencePct: 3.6,
        state: "matched",
    };

    it("labels each state and unavailable reason", () => {
        expect(invoiceStatusLabelKey(base)).toBe("invoiceState.matched");
        expect(invoiceStatusLabelKey({ state: "check" })).toBe("invoiceState.check");
        expect(invoiceStatusLabelKey({ state: "unavailable", reason: "dialog360" })).toBe("invoiceReason.dialog360");
        expect(invoiceStatusLabelKey({ state: "unavailable", reason: "no_token" })).toBe("invoiceReason.noToken");
        expect(invoiceStatusLabelKey({ state: "unavailable", reason: "meta_unreadable" })).toBe(
            "invoiceReason.metaUnreadable",
        );
        expect(invoiceStatusLabelKey({ state: "unavailable" })).toBe("invoiceState.unavailable");
        expect(invoiceStatusTone("check")).toBe("warning");
        expect(invoiceStatusTone("matched")).toBe("healthy");
        expect(invoiceStatusTone("unavailable")).toBe("default");
    });

    it("formats the template counts and the signed difference", () => {
        const counts = invoiceCounts(base, "pt");
        expect(counts.ours).toBe("24.201");
        expect(counts.meta).toBe("25.072");
        expect(counts.metaCharged).toBe("23.990");
        expect(counts.difference).toBe("+871");
        expect(plain(counts.differencePct)).toBe("+3,6%");
        expect(counts.chargedService).toBe("0");
        expect(counts.freeService).toBe("9.588");
    });

    it("hides what Meta did not tell us", () => {
        const unavailable = invoiceCounts({ ...base, state: "unavailable", reason: "no_token" }, "pt");
        expect(unavailable.ours).toBe("24.201");
        expect(unavailable.meta).toBeNull();
        expect(unavailable.metaCharged).toBeNull();
        expect(unavailable.difference).toBeNull();
        expect(unavailable.chargedService).toBeNull();
        expect(unavailable.freeService).toBeNull();
    });
});
