"use client";

import { useTranslations } from "next-intl";

import { CircleNotch, File as FileIcon, Waveform, X } from "@/components/icons";
import { AudioPlayer } from "@/components/media/audio-player";
import type { ComposerAttachment } from "@/lib/conversations/composer-attachments";
import { formatFileSize } from "@/lib/conversations/media";

interface ComposerAttachmentStripProps {
  attachments: readonly ComposerAttachment[];
  onRemove: (localId: string) => void;
}

function AttachmentThumbnail({ attachment }: { attachment: ComposerAttachment }) {
  if (attachment.type === "image" && attachment.previewUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={attachment.previewUrl} alt="" className="h-10 w-10 rounded-lg object-cover sm:h-14 sm:w-14" />
    );
  }
  const Icon = attachment.type === "audio" ? Waveform : FileIcon;
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted sm:h-14 sm:w-14">
      <Icon weight="fill" className={attachment.type === "audio" ? "h-5 w-5 text-primary-ink sm:h-6 sm:w-6" : "h-5 w-5 text-muted-foreground sm:h-6 sm:w-6"} />
    </div>
  );
}

function AttachmentRow({ attachment, onRemove }: { attachment: ComposerAttachment; onRemove: () => void }) {
  const t = useTranslations("crmComposer.attachments");
  const listenable = attachment.type === "audio" && attachment.previewUrl && attachment.status !== "failed";
  const detail =
    attachment.status === "uploading"
      ? t("uploading")
      : attachment.status === "failed"
        ? attachment.error
        : attachment.size > 0
          ? formatFileSize(attachment.size)
          : null;

  return (
    <li className="flex items-center gap-2 px-3 py-2 sm:gap-3 sm:px-4">
      {listenable ? (
        <AudioPlayer url={attachment.previewUrl!} label={t("voiceNotePreview")} downloadable={false} className="mb-0 flex-1" />
      ) : (
        <>
          <div className="relative flex-shrink-0">
            <AttachmentThumbnail attachment={attachment} />
            {attachment.status === "uploading" && (
              <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/40">
                <CircleNotch weight="bold" className="h-4 w-4 animate-spin text-white sm:h-5 sm:w-5" />
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-2xs font-medium text-foreground sm:text-xs">{attachment.name}</p>
            {detail ? (
              <p className={attachment.status === "failed" ? "text-2xs text-destructive-ink" : "text-2xs text-muted-foreground"}>{detail}</p>
            ) : null}
          </div>
        </>
      )}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("remove", { name: attachment.name })}
        title={t("remove", { name: attachment.name })}
        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <X weight="bold" className="h-3.5 w-3.5" />
      </button>
    </li>
  );
}

export function ComposerAttachmentStrip({ attachments, onRemove }: ComposerAttachmentStripProps) {
  const t = useTranslations("crmComposer.attachments");
  if (attachments.length === 0) return null;
  return (
    <ul aria-label={t("listLabel", { count: attachments.length })} className="max-h-48 overflow-y-auto border-b border-border">
      {attachments.map((attachment) => (
        <AttachmentRow key={attachment.localId} attachment={attachment} onRemove={() => onRemove(attachment.localId)} />
      ))}
    </ul>
  );
}
