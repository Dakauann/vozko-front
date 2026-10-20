"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { getMediaAction } from "@/app/actions/medias";
import { createMediaRecordCache } from "@/lib/medias/media-record-cache";
import type { MediaSources } from "@/lib/medias/media-preview";
import type { Media } from "@/lib/medias/types";

const workflowMediaRecords = createMediaRecordCache(getMediaAction);

function useMediaRecord(mediaId: string): { record: Media | null | undefined; failed: boolean } {
  const snapshot = () => (mediaId ? workflowMediaRecords.peek(mediaId) : null);
  const record = useSyncExternalStore(workflowMediaRecords.subscribe, snapshot, snapshot);
  const [failedId, setFailedId] = useState<string | null>(null);

  useEffect(() => {
    if (!mediaId || record !== undefined) return;
    let live = true;
    workflowMediaRecords.read(mediaId).catch(() => {
      if (live) setFailedId(mediaId);
    });
    return () => {
      live = false;
    };
  }, [mediaId, record]);

  return { record, failed: failedId === mediaId };
}

export interface NodeMediaRef {
  mediaId: string;
  url: string;
  previewUrl: string;
  type: string;
}

export function useResolvedMedia({ mediaId, url, previewUrl, type }: NodeMediaRef): {
  sources: MediaSources;
  type: string;
  loading: boolean;
} {
  const known = Boolean(url || previewUrl);
  const { record, failed } = useMediaRecord(known ? "" : mediaId);
  if (known || !mediaId) {
    return { sources: { url: url || previewUrl, previewUrl }, type, loading: false };
  }
  return {
    sources: { url: record?.url ?? "", previewUrl: record?.previewUrl ?? "" },
    type: type || (record?.type ?? "").toLowerCase(),
    loading: record === undefined && !failed,
  };
}
