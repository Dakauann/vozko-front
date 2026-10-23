"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { uploadConversationMediaAction } from "@/app/actions/conversations";
import type { ComposerAttachment } from "@/lib/conversations/composer-attachments";
import { mediaTypeForFile, normalizeUploadFile } from "@/lib/conversations/media";
import type { EntryType, MediaType } from "@/lib/conversations/types";
import { fileFromShortcutMedia } from "@/lib/message-shortcuts/shortcut-media";

export interface AttachmentUpload {
  mediaId: string | null;
  error?: string;
}

export type AttachmentUploader = (file: File, type: MediaType) => Promise<AttachmentUpload>;

interface ComposerAttachmentsOptions {
  entryType: EntryType;
  entryId: string;
  initial: ComposerAttachment[];
  admit: (file: File) => boolean;
  upload?: AttachmentUploader;
}

function newLocalId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function hasPlayablePreview(file: File): boolean {
  return file.type.startsWith("image/") || file.type.startsWith("audio/");
}

function revokePreview(attachment: ComposerAttachment) {
  if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
}

export function useComposerAttachments({ entryType, entryId, initial, admit, upload }: ComposerAttachmentsOptions) {
  const t = useTranslations("crmComposer.attachments");
  const [attachments, setAttachments] = useState<ComposerAttachment[]>(initial);
  const attachmentsRef = useRef(attachments);

  useEffect(() => {
    attachmentsRef.current = attachments;
  }, [attachments]);

  useEffect(() => () => attachmentsRef.current.forEach(revokePreview), []);

  const patch = useCallback((localId: string, change: Partial<ComposerAttachment>) => {
    setAttachments((current) => current.map((item) => (item.localId === localId ? { ...item, ...change } : item)));
  }, []);

  const uploadOne = useCallback(
    async (rawFile: File) => {
      const file = normalizeUploadFile(rawFile);
      if (!admit(file)) return;
      const type = mediaTypeForFile(file);
      const localId = newLocalId();
      const previewUrl = hasPlayablePreview(file) ? URL.createObjectURL(file) : undefined;
      setAttachments((current) => [
        ...current,
        { localId, name: file.name, size: file.size, type, previewUrl, status: "uploading" },
      ]);

      const result = upload ? await upload(file, type) : await uploadConversationMediaAction(entryType, entryId, file, type);
      if (result.error || !result.mediaId) {
        patch(localId, { status: "failed", error: result.error || t("uploadFailed") });
        return;
      }
      patch(localId, { status: "ready", mediaId: result.mediaId });
    },
    [admit, entryId, entryType, patch, t, upload],
  );

  const attachFiles = useCallback(
    (files: readonly File[]) => Promise.all(files.map((file) => uploadOne(file))).then(() => undefined),
    [uploadOne],
  );

  const attachFromUrl = useCallback(
    async (url: string, mediaType: string | undefined) => {
      const file = await fileFromShortcutMedia(url, mediaType, fetch);
      if (file) {
        await uploadOne(file);
        return;
      }
      setAttachments((current) => [
        ...current,
        { localId: newLocalId(), name: t("shortcutMediaName"), size: 0, type: "document", status: "failed", error: t("shortcutMediaFailed") },
      ]);
    },
    [t, uploadOne],
  );

  const remove = useCallback((localId: string) => {
    attachmentsRef.current.filter((item) => item.localId === localId).forEach(revokePreview);
    setAttachments((current) => current.filter((item) => item.localId !== localId));
  }, []);

  const clearAll = useCallback(() => {
    attachmentsRef.current.forEach(revokePreview);
    setAttachments([]);
  }, []);

  return { attachments, attachFiles, attachFromUrl, remove, clearAll };
}
