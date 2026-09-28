"use client";

import { ArrowSquareOut, InstagramLogo, Link as LinkIcon, Megaphone, MessengerLogo } from "@/components/icons";
import { useState } from "react";
import { useTranslations } from "next-intl";

import type { MessengerSentVia, MetaPrefix, MetaReferral } from "@/lib/conversations/meta-metadata";
import { cn } from "@/lib/utils";

const CHANNEL_MARK = {
  instagram: InstagramLogo,
  facebook: MessengerLogo,
} as const;

function StoryMedia({ url }: { url?: string }) {
  const t = useTranslations("crmConversation.meta");
  const [kind, setKind] = useState<"image" | "video" | "gone">(url ? "image" : "gone");
  if (!url || kind === "gone") {
    return <p className="mb-1.5 text-2xs italic text-muted-foreground">{t("storyUnavailable")}</p>;
  }
  if (kind === "video") {
    return (
      <video
        src={url}
        controls
        preload="metadata"
        className="mb-1.5 max-h-60 rounded"
        onError={() => setKind("gone")}
      />
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      referrerPolicy="no-referrer"
      className="mb-1.5 max-h-40 rounded object-cover"
      onError={() => setKind("video")}
    />
  );
}

export function StoryCard({
  prefix,
  mention,
  mediaUrl,
  text,
}: {
  prefix: MetaPrefix;
  mention: boolean;
  mediaUrl?: string;
  text?: string;
}) {
  const t = useTranslations("crmConversation.meta");
  const Mark = CHANNEL_MARK[prefix];
  return (
    <div className="max-w-[75%] rounded-lg border border-border bg-muted p-2">
      <div className="mb-1 flex items-center gap-1.5 text-2xs font-semibold text-chart-4">
        <Mark className="h-3 w-3" />
        <span>{mention ? t("storyMention") : t("storyReply")}</span>
      </div>
      <StoryMedia url={mediaUrl} />
      {text && <p className="whitespace-pre-wrap break-words text-sm text-foreground">{text}</p>}
    </div>
  );
}

export function UnsupportedNotice({ text }: { text?: string }) {
  const t = useTranslations("crmConversation.meta");
  return (
    <div className="rounded-[--radius] bg-muted px-3 py-1.5 text-2xs text-muted-foreground">
      {text || t("unsupported")}
    </div>
  );
}

export function LikeSticker() {
  const t = useTranslations("crmConversation.meta");
  return (
    <span role="img" aria-label={t("likeSticker")} className="text-4xl leading-none">
      👍
    </span>
  );
}

export function StickerPlaceholder() {
  const t = useTranslations("crmConversation.meta");
  return <span className="text-2xs italic text-muted-foreground">{t("sticker")}</span>;
}

export function SharedLinkCard({
  kind,
  url,
  title,
}: {
  kind: "link" | "post";
  url?: string;
  title?: string;
}) {
  const t = useTranslations("crmConversation.meta");
  const label = title || (kind === "post" ? t("sharedPost") : t("sharedLink"));
  const body = (
    <>
      <LinkIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-foreground">{label}</span>
        {url ? <span className="block truncate text-2xs text-muted-foreground">{url}</span> : null}
      </span>
      {url ? <ArrowSquareOut className="h-3.5 w-3.5 shrink-0 text-muted-foreground" /> : null}
    </>
  );
  const className = "mb-1 flex items-center gap-2 rounded-lg border border-border bg-black/5 px-2.5 py-1.5";
  return url ? (
    <a href={url} target="_blank" rel="noreferrer noopener" className={cn(className, "hover:bg-black/[0.08]")}>
      {body}
    </a>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function ReactionChip({ emoji }: { emoji: string }) {
  const t = useTranslations("crmConversation.meta");
  return (
    <span
      aria-label={t("reaction", { emoji })}
      className="inline-flex items-center rounded-full border border-border bg-card px-1.5 py-0.5 text-xs leading-none shadow-sm"
    >
      {emoji}
    </span>
  );
}

export function ReferralChip({ referral }: { referral: MetaReferral }) {
  const t = useTranslations("crmConversation.meta");
  const label = referral.adTitle
    ? t("referralAd", { title: referral.adTitle })
    : referral.source
      ? t("referralSource", { source: referral.source })
      : t("referralGeneric");
  return (
    <span className="mb-1 inline-flex max-w-full items-center gap-1 rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
      <Megaphone className="h-3 w-3 shrink-0" />
      <span className="truncate">{label}</span>
    </span>
  );
}

export function PostbackChip({ title }: { title?: string }) {
  const t = useTranslations("crmConversation.meta");
  return (
    <span className="mb-1 inline-flex items-center rounded-[--radius] bg-muted px-2 py-0.5 text-2xs font-medium text-muted-foreground">
      {title ? t("postbackTitled", { title }) : t("postback")}
    </span>
  );
}

export function SentViaBadge({ via }: { via: MessengerSentVia }) {
  const t = useTranslations("crmConversation.meta.sentVia");
  if (via === "vozko") return null;
  return (
    <span className="rounded-md bg-muted px-1.5 py-0.5 text-2xs font-semibold text-muted-foreground">{t(via)}</span>
  );
}
