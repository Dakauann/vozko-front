/**
 * @vitest-environment node
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    getMyAffiliateAction,
    listAffiliateEarningsAction,
    listAffiliateReferralsAction,
    registerAffiliateAction,
    updateMyAffiliateAction,
    validateAffiliateCodeAction,
} from "@/app/actions/affiliate";

const { apiClient, apiFetch } = vi.hoisted(() => ({
    apiClient: vi.fn(),
    apiFetch: vi.fn(),
}));

vi.mock("@/lib/api/browser-client", () => ({ apiClient }));
vi.mock("@/lib/api/http", () => ({ apiFetch }));



const AFFILIATE = {
    id: "a1",
    userId: "u1",
    code: "BRAND",
    brandName: "Brand",
    brandLogoUrl: "https://x/l.png",
    asaasWalletId: "w1",
    commissionPct: 0.05,
    active: true,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
};

const PROFILE = {
    affiliate: AFFILIATE,
    stats: { totalReferrals: 2, totalEarningMicros: 1_000_000, monthEarningMicros: 500_000 },
};

describe("affiliate server actions", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });


    it("register: omits empty code from body and returns affiliate on success", async () => {
        apiClient.mockResolvedValue({ data: AFFILIATE });

        const res = await registerAffiliateAction({
            brandName: "Brand",
            brandLogoUrl: "https://x/l.png",
            asaasWalletId: "w1",
            code: "",
        });

        expect(res).toEqual({ affiliate: AFFILIATE });
        const [, opts] = apiClient.mock.calls[0];
        const body = JSON.parse(opts.body);
        expect(body).toEqual({
            brandName: "Brand",
            brandLogoUrl: "https://x/l.png",
            asaasWalletId: "w1",
        });
        expect(body).not.toHaveProperty("code");
    });

    it("register: forwards explicit code to body", async () => {
        apiClient.mockResolvedValue({ data: AFFILIATE });

        await registerAffiliateAction({
            brandName: "Brand",
            brandLogoUrl: "https://x/l.png",
            asaasWalletId: "w1",
            code: "MY-CODE",
        });
        const [, opts] = apiClient.mock.calls[0];
        expect(JSON.parse(opts.body).code).toBe("MY-CODE");
    });

    it("register: surfaces backend error message", async () => {
        apiClient.mockResolvedValue({
            error: { message: "Code already taken", status: 409 },
        });

        await expect(
            registerAffiliateAction({
                brandName: "Brand",
                brandLogoUrl: "https://x/l.png",
                asaasWalletId: "w1",
            }),
        ).resolves.toEqual({ affiliate: null, error: "Code already taken" });
    });


    it("getMe: returns profile on success", async () => {
        apiClient.mockResolvedValue({ data: PROFILE });

        await expect(getMyAffiliateAction()).resolves.toEqual({ profile: PROFILE });
    });

    it("getMe: 404 maps to notFound", async () => {
        apiClient.mockResolvedValue({
            error: { message: "not found", status: 404 },
        });

        await expect(getMyAffiliateAction()).resolves.toEqual({
            profile: null,
            notFound: true,
        });
    });

    it("getMe: other errors propagate", async () => {
        apiClient.mockResolvedValue({
            error: { message: "boom", status: 500 },
        });

        await expect(getMyAffiliateAction()).resolves.toEqual({
            profile: null,
            error: "boom",
        });
    });


    it("updateMe: sends only provided fields", async () => {
        apiClient.mockResolvedValue({ data: AFFILIATE });

        await updateMyAffiliateAction({ brandName: "New Brand" });

        const [, opts] = apiClient.mock.calls[0];
        expect(JSON.parse(opts.body)).toEqual({ brandName: "New Brand" });
    });


    it("listReferrals: returns items + meta", async () => {
        apiClient.mockResolvedValue({
            data: {
                data: [{ id: "r1", affiliateId: "a1", workspaceId: "w", referredAt: "2026-01-01" }],
                meta: { page: 1, pageSize: 20, totalItems: 1, totalPages: 1 },
            },
        });

        const res = await listAffiliateReferralsAction(1, 20);
        expect(res.items).toHaveLength(1);
        expect(res.meta.totalItems).toBe(1);
    });

    it("listReferrals: error propagates", async () => {
        apiClient.mockResolvedValue({
            error: { message: "no auth", status: 401 },
        });
        const res = await listAffiliateReferralsAction();
        expect(res.items).toEqual([]);
        expect(res.error).toBe("no auth");
    });

    it("listEarnings: error propagates", async () => {
        apiClient.mockResolvedValue({
            error: { message: "500", status: 500 },
        });
        const res = await listAffiliateEarningsAction();
        expect(res.items).toEqual([]);
        expect(res.error).toBe("500");
    });


    it("validateCode: rejects empty input without hitting the API", async () => {
        const res = await validateAffiliateCodeAction("   ");
        expect(apiFetch).not.toHaveBeenCalled();
        expect(res).toEqual({ result: { valid: false } });
    });

    it("validateCode: success", async () => {
        apiFetch.mockResolvedValue({
            data: { valid: true, code: "BRAND", brandName: "Brand" },
        });
        const res = await validateAffiliateCodeAction("brand");
        expect(res).toEqual({ result: { valid: true, code: "BRAND", brandName: "Brand" } });
        expect(apiFetch).toHaveBeenCalledWith(
            expect.stringContaining("/affiliate/validate/BRAND"),
            expect.objectContaining({ method: "GET" }),
        );
    });

    it("validateCode: backend failure propagates error", async () => {
        apiFetch.mockResolvedValue({ error: { message: "404", status: 404 } });
        const res = await validateAffiliateCodeAction("UNKNOWN");
        expect(res).toEqual({ result: null, error: "404" });
    });
});
