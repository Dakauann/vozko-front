"use client";

import { useMemo } from "react";

import { CommentRulesPanel } from "@/components/social/comment-rules-panel";
import { MERCADOLIVRE_ANSWER_LIMIT } from "@/lib/mercadolivre/questions";
import { MERCADOLIVRE_RULE_ACTIONS, type CommentRuleTextLimits } from "@/lib/social/comment-rules";
import { mercadoLivreRuleApi } from "@/lib/social/comment-sources";

import { MercadoLivreListingPicker } from "./mercadolivre-listing-picker";

const ANSWER_LIMITS: CommentRuleTextLimits = { publicText: MERCADOLIVRE_ANSWER_LIMIT };

export function MercadoLivreCommentRulesPanel({
  accountId,
  itemId,
  canManage,
  disabledReason,
  className,
}: {
  accountId: string;
  itemId?: string;
  canManage: boolean;
  disabledReason?: string;
  className?: string;
}) {
  const api = useMemo(() => mercadoLivreRuleApi(accountId), [accountId]);
  return (
    <CommentRulesPanel
      api={api}
      allowedActions={MERCADOLIVRE_RULE_ACTIONS}
      translationNamespace="mercadolivre.commentRules"
      containerId={itemId}
      textLimits={ANSWER_LIMITS}
      renderContainerPicker={(picker) => (
        <MercadoLivreListingPicker accountId={accountId} value={picker.value} onChange={picker.onChange} disabled={picker.disabled} />
      )}
      canManage={canManage}
      disabledReason={disabledReason}
      className={className}
    />
  );
}
