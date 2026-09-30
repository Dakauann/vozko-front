"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { fetchHoldPresetAudioAction, listHoldPresetsAction } from "@/app/actions/call-routing";
import { listMediasAction, uploadMediaAction } from "@/app/actions/medias";
import type { HoldPreset } from "@/lib/call-routing/types";
import type { Media } from "@/lib/medias/types";

export interface HoldMusicLibrary {
  presets: HoldPreset[];
  audios: Media[];
  loading: boolean;
  upload: (file: File) => Promise<{ media?: Media; error?: string }>;
}

export function useHoldMusicLibrary(): HoldMusicLibrary {
  const [presets, setPresets] = useState<HoldPreset[]>([]);
  const [audios, setAudios] = useState<Media[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.all([listHoldPresetsAction(), listMediasAction()]).then(([presetResult, mediaResult]) => {
      if (cancelled) return;
      setPresets(presetResult.presets);
      setAudios(mediaResult.medias.filter((media) => media.type === "audio" && Boolean(media.url)));
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const upload = useCallback(async (file: File) => {
    const form = new FormData();
    form.append("media", file);
    form.append("mediaType", "audio");
    form.append("description", file.name);
    const result = await uploadMediaAction(form);
    if (result.error || !result.mediaId || !result.mediaUrl) return { error: result.error ?? "upload failed" };
    const media: Media = {
      id: result.mediaId,
      url: result.mediaUrl,
      previewUrl: result.mediaPreviewUrl ?? result.mediaUrl,
      description: file.name,
      createdAt: new Date().toISOString(),
      type: "audio",
    };
    setAudios((current) => [media, ...current]);
    return { media };
  }, []);

  return { presets, audios, loading, upload };
}

export interface PreviewPlayer {
  playing: string | null;
  loading: string | null;
  toggle: (key: string, source: () => Promise<string | null>) => void;
}

export function usePreviewPlayer(): PreviewPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);

  useEffect(
    () => () => {
      audioRef.current?.pause();
      audioRef.current = null;
    },
    [],
  );

  const toggle = useCallback(
    (key: string, source: () => Promise<string | null>) => {
      audioRef.current?.pause();
      if (playing === key) {
        setPlaying(null);
        return;
      }
      setLoading(key);
      void source().then((src) => {
        setLoading(null);
        if (!src) return;
        const audio = new Audio(src);
        audio.onended = () => setPlaying((current) => (current === key ? null : current));
        audioRef.current = audio;
        void audio.play().then(
          () => setPlaying(key),
          () => setPlaying(null),
        );
      });
    },
    [playing],
  );

  return { playing, loading, toggle };
}

const presetUrls = new Map<string, string>();

export async function presetPreviewUrl(presetId: string): Promise<string | null> {
  const cached = presetUrls.get(presetId);
  if (cached) return cached;
  const result = await fetchHoldPresetAudioAction(presetId);
  if (!result.blob) return null;
  const url = URL.createObjectURL(result.blob);
  presetUrls.set(presetId, url);
  return url;
}
