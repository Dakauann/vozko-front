import type { SocialComment } from "@/lib/social/comments";
import type { TiktokComment } from "@/lib/tiktok/types";

function authorOf(comment: TiktokComment): string | null {
  if (comment.authorUsername) return `@${comment.authorUsername}`;
  return comment.authorDisplayName || null;
}

export function fromTiktokComment(comment: TiktokComment, canModerate: boolean): SocialComment {
  return {
    id: comment.commentId,
    author: authorOf(comment),
    text: comment.text,
    createdAt: comment.commentedAt,
    likeCount: comment.likes,
    hidden: comment.visibility === "hidden",
    isOurs: comment.isOurs,
    likedByPage: comment.likedByUs,
    canHide: canModerate && comment.canHide,
    canRemove: false,
    canReply: canModerate && comment.canReply,
    canReplyPrivately: false,
    canLike: canModerate && comment.canLike,
    canEdit: false,
    replies: [],
  };
}

export function threadTiktokComments(comments: TiktokComment[], canModerate: boolean): SocialComment[] {
  const shown = comments.filter((comment) => comment.visibility !== "deleted");
  const byId = new Map(shown.map((comment) => [comment.commentId, fromTiktokComment(comment, canModerate)]));
  const roots: SocialComment[] = [];
  for (const comment of shown) {
    const mapped = byId.get(comment.commentId);
    if (!mapped) continue;
    const parent = comment.parentCommentId ? byId.get(comment.parentCommentId) : undefined;
    if (parent && parent !== mapped) parent.replies.push(mapped);
    else roots.push(mapped);
  }
  return roots;
}
