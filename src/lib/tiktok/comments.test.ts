import { describe, expect, it } from "vitest";

import { fromTiktokComment, threadTiktokComments } from "@/lib/tiktok/comments";
import { tiktokComment } from "@/lib/tiktok/test-fixtures";

describe("fromTiktokComment", () => {
  it("maps a public comment with the moderation TikTok allows", () => {
    expect(fromTiktokComment(tiktokComment({ likedByUs: true }), true)).toEqual({
      id: "c-1",
      author: "@cliente",
      text: "quanto custa?",
      createdAt: "2026-10-19T12:00:00Z",
      likeCount: 3,
      hidden: false,
      isOurs: false,
      likedByPage: true,
      canHide: true,
      canRemove: false,
      canReply: true,
      canReplyPrivately: false,
      canLike: true,
      canEdit: false,
      replies: [],
    });
  });

  it("never offers a private reply, an edit or a delete", () => {
    const mapped = fromTiktokComment(tiktokComment(), true);
    expect(mapped.canReplyPrivately).toBe(false);
    expect(mapped.canRemove).toBe(false);
    expect(mapped.canEdit).toBe(false);
  });

  it("marks a hidden comment so it can be shown again", () => {
    const mapped = fromTiktokComment(tiktokComment({ visibility: "hidden" }), true);
    expect(mapped.hidden).toBe(true);
    expect(mapped.canHide).toBe(true);
  });

  it("follows what the backend allows on each comment", () => {
    const mapped = fromTiktokComment(tiktokComment({ canReply: false, canHide: false, canLike: false }), true);
    expect(mapped.canReply).toBe(false);
    expect(mapped.canHide).toBe(false);
    expect(mapped.canLike).toBe(false);
  });

  it("offers no action at all when the account cannot moderate", () => {
    const mapped = fromTiktokComment(tiktokComment(), false);
    expect(mapped.canReply).toBe(false);
    expect(mapped.canHide).toBe(false);
    expect(mapped.canLike).toBe(false);
  });

  it("falls back to the display name, and then to no author", () => {
    expect(fromTiktokComment(tiktokComment({ authorUsername: undefined }), true).author).toBe("Cliente");
    expect(fromTiktokComment(tiktokComment({ authorUsername: "", authorDisplayName: "" }), true).author).toBeNull();
  });
});

describe("threadTiktokComments", () => {
  it("nests replies under their parent comment", () => {
    const thread = threadTiktokComments(
      [
        tiktokComment({ commentId: "c-1" }),
        tiktokComment({ commentId: "r-1", kind: "reply", parentCommentId: "c-1", isOurs: true }),
        tiktokComment({ commentId: "c-2" }),
      ],
      true,
    );
    expect(thread.map((comment) => comment.id)).toEqual(["c-1", "c-2"]);
    expect(thread[0].replies.map((reply) => reply.id)).toEqual(["r-1"]);
    expect(thread[0].replies[0].isOurs).toBe(true);
  });

  it("keeps a reply whose parent is not on the page at the top", () => {
    const thread = threadTiktokComments([tiktokComment({ commentId: "r-1", kind: "reply", parentCommentId: "missing" })], true);
    expect(thread.map((comment) => comment.id)).toEqual(["r-1"]);
  });

  it("leaves deleted comments out", () => {
    const thread = threadTiktokComments(
      [tiktokComment({ commentId: "c-1", visibility: "deleted" }), tiktokComment({ commentId: "c-2" })],
      true,
    );
    expect(thread.map((comment) => comment.id)).toEqual(["c-2"]);
  });
});
