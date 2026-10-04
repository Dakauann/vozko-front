"use client";

import type { ReactNode } from "react";
import Image from "next/image";

import { CircleNotch, FileText } from "@/components/icons";
import { isShownImage } from "@/lib/aichat/attachments";
import type { ChatAttachment } from "@/lib/aichat/types";
import { cn } from "@/lib/utils";

export function AttachmentChip({
  name,
  attachment,
  uploadingLabel,
  className,
  children,
}: {
  name: string;
  attachment?: ChatAttachment;
  uploadingLabel?: string;
  className?: string;
  children?: ReactNode;
}) {
  const image = attachment && isShownImage(attachment) ? attachment.url : null;
  return (
    <li className={cn("flex max-w-[14rem] items-center gap-1.5 rounded-[--radius] border border-border px-2 py-1 text-xs text-foreground", className)}>
      {!attachment ? (
        <CircleNotch className="h-3.5 w-3.5 flex-shrink-0 animate-spin text-muted-foreground" aria-label={uploadingLabel} />
      ) : image ? (
        <Image src={image} alt="" width={24} height={24} unoptimized className="h-6 w-6 flex-shrink-0 rounded-sm object-cover" />
      ) : (
        <FileText className="h-3.5 w-3.5 flex-shrink-0 text-muted-foreground" aria-hidden />
      )}
      <span className="truncate">{name}</span>
      {children}
    </li>
  );
}
