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
import {
    answerMercadoLivreQuestionAction,
    createMercadoLivreCommentRuleAction,
    deleteMercadoLivreCommentRuleAction,
    deleteMercadoLivreQuestionAction,
    listMercadoLivreCommentRulesAction,
    updateMercadoLivreCommentRuleAction,
} from '@/app/actions/mercadolivre';
import type { CommentSource } from '@/lib/audience/types';
import { refuseUnhandled } from '@/lib/exhaustive';
import {
    fromFacebookRule,
    fromInstagramRule,
    fromMercadoLivreRule,
    toFacebookRulePayload,
    toInstagramRulePayload,
    toMercadoLivreRulePayload,
    type CommentRuleApi,
} from '@/lib/social/comment-rules';
import type { CommentActionResult, CommentThreadActions } from '@/lib/social/comments';
import { tiktokCommentActions } from '@/lib/tiktok/sources';

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

export function mercadoLivreCommentActions(accountId: string): CommentThreadActions {
    return {
        reply: (questionId, text) => settled(answerMercadoLivreQuestionAction(accountId, questionId, text)),
        remove: (questionId) => settled(deleteMercadoLivreQuestionAction(accountId, questionId)),
    };
}

export function commentActionsFor(source: CommentSource, accountId: string): CommentThreadActions | null {
    switch (source) {
        case 'facebook':
            return facebookCommentActions(accountId);
        case 'instagram':
            return instagramCommentActions(accountId);
        case 'mercadolivre':
            return mercadoLivreCommentActions(accountId);
        case 'tiktok':
            return tiktokCommentActions(accountId);
        default:
            return refuseUnhandled(source, null);
    }
}

export function commentAccountAvatar(source: CommentSource, accountId: string): { url?: string; authenticated: boolean } {
    switch (source) {
        case 'instagram':
            return { url: instagramAvatarUrl(accountId), authenticated: true };
        case 'facebook':
        case 'mercadolivre':
        case 'tiktok':
            return { authenticated: false };
        default:
            return refuseUnhandled(source, { authenticated: false });
    }
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

export function mercadoLivreRuleApi(accountId: string): CommentRuleApi {
    return {
        list: async () => {
            const result = await listMercadoLivreCommentRulesAction(accountId);
            return { rules: result.rules.map(fromMercadoLivreRule), error: result.error };
        },
        create: async (draft) => {
            const result = await createMercadoLivreCommentRuleAction(accountId, toMercadoLivreRulePayload(draft));
            if ('error' in result) return { error: result.error };
            return { rule: fromMercadoLivreRule(result.rule) };
        },
        update: async (ruleId, draft) => {
            const result = await updateMercadoLivreCommentRuleAction(accountId, ruleId, toMercadoLivreRulePayload(draft));
            if ('error' in result) return { error: result.error };
            return { rule: fromMercadoLivreRule(result.rule) };
        },
        remove: async (ruleId) => {
            const result = await deleteMercadoLivreCommentRuleAction(accountId, ruleId);
            return 'error' in result ? { error: result.error } : {};
        },
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
