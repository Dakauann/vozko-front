"use client";

import { useEffect, useRef, useState } from "react";

import { getConversationMediaAction } from "@/app/actions/conversations";
import type { EntryType } from "@/lib/conversations/types";

export function useConversationMediaUrl(url?: string, mediaId?: string, entryType?: EntryType, entryId?: string) {
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(!url && !!mediaId);
  const [error, setError] = useState(false);
  const fetchedRef = useRef(false);

  useEffect(() => {
    if (url || !mediaId || !entryType || !entryId || fetchedRef.current) return;
    fetchedRef.current = true;

    getConversationMediaAction(entryType, entryId, mediaId)
      .then((media) => {
        if (media?.url) setFetchedUrl(media.url);
        else setError(true);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [mediaId, url, entryType, entryId]);

  return { mediaUrl: url || fetchedUrl, loading, error };
}
