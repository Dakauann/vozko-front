import { describe, expect, it } from "vitest";

import { cleanTopics, overrideDraftFrom, overrideDraftToPut } from "@/lib/comment-analysis/override";
import type { CommentAnalysisSettings, CommentContainerSettings } from "@/lib/comment-analysis/types";

/**
 * The override editor's two mappings. The invariant that matters: a field the
 * operator left empty must reach the API as `null` (inherit), never as a zero
 * value that would silently override the account.
 */

const effective: CommentAnalysisSettings = {
    source: "instagram",
    accountId: "acc-1",
    enabled: true,
    model: "openai/gpt-4.1-mini",
    vertical: "gov",
    topics: [
        { key: "saude", label: "Saúde" },
        { key: "obras", label: "Obras" },
        { key: "other", label: "Outros" },
    ],
    severityThreshold: 60,
    dailyCap: 2000,
    instructions: "Conta da prefeitura",
    updatedAt: "2026-09-01T00:00:00Z",
};

describe("overrideDraftFrom", () => {
    it("a post without an override starts fully inheriting, with the effective topics as the draft", () => {
        const d = overrideDraftFrom({ override: null, effective });
        expect(d).toEqual({
            enabled: "inherit",
            model: "",
            threshold: "",
            instructions: "",
            ownTopics: false,
            // "other" is fixed and never editable.
            topics: [
                { key: "saude", label: "Saúde" },
                { key: "obras", label: "Obras" },
            ],
        });
    });

    it("an existing override lands field by field, nulls staying as inherit", () => {
        const cs: CommentContainerSettings = {
            effective,
            override: {
                source: "instagram",
                accountId: "acc-1",
                containerId: "m-1",
                enabled: false,
                model: null,
                severityThreshold: 80,
                instructions: "Post sobre a obra",
                topics: [{ key: "obra", label: "Obra" }],
                updatedAt: "2026-09-02T00:00:00Z",
            },
        };
        const d = overrideDraftFrom(cs);
        expect(d.enabled).toBe("off");
        expect(d.model).toBe("");
        expect(d.threshold).toBe("80");
        expect(d.instructions).toBe("Post sobre a obra");
        expect(d.ownTopics).toBe(true);
        expect(d.topics).toEqual([{ key: "obra", label: "Obra" }]);
    });
});

describe("overrideDraftToPut", () => {
    it("empty fields become null so they inherit; an empty draft is an empty override", () => {
        const put = overrideDraftToPut(overrideDraftFrom({ override: null, effective }));
        expect(put).toEqual({ enabled: null, model: null, severityThreshold: null, instructions: null, topics: null });
    });

    it("filled fields are trimmed, clamped and cleaned", () => {
        const put = overrideDraftToPut({
            enabled: "on",
            model: "  anthropic/claude-sonnet-5 ",
            threshold: "250",
            instructions: "  Post sobre a obra  ",
            ownTopics: true,
            topics: [
                { key: "", label: "  Obra ", description: " atrasos " },
                { key: "", label: "   " },
            ],
        });
        expect(put).toEqual({
            enabled: true,
            model: "anthropic/claude-sonnet-5",
            severityThreshold: 100,
            instructions: "Post sobre a obra",
            topics: [{ key: "", label: "Obra", description: "atrasos" }],
        });
    });

    it("'off' is an explicit false, not inherit; a non-numeric threshold inherits", () => {
        const put = overrideDraftToPut({ enabled: "off", model: "", threshold: "abc", instructions: "", ownTopics: false, topics: [] });
        expect(put.enabled).toBe(false);
        expect(put.severityThreshold).toBeNull();
        expect(put.topics).toBeNull();
    });

    it("own topics switched on with every row blank sends an empty list, which the API reads as 'only other'", () => {
        const put = overrideDraftToPut({ enabled: "inherit", model: "", threshold: "", instructions: "", ownTopics: true, topics: [{ key: "", label: " " }] });
        expect(put.topics).toEqual([]);
    });
});

describe("cleanTopics", () => {
    it("keeps keys so a renamed topic stays the same topic", () => {
        expect(cleanTopics([{ key: "saude", label: " Saúde pública " }])).toEqual([{ key: "saude", label: "Saúde pública", description: undefined }]);
    });
});
