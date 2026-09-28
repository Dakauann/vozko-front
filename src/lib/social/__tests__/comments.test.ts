import { describe, expect, it } from "vitest";

import {
    PRIVATE_REPLY_WINDOW_MS,
    fromFacebookComment,
    fromInstagramComment,
    privateReplyError,
    privateReplyOpen,
    threadFacebookComments,
    type SocialComment,
} from "@/lib/social/comments";
import type { FacebookComment } from "@/lib/facebook/types";
import type { InstagramComment } from "@/lib/instagram/types";

const NOW = new Date("2026-10-01T12:00:00Z").getTime();

function igComment(overrides: Partial<InstagramComment> = {}): InstagramComment {
    return {
        id: "ig-1",
        text: "Quanto custa?",
        timestamp: "2026-09-30T12:00:00Z",
        fromUsername: "maria",
        likeCount: 2,
        hidden: false,
        isOurs: false,
        canDelete: true,
        ...overrides,
    };
}

function fbComment(overrides: Partial<FacebookComment> = {}): FacebookComment {
    return {
        id: "fb-1",
        message: "Tem em azul?",
        createdTime: "2026-09-30T12:00:00Z",
        from: { id: "psid-1", name: "Maria", isPage: false, contactId: "contact-1" },
        likeCount: 1,
        replyCount: 0,
        isHidden: false,
        isOurs: false,
        likedByPage: false,
        canHide: true,
        canRemove: false,
        canReplyPrivately: true,
        canLike: true,
        canEdit: false,
        privateReply: { status: "NONE", deadline: "2026-10-07T12:00:00Z" },
        ...overrides,
    };
}

function social(overrides: Partial<SocialComment> = {}): SocialComment {
    return { ...fromFacebookComment(fbComment(), { canModerate: true, canComment: true, canMessage: true }), ...overrides };
}

describe("fromInstagramComment", () => {
    it("keeps Instagram's moderation rules: account level hide, per comment delete, no like or edit", () => {
        const mapped = fromInstagramComment(igComment({ replies: [igComment({ id: "ig-2", isOurs: true })] }), true);
        expect(mapped).toMatchObject({
            id: "ig-1",
            author: "maria",
            text: "Quanto custa?",
            createdAt: "2026-09-30T12:00:00Z",
            hidden: false,
            canHide: true,
            canRemove: true,
            canReply: true,
            canReplyPrivately: true,
            canLike: false,
            canEdit: false,
        });
        expect(mapped.replies[0]).toMatchObject({ id: "ig-2", isOurs: true, canReplyPrivately: false });
    });

    it("grants nothing when the account cannot moderate", () => {
        const mapped = fromInstagramComment(igComment(), false);
        expect(mapped.canHide).toBe(false);
        expect(mapped.canRemove).toBe(false);
        expect(mapped.canReply).toBe(false);
        expect(mapped.canReplyPrivately).toBe(false);
    });
});

describe("fromFacebookComment", () => {
    it("takes every flag from the comment and the page capabilities", () => {
        expect(fromFacebookComment(fbComment(), { canModerate: true, canComment: true, canMessage: true })).toMatchObject({
            id: "fb-1",
            author: "Maria",
            text: "Tem em azul?",
            canHide: true,
            canRemove: false,
            canReply: true,
            canReplyPrivately: true,
            canLike: true,
            canEdit: false,
            privateReplyDeadline: "2026-10-07T12:00:00Z",
        });
    });

    it("drops what the page capability does not allow", () => {
        const mapped = fromFacebookComment(fbComment(), { canModerate: false, canComment: false, canMessage: false });
        expect(mapped.canHide).toBe(false);
        expect(mapped.canLike).toBe(false);
        expect(mapped.canRemove).toBe(false);
        expect(mapped.canReply).toBe(false);
        expect(mapped.canReplyPrivately).toBe(false);
    });

    it("shows delete for a third party comment only when Facebook allows it", () => {
        expect(fromFacebookComment(fbComment({ canRemove: true }), { canModerate: true, canComment: true, canMessage: true }).canRemove).toBe(true);
    });

    it("lets the page edit only its own comments", () => {
        const own = fromFacebookComment(fbComment({ isOurs: true, canEdit: true, from: { id: "123", name: "Loja", isPage: true } }), {
            canModerate: true,
            canComment: true,
            canMessage: true,
        });
        expect(own.canEdit).toBe(true);
        expect(own.canReplyPrivately).toBe(false);
    });

    it("keeps an author-less comment anonymous", () => {
        expect(fromFacebookComment(fbComment({ from: null }), { canModerate: true, canComment: true, canMessage: true }).author).toBeNull();
    });
});

describe("privateReplyOpen", () => {
    it("is open inside the deadline", () => {
        expect(privateReplyOpen(social(), NOW)).toBe(true);
    });

    it("closes after the deadline Facebook gave", () => {
        expect(privateReplyOpen(social({ privateReplyDeadline: "2026-10-01T11:59:59Z" }), NOW)).toBe(false);
    });

    it("falls back to seven days from the comment when no deadline is given", () => {
        const base = social({ privateReplyDeadline: undefined });
        expect(privateReplyOpen({ ...base, createdAt: new Date(NOW - PRIVATE_REPLY_WINDOW_MS + 1000).toISOString() }, NOW)).toBe(true);
        expect(privateReplyOpen({ ...base, createdAt: new Date(NOW - PRIVATE_REPLY_WINDOW_MS - 1000).toISOString() }, NOW)).toBe(false);
    });

    it("stays closed when the comment date is unknown", () => {
        expect(privateReplyOpen(social({ privateReplyDeadline: undefined, createdAt: undefined }), NOW)).toBe(false);
    });

    it("is closed once used, for our own comments, or when the platform refuses it", () => {
        expect(privateReplyOpen(social({ canReplyPrivately: false }), NOW)).toBe(false);
        expect(privateReplyOpen(social({ isOurs: true }), NOW)).toBe(false);
    });
});

describe("privateReplyError", () => {
    it("maps the shared codes and says when the reply is spent (only a used one)", () => {
        expect(privateReplyError("private_reply_used")).toEqual({ key: "privateReplyUsed", consumed: true });
        expect(privateReplyError("private_reply_expired")).toEqual({ key: "privateReplyExpired", consumed: false });
        expect(privateReplyError("private_reply_deadline_unknown")).toEqual({ key: "privateReplyDeadlineUnknown", consumed: false });
    });

    it("returns null for other codes so the server message is shown", () => {
        expect(privateReplyError("facebook_busy")).toBeNull();
        expect(privateReplyError(undefined)).toBeNull();
    });
});

describe("threadFacebookComments", () => {
    const permissions = { canModerate: true, canComment: true, canMessage: true };

    it("nests replies under the comment they answer", () => {
        const threaded = threadFacebookComments(
            [fbComment({ id: "c-1" }), fbComment({ id: "c-2", parentId: "c-1", isOurs: true }), fbComment({ id: "c-3" })],
            permissions,
        );
        expect(threaded.map((c) => c.id)).toEqual(["c-1", "c-3"]);
        expect(threaded[0].replies.map((r) => r.id)).toEqual(["c-2"]);
    });

    it("keeps a reply whose parent is on another page visible at the top", () => {
        const threaded = threadFacebookComments([fbComment({ id: "c-9", parentId: "elsewhere" })], permissions);
        expect(threaded.map((c) => c.id)).toEqual(["c-9"]);
    });
});
