"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { Paperclip, Plus, Smiley } from "@/components/icons";
import type { RcsContent } from "@/lib/rcs/types";
import { previewContent } from "@/lib/rcs/variables";
import { cn } from "@/lib/utils";

import { PALETTE, accentStyle, type RcsPreviewAgent, type RcsPreviewPlatform } from "./palette";
import { CLOCK, PhoneFrame, ThreadStamp } from "./PhoneFrame";
import { PreviewHeading } from "./PlatformToggle";
import { RcsAgentHeader } from "./RcsAgentHeader";
import { RcsMessageView, SuggestionChips } from "./RcsMessageView";

function ComposeBar({ platform }: { platform: RcsPreviewPlatform }) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  if (platform === "ios") {
    return (
      <div aria-hidden className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E9E9EB] text-[#8E8E93] dark:bg-[#26252A]">
          <Plus className="h-4 w-4" weight="bold" />
        </span>
        <span className={cn("flex h-8 flex-1 items-center px-3 text-[13px]", palette.compose)}>{t("compose.ios")}</span>
      </div>
    );
  }
  return (
    <div aria-hidden className="flex shrink-0 items-center gap-2 px-3 pb-1 pt-2">
      <span className={cn("flex h-10 flex-1 items-center gap-2.5 px-4 text-[13px]", palette.compose)}>
        <Smiley className="h-5 w-5 shrink-0" />
        <span className="flex-1 truncate">{t("compose.android")}</span>
        <Paperclip className="h-5 w-5 shrink-0" />
      </span>
    </div>
  );
}

export function RcsPhoneScreen({
  content,
  agent,
  platform,
  expectsMedia,
}: {
  content: RcsContent;
  agent: RcsPreviewAgent;
  platform: RcsPreviewPlatform;
  expectsMedia?: boolean;
}) {
  const t = useTranslations("rcs.preview");
  const palette = PALETTE[platform];
  const suggestions = content.suggestions ?? [];
  return (
    <PhoneFrame platform={platform} label={t(`frame.${platform}`)} style={accentStyle(agent.color)}>
      <RcsAgentHeader agent={agent} platform={platform} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-2 pt-3 [scrollbar-width:thin]">
        <ThreadStamp platform={platform} channel={t("stamp.iosChannel")} />
        <RcsMessageView content={content} platform={platform} expectsMedia={expectsMedia} />
        {suggestions.length > 0 || content.text || content.media || content.cards?.length ? (
          <p className={cn("mt-1 px-1 text-[11px]", palette.muted)}>{CLOCK}</p>
        ) : null}
        {suggestions.length > 0 ? (
          <div className="mt-auto pt-3">
            <SuggestionChips suggestions={suggestions} platform={platform} />
          </div>
        ) : null}
      </div>
      <ComposeBar platform={platform} />
    </PhoneFrame>
  );
}

export function RcsPhonePreview({
  content,
  agent,
  values = [],
  platform,
  onPlatformChange,
  expectsMedia,
  className,
}: {
  content: RcsContent;
  agent: RcsPreviewAgent;
  values?: readonly string[];
  platform?: RcsPreviewPlatform;
  onPlatformChange?: (platform: RcsPreviewPlatform) => void;
  expectsMedia?: boolean;
  className?: string;
}) {
  const t = useTranslations("rcs.preview");
  const [ownPlatform, setOwnPlatform] = useState<RcsPreviewPlatform>("android");
  const shown = platform ?? ownPlatform;
  const choose = (next: RcsPreviewPlatform) => {
    setOwnPlatform(next);
    onPlatformChange?.(next);
  };
  const rendered = previewContent(content, values);

  return (
    <section aria-label={t("label")} className={cn("min-w-0 space-y-3", className)}>
      <PreviewHeading title={t("label")} platform={shown} onPlatformChange={choose} />
      <RcsPhoneScreen content={rendered} agent={agent} platform={shown} expectsMedia={expectsMedia} />
      <p className="text-center text-2xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
