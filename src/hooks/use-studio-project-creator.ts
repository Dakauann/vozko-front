"use client";

import { useCallback, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { createStudioProjectAction, type StudioProjectOrigin } from "@/app/actions/studio";
import { isActionError } from "@/app/actions/action-result";
import { useRouter } from "@/i18n/routing";
import type { CanvasSize, StudioKind, VideoAspect } from "@/lib/studio/document";
import { projectNameFrom, studioProjectDocument, type MediaFrame } from "@/lib/studio/from-media";
import type { MediaClipType } from "@/lib/studio/media-clips";
import { editorPathFor } from "@/lib/studio/project";

const FRAME_TIMEOUT_MS = 20_000;

export interface StudioOrderMedia {
  mediaId: string;
  url: string;
  type: MediaClipType;
}

export interface StudioProjectOrder {
  kind: StudioKind;
  name?: string;
  media?: StudioOrderMedia[];
  sizes?: CanvasSize[];
  aspect?: VideoAspect;
  durationMs?: number;
}

export type StudioProjectOutcome = { ok: true; path: string; projectId: string } | { ok: false; error: string };

export interface CreateOptions {
  open?: boolean;
  origin?: StudioProjectOrigin;
}

export function readMediaFrame(url: string, kind: MediaClipType): Promise<MediaFrame> {
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

export function useStudioProjectCreator() {
  const t = useTranslations("studio");
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const running = useRef(false);

  const create = useCallback(
    async (order: StudioProjectOrder, key: string, { open = true, origin }: CreateOptions = {}): Promise<StudioProjectOutcome> => {
      if (running.current) return { ok: false, error: t("create.busy") };
      running.current = true;
      setBusy(key);
      try {
        const media = order.media ?? [];
        const frames = await Promise.all(media.map((m) => readMediaFrame(m.url, m.type).catch(() => null)));
        if (frames.some((frame) => frame === null)) return { ok: false, error: t("openFromMedia.unreadable") };
        const built = studioProjectDocument({
          kind: order.kind,
          media: media.map((m, i) => ({ mediaId: m.mediaId, type: m.type, frame: frames[i]! })),
          sizes: order.sizes,
          aspect: order.aspect,
          durationMs: order.durationMs,
        });
        if (!built.ok) return { ok: false, error: t(`create.orderIssues.${built.issue}`) };
        const name = projectNameFrom(order.name ?? "", t(`create.defaultName.${order.kind}`));
        const saved = await createStudioProjectAction({ kind: order.kind, name, document: built.document, ...(origin ? { origin } : {}) });
        if (isActionError(saved)) return { ok: false, error: saved.error };
        const path = editorPathFor(saved.data);
        if (!path) return { ok: false, error: t("create.failed") };
        if (open) router.push(path);
        return { ok: true, path, projectId: saved.data.id };
      } finally {
        running.current = false;
        setBusy(null);
      }
    },
    [router, t],
  );

  return { create, busy };
}
