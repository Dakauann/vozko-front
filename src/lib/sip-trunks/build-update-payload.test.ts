// @vitest-environment node

import { describe, expect, it } from "vitest";

import type { SipTrunk } from "./types";
import { buildSipTrunkUpdatePayload } from "./build-update-payload";

const baseTrunk: SipTrunk = {
    id: "trunk-1",
    name: "Original Trunk",
    description: "Some desc",
    host: "sip.example.com",
    port: 5060,
    username: "user1",
    domain: "example.com",
    transport: "udp",
    trunkType: "mobile",
    isRotational: false,
    phoneNumber: "+5511999999999",
    enabled: true,
    registrationStatus: "registered",
    createdAt: "2025-01-01T00:00:00Z",
    updatedAt: "2025-01-01T00:00:00Z",
};

const unchanged = {
    name: "Original Trunk",
    description: "Some desc",
    host: "sip.example.com",
    port: 5060,
    username: "user1",
    domain: "example.com",
    transport: "udp",
    trunkType: "mobile",
    isRotational: false,
    phoneNumber: "+5511999999999",
};

describe("buildSipTrunkUpdatePayload", () => {
    it("returns empty object when nothing changed", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, unchanged);
        expect(result).toEqual({});
    });

    it("includes only name when only name changed", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            name: "New Name",
        });
        expect(result).toEqual({ name: "New Name" });
    });

    it("always includes password when non-empty", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            password: "newpass123",
        });
        expect(result).toEqual({ password: "newpass123" });
    });

    it("excludes password when empty/undefined", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            password: "",
        });
        expect(result).toEqual({});
    });

    it("detects multiple field changes", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            name: "Changed",
            host: "new.host.com",
            port: 5061,
        });
        expect(result).toEqual({
            name: "Changed",
            host: "new.host.com",
            port: 5061,
        });
    });

    it("handles optional fields going from set to undefined", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            description: undefined,
        });
        expect(result).toEqual({ description: undefined });
    });

    it("handles optional fields going from undefined to set", () => {
        const trunkNoDesc: SipTrunk = { ...baseTrunk, description: undefined };
        const result = buildSipTrunkUpdatePayload(trunkNoDesc, {
            ...unchanged,
            description: "New desc",
        });
        expect(result).toEqual({ description: "New desc" });
    });

    it("detects transport change", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            transport: "tls",
        });
        expect(result).toEqual({ transport: "tls" });
    });

    it("detects isRotational toggle", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            isRotational: true,
        });
        expect(result).toEqual({ isRotational: true });
    });

    it("detects domain change from set to empty", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            domain: undefined,
        });
        expect(result).toEqual({ domain: undefined });
    });

    it("omits advanced when current.advanced is undefined", () => {
        const result = buildSipTrunkUpdatePayload(baseTrunk, {
            ...unchanged,
            advanced: undefined,
        });
        expect(result).toEqual({});
    });

    it("omits advanced when no advanced fields changed", () => {
        const trunk: SipTrunk = {
            ...baseTrunk,
            advanced: { registerEnabled: true, ptimeMs: 20 },
        };
        const result = buildSipTrunkUpdatePayload(trunk, {
            ...unchanged,
            advanced: { registerEnabled: true, ptimeMs: 20 },
        });
        expect(result).toEqual({});
    });

    it("emits only changed advanced scalar fields", () => {
        const trunk: SipTrunk = {
            ...baseTrunk,
            advanced: { registerEnabled: true, ptimeMs: 20 },
        };
        const result = buildSipTrunkUpdatePayload(trunk, {
            ...unchanged,
            advanced: { registerEnabled: true, ptimeMs: 30 },
        });
        expect(result).toEqual({ advanced: { ptimeMs: 30 } });
    });

    it("detects ordered codecs[] reorder", () => {
        const trunk: SipTrunk = {
            ...baseTrunk,
            advanced: { codecs: ["opus", "g722", "pcmu"] },
        };
        const result = buildSipTrunkUpdatePayload(trunk, {
            ...unchanged,
            advanced: { codecs: ["g722", "opus", "pcmu"] },
        });
        expect(result).toEqual({
            advanced: { codecs: ["g722", "opus", "pcmu"] },
        });
    });

    it("treats identical codecs[] as no change", () => {
        const trunk: SipTrunk = {
            ...baseTrunk,
            advanced: { codecs: ["opus", "g722"] },
        };
        const result = buildSipTrunkUpdatePayload(trunk, {
            ...unchanged,
            advanced: { codecs: ["opus", "g722"] },
        });
        expect(result).toEqual({});
    });
});
