import type { ReactNode } from "react";

import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";

import ptMessages from "@/i18n/messages/pt.json";
import type { MetaInvoiceCheckReport, MetaServiceMessageCostReport } from "@/lib/analytics/types";

import MetaServiceCostDashboard from "./meta-service-cost-dashboard";

const reportAction = vi.fn();
const invoiceAction = vi.fn();

vi.mock("@/app/actions/analytics", () => ({
    getMetaServiceMessageCostAction: (...args: unknown[]) => reportAction(...args),
    getMetaInvoiceCheckAction: (...args: unknown[]) => invoiceAction(...args),
}));

vi.mock("@/i18n/routing", () => ({
    Link: ({ href, children, className }: { href: string; children: ReactNode; className?: string }) => (
        <a href={href} className={className}>
            {children}
        </a>
    ),
}));

const t = ptMessages.metaCosts;

function money(brl: number | null, usd = 0) {
    return { usdMicros: usd, brlMicros: brl };
}

function report(overrides: Partial<MetaServiceMessageCostReport> = {}): MetaServiceMessageCostReport {
    return {
        period: { startDate: "2026-10-01T03:00:00Z", endDate: "2026-11-01T03:00:00Z" },
        provider: "meta",
        inferredOnly: false,
        rates: { usdToBrlMicros: 5_420_000 },
        totals: {
            serviceMessages: 38_412,
            netBillableSends: 47_560,
            ratio: 0.81,
            workspacesCovered: 4,
            metaConfirmed: 20_061,
            metaAnswered: 28_473,
            unattributedServiceMessages: 0,
            unlinkedServiceMessages: 27,
            answers: { charged: 20_061, free: 8_412, noAnswer: 9_939 },
            confirmedServiceCost: money(702_150_000),
            serviceCostMissing: 0,
            paidByClients: money(2_615_800_000),
            vozkoMetaCost: money(779_350_000),
            realMargin: money(-114_380_000),
        },
        workspaces: {
            items: [
                {
                    workspaceId: "ws-1",
                    workspaceName: "Clínica Aurora",
                    providers: ["meta"],
                    serviceMessages: 9_884,
                    netBillableSends: 4_210,
                    metaConfirmed: 6_120,
                    ratio: 2.35,
                    economics: {
                        metaPayer: "vozko",
                        paidByClient: money(231_550_000),
                        templateCost: money(131_720_000),
                        serviceCost: money(214_210_000),
                        vozkoMetaCost: money(345_930_000),
                        realMargin: money(-114_380_000),
                        serviceExceedsPrice: true,
                    },
                },
                {
                    workspaceId: "ws-2",
                    workspaceName: "Grupo Vértice",
                    providers: ["dialog360"],
                    serviceMessages: 6_540,
                    netBillableSends: 9_430,
                    metaConfirmed: 2_904,
                    ratio: 0.69,
                    economics: {
                        metaPayer: "client",
                        paidByClient: money(518_650_000),
                        templateCost: money(0),
                        serviceCost: money(101_640_000),
                        vozkoMetaCost: money(0),
                        realMargin: money(518_650_000),
                        serviceExceedsPrice: false,
                    },
                },
            ],
            page: 1,
            page_size: 20,
            total_items: 2,
            total_pages: 1,
        },
        numbers: [
            {
                phoneId: "p1",
                displayPhoneNumber: "+55 11 94000-1201",
                provider: "meta",
                workspaceName: "Clínica Aurora",
                serviceMessages: 9_884,
                answered: 7_000,
                charged: 6_120,
                firstChargedAt: "2026-09-12T15:00:00Z",
                state: "charging",
            },
            {
                phoneId: "p2",
                displayPhoneNumber: "+55 21 93000-4410",
                provider: "meta",
                workspaceName: "Escola Horizonte",
                serviceMessages: 7_302,
                answered: 7_302,
                charged: 0,
                state: "free",
            },
        ],
        unlinked: [
            { phoneNumberId: "109384756", displayPhoneNumber: "", messages: 27 },
        ],
        ...overrides,
    };
}

const invoice: MetaInvoiceCheckReport = {
    period: { startDate: "2026-10-01T03:00:00Z", endDate: "2026-11-01T03:00:00Z" },
    totals: { metaChargedService: 0, metaFreeService: 9_588, unavailableAccounts: 1, idleAccounts: 238 },
    accounts: [
        {
            wabaId: "5647382910",
            name: "Loja Mar Azul",
            provider: "meta",
            ourTemplates: 24_201,
            metaTemplates: 27_275,
            metaChargedTemplates: 26_990,
            metaChargedService: 0,
            metaFreeService: 9_588,
            difference: 3_074,
            differencePct: 12.7,
            state: "check",
        },
        {
            wabaId: "1029384756",
            name: "Grupo Vértice",
            provider: "dialog360",
            ourTemplates: 9_430,
            metaTemplates: 0,
            metaChargedTemplates: 0,
            metaChargedService: 0,
            metaFreeService: 0,
            difference: 0,
            state: "unavailable",
            reason: "dialog360",
        },
    ],
};

function renderDashboard() {
    return render(
        <NextIntlClientProvider locale="pt" messages={ptMessages} timeZone="America/Sao_Paulo">
            <MetaServiceCostDashboard />
        </NextIntlClientProvider>,
    );
}

