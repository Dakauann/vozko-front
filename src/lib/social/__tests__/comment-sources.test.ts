import { beforeEach, describe, expect, it, vi } from "vitest";

const facebook = vi.hoisted(() => ({
    replyFacebookCommentAction: vi.fn(async () => ({})),
    privateReplyFacebookCommentAction: vi.fn(async () => ({})),
    hideFacebookCommentAction: vi.fn(async () => ({})),
    deleteFacebookCommentAction: vi.fn(async () => ({})),
    likeFacebookCommentAction: vi.fn(async () => ({})),
    editFacebookCommentAction: vi.fn(async () => ({})),
    createFacebookCommentRuleAction: vi.fn(),
    deleteFacebookCommentRuleAction: vi.fn(),
    listFacebookCommentRulesAction: vi.fn(),
    updateFacebookCommentRuleAction: vi.fn(),
}));

const instagram = vi.hoisted(() => ({
    replyInstagramCommentAction: vi.fn(async () => ({})),
    privateReplyInstagramCommentAction: vi.fn(async () => ({})),
    hideInstagramCommentAction: vi.fn(async () => ({})),
    deleteInstagramCommentAction: vi.fn(async () => ({})),
    instagramAvatarUrl: vi.fn((accountId: string) => `/avatar/${accountId}`),
    createCommentRuleAction: vi.fn(),
    deleteCommentRuleAction: vi.fn(),
    listCommentRulesAction: vi.fn(),
    updateCommentRuleAction: vi.fn(),
}));

const mercadolivre = vi.hoisted(() => ({
    answerMercadoLivreQuestionAction: vi.fn(async (): Promise<object> => ({ question: { id: "row-1" } })),
    deleteMercadoLivreQuestionAction: vi.fn(async (): Promise<object> => ({ status: "deleted" })),
    listMercadoLivreCommentRulesAction: vi.fn(),
    createMercadoLivreCommentRuleAction: vi.fn(),
    updateMercadoLivreCommentRuleAction: vi.fn(),
    deleteMercadoLivreCommentRuleAction: vi.fn(),
}));

vi.mock("@/app/actions/facebook", () => facebook);
vi.mock("@/app/actions/instagram", () => instagram);
vi.mock("@/app/actions/mercadolivre", () => mercadolivre);

const tiktok = vi.hoisted(() => ({
    replyTiktokCommentAction: vi.fn(async (): Promise<object> => ({ comment: { commentId: "c-1" } })),
    setTiktokCommentHiddenAction: vi.fn(async (): Promise<object> => ({})),
    setTiktokCommentLikedAction: vi.fn(async (): Promise<object> => ({})),
    listTiktokCommentRulesAction: vi.fn(),
    createTiktokCommentRuleAction: vi.fn(),
    updateTiktokCommentRuleAction: vi.fn(),
    deleteTiktokCommentRuleAction: vi.fn(),
    listTiktokAccountsAction: vi.fn(),
    listTiktokVideosAction: vi.fn(),
}));

vi.mock("@/app/actions/tiktok", () => tiktok);

import type { CommentSource } from "@/lib/audience/types";
import { commentAccountAvatar, commentActionsFor, mercadoLivreRuleApi } from "@/lib/social/comment-sources";

const unknownSource = "fax" as unknown as CommentSource;

beforeEach(() => {
    vi.clearAllMocks();
});

