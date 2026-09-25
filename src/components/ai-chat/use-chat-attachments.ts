"use client";

import { useCallback, useRef, useState } from "react";

import { uploadMediaAction } from "@/app/actions/medias";
import { attachmentProblem, mediaTypeFor, type AttachmentProblem } from "@/lib/aichat/attachments";
import type { ChatAttachment } from "@/lib/aichat/types";

export interface DraftAttachment {
  key: string;
  name: string;
  uploading: boolean;
  attachment?: ChatAttachment;
}

export type AttachmentError = AttachmentProblem | "upload";

export function useChatAttachments() {
  const [items, setItems] = useState<DraftAttachment[]>([]);
  const [error, setError] = useState<AttachmentError | null>(null);
  const counter = useRef(0);

  const upload = useCallback(async (key: string, file: File) => {
    const form = new FormData();
    form.append("mediaType", mediaTypeFor(file));
    form.append("media", file);
    form.append("description", file.name);
    const { mediaId } = await uploadMediaAction(form);
    if (!mediaId) {
      setError("upload");
      setItems((prev) => prev.filter((item) => item.key !== key));
      return;
    }
    const attachment: ChatAttachment = { mediaId, name: file.name, kind: mediaTypeFor(file) };
    setItems((prev) => prev.map((item) => (item.key === key ? { ...item, uploading: false, attachment } : item)));
  }, []);

  const add = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      let count = items.length;
      for (const file of Array.from(files)) {
        const problem = attachmentProblem(count, file);
        if (problem) {
          setError(problem);
          continue;
        }
        count += 1;
        counter.current += 1;
        const key = `${counter.current}-${file.name}`;
        setItems((prev) => [...prev, { key, name: file.name, uploading: true }]);
        void upload(key, file);
      }
    },
    [items.length, upload],
  );

  const remove = useCallback((key: string) => {
    setItems((prev) => prev.filter((item) => item.key !== key));
  }, []);

  const clear = useCallback(() => {
    setItems([]);
    setError(null);
  }, []);

  const ready = items.flatMap((item) => (item.attachment ? [item.attachment] : []));
  const uploading = items.some((item) => item.uploading);

  return { items, ready, uploading, error, add, remove, clear };
}
