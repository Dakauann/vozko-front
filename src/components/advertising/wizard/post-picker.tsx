"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { listAdPagePostsAction } from "@/app/actions/advertising-create";
import ElevatedPillToggle from "@/components/elevated-design/elevated-pill-toggle";
import { CheckCircle, FacebookLogo, InstagramLogo } from "@/components/icons";
import type { PostChoice } from "@/lib/advertising/draft";
import type { AdPostPlatform } from "@/lib/advertising/draft-types";
import { cn } from "@/lib/utils";

import { AdImage } from "../ad-image";
import { ResourceState } from "./choice-row";
import { readyData, useAdsResource } from "./use-ads-resource";

export function PostPicker({
  accountId,
  pageId,
  hasInstagram,
  value,
  onChange,
}: {
  accountId: string;
  pageId: string;
  hasInstagram: boolean;
  value: PostChoice | null;
  onChange: (post: PostChoice | null) => void;
}) {
  const t = useTranslations("adsWizard.ads");
  const [platform, setPlatform] = useState<AdPostPlatform>(value?.platform ?? "facebook");
  const key = accountId && pageId ? `posts:${accountId}:${pageId}:${platform}` : null;
  const posts = useAdsResource(key, () => listAdPagePostsAction(accountId, pageId, platform));
  const list = readyData(posts) ?? [];

  if (!pageId) return <p className="text-sm text-muted-foreground">{t("choosePage")}</p>;

  return (
    <div className="space-y-3">
      <ElevatedPillToggle<AdPostPlatform>
        size="sm"
        value={platform}
        onChange={setPlatform}
        options={[
          { value: "facebook", label: t("postPlatform.facebook"), icon: <FacebookLogo className="h-3.5 w-3.5" /> },
          {
            value: "instagram",
            label: t("postPlatform.instagram"),
            icon: <InstagramLogo className="h-3.5 w-3.5" />,
            disabled: !hasInstagram,
          },
        ]}
      />
      <ResourceState resource={posts} empty={t("noPosts")} />
      {list.length > 0 ? (
        <ul className="grid max-h-80 gap-2 overflow-y-auto sm:grid-cols-2" role="listbox" aria-label={t("postTitle")}>
          {list.map((post) => {
            const selected = value?.id === post.id;
            return (
              <li key={post.id}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() =>
                    onChange(
                      selected
                        ? null
                        : { id: post.id, platform: post.platform ?? platform, message: post.message, pictureUrl: post.pictureUrl },
                    )
                  }
                  className={cn(
                    "flex w-full items-start gap-2 rounded-[--radius] border p-2 text-left transition-colors",
                    selected ? "border-control-edge bg-muted" : "border-border hover:bg-muted",
                  )}
                >
                  <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-[--radius] bg-muted">
                    {post.pictureUrl ? <AdImage src={post.pictureUrl} /> : null}
                  </span>
                  <span className="line-clamp-3 min-w-0 flex-1 text-xs text-foreground">{post.message || t("postNoText")}</span>
                  {selected ? <CheckCircle className="h-4 w-4 shrink-0 text-primary-ink" weight="fill" aria-hidden /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
