import type { CommentSource } from '@/lib/audience/types';
import type { FacebookCommentRule, FacebookCommentRulePayload } from '@/lib/facebook/types';
import type { CommentRulePayload, InstagramCommentRule, InstagramCommentRuleAction } from '@/lib/instagram/types';

export type CommentRuleMatch = 'any' | 'contains' | 'exact';

export type CommentRuleAction = 'public_reply' | 'private_reply' | 'hide' | 'delete' | 'like';

export const INSTAGRAM_RULE_ACTIONS: readonly InstagramCommentRuleAction[] = ['public_reply', 'private_reply', 'hide'];

export const FACEBOOK_RULE_ACTIONS: readonly CommentRuleAction[] = ['public_reply', 'private_reply', 'hide', 'delete', 'like'];

export function ruleActionsFor(source: CommentSource): readonly CommentRuleAction[] {
    return source === 'facebook' ? FACEBOOK_RULE_ACTIONS : INSTAGRAM_RULE_ACTIONS;
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

export interface CommentRuleFieldsValue {
    match: CommentRuleMatch;
    keywords: string;
    actions: CommentRuleAction[];
    publicText: string;
    privateText: string;
}

export function commentRuleFieldsErrors(value: CommentRuleFieldsValue) {
    const keywordList = value.keywords
        .split(',')
        .map((k) => k.trim())
        .filter(Boolean);

    const needsKeywords = value.match !== 'any' && keywordList.length === 0;
    const needsPublicText = value.actions.includes('public_reply') && !value.publicText.trim();
    const needsPrivateText = value.actions.includes('private_reply') && !value.privateText.trim();

    return {
        keywordList,
        needsKeywords,
        needsPublicText,
        needsPrivateText,
        valid: value.actions.length > 0 && !needsKeywords && !needsPublicText && !needsPrivateText,
    };
}
