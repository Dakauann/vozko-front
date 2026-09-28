import { describe, expect, it } from "vitest";

import { composerProblems, toCreatePayload, type FacebookPostDraft } from "@/lib/facebook/composer";
import type { FacebookMediaRef } from "@/lib/facebook/types";

const NOW = new Date("2026-10-01T12:00:00Z");

const JPEG: FacebookMediaRef = { url: "https://cdn.test/a.jpg", mimeType: "image/jpeg", sizeBytes: 1000 };
const MP4: FacebookMediaRef = { url: "https://cdn.test/a.mp4", mimeType: "video/mp4", sizeBytes: 1000 };
const MOV: FacebookMediaRef = { url: "https://cdn.test/a.mov", mimeType: "video/quicktime", sizeBytes: 1000 };

function draft(overrides: Partial<FacebookPostDraft>): FacebookPostDraft {
    return { kind: "text", message: "", link: "", media: [], videoTitle: "", scheduledAt: null, ...overrides };
}

describe("composerProblems", () => {
    it("needs a message for a text post", () => {
        expect(composerProblems(draft({ kind: "text" }), NOW)).toContain("messageRequired");
        expect(composerProblems(draft({ kind: "text", message: "Olá" }), NOW)).toEqual([]);
    });

    it("needs an https link for a link post", () => {
        expect(composerProblems(draft({ kind: "link", link: "http://x.test" }), NOW)).toContain("linkInvalid");
        expect(composerProblems(draft({ kind: "link", link: "nope" }), NOW)).toContain("linkInvalid");
        expect(composerProblems(draft({ kind: "link", link: "https://x.test/a" }), NOW)).toEqual([]);
    });

    it("takes exactly one image for a photo post", () => {
        expect(composerProblems(draft({ kind: "photo" }), NOW)).toContain("photoCount");
        expect(composerProblems(draft({ kind: "photo", media: [JPEG, JPEG] }), NOW)).toContain("photoCount");
        expect(composerProblems(draft({ kind: "photo", media: [JPEG] }), NOW)).toEqual([]);
    });

    it("takes 2 to 10 images for an album", () => {
        expect(composerProblems(draft({ kind: "album", media: [JPEG] }), NOW)).toContain("albumCount");
        expect(composerProblems(draft({ kind: "album", media: Array(11).fill(JPEG) }), NOW)).toContain("albumCount");
        expect(composerProblems(draft({ kind: "album", media: [JPEG, JPEG] }), NOW)).toEqual([]);
        expect(composerProblems(draft({ kind: "album", media: Array(10).fill(JPEG) }), NOW)).toEqual([]);
    });

    it("refuses images Facebook does not take", () => {
        const webp = { ...JPEG, mimeType: "image/webp" };
        expect(composerProblems(draft({ kind: "photo", media: [webp] }), NOW)).toContain("photoType");
        const huge = { ...JPEG, sizeBytes: 11 * 1024 * 1024 };
        expect(composerProblems(draft({ kind: "photo", media: [huge] }), NOW)).toContain("photoTooLarge");
    });

    it("takes one mp4 for a video or a reel", () => {
        expect(composerProblems(draft({ kind: "video" }), NOW)).toContain("videoCount");
        expect(composerProblems(draft({ kind: "reel", media: [MOV] }), NOW)).toContain("videoType");
        expect(composerProblems(draft({ kind: "reel", media: [MP4] }), NOW)).toEqual([]);
        expect(composerProblems(draft({ kind: "video", media: [MP4] }), NOW)).toEqual([]);
    });

    it("takes one image or one mp4 for a story, with no text and no schedule", () => {
        expect(composerProblems(draft({ kind: "story", media: [JPEG] }), NOW)).toEqual([]);
        expect(composerProblems(draft({ kind: "story", media: [MP4] }), NOW)).toEqual([]);
        expect(composerProblems(draft({ kind: "story", media: [MOV] }), NOW)).toContain("videoType");
        expect(composerProblems(draft({ kind: "story", media: [JPEG], message: "oi" }), NOW)).toContain("storyNoText");
        expect(
            composerProblems(draft({ kind: "story", media: [JPEG], scheduledAt: new Date("2026-10-02T12:00:00Z") }), NOW),
        ).toContain("scheduleNotSchedulable");
    });

    it("reports schedule problems from the shared schedule rule", () => {
        expect(
            composerProblems(draft({ kind: "text", message: "a", scheduledAt: new Date("2026-10-01T12:05:00Z") }), NOW),
        ).toContain("scheduleTooSoon");
    });

    it("keeps a title only for videos", () => {
        expect(composerProblems(draft({ kind: "reel", media: [MP4], videoTitle: "x" }), NOW)).toContain("titleOnlyVideo");
        expect(composerProblems(draft({ kind: "video", media: [MP4], videoTitle: "x" }), NOW)).toEqual([]);
    });
});

describe("toCreatePayload", () => {
    it("sends only the fields the kind uses, with an ISO schedule", () => {
        expect(
            toCreatePayload(
                draft({ kind: "photo", message: "  Oi  ", link: "https://ignored", media: [JPEG], scheduledAt: new Date("2026-10-02T12:00:00Z") }),
            ),
        ).toEqual({
            kind: "photo",
            message: "Oi",
            media: [JPEG],
            scheduledPublishTime: "2026-10-02T12:00:00.000Z",
        });
    });

    it("sends the link for a link post and the title for a video", () => {
        expect(toCreatePayload(draft({ kind: "link", link: " https://x.test ", message: "" }))).toEqual({
            kind: "link",
            link: "https://x.test",
        });
        expect(toCreatePayload(draft({ kind: "video", media: [MP4], videoTitle: " Aula " }))).toEqual({
            kind: "video",
            media: [MP4],
            videoTitle: "Aula",
        });
    });
});
