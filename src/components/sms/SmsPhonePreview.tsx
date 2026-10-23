"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { ArrowLeft, CaretLeft, DotsThreeVertical, Plus, Smiley, User } from "@/components/icons";
import { PALETTE, type RcsPreviewPlatform } from "@/components/rcs/preview/palette";
import { CLOCK, PhoneFrame, ThreadStamp } from "@/components/rcs/preview/PhoneFrame";
import { PreviewHeading } from "@/components/rcs/preview/PlatformToggle";
import { slotNames } from "@/lib/rcs/variables";
import { cn } from "@/lib/utils";
import { renderTemplateText } from "@/lib/whatsapp-templates/params";

function SenderAvatar({ className }: { className?: string }) {
  return (
    <span aria-hidden className={cn("flex shrink-0 items-center justify-center rounded-full bg-[#9AA0A6] text-white dark:bg-[#5F6368]", className)}>
      <User className="h-1/2 w-1/2" />
    </span>
  );
}

function SmsHeader({ platform, sender }: { platform: RcsPreviewPlatform; sender: string }) {
  const palette = PALETTE[platform];
  if (platform === "ios") {
    return (
      <header className={cn("relative flex shrink-0 flex-col items-center gap-1 px-4 pb-2 pt-1 backdrop-blur", palette.header)}>
        <CaretLeft aria-hidden weight="bold" className="absolute left-3 top-4 h-5 w-5 text-[#007AFF] dark:text-[#0A84FF]" />
        <SenderAvatar className="h-11 w-11" />
        <p className={cn("max-w-full truncate text-[11px] font-medium tabular-nums", palette.ink)}>{sender}</p>
      </header>
    );
  }
  return (
    <header className={cn("flex shrink-0 items-center gap-3 px-3 pb-2.5 pt-1", palette.header)}>
      <ArrowLeft aria-hidden className={cn("h-5 w-5 shrink-0", palette.ink)} />
      <SenderAvatar className="h-9 w-9" />
      <p className={cn("min-w-0 flex-1 truncate text-[15px] font-medium tabular-nums", palette.ink)}>{sender}</p>
      <DotsThreeVertical aria-hidden weight="bold" className={cn("h-5 w-5 shrink-0", palette.ink)} />
    </header>
  );
}

function SmsComposeBar({ platform }: { platform: RcsPreviewPlatform }) {
  const t = useTranslations("sms.preview");
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
      </span>
    </div>
  );
}

export function SmsPhoneScreen({ text, sender, platform }: { text: string; sender?: string; platform: RcsPreviewPlatform }) {
  const t = useTranslations("sms.preview");
  const palette = PALETTE[platform];
  const shown = text.trim();
  return (
    <PhoneFrame platform={platform} label={t(`frame.${platform}`)}>
      <SmsHeader platform={platform} sender={sender?.trim() || t("senderFallback")} />
      <div className="flex min-h-0 flex-1 flex-col overflow-y-auto overflow-x-hidden px-3 pb-2 pt-3 [scrollbar-width:thin]">
        <ThreadStamp platform={platform} channel={t("iosChannel")} />
        {shown ? (
          <div className="flex flex-col items-start gap-1">
            <p className={cn("w-fit max-w-[82%] whitespace-pre-wrap break-words px-3.5 py-2", palette.bubble, palette.bubbleShape, palette.text)}>{shown}</p>
            <p className={cn("px-1 text-[11px]", palette.muted)}>{CLOCK}</p>
          </div>
        ) : (
          <p className={cn("mx-auto max-w-[15rem] py-10 text-center text-xs leading-relaxed", palette.muted)}>{t("empty")}</p>
        )}
      </div>
      <SmsComposeBar platform={platform} />
    </PhoneFrame>
  );
}

export function SmsPhonePreview({
  text,
  sender,
  values = [],
  platform,
  onPlatformChange,
  className,
}: {
  text: string;
  sender?: string;
  values?: readonly string[];
  platform?: RcsPreviewPlatform;
  onPlatformChange?: (platform: RcsPreviewPlatform) => void;
  className?: string;
}) {
  const t = useTranslations("sms.preview");
  const [ownPlatform, setOwnPlatform] = useState<RcsPreviewPlatform>("android");
  const shown = platform ?? ownPlatform;
  const choose = (next: RcsPreviewPlatform) => {
    setOwnPlatform(next);
    onPlatformChange?.(next);
  };
  const rendered = renderTemplateText(text, [...values], slotNames(values.length));
  return (
    <section aria-label={t("label")} className={cn("min-w-0 space-y-3", className)}>
      <PreviewHeading title={t("label")} platform={shown} onPlatformChange={choose} />
      <SmsPhoneScreen text={rendered} sender={sender} platform={shown} />
      <p className="text-center text-2xs text-muted-foreground">{t("note")}</p>
    </section>
  );
}
