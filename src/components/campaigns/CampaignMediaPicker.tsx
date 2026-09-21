"use client";

import { useState } from "react";

import { UploadSimple, X } from "@/components/icons";
import { uploadMediaAction } from "@/app/actions/medias";
import { cn } from "@/lib/utils";

export function CampaignMediaPicker({
  kind,
  mediaId,
  fileName,
  onChange,
  accept,
  labels,
  disabled,
}: {
  kind: string;
  mediaId?: string;
  fileName?: string;
  onChange: (next: { mediaId?: string; fileName?: string; previewUrl?: string }) => void;
  accept: string;
  labels: { upload: string; uploading: string; remove: string; failed: string };
  disabled?: boolean;
}) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mediaId) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-[--radius] border border-border px-3 py-2">
        <span className="min-w-0 flex-1 truncate text-sm text-foreground">
          {fileName || mediaId}
        </span>
        <button
          type="button"
          onClick={() => onChange({})}
          disabled={disabled}
          className="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-muted"
          aria-label={labels.remove}
        >
          <X className="h-4 w-4" weight="bold" />
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <label
        className={cn(
          "inline-flex w-full cursor-pointer items-center justify-center gap-2 rounded-[--radius] border border-dashed border-border px-3 py-3 text-sm text-muted-foreground transition-colors hover:bg-muted",
          (disabled || uploading) && "pointer-events-none opacity-50",
        )}
      >
        <UploadSimple className="h-4 w-4" weight="bold" />
        {uploading ? labels.uploading : labels.upload}
        <input
          type="file"
          accept={accept}
          className="hidden"
          disabled={disabled || uploading}
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            setUploading(true);
            setError(null);
            try {
              const form = new FormData();
              form.append("media", file);
              form.append("mediaType", kind);
              form.append("description", file.name);
              const result = await uploadMediaAction(form);
              if (result.error || !result.mediaId) {
                setError(result.error ?? labels.failed);
                return;
              }
              onChange({
                mediaId: result.mediaId,
                fileName: file.name,
                previewUrl: result.mediaPreviewUrl ?? result.mediaUrl ?? undefined,
              });
            } finally {
              setUploading(false);
              e.target.value = "";
            }
          }}
        />
      </label>
      {error ? <p className="text-xs font-semibold text-destructive-ink">{error}</p> : null}
    </div>
  );
}

export const MEDIA_ACCEPT: Record<string, string> = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/3gpp",
  audio: "audio/*",
  document: "*/*",
  sticker: "image/webp",
};
