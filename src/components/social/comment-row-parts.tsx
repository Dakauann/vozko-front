"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { cn } from "@/lib/utils";

export function CommentListFrame({
  translationNamespace,
  loading,
  count,
  totalCount,
  hasNext,
  loadingMore,
  onLoadMore,
  children,
}: {
  translationNamespace: string;
  loading: boolean;
  count: number;
  totalCount?: number;
  hasNext: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  children: ReactNode;
}) {
  const t = useTranslations(translationNamespace);

  if (loading) {
    return (
      <div className="flex flex-col gap-3 p-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg bg-muted" />
        ))}
      </div>
    );
  }

  if (count === 0) {
    const hidden = (totalCount ?? 0) > 0;
    return (
      <div className="flex flex-col items-center gap-2 p-6 text-center">
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
        {hidden && (
          <p className="max-w-sm text-xs leading-relaxed text-muted-foreground">
            {t("countMismatch", { count: totalCount ?? 0 })}
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {children}
      {hasNext ? (
        <div className="p-4">
          <Button variant="secondary" className="w-full" onClick={onLoadMore} disabled={loadingMore} title={loadingMore ? t("loading") : t("loadMore")} />
        </div>
      ) : (
        <p className="p-3 text-center text-2xs text-muted-foreground">{t("allLoaded", { count })}</p>
      )}
    </div>
  );
}

export function CommentIconAction({
  label,
  onClick,
  disabled,
  danger = false,
  pressed,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(
        "rounded p-1 transition-colors hover:bg-muted disabled:opacity-40",
        className ?? (danger ? "text-muted-foreground hover:text-destructive-ink" : "text-muted-foreground hover:text-foreground"),
      )}
    >
      {children}
    </button>
  );
}

export function CommentAuthorLine({
  author,
  fallback,
  prefix = "",
  children,
}: {
  author: string | null;
  fallback: string;
  prefix?: string;
  children?: ReactNode;
}) {
  return (
    <p className="text-sm">
      <span className="font-semibold text-foreground">
        {prefix}
        {author || fallback}
      </span>
      {children}
    </p>
  );
}

export function CommentText({ text }: { text: string }) {
  return <p className="mt-0.5 whitespace-pre-wrap break-words text-sm text-foreground">{text}</p>;
}
