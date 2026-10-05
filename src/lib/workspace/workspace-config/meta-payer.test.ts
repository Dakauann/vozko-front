import { describe, expect, it } from "vitest";

import { metaPayerSaveOutcome, parseMetaPayer } from "./meta-payer";
import type { WorkspaceConfig } from "./types";

const config = { id: "c1", workspaceId: "ws-1", metaPayer: "client" } as WorkspaceConfig;

describe("parseMetaPayer", () => {
    it("accepts only vozko and client", () => {
        expect(parseMetaPayer("vozko")).toBe("vozko");
        expect(parseMetaPayer("client")).toBe("client");
        expect(parseMetaPayer("cliente")).toBeNull();
        expect(parseMetaPayer(undefined)).toBeNull();
    });
});

describe("metaPayerSaveOutcome", () => {
    it("succeeds only when the backend echoes the requested payer", () => {
        expect(metaPayerSaveOutcome("client", { config })).toEqual({ ok: true, metaPayer: "client", config });
    });

    it("surfaces the backend error", () => {
        expect(metaPayerSaveOutcome("client", { config: null, error: "invalid metaPayer" })).toEqual({
            ok: false,
            error: "invalid metaPayer",
        });
    });

    it("fails closed when the saved value does not match or is missing", () => {
        expect(metaPayerSaveOutcome("vozko", { config })).toEqual({ ok: false, error: null });
        expect(metaPayerSaveOutcome("vozko", { config: { ...config, metaPayer: undefined } })).toEqual({
            ok: false,
            error: null,
        });
        expect(metaPayerSaveOutcome("vozko", { config: null })).toEqual({ ok: false, error: null });
    });
});
