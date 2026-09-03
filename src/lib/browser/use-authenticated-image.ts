"use client";

import { useEffect, useState } from "react";

import { fetchWithRefresh, scopeHeaders } from "@/lib/api/browser-client";

interface ImageState {
  url: string | null;
  src: string | null;
  contentType: string | null;
  failed: boolean;
  onError: () => void;
}

/**
 * Loads a protected image through the shared refresh-on-401 transport. Native
 * <img> requests cannot refresh an expired access cookie, so they otherwise
 * remain broken until the page is reloaded.
 */
export function useAuthenticatedImage(url: string): ImageState {
  const [state, setState] = useState<ImageState>({
    url: null,
    src: null,
    contentType: null,
    failed: false,
    onError: () => undefined,
  });

  useEffect(() => {
    let mounted = true;
    let objectUrl: string | null = null;
    const controller = new AbortController();

    void fetchWithRefresh(() =>
      fetch(url, {
        credentials: "include",
        headers: scopeHeaders(),
        signal: controller.signal,
      }),
    )
      .then((response) => {
        if (!response.ok) throw new Error(`Image request failed: ${response.status}`);
        return response.blob().then((blob) => ({
          blob,
          contentType: response.headers.get("content-type"),
        }));
      })
      .then(({ blob, contentType }) => {
        if (!mounted) return;
        if (blob.size === 0) throw new Error("Image response was empty");
        objectUrl = URL.createObjectURL(blob);
        setState({
          url,
          src: objectUrl,
          contentType,
          failed: false,
          onError: () => {
            if (objectUrl) URL.revokeObjectURL(objectUrl);
            setState({ url, src: null, contentType: null, failed: true, onError: () => undefined });
          },
        });
      })
      .catch(() => {
        if (mounted && !controller.signal.aborted) {
          setState({ url, src: null, contentType: null, failed: true, onError: () => undefined });
        }
      });

    return () => {
      mounted = false;
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [url]);

  return state.url === url
    ? state
    : { url, src: null, contentType: null, failed: false, onError: () => undefined };
}
