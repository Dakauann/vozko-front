import type { FacebookComment } from '@/lib/facebook/types';
import type { InstagramComment } from '@/lib/instagram/types';

export const PRIVATE_REPLY_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

export interface SocialComment {
    id: string;
    author: string | null;
    text: string;
    createdAt?: string;
    likeCount: number;
    hidden: boolean;
    isOurs: boolean;
    likedByPage: boolean;
    canHide: boolean;
    canRemove: boolean;
    canReply: boolean;
    canReplyPrivately: boolean;
    canLike: boolean;
    canEdit: boolean;
    privateReplyDeadline?: string;
    replies: SocialComment[];
}

export interface CommentActionResult {
    error?: string;
    code?: string;
}

export interface CommentThreadActions {
    reply: (commentId: string, text: string) => Promise<CommentActionResult>;
    privateReply: (commentId: string, text: string) => Promise<CommentActionResult>;
    setHidden: (commentId: string, hidden: boolean) => Promise<CommentActionResult>;
    remove: (commentId: string) => Promise<CommentActionResult>;
    setLiked?: (commentId: string, liked: boolean) => Promise<CommentActionResult>;
    edit?: (commentId: string, text: string) => Promise<CommentActionResult>;
}

export function fromInstagramComment(comment: InstagramComment, canModerate: boolean): SocialComment {
    return {
        id: comment.id,
        author: comment.fromUsername || null,
        text: comment.text,
        createdAt: comment.timestamp,
        likeCount: comment.likeCount,
        hidden: comment.hidden,
        isOurs: comment.isOurs,
        likedByPage: false,
        canHide: canModerate,
        canRemove: canModerate && comment.canDelete,
        canReply: canModerate,
        canReplyPrivately: canModerate && !comment.isOurs,
        canLike: false,
        canEdit: false,
        replies: (comment.replies ?? []).map((reply) => fromInstagramComment(reply, canModerate)),
    };
}

export interface FacebookCommentPermissions {
    canModerate: boolean;
    canComment: boolean;
    canMessage: boolean;
}

export function fromFacebookComment(comment: FacebookComment, permissions: FacebookCommentPermissions): SocialComment {
    return {
        id: comment.id,
        author: comment.from?.name || null,
        text: comment.message,
        createdAt: comment.createdTime,
        likeCount: comment.likeCount,
        hidden: comment.isHidden,
        isOurs: comment.isOurs,
        likedByPage: comment.likedByPage,
        canHide: permissions.canModerate && comment.canHide,
        canRemove: permissions.canModerate && comment.canRemove,
        canReply: permissions.canComment,
        canReplyPrivately: permissions.canMessage && comment.canReplyPrivately && !comment.isOurs,
        canLike: permissions.canModerate && comment.canLike,
        canEdit: permissions.canComment && comment.isOurs && comment.canEdit,
        privateReplyDeadline: comment.privateReply.deadline,
        replies: [],
    };
}

export function threadFacebookComments(comments: FacebookComment[], permissions: FacebookCommentPermissions): SocialComment[] {
    const byId = new Map(comments.map((comment) => [comment.id, fromFacebookComment(comment, permissions)]));
    const roots: SocialComment[] = [];
    for (const comment of comments) {
        const mapped = byId.get(comment.id)!;
        const parent = comment.parentId ? byId.get(comment.parentId) : undefined;
        if (parent && parent !== mapped) {
            parent.replies.push(mapped);
        } else {
            roots.push(mapped);
        }
    }
    return roots;
}

function deadlineOf(comment: SocialComment): number | null {
    if (comment.privateReplyDeadline) {
        const deadline = Date.parse(comment.privateReplyDeadline);
        return Number.isNaN(deadline) ? null : deadline;
    }
    if (!comment.createdAt) return null;
    const created = Date.parse(comment.createdAt);
    return Number.isNaN(created) ? null : created + PRIVATE_REPLY_WINDOW_MS;
}

export function privateReplyOpen(comment: SocialComment, now: number): boolean {
    if (!comment.canReplyPrivately || comment.isOurs) return false;
    const deadline = deadlineOf(comment);
    return deadline !== null && now < deadline;
}

export type PrivateReplyErrorKey = 'privateReplyUsed' | 'privateReplyExpired' | 'privateReplyDeadlineUnknown';

export function privateReplyError(code: string | undefined): { key: PrivateReplyErrorKey; consumed: boolean } | null {
    switch (code) {
        case 'private_reply_used':
            return { key: 'privateReplyUsed', consumed: true };
        case 'private_reply_expired':
            return { key: 'privateReplyExpired', consumed: false };
        case 'private_reply_deadline_unknown':
            return { key: 'privateReplyDeadlineUnknown', consumed: false };
        default:
            return null;
    }
}
