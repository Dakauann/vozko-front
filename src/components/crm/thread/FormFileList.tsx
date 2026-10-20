"use client";

import { File as FileIcon } from "@/components/icons";
import { useConversationMediaUrl } from "@/hooks/use-conversation-media-url";
import type { FormAnswerFile } from "@/lib/conversations/form-metadata";
import type { EntryType } from "@/lib/conversations/types";

function isImage(file: FormAnswerFile): boolean {
  return file.mimeType.startsWith("image/");
}

function FileThumb({ file, entryType, entryId }: { file: FormAnswerFile; entryType: EntryType; entryId: string }) {
  const { mediaUrl } = useConversationMediaUrl(undefined, isImage(file) ? file.mediaId : undefined, entryType, entryId);
  if (mediaUrl) {
    return (
      <span
        role="img"
        aria-label={file.name}
        className="block h-14 w-14 rounded-md bg-muted bg-cover bg-center"
        style={{ backgroundImage: `url("${mediaUrl}")` }}
      />
    );
  }
  return (
    <span className="inline-flex max-w-full items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-2xs text-foreground">
      <FileIcon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
      <span className="truncate">{file.name || file.mimeType}</span>
    </span>
  );
}

export function FormFileList({ files, entryType, entryId }: { files: FormAnswerFile[]; entryType: EntryType; entryId: string }) {
  if (files.length === 0) return null;
  return (
    <div className="mt-1 flex flex-wrap gap-1.5">
      {files.map((file, index) => (
        <FileThumb key={`${file.mediaId ?? file.name}:${index}`} file={file} entryType={entryType} entryId={entryId} />
      ))}
    </div>
  );
}
