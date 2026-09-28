import {
    createFacebookCommentRuleAction,
    deleteFacebookCommentAction,
    deleteFacebookCommentRuleAction,
    editFacebookCommentAction,
    hideFacebookCommentAction,
    likeFacebookCommentAction,
    listFacebookCommentRulesAction,
    privateReplyFacebookCommentAction,
    replyFacebookCommentAction,
    updateFacebookCommentRuleAction,
} from '@/app/actions/facebook';
import {
    createCommentRuleAction,
    deleteCommentRuleAction,
    deleteInstagramCommentAction,
    hideInstagramCommentAction,
    instagramAvatarUrl,
    listCommentRulesAction,
    privateReplyInstagramCommentAction,
    replyInstagramCommentAction,
    updateCommentRuleAction,
} from '@/app/actions/instagram';
import type { CommentSource } from '@/lib/audience/types';
import {
    fromFacebookRule,
    fromInstagramRule,
    toFacebookRulePayload,
    toInstagramRulePayload,
    type CommentRuleApi,
} from '@/lib/social/comment-rules';
import type { CommentActionResult, CommentThreadActions } from '@/lib/social/comments';

export function instagramCommentActions(accountId: string): CommentThreadActions {
    return {
        reply: (id, text) => replyInstagramCommentAction(accountId, id, text),
        privateReply: (id, text) => privateReplyInstagramCommentAction(accountId, id, text),
        setHidden: (id, hidden) => hideInstagramCommentAction(accountId, id, hidden),
        remove: (id) => deleteInstagramCommentAction(accountId, id),
    };
}

async function settled(pending: Promise<object>): Promise<CommentActionResult> {
    const result = await pending;
    if ('error' in result && typeof result.error === 'string') {
        return { error: result.error, code: 'code' in result ? (result.code as string | undefined) : undefined };
    }
    return {};
}

export function facebookCommentActions(pageId: string): CommentThreadActions {
    return {
        reply: (id, text) => settled(replyFacebookCommentAction(pageId, id, text)),
        privateReply: (id, text) => settled(privateReplyFacebookCommentAction(pageId, id, text)),
        setHidden: (id, hidden) => settled(hideFacebookCommentAction(pageId, id, hidden)),
        remove: (id) => settled(deleteFacebookCommentAction(pageId, id)),
        setLiked: (id, liked) => settled(likeFacebookCommentAction(pageId, id, liked)),
        edit: (id, text) => settled(editFacebookCommentAction(pageId, id, text)),
    };
}

export function commentActionsFor(source: CommentSource, accountId: string): CommentThreadActions {
    return source === 'facebook' ? facebookCommentActions(accountId) : instagramCommentActions(accountId);
}

export function commentAccountAvatar(source: CommentSource, accountId: string): { url?: string; authenticated: boolean } {
    return source === 'instagram' ? { url: instagramAvatarUrl(accountId), authenticated: true } : { authenticated: false };
}

export function instagramRuleApi(accountId: string): CommentRuleApi {
    return {
        list: async () => {
            const result = await listCommentRulesAction(accountId);
            return { rules: result.rules.map(fromInstagramRule), error: result.error };
        },
        create: async (draft) => {
            const result = await createCommentRuleAction(accountId, toInstagramRulePayload(draft));
            return { rule: result.rule ? fromInstagramRule(result.rule) : undefined, error: result.error };
        },
        update: async (ruleId, draft) => {
            const result = await updateCommentRuleAction(accountId, ruleId, toInstagramRulePayload(draft));
            return { rule: result.rule ? fromInstagramRule(result.rule) : undefined, error: result.error };
        },
        remove: (ruleId) => deleteCommentRuleAction(accountId, ruleId),
    };
}

export function facebookRuleApi(pageId: string): CommentRuleApi {
    return {
        list: async () => {
            const result = await listFacebookCommentRulesAction(pageId);
            return { rules: result.rules.map(fromFacebookRule), error: 'error' in result ? result.error : undefined };
        },
        create: async (draft) => {
            const result = await createFacebookCommentRuleAction(pageId, toFacebookRulePayload(draft));
            if ('error' in result) return { error: result.error };
            return { rule: result.rule ? fromFacebookRule(result.rule) : undefined };
        },
        update: async (ruleId, draft) => {
            const result = await updateFacebookCommentRuleAction(pageId, ruleId, toFacebookRulePayload(draft));
            if ('error' in result) return { error: result.error };
            return { rule: result.rule ? fromFacebookRule(result.rule) : undefined };
        },
        remove: async (ruleId) => {
            const result = await deleteFacebookCommentRuleAction(pageId, ruleId);
            return 'error' in result ? { error: result.error } : {};
        },
    };
}
