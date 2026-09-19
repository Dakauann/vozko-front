"use client";

import { useState } from "react";

import { UploadSimple, X } from "@/components/icons";
import { uploadMediaAction } from "@/app/actions/medias";
import { cn } from "@/lib/utils";

/**
 * The campaign attachment.
 *
 * Uploads through the platform's own media store and hands back a media id — it
 * never accepts a URL. A caller-supplied external URL would make the campaign a
 * server-side request forger pointed at whatever the caller likes, which is why
 * the domain's MessageSpec carries a MediaID and not a link.
 */
export function CampaignMediaPicker({
  kind,
  mediaId,
  fileName,
  onChange,
  accept,
  labels,
  disabled,
}: {
  /**
   * What the file IS, sent to the store alongside the bytes.
   *
   * The upload endpoint refuses a file with no type, so this is required
   * rather than inferred here: the caller already knows which kind it is
   * collecting, and guessing from the MIME type would disagree with it the
   * first time somebody picks a PDF for a document campaign.
   */
  kind: string;
  mediaId?: string;
  fileName?: string;
  onChange: (next: { mediaId?: string; fileName?: string; previewUrl?: string }) => void;
  /** Narrowed per message kind, so an image campaign cannot take a PDF. */
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
              // The field names are the endpoint's, not ours: it reads
              // `media`, `mediaType` and `description`, and refuses the upload
              // outright when any of the three is missing.
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

/**
 * What each message kind will accept.
 *
 * Mirrors the channel descriptor's MediaLimits: audio is the widest list because
 * the send path re-encodes everything to ogg/opus anyway, so the constraint is
 * what a recorder or a file picker can PRODUCE, not what WhatsApp takes raw.
 */
export const MEDIA_ACCEPT: Record<string, string> = {
  image: "image/jpeg,image/png,image/webp",
  video: "video/mp4,video/3gpp",
  audio: "audio/*",
  document: "*/*",
  // A WhatsApp sticker is a webp image. Unused by campaigns, which have no
  // sticker kind; seeded conversation openings do.
  sticker: "image/webp",
};
