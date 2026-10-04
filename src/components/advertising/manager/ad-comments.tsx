"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { listAdCommentsAction } from "@/app/actions/advertising";
import Button from "@/components/elevated-design/button";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { ArrowsClockwise, ChatCircle, Heart } from "@/components/icons";
import type { AdComment, AdCommentPlatform } from "@/lib/advertising/types";
import { formatWhen } from "@/lib/advertising/when";

import { useAdsErrorText } from "../use-ads-error";
import { useAdsFormat } from "../use-ads-format";
import { useAdsResource } from "../wizard/use-ads-resource";

const PLATFORMS: AdCommentPlatform[] = ["facebook", "instagram"];

function CommentItem({ comment }: { comment: AdComment }) {
  const t = useTranslations("adsManager.insights.comments");
  const fmt = useAdsFormat();
  return (
    <li className="space-y-1 border-b border-border py-3 last:border-b-0">
      <div className="flex items-baseline justify-between gap-3">
        <p className="truncate text-sm font-semibold text-foreground">{comment.authorName || t("anonymous")}</p>
        <p className="shrink-0 text-2xs text-muted-foreground">{formatWhen(comment.createdAt, fmt.tag)}</p>
      </div>
      <p className="whitespace-pre-wrap break-words text-sm text-foreground">{comment.message}</p>
      <p className="flex items-center gap-3 text-2xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <Heart className="h-3 w-3" aria-hidden />
          {t("likes", { count: comment.likeCount })}
        </span>
        <span className="inline-flex items-center gap-1">
          <ChatCircle className="h-3 w-3" aria-hidden />
          {t("replies", { count: comment.replyCount })}
        </span>
      </p>
    </li>
  );
}

export function AdComments({ metaId }: { metaId: string }) {
  const t = useTranslations("adsManager.insights.comments");
  const errorText = useAdsErrorText();
  const [platform, setPlatform] = useState<AdCommentPlatform>("facebook");
  const comments = useAdsResource(`comments:${metaId}:${platform}`, () => listAdCommentsAction(metaId, platform));
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <ElevatedPillToggle<AdCommentPlatform>
          size="sm"
          value={platform}
          onChange={setPlatform}
          options={PLATFORMS.map((value) => ({ value, label: t(`platform.${value}`) }))}
        />
        <Button
          variant="ghost"
          size="sm"
          title={t("reload")}
          icon={<ArrowsClockwise className="h-3.5 w-3.5" aria-hidden />}
          onClick={comments.reload}
          disabled={comments.status === "loading"}
        />
      </div>
      {comments.status === "loading" ? <div className="h-32 animate-pulse rounded-[--radius] bg-muted" /> : null}
      {comments.status === "error" ? <p className="text-sm text-muted-foreground">{errorText({ error: comments.message, code: comments.code })}</p> : null}
      {comments.status === "ready" && comments.data.length === 0 ? <p className="text-sm text-muted-foreground">{t("empty")}</p> : null}
      {comments.status === "ready" && comments.data.length > 0 ? (
        <ul>
          {comments.data.map((comment) => (
            <CommentItem key={comment.id} comment={comment} />
          ))}
        </ul>
      ) : null}
      <p className="text-2xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