function section(name: string) {
    return screen.getByRole("heading", { name }).closest("section") as HTMLElement;
}

function normalized(element: HTMLElement) {
    return (element.textContent ?? "").replace(/ /g, " ");
}

describe("MetaServiceCostDashboard", () => {
    beforeEach(() => {
        reportAction.mockReset();
        invoiceAction.mockReset();
    });

    it("renders the summary, numbers, clients and invoice check from the API", async () => {
        reportAction.mockResolvedValue({ data: report() });
        invoiceAction.mockResolvedValue({ data: invoice });

        renderDashboard();

        await waitFor(() => expect(screen.getByText("Clínica Aurora", { selector: "p" })).toBeInTheDocument());

        const summary = screen.getByRole("region", { name: t.summaryLabel });
        expect(normalized(summary)).toContain("R$ 779,35");
        expect(normalized(summary)).toContain("-R$ 114,38");
        expect(normalized(summary)).toContain("74% com resposta da Meta");
        expect(normalized(summary)).toContain("R$ 702,15");
        expect(normalized(summary)).toContain("20.061 mensagens cobradas");
        expect(normalized(screen.getByText(/Câmbio do período/))).toContain("R$ 5,42");

        const safety = section(t.safetyTitle);
        expect(within(safety).getByText("27 mensagens")).toBeInTheDocument();
        expect(within(safety).getByRole("link", { name: t.unlinkedLink })).toHaveAttribute(
            "href",
            "#meta-cost-numbers",
        );

        const numbers = section(t.numbersTitle);
        expect(within(numbers).getByText("Cobrando desde 12/09")).toBeInTheDocument();
        expect(within(numbers).getByText(t.numberState.free)).toBeInTheDocument();
        expect(within(numbers).getByText("109384756")).toBeInTheDocument();

        const clients = section(t.clientsTitle);
        expect(within(clients).getByText(t.payerVozko)).toBeInTheDocument();
        expect(within(clients).getByText(t.payerClient)).toBeInTheDocument();
        expect(normalized(clients)).toContain("R$ 345,93");
        expect(normalized(clients)).toContain("R$ 214,21 em serviço");
        expect(within(clients).getByText(t.serviceExceedsPrice)).toBeInTheDocument();
        expect(within(clients).getByText(t.paidByClientLabel, { selector: "span" })).toBeInTheDocument();

        await waitFor(() => expect(invoiceAction).toHaveBeenCalledTimes(1));
        const invoiceSection = section(t.invoiceTitle);
        await waitFor(() => expect(within(invoiceSection).getByText(t.invoiceState.check)).toBeInTheDocument());
        expect(within(invoiceSection).getByText(t.invoiceReason.dialog360)).toBeInTheDocument();
        expect(normalized(invoiceSection)).toContain("+3.074");
        expect(normalized(invoiceSection)).toContain("9.588");
        expect(normalized(invoiceSection)).toContain(t.invoiceIdle);
        expect(normalized(invoiceSection)).toContain("238");
        expect(normalized(invoiceSection)).toContain("+12,7%");
        expect(invoiceAction.mock.calls[0][0]).toEqual({
            startDate: reportAction.mock.calls[0][0].startDate,
            endDate: reportAction.mock.calls[0][0].endDate,
        });
    });

    it("points to the service message cost on Tarifas when a charged client has none", async () => {
        const base = report();
        reportAction.mockResolvedValue({
            data: report({
                totals: { ...base.totals, confirmedServiceCost: null, vozkoMetaCost: null, realMargin: null, serviceCostMissing: 2 },
            }),
        });
        invoiceAction.mockResolvedValue({ data: { ...invoice, accounts: [] } });

        renderDashboard();

        expect(await screen.findByText(t.serviceCostMissingTitle)).toBeInTheDocument();
        expect(screen.getByRole("link", { name: t.serviceCostMissingAction })).toHaveAttribute("href", "/dashboard/pricing");
        const summary = screen.getByRole("region", { name: t.summaryLabel });
        expect(within(summary).getAllByText("n/d").length).toBeGreaterThanOrEqual(3);
        expect(normalized(summary)).not.toContain("R$ 0,00");
    });

    it("shows no cost notice when every charged client has a cost", async () => {
        reportAction.mockResolvedValue({ data: report() });
        invoiceAction.mockResolvedValue({ data: { ...invoice, accounts: [] } });

        renderDashboard();

        await waitFor(() => expect(screen.getByText("Clínica Aurora", { selector: "p" })).toBeInTheDocument());
        expect(screen.queryByText(t.serviceCostMissingTitle)).toBeNull();
    });

    it("keeps the page usable when the invoice check fails", async () => {
        reportAction.mockResolvedValue({ data: report() });
        invoiceAction.mockResolvedValue({ error: "meta timeout" });

        renderDashboard();

        const invoiceSection = await waitFor(() => section(t.invoiceTitle));
        await waitFor(() => expect(within(invoiceSection).getByText(/meta timeout/)).toBeInTheDocument());
        expect(within(invoiceSection).getByText(new RegExp(t.invoiceError))).toBeInTheDocument();
        expect(screen.getByText("Clínica Aurora", { selector: "p" })).toBeInTheDocument();
    });
});
