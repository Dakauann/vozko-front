import type { CommentRule, CommentRuleAction, CommentRuleDraft, CommentRuleTextLimits } from "@/lib/social/comment-rules";
import { TIKTOK_COMMENT_REPLY_LIMIT } from "@/lib/tiktok/channel";
import type { TiktokCommentRule, TiktokCommentRulePayload } from "@/lib/tiktok/types";

export const TIKTOK_RULE_ACTIONS: readonly CommentRuleAction[] = ["public_reply", "hide", "like"];

export const TIKTOK_RULE_TEXT_LIMITS: CommentRuleTextLimits = { publicText: TIKTOK_COMMENT_REPLY_LIMIT };

function isTiktokAction(action: CommentRuleAction): boolean {
  return TIKTOK_RULE_ACTIONS.includes(action);
}

export function fromTiktokRule(rule: TiktokCommentRule): CommentRule {
  return {
    id: rule.id,
    name: rule.name,
    enabled: rule.enabled,
    containerId: rule.containerId || undefined,
    match: rule.match,
    keywords: rule.keywords,
    actions: rule.actions.filter(isTiktokAction),
    publicReplyText: rule.publicReplyText,
    priority: rule.priority,
  };
}

export function toTiktokRulePayload(draft: CommentRuleDraft): TiktokCommentRulePayload {
  const actions = draft.actions.filter(isTiktokAction);
  return {
    name: draft.name,
    enabled: draft.enabled,
    containerId: draft.containerId,
    match: draft.match,
    keywords: draft.keywords,
    actions,
    publicReplyText: actions.includes("public_reply") ? draft.publicReplyText : "",
    privateReplyText: "",
    priority: draft.priority,
  };
}
