import { describe, expect, it } from "vitest";

import {
    MAX_ALLOWED_ORIGINS,
    checkOrigin,
    checkOrigins,
    isAccentColor,
    isCountryCode,
    isPrivacyPolicyUrl,
    originsSummary,
    webchatErrorKey,
} from "@/lib/webchat/types";

describe("checkOrigin", () => {
    it("accepts an https origin and normalizes case and trailing slash", () => {
        expect(checkOrigin("  HTTPS://Loja.Example.com/ ")).toEqual({ ok: true, origin: "https://loja.example.com" });
    });

    it("keeps a non default port and drops the default one", () => {
        expect(checkOrigin("https://loja.example.com:8443")).toEqual({ ok: true, origin: "https://loja.example.com:8443" });
        expect(checkOrigin("https://loja.example.com:443")).toEqual({ ok: true, origin: "https://loja.example.com" });
    });

    it("accepts a subdomain wildcard", () => {
        expect(checkOrigin("https://*.example.com")).toEqual({ ok: true, origin: "https://*.example.com" });
    });

    it("accepts plain http only for loopback hosts", () => {
        expect(checkOrigin("http://localhost:3000")).toEqual({ ok: true, origin: "http://localhost:3000" });
        expect(checkOrigin("http://127.0.0.1:8080")).toEqual({ ok: true, origin: "http://127.0.0.1:8080" });
        expect(checkOrigin("http://loja.example.com")).toEqual({ ok: false, issue: "insecure" });
    });

    it("refuses paths, queries, fragments and credentials", () => {
        for (const raw of [
            "https://loja.example.com/contato",
            "https://loja.example.com?x=1",
            "https://loja.example.com#top",
            "https://user:pass@loja.example.com",
        ]) {
            expect(checkOrigin(raw), raw).toEqual({ ok: false, issue: "invalid" });
        }
    });

    it("refuses a bare star, a wildcard in the middle and wildcards on loopback, IPs or top level names", () => {
        for (const raw of [
            "*",
            "https://*",
            "https://loja.*.com",
            "https://*.localhost",
            "https://*.127.0.0.1",
            "https://*.com",
        ]) {
            expect(checkOrigin(raw), raw).toEqual({ ok: false, issue: "invalid" });
        }
    });

    it("refuses other schemes, lists and blanks", () => {
        for (const raw of ["", "   ", "ftp://loja.example.com", "loja.example.com", "https://a.com,https://b.com"]) {
            expect(checkOrigin(raw).ok, raw).toBe(false);
        }
    });
});

describe("checkOrigins", () => {
    it("requires at least one valid origin", () => {
        expect(checkOrigins([]).listIssue).toBe("required");
        expect(checkOrigins(["", "  "]).listIssue).toBe("required");
        expect(checkOrigins(["", "  "]).valid).toBe(false);
    });

    it("ignores empty rows and normalizes the rest", () => {
        const result = checkOrigins(["https://Loja.example.com/", ""]);
        expect(result.valid).toBe(true);
        expect(result.origins).toEqual(["https://loja.example.com"]);
        expect(result.rowIssues).toEqual([null, null]);
    });

    it("flags each bad row and repeated origins", () => {
        const result = checkOrigins(["https://loja.example.com", "http://loja.example.com", "https://LOJA.example.com"]);
        expect(result.rowIssues).toEqual([null, "insecure", "duplicate"]);
        expect(result.valid).toBe(false);
    });

    it("refuses more than the maximum", () => {
        const rows = Array.from({ length: MAX_ALLOWED_ORIGINS + 1 }, (_, i) => `https://site${i}.example.com`);
        expect(checkOrigins(rows).listIssue).toBe("too_many");
        expect(checkOrigins(rows.slice(0, MAX_ALLOWED_ORIGINS)).valid).toBe(true);
    });
});

describe("widget field rules", () => {
    it("accepts only six digit hex colours", () => {
        expect(isAccentColor("#0d9488")).toBe(true);
        expect(isAccentColor("#fff")).toBe(false);
        expect(isAccentColor("0d9488")).toBe(false);
    });

    it("accepts one to three digit country codes", () => {
        expect(isCountryCode("55")).toBe(true);
        expect(isCountryCode("1")).toBe(true);
        expect(isCountryCode("+55")).toBe(false);
        expect(isCountryCode("5555")).toBe(false);
    });

    it("accepts an empty privacy policy or an https link", () => {
        expect(isPrivacyPolicyUrl("")).toBe(true);
        expect(isPrivacyPolicyUrl("https://loja.example.com/privacidade")).toBe(true);
        expect(isPrivacyPolicyUrl("http://loja.example.com/privacidade")).toBe(false);
        expect(isPrivacyPolicyUrl("privacidade")).toBe(false);
    });
});

describe("webchatErrorKey", () => {
    it("maps the codes a form can cause and nothing else", () => {
        expect(webchatErrorKey("origin_insecure")).toBe("errors.origin_insecure");
        expect(webchatErrorKey("internal_error")).toBeNull();
        expect(webchatErrorKey(undefined)).toBeNull();
    });
});

describe("originsSummary", () => {
    it("names the first site and counts the rest", () => {
        expect(originsSummary(["https://a.example.com", "https://b.example.com", "https://c.example.com"])).toEqual({
            first: "https://a.example.com",
            more: 2,
        });
        expect(originsSummary([])).toEqual({ first: null, more: 0 });
    });
});
