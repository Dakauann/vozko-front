"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { CommentRulesPanel } from "@/components/social/comment-rules-panel";
import type { CommentManageBlock } from "@/lib/tiktok/account";
import { TIKTOK_RULE_ACTIONS, TIKTOK_RULE_TEXT_LIMITS } from "@/lib/tiktok/comment-rules";
import { tiktokRuleApi } from "@/lib/tiktok/sources";

export function TiktokCommentRulesPanel({
  accountId,
  videoId,
  block,
  className,
}: {
  accountId: string;
  videoId?: string;
  block: CommentManageBlock | null;
  className?: string;
}) {
  const t = useTranslations("tiktok.commentRules");
  const api = useMemo(() => tiktokRuleApi(accountId), [accountId]);
  return (
    <CommentRulesPanel
      api={api}
      allowedActions={TIKTOK_RULE_ACTIONS}
      translationNamespace="tiktok.commentRules"
      containerId={videoId}
      textLimits={TIKTOK_RULE_TEXT_LIMITS}
      canManage={block === null}
      disabledReason={block ? t(`blocked.${block}`) : undefined}
      className={className}
    />
  );
}
