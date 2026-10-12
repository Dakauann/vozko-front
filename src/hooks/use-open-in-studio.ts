"use client";

import { useCallback } from "react";
import { useTranslations } from "next-intl";

import { useStudioProjectCreator } from "@/hooks/use-studio-project-creator";
import { useToast } from "@/hooks/use-toast";
import type { ChatMedia } from "@/lib/aichat/types";
import { chatMediaKind } from "@/lib/aichat/chat-media";
import { projectNameFrom } from "@/lib/studio/from-media";

export function useOpenInStudio() {
  const t = useTranslations("studio.openFromMedia");
  const { toast } = useToast();
  const { create, busy } = useStudioProjectCreator();

  const open = useCallback(
    async (media: ChatMedia) => {
      if (busy) return;
      const type = chatMediaKind(media);
      const outcome = await create(
        { kind: type === "image" ? "image" : "video", name: projectNameFrom(media.alt, t("defaultName")), media: [{ mediaId: media.mediaId, url: media.url, type }] },
        media.mediaId,
      );
      if (!outcome.ok) toast({ title: t("failed"), description: outcome.error, variant: "destructive" });
    },
    [busy, create, t, toast],
  );

  return { open, opening: busy };
}
