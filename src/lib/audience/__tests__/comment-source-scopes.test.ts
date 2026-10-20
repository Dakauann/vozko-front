import { beforeEach, describe, expect, it, vi } from "vitest";

const instagram = vi.hoisted(() => ({
    listInstagramAccountsAction: vi.fn(),
    listInstagramMediaAction: vi.fn(),
}));

const facebook = vi.hoisted(() => ({
    listFacebookPagesAction: vi.fn(),
    listFacebookPostsAction: vi.fn(),
}));

const tiktok = vi.hoisted(() => ({
    listTiktokAccountsAction: vi.fn(),
    listTiktokVideosAction: vi.fn(),
}));

vi.mock("@/app/actions/instagram", () => instagram);
vi.mock("@/app/actions/facebook", () => facebook);
vi.mock("@/app/actions/tiktok", () => tiktok);

import { ANALYSABLE_COMMENT_SOURCES } from "@/lib/audience/types";
import { COMMENT_SOURCE_SCOPES, loadScopeAccounts, readableCommentSources } from "@/lib/audience/comment-source-scopes";
import type { ResourceAction, ResourceType } from "@/lib/workspace/types";

beforeEach(() => {
    vi.clearAllMocks();
    instagram.listInstagramAccountsAction.mockResolvedValue({ accounts: [{ id: "ig-1", username: "loja" }] });
    instagram.listInstagramMediaAction.mockResolvedValue({
        page: { items: [{ id: "m-1", caption: "Promo", timestamp: "2026-10-01T10:00:00Z" }], hasNext: false },
    });
    facebook.listFacebookPagesAction.mockResolvedValue({ pages: [{ id: "page-1", name: "Loja" }] });
    facebook.listFacebookPostsAction.mockResolvedValue({
        list: { items: [{ id: "p-1", message: "", story: "Atualizou a capa", createdTime: "2026-10-02T10:00:00Z" }] },
    });
});

function allowing(...granted: ResourceType[]) {
    return (resource: ResourceType, action: ResourceAction) => action === "read" && granted.includes(resource);
}

describe("comment source scopes", () => {
    it("has one entry per analysable comment source", () => {
        expect(Object.keys(COMMENT_SOURCE_SCOPES).sort()).toEqual([...ANALYSABLE_COMMENT_SOURCES].sort());
    });

    it("links each source to its own account page", () => {
        expect(COMMENT_SOURCE_SCOPES.instagram.accountsPage).toBe("/dashboard/instagram-accounts");
        expect(COMMENT_SOURCE_SCOPES.facebook.accountsPage).toBe("/dashboard/facebook-pages");
        expect(COMMENT_SOURCE_SCOPES.tiktok.accountsPage).toBe("/dashboard/tiktok-accounts");
        expect(COMMENT_SOURCE_SCOPES.tiktok.readResource).toBe("tiktok_accounts");
    });

    it("loads Facebook posts from the page and Instagram media from the account", async () => {
        await expect(COMMENT_SOURCE_SCOPES.facebook.loadPosts("page-1")).resolves.toEqual([
            { id: "p-1", text: "Atualizou a capa", timestamp: "2026-10-02T10:00:00Z" },
        ]);
        expect(facebook.listFacebookPostsAction).toHaveBeenCalledWith("page-1", "published", undefined, 50);
        expect(instagram.listInstagramMediaAction).not.toHaveBeenCalled();

        await expect(COMMENT_SOURCE_SCOPES.instagram.loadPosts("ig-1")).resolves.toEqual([
            { id: "m-1", text: "Promo", timestamp: "2026-10-01T10:00:00Z" },
        ]);
        expect(instagram.listInstagramMediaAction).toHaveBeenCalledWith("ig-1", undefined, 50);
    });
});

describe("readableCommentSources", () => {
    it("keeps only the sources whose accounts the member may read", () => {
        expect(readableCommentSources(allowing("instagram_accounts", "facebook_pages"))).toEqual(["instagram", "facebook"]);
        expect(readableCommentSources(allowing("facebook_pages"))).toEqual(["facebook"]);
        expect(readableCommentSources(allowing())).toEqual([]);
    });
});

describe("loadScopeAccounts", () => {
    it("lists the accounts of every readable source, each tagged with its source", async () => {
        await expect(loadScopeAccounts(["instagram", "facebook"])).resolves.toEqual({
            accounts: [
                { id: "ig-1", source: "instagram", label: "@loja" },
                { id: "page-1", source: "facebook", label: "Loja" },
            ],
            error: undefined,
        });
    });

    it("never asks a source the member may not read", async () => {
        await loadScopeAccounts(["instagram"]);
        expect(facebook.listFacebookPagesAction).not.toHaveBeenCalled();
    });

    it("reports the first failure and keeps the accounts that did load", async () => {
        facebook.listFacebookPagesAction.mockResolvedValue({ pages: [], error: "Sem acesso" });
        await expect(loadScopeAccounts(["instagram", "facebook"])).resolves.toEqual({
            accounts: [{ id: "ig-1", source: "instagram", label: "@loja" }],
            error: "Sem acesso",
        });
    });
});
