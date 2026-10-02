"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";

import { fetchMediaFileAction } from "@/app/actions/medias";
import { CircleNotch, DownloadSimple } from "@/components/icons";
import { downloadBlob } from "@/lib/browser/download";
import { mediaDownloadName } from "@/lib/media/download-name";
import { cn } from "@/lib/utils";

type DownloadState = "idle" | "busy" | "failed";

export function MediaDownloadButton({
  mediaId,
  description,
  className,
}: {
  mediaId: string;
  description: string;
  className?: string;
}) {
  const t = useTranslations("imageGeneration");
  const [state, setState] = useState<DownloadState>("idle");

  const download = async () => {
    setState("busy");
    const { data } = await fetchMediaFileAction(mediaId);
    if (!data) {
      setState("failed");
      return;
    }
    downloadBlob(data.blob, mediaDownloadName(description, data.contentType));
    setState("idle");
  };

  const busy = state === "busy";
  return (
    <span className={cn("inline-flex flex-col items-start gap-1", className)}>
      <button
        type="button"
        onClick={() => void download()}
        disabled={busy}
        aria-label={t("download")}
        className="inline-flex shrink-0 items-center gap-1 font-semibold text-primary-ink hover:underline disabled:pointer-events-none disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        {busy ? (
          <CircleNotch weight="bold" className="h-3.5 w-3.5 animate-spin motion-reduce:animate-none" aria-hidden />
        ) : (
          <DownloadSimple className="h-3.5 w-3.5" aria-hidden />
        )}
        {busy ? t("downloading") : t("download")}
      </button>
      {state === "failed" ? (
        <span role="alert" className="text-2xs text-destructive-ink">
          {t("downloadFailed")}
        </span>
      ) : null}
    </span>
  );
}
