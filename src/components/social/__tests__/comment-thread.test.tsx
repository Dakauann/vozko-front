import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { describe, expect, it, vi } from "vitest";

import ptMessages from "@/i18n/messages/pt.json";
import { CommentThread } from "@/components/social/comment-thread";
import type { CommentThreadActions, SocialComment } from "@/lib/social/comments";

const labels = ptMessages.facebook.comments;

function comment(overrides: Partial<SocialComment> = {}): SocialComment {
    return {
        id: "c-1",
        author: "Maria",
        text: "Tem em azul?",
        createdAt: new Date(Date.now() - 60_000).toISOString(),
        likeCount: 0,
        hidden: false,
        isOurs: false,
        likedByPage: false,
        canHide: true,
        canRemove: false,
        canReply: true,
        canReplyPrivately: true,
        canLike: true,
        canEdit: false,
        privateReplyDeadline: new Date(Date.now() + 86_400_000).toISOString(),
        replies: [],
        ...overrides,
    };
}

function actions(overrides: Partial<CommentThreadActions> = {}): CommentThreadActions {
    return {
        reply: vi.fn(async () => ({})),
        privateReply: vi.fn(async () => ({})),
        setHidden: vi.fn(async () => ({})),
        remove: vi.fn(async () => ({})),
        setLiked: vi.fn(async () => ({})),
        edit: vi.fn(async () => ({})),
        ...overrides,
    };
}

function renderThread(comments: SocialComment[], threadActions = actions()) {
    render(
        <NextIntlClientProvider locale="pt" messages={ptMessages}>
            <CommentThread
                comments={comments}
                actions={threadActions}
                translationNamespace="facebook.comments"
                loading={false}
                hasNext={false}
                loadingMore={false}
                onLoadMore={() => undefined}
                onChanged={() => undefined}
            />
        </NextIntlClientProvider>,
    );
    return threadActions;
}

describe("CommentThread", () => {
    it("offers a private reply inside the deadline and hides it once sent", async () => {
        const threadActions = renderThread([comment()]);

        fireEvent.click(screen.getByRole("button", { name: labels.privateReply }));
        fireEvent.change(screen.getByPlaceholderText(labels.privateReplyPlaceholder), { target: { value: "Oi Maria" } });
        fireEvent.click(screen.getByRole("button", { name: labels.send }));

        await waitFor(() => expect(threadActions.privateReply).toHaveBeenCalledWith("c-1", "Oi Maria"));
        await waitFor(() => expect(screen.queryByRole("button", { name: labels.privateReply })).toBeNull());
    });

    it("hides the private reply past the deadline", () => {
        renderThread([comment({ privateReplyDeadline: new Date(Date.now() - 1000).toISOString() })]);
        expect(screen.queryByRole("button", { name: labels.privateReply })).toBeNull();
    });

    it("hides the private reply and shows the reason when it was already used", async () => {
        renderThread([comment()], actions({ privateReply: vi.fn(async () => ({ error: "used", code: "private_reply_used" })) }));

        fireEvent.click(screen.getByRole("button", { name: labels.privateReply }));
        fireEvent.change(screen.getByPlaceholderText(labels.privateReplyPlaceholder), { target: { value: "Oi" } });
        fireEvent.click(screen.getByRole("button", { name: labels.send }));

        expect(await screen.findByText(labels.privateReplyUsed)).toBeTruthy();
        expect(screen.queryByRole("button", { name: labels.privateReply })).toBeNull();
    });

    it("shows delete for a third party comment only when it can be removed", () => {
        renderThread([comment({ id: "a", canRemove: false }), comment({ id: "b", author: "João", canRemove: true })]);
        expect(screen.getAllByRole("button", { name: labels.delete })).toHaveLength(1);
    });

    it("offers edit only on the page's own comments", () => {
        renderThread([comment({ id: "a" }), comment({ id: "b", isOurs: true, canEdit: true, canReplyPrivately: false })]);
        expect(screen.getAllByRole("button", { name: labels.edit })).toHaveLength(1);
    });

    it("shows the server message when an action fails, never a silent success", async () => {
        renderThread([comment()], actions({ setHidden: vi.fn(async () => ({ error: "Facebook recusou" })) }));
        fireEvent.click(screen.getByRole("button", { name: labels.hide }));
        expect(await screen.findByText("Facebook recusou")).toBeTruthy();
    });
});