describe("commentActionsFor", () => {
    it("moderates a Facebook comment through the Facebook page endpoints", async () => {
        const actions = commentActionsFor("facebook", "page-1");
        await actions?.reply("c-1", "oi");
        expect(facebook.replyFacebookCommentAction).toHaveBeenCalledWith("page-1", "c-1", "oi");
        expect(instagram.replyInstagramCommentAction).not.toHaveBeenCalled();
        expect(actions?.setLiked).toBeDefined();
    });

    it("moderates an Instagram comment through the Instagram account endpoints", async () => {
        const actions = commentActionsFor("instagram", "ig-1");
        await actions?.reply("c-1", "oi");
        expect(instagram.replyInstagramCommentAction).toHaveBeenCalledWith("ig-1", "c-1", "oi");
        expect(facebook.replyFacebookCommentAction).not.toHaveBeenCalled();
    });

    it("answers a Mercado Livre question for good and deletes it, through the account endpoints only", async () => {
        const actions = commentActionsFor("mercadolivre", "ml-1");
        expect(await actions?.reply("987", "Temos sim")).toEqual({});
        expect(mercadolivre.answerMercadoLivreQuestionAction).toHaveBeenCalledWith("ml-1", "987", "Temos sim");
        expect(await actions?.remove("987")).toEqual({});
        expect(mercadolivre.deleteMercadoLivreQuestionAction).toHaveBeenCalledWith("ml-1", "987");
        expect(facebook.replyFacebookCommentAction).not.toHaveBeenCalled();
        expect(instagram.replyInstagramCommentAction).not.toHaveBeenCalled();
    });

    it("offers no private reply, hide, like or edit on a Mercado Livre question", () => {
        const actions = commentActionsFor("mercadolivre", "ml-1");
        expect(actions?.privateReply).toBeUndefined();
        expect(actions?.setHidden).toBeUndefined();
        expect(actions?.setLiked).toBeUndefined();
        expect(actions?.edit).toBeUndefined();
    });

    it("passes the Mercado Livre refusal code on", async () => {
        mercadolivre.answerMercadoLivreQuestionAction.mockResolvedValueOnce({ error: "closed", code: "question_not_open", status: 409 });
        expect(await commentActionsFor("mercadolivre", "ml-1")?.reply("987", "oi")).toEqual({ error: "closed", code: "question_not_open" });
    });

    it("replies to, hides and likes a TikTok comment through the TikTok account endpoints only", async () => {
        const actions = commentActionsFor("tiktok", "tt-1");
        expect(await actions?.reply("c-1", "Oi")).toEqual({});
        expect(tiktok.replyTiktokCommentAction).toHaveBeenCalledWith("tt-1", "c-1", "Oi");
        expect(await actions?.setHidden?.("c-1", true)).toEqual({});
        expect(tiktok.setTiktokCommentHiddenAction).toHaveBeenCalledWith("tt-1", "c-1", true);
        expect(await actions?.setLiked?.("c-1", true)).toEqual({});
        expect(tiktok.setTiktokCommentLikedAction).toHaveBeenCalledWith("tt-1", "c-1", true);
        expect(actions?.privateReply).toBeUndefined();
        expect(instagram.replyInstagramCommentAction).not.toHaveBeenCalled();
        expect(facebook.replyFacebookCommentAction).not.toHaveBeenCalled();
    });

    it("offers no actions for a source it does not know, instead of calling another channel", () => {
        expect(commentActionsFor(unknownSource, "acc-1")).toBeNull();
    });
});

describe("commentAccountAvatar", () => {
    it("serves the Instagram avatar through the authenticated proxy", () => {
        expect(commentAccountAvatar("instagram", "ig-1")).toEqual({ url: "/avatar/ig-1", authenticated: true });
    });

    it("has no avatar url for a Facebook page", () => {
        expect(commentAccountAvatar("facebook", "page-1")).toEqual({ authenticated: false });
    });

    it("has no avatar url for a Mercado Livre account", () => {
        expect(commentAccountAvatar("mercadolivre", "ml-1")).toEqual({ authenticated: false });
    });

    it("has no avatar url for a TikTok account", () => {
        expect(commentAccountAvatar("tiktok", "tt-1")).toEqual({ authenticated: false });
    });

    it("shows no avatar for a source it does not know", () => {
        expect(commentAccountAvatar(unknownSource, "acc-1")).toEqual({ authenticated: false });
        expect(instagram.instagramAvatarUrl).not.toHaveBeenCalled();
    });
});

describe("mercadoLivreRuleApi", () => {
    it("maps the shared rule draft to the account rule endpoints", async () => {
        mercadolivre.listMercadoLivreCommentRulesAction.mockResolvedValue({
            rules: [{ id: "r-1", name: "Frete", enabled: true, containerId: "MLB1", match: "any", keywords: [], actions: ["delete"], priority: 0 }],
        });
        const api = mercadoLivreRuleApi("ml-1");
        expect((await api.list()).rules.map((rule) => rule.containerId)).toEqual(["MLB1"]);

        mercadolivre.createMercadoLivreCommentRuleAction.mockResolvedValue({ error: "bad", code: "invalid_rule" });
        const draft = {
            name: "Frete",
            enabled: true,
            containerId: "",
            match: "any" as const,
            keywords: [],
            actions: ["public_reply" as const, "private_reply" as const],
            publicReplyText: "Oi",
            privateReplyText: "",
            priority: 0,
        };
        expect(await api.create(draft)).toEqual({ error: "bad" });
        expect(mercadolivre.createMercadoLivreCommentRuleAction).toHaveBeenCalledWith("ml-1", expect.objectContaining({ actions: ["public_reply"] }));

        mercadolivre.deleteMercadoLivreCommentRuleAction.mockResolvedValue({ status: "deleted" });
        expect(await api.remove("r-1")).toEqual({});
        expect(mercadolivre.deleteMercadoLivreCommentRuleAction).toHaveBeenCalledWith("ml-1", "r-1");
    });
});
