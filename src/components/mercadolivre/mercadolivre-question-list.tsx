"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { listMercadoLivreQuestionsAction } from "@/app/actions/mercadolivre";
import Button from "@/components/elevated-design/button";
import { CommentListFrame } from "@/components/social/comment-row-parts";
import { Notice } from "@/components/ui/notice";
import { removeById, replaceById } from "@/lib/mercadolivre/pages";
import type { QuestionStatusFilter } from "@/lib/mercadolivre/questions";
import type { MercadoLivreQuestion } from "@/lib/mercadolivre/types";

import { MercadoLivreQuestionRow, type QuestionRowPermissions } from "./mercadolivre-question-row";
import { useKeysetPages } from "./use-keyset-pages";
import { useMercadoLivreError } from "./use-mercadolivre-error";

const QUESTIONS_PAGE_SIZE = 30;

export function MercadoLivreQuestionList({
  accountId,
  itemId,
  status,
  permissions,
  showListing,
}: {
  accountId: string;
  itemId?: string;
  status: QuestionStatusFilter;
  permissions: QuestionRowPermissions;
  showListing: boolean;
}) {
  const t = useTranslations("mercadolivre.questions");
  const describeError = useMercadoLivreError();
  const [closedElsewhere, setClosedElsewhere] = useState(false);
  const [blockedAskers, setBlockedAskers] = useState<ReadonlySet<string>>(new Set());

  const fetchPage = useCallback(
    (cursor: string | undefined) =>
      listMercadoLivreQuestionsAction(accountId, {
        status: status === "all" ? undefined : status,
        itemId: itemId || undefined,
        cursor,
        limit: QUESTIONS_PAGE_SIZE,
      }),
    [accountId, itemId, status],
  );
  const { rows, loading, loadingMore, hasNext, failure, loadMore, reload, updateRows } = useKeysetPages<MercadoLivreQuestion>(fetchPage, true);

  const markAsker = useCallback((mlUserId: string, blocked: boolean) => {
    setBlockedAskers((prev) => {
      const next = new Set(prev);
      if (blocked) next.add(mlUserId);
      else next.delete(mlUserId);
      return next;
    });
  }, []);

  return (
    <div className="flex flex-col">
      {closedElsewhere ? (
        <Notice tone="info" className="m-4 mb-0">
          <p>{t("answer.alreadyClosed")}</p>
        </Notice>
      ) : null}
      {failure ? (
        <Notice tone="fault" className="m-4 mb-0">
          <p>{describeError(failure)}</p>
          <Button size="sm" variant="secondary" title={t("retry")} onClick={reload} />
        </Notice>
      ) : null}
      <CommentListFrame
        translationNamespace="mercadolivre.questions"
        loading={loading}
        count={rows.length}
        hasNext={hasNext}
        loadingMore={loadingMore}
        onLoadMore={loadMore}
      >
        {rows.map((question) => (
          <MercadoLivreQuestionRow
            key={question.id}
            question={question}
            permissions={permissions}
            showListing={showListing}
            askerBlocked={question.asker ? blockedAskers.has(question.asker.mlUserId) : false}
            onChanged={(next) => {
              setClosedElsewhere(false);
              updateRows((list) => replaceById(list, next));
            }}
            onRemoved={(removed) => updateRows((list) => removeById(list, removed.id))}
            onClosedElsewhere={() => {
              setClosedElsewhere(true);
              reload();
            }}
            onAskerBlocked={markAsker}
          />
        ))}
      </CommentListFrame>
    </div>
  );
}
