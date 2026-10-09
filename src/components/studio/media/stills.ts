"use client";

import { STILL_JPEG_QUALITY, stillSeconds } from "@/lib/studio/media/stills";

import { loadMediaFile } from "../canvas/media-files";

const SEEK_TIMEOUT_MS = 6000;

export interface StillSource {
  grab(file: string, seconds: number, heightPx: number): Promise<Blob | null>;
  dispose(): void;
}

function waitFor(element: HTMLVideoElement, event: "loadeddata" | "seeked"): Promise<boolean> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => finish(false), SEEK_TIMEOUT_MS);
    function finish(ok: boolean) {
      clearTimeout(timer);
      element.removeEventListener(event, onEvent);
      element.removeEventListener("error", onError);
      resolve(ok);
    }
    const onEvent = () => finish(true);
    const onError = () => finish(false);
    element.addEventListener(event, onEvent);
    element.addEventListener("error", onError);
  });
}

export class ElementStills implements StillSource {
  private readonly videos = new Map<string, Promise<HTMLVideoElement | null>>();
  private disposed = false;

  async grab(file: string, seconds: number, heightPx: number): Promise<Blob | null> {
    const video = await this.video(file);
    if (!video || this.disposed || !video.videoWidth || !video.videoHeight) return null;
    const target = stillSeconds(seconds, video.duration);
    if (Math.abs(video.currentTime - target) > 0.001) {
      video.currentTime = target;
      if (!(await waitFor(video, "seeked"))) return null;
    }
    if (this.disposed) return null;
    const canvas = document.createElement("canvas");
    canvas.height = heightPx;
    canvas.width = Math.max(8, Math.round((heightPx * video.videoWidth) / video.videoHeight));
    const context = canvas.getContext("2d");
    if (!context) return null;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", STILL_JPEG_QUALITY));
  }

  dispose(): void {
    this.disposed = true;
    for (const pending of this.videos.values()) {
      void pending.then((video) => {
        if (!video) return;
        video.removeAttribute("src");
        video.load();
      });
    }
    this.videos.clear();
  }

  private video(file: string): Promise<HTMLVideoElement | null> {
    const existing = this.videos.get(file);
    if (existing) return existing;
    const loading = loadMediaFile(file)
      .then(async (loaded) => {
        if (this.disposed || !loaded || !loaded.contentType.startsWith("video/")) return null;
        const element = document.createElement("video");
        element.muted = true;
        element.playsInline = true;
        element.preload = "auto";
        element.src = loaded.url;
        if (await waitFor(element, "loadeddata")) return element;
        element.removeAttribute("src");
        element.load();
        return null;
      })
      .catch(() => null);
    this.videos.set(file, loading);
    void loading.then((value) => {
      if (!value) this.videos.delete(file);
    });
    return loading;
  }
}
