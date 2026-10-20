import {
  createTiktokCommentRuleAction,
  deleteTiktokCommentRuleAction,
  listTiktokAccountsAction,
  listTiktokCommentRulesAction,
  listTiktokVideosAction,
  replyTiktokCommentAction,
  setTiktokCommentHiddenAction,
  setTiktokCommentLikedAction,
  updateTiktokCommentRuleAction,
} from "@/app/actions/tiktok";
import type { CommentRuleApi } from "@/lib/social/comment-rules";
import type { CommentActionResult, CommentThreadActions } from "@/lib/social/comments";
import { TIKTOK_RESOURCE } from "@/lib/tiktok/channel";
import { fromTiktokRule, toTiktokRulePayload } from "@/lib/tiktok/comment-rules";
import { TIKTOK_ACCOUNTS_PATH } from "@/lib/tiktok/connect";
import type { TiktokActionError } from "@/lib/tiktok/types";

const UNSUPPORTED: CommentActionResult = { error: "unsupported", code: "unsupported" };

const SCOPE_ACCOUNT_LIMIT = 50;

function isFailure(result: object): result is TiktokActionError {
  return "error" in result && typeof result.error === "string";
}

async function settled(pending: Promise<object>): Promise<CommentActionResult> {
  const result = await pending;
  return isFailure(result) ? { error: result.error, code: result.code } : {};
}

export function tiktokCommentActions(accountId: string): CommentThreadActions {
  return {
    reply: (id, text) => settled(replyTiktokCommentAction(accountId, id, text)),
    setHidden: (id, hidden) => settled(setTiktokCommentHiddenAction(accountId, id, hidden)),
    remove: async () => UNSUPPORTED,
    setLiked: (id, liked) => settled(setTiktokCommentLikedAction(accountId, id, liked)),
  };
}

export function tiktokRuleApi(accountId: string): CommentRuleApi {
  return {
    list: async () => {
      const result = await listTiktokCommentRulesAction(accountId);
      return { rules: result.rules.map(fromTiktokRule), error: isFailure(result) ? result.error : undefined };
    },
    create: async (draft) => {
      const result = await createTiktokCommentRuleAction(accountId, toTiktokRulePayload(draft));
      return isFailure(result) ? { error: result.error } : { rule: fromTiktokRule(result.rule) };
    },
    update: async (ruleId, draft) => {
      const result = await updateTiktokCommentRuleAction(accountId, ruleId, toTiktokRulePayload(draft));
      return isFailure(result) ? { error: result.error } : { rule: fromTiktokRule(result.rule) };
    },
    remove: async (ruleId) => {
      const result = await deleteTiktokCommentRuleAction(accountId, ruleId);
      return isFailure(result) ? { error: result.error } : {};
    },
  };
}

export const tiktokCommentSourceScope = {
  accountsPage: TIKTOK_ACCOUNTS_PATH,
  readResource: TIKTOK_RESOURCE,
  loadAccounts: async () => {
    const result = await listTiktokAccountsAction(1, SCOPE_ACCOUNT_LIMIT);
    return {
      accounts: result.accounts.map((account) => ({ id: account.id, label: `@${account.username}` })),
      error: isFailure(result) ? result.error : undefined,
    };
  },
  loadPosts: async (accountId: string) => {
    const result = await listTiktokVideosAction(accountId);
    return result.page.videos.map((video) => ({ id: video.itemId, text: video.caption, timestamp: video.postedAt }));
  },
};
