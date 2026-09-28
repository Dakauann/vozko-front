"use client";

import { useMemo } from "react";

import { CommentRulesPanel } from "@/components/social/comment-rules-panel";
import { INSTAGRAM_RULE_ACTIONS } from "@/lib/social/comment-rules";
import { instagramRuleApi } from "@/lib/social/comment-sources";

export function InstagramCommentRulesPanel({
  accountId,
  mediaId,
  className,
}: {
  accountId: string;
  mediaId?: string;
  className?: string;
}) {
  const api = useMemo(() => instagramRuleApi(accountId), [accountId]);
  return (
    <CommentRulesPanel
      api={api}
      allowedActions={INSTAGRAM_RULE_ACTIONS}
      translationNamespace="instagram.commentRules"
      containerId={mediaId}
      className={className}
    />
  );
}
