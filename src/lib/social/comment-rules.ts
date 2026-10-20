import type { CommentSource } from '@/lib/audience/types';
import { textLimitState } from '@/lib/conversations/text-limit';
import type { TextLimit } from '@/lib/conversations/types';
import { refuseUnhandled } from '@/lib/exhaustive';
import type { FacebookCommentRule, FacebookCommentRulePayload } from '@/lib/facebook/types';
import type { CommentRulePayload, InstagramCommentRule, InstagramCommentRuleAction } from '@/lib/instagram/types';
import type { MercadoLivreCommentRule, MercadoLivreCommentRulePayload } from '@/lib/mercadolivre/types';
import { TIKTOK_RULE_ACTIONS } from '@/lib/tiktok/comment-rules';

export type CommentRuleMatch = 'any' | 'contains' | 'exact';

export type CommentRuleAction = 'public_reply' | 'private_reply' | 'hide' | 'delete' | 'like';

export const INSTAGRAM_RULE_ACTIONS: readonly InstagramCommentRuleAction[] = ['public_reply', 'private_reply', 'hide'];

export const FACEBOOK_RULE_ACTIONS: readonly CommentRuleAction[] = ['public_reply', 'private_reply', 'hide', 'delete', 'like'];

export const MERCADOLIVRE_RULE_ACTIONS: readonly CommentRuleAction[] = ['public_reply', 'delete'];

const NO_RULE_ACTIONS: readonly CommentRuleAction[] = [];

export function defaultRuleActions(allowed: readonly CommentRuleAction[]): CommentRuleAction[] {
    if (allowed.includes('private_reply')) return ['private_reply'];
    return allowed.length > 0 ? [allowed[0]] : [];
}

export function ruleActionsFor(source: CommentSource): readonly CommentRuleAction[] {
    switch (source) {
        case 'facebook':
            return FACEBOOK_RULE_ACTIONS;
        case 'instagram':
            return INSTAGRAM_RULE_ACTIONS;
        case 'mercadolivre':
            return MERCADOLIVRE_RULE_ACTIONS;
        case 'tiktok':
            return TIKTOK_RULE_ACTIONS;
        default:
            return refuseUnhandled(source, NO_RULE_ACTIONS);
    }
}

export interface CommentRule {
    id: string;
    name: string;
    enabled: boolean;
    containerId?: string;
    match: CommentRuleMatch;
    keywords: string[];
    actions: CommentRuleAction[];
    publicReplyText?: string;
    privateReplyText?: string;
    priority: number;
}

export interface CommentRuleDraft {
    name: string;
    enabled: boolean;
    containerId: string;
    match: CommentRuleMatch;
    keywords: string[];
    actions: CommentRuleAction[];
    publicReplyText: string;
    privateReplyText: string;
    priority: number;
}

export interface CommentRuleApi {
    list: () => Promise<{ rules: CommentRule[]; error?: string }>;
    create: (draft: CommentRuleDraft) => Promise<{ rule?: CommentRule; error?: string }>;
    update: (ruleId: string, draft: CommentRuleDraft) => Promise<{ rule?: CommentRule; error?: string }>;
    remove: (ruleId: string) => Promise<{ error?: string }>;
}

export function toDraft(rule: CommentRule): CommentRuleDraft {
    return {
        name: rule.name,
        enabled: rule.enabled,
        containerId: rule.containerId ?? '',
        match: rule.match,
        keywords: rule.keywords,
        actions: rule.actions,
        publicReplyText: rule.publicReplyText ?? '',
        privateReplyText: rule.privateReplyText ?? '',
        priority: rule.priority,
    };
}

export function fromInstagramRule(rule: InstagramCommentRule): CommentRule {
    return {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        containerId: rule.igMediaId,
        match: rule.match,
        keywords: rule.keywords,
        actions: rule.actions,
        publicReplyText: rule.publicReplyText,
        privateReplyText: rule.privateReplyText,
        priority: rule.priority,
    };
}

function isInstagramAction(action: CommentRuleAction): action is InstagramCommentRuleAction {
    return (INSTAGRAM_RULE_ACTIONS as readonly string[]).includes(action);
}

export function toInstagramRulePayload(draft: CommentRuleDraft): CommentRulePayload {
    return {
        name: draft.name,
        enabled: draft.enabled,
        igMediaId: draft.containerId,
        match: draft.match,
        keywords: draft.keywords,
        actions: draft.actions.filter(isInstagramAction),
        publicReplyText: draft.publicReplyText,
        privateReplyText: draft.privateReplyText,
        priority: draft.priority,
    };
}

export function fromFacebookRule(rule: FacebookCommentRule): CommentRule {
    return {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        containerId: rule.postId,
        match: rule.match,
        keywords: rule.keywords,
        actions: rule.actions,
        publicReplyText: rule.publicReplyText,
        privateReplyText: rule.privateReplyText,
        priority: rule.priority,
    };
}

export function toFacebookRulePayload(draft: CommentRuleDraft): FacebookCommentRulePayload {
    return {
        name: draft.name,
        enabled: draft.enabled,
        postId: draft.containerId,
        match: draft.match,
        keywords: draft.keywords,
        actions: draft.actions,
        publicReplyText: draft.publicReplyText,
        privateReplyText: draft.privateReplyText,
        priority: draft.priority,
    };
}

export function fromMercadoLivreRule(rule: MercadoLivreCommentRule): CommentRule {
    return {
        id: rule.id,
        name: rule.name,
        enabled: rule.enabled,
        containerId: rule.containerId,
        match: rule.match,
        keywords: rule.keywords,
        actions: rule.actions,
        publicReplyText: rule.publicReplyText,
        privateReplyText: rule.privateReplyText,
        priority: rule.priority,
    };
}

type MercadoLivreRuleAction = MercadoLivreCommentRulePayload['actions'][number];

function isMercadoLivreAction(action: CommentRuleAction): action is MercadoLivreRuleAction {
    return (MERCADOLIVRE_RULE_ACTIONS as readonly string[]).includes(action);
}

export function toMercadoLivreRulePayload(draft: CommentRuleDraft): MercadoLivreCommentRulePayload {
    return {
        name: draft.name,
        enabled: draft.enabled,
        containerId: draft.containerId,
        match: draft.match,
        keywords: draft.keywords,
        actions: draft.actions.filter(isMercadoLivreAction),
        publicReplyText: draft.publicReplyText,
        privateReplyText: '',
        priority: draft.priority,
    };
}

export interface CommentRuleTextLimits {
    publicText?: TextLimit;
}

export interface CommentRuleFieldsValue {
    match: CommentRuleMatch;
    keywords: string;
    actions: CommentRuleAction[];
    publicText: string;
    privateText: string;
}

export function commentRuleFieldsErrors(value: CommentRuleFieldsValue, limits: CommentRuleTextLimits = {}) {
    const keywordList = value.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

    const needsKeywords = value.match !== 'any' && keywordList.length === 0;
    const needsPublicText = value.actions.includes('public_reply') && !value.publicText.trim();
    const needsPrivateText = value.actions.includes('private_reply') && !value.privateText.trim();
    const publicTooLong =
        value.actions.includes('public_reply') && limits.publicText !== undefined && (textLimitState(value.publicText.trim(), limits.publicText)?.refused ?? true);

    return {
        keywordList,
        needsKeywords,
        needsPublicText,
        needsPrivateText,
        publicTooLong,
        valid: value.actions.length > 0 && !needsKeywords && !needsPublicText && !needsPrivateText && !publicTooLong,
    };
}
