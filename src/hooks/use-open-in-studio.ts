"use client";

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";

import { createStudioProjectAction } from "@/app/actions/studio";
import { isActionError } from "@/app/actions/action-result";
import { useToast } from "@/hooks/use-toast";
import { useRouter } from "@/i18n/routing";
import type { ChatMedia } from "@/lib/aichat/types";
import { chatMediaKind } from "@/lib/aichat/chat-media";
import { imageDocumentFromMedia, projectNameFrom, videoDocumentFromMedia, type MediaFrame } from "@/lib/studio/from-media";
import { editorPathFor } from "@/lib/studio/project";

const FRAME_TIMEOUT_MS = 20_000;

function readFrame(url: string, kind: "image" | "audio" | "video"): Promise<MediaFrame> {
  return new Promise((resolve, reject) => {
    const timer = window.setTimeout(() => reject(new Error("media_timeout")), FRAME_TIMEOUT_MS);
    const done = (frame: MediaFrame) => {
      window.clearTimeout(timer);
      resolve(frame);
    };
    const fail = () => {
      window.clearTimeout(timer);
      reject(new Error("media_unreadable"));
    };
    if (kind === "image") {
      const image = new Image();
      image.onload = () => done({ width: image.naturalWidth, height: image.naturalHeight });
      image.onerror = fail;
      image.src = url;
      return;
    }
    const element = document.createElement(kind);
    element.preload = "metadata";
    element.onloadedmetadata = () => {
      const durationMs = Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : undefined;
      const video = element instanceof HTMLVideoElement ? element : null;
      done({ width: video?.videoWidth ?? 0, height: video?.videoHeight ?? 0, durationMs });
    };
    element.onerror = fail;
    element.src = url;
  });
}

export function useOpenInStudio() {
  const t = useTranslations("studio.openFromMedia");
  const { toast } = useToast();
  const router = useRouter();
  const [opening, setOpening] = useState<string | null>(null);

  const open = useCallback(
    async (media: ChatMedia) => {
      if (opening) return;
      setOpening(media.mediaId);
      try {
        const kind = chatMediaKind(media);
        const frame = await readFrame(media.url, kind).catch(() => null);
        const document = frame === null ? null : kind === "image" ? imageDocumentFromMedia(media.mediaId, frame) : videoDocumentFromMedia(kind, media.mediaId, frame);
        if (!document) {
          toast({ title: t("failed"), description: t("unreadable"), variant: "destructive" });
          return;
        }
        const result = await createStudioProjectAction({ kind: kind === "image" ? "image" : "video", name: projectNameFrom(media.alt, t("defaultName")), document });
        const path = isActionError(result) ? null : editorPathFor(result.data);
        if (!path) {
          toast({ title: t("failed"), description: isActionError(result) ? result.error : undefined, variant: "destructive" });
          return;
        }
        router.push(path);
      } finally {
        setOpening(null);
      }
    },
    [opening, router, t, toast],
  );

  return { open, opening };
}
