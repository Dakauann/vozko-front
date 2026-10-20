"use client";

import { useTranslations } from "next-intl";
import type { ReactNode } from "react";
import { useDropzone } from "react-dropzone";

import { UploadSimple } from "@/components/icons";
import { cn } from "@/lib/utils";

interface ConversationDropZoneProps {
  enabled: boolean;
  onFiles: (files: File[]) => void;
  className?: string;
  children: ReactNode;
}

export function ConversationDropZone({ enabled, onFiles, className, children }: ConversationDropZoneProps) {
  const t = useTranslations("crmComposer.attachments");
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop: (files) => {
      if (files.length > 0) onFiles(files);
    },
    disabled: !enabled,
    noClick: true,
    noKeyboard: true,
    multiple: true,
  });

  return (
    <div {...getRootProps({ className: cn("relative", className) })}>
      <input {...getInputProps()} aria-hidden tabIndex={-1} />
      {children}
      {isDragActive && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-2 z-30 flex flex-col items-center justify-center gap-2 rounded-[--radius] border-2 border-dashed border-primary bg-background/90 text-sm font-medium text-foreground"
        >
          <UploadSimple weight="bold" className="h-6 w-6 text-primary-ink" />
          {t("dropHere")}
        </div>
      )}
    </div>
  );
}
