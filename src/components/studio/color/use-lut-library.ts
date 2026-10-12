"use client";

import { useCallback, useEffect, useState } from "react";

import { isActionError, type ActionResult } from "@/app/actions/action-result";
import { listLibraryAction, uploadMediaAction } from "@/app/actions/medias";
import type { Media } from "@/lib/medias/types";
import { isCubeName, LUT_MEDIA_TYPE, parseCube, type CubeFault } from "@/lib/studio/cube-lut";

export type LutImport = { ok: true; mediaId: string } | { ok: false; fault: CubeFault | "name" | "upload" };

export interface LutLibrary {
  luts: Media[] | null;
  importing: boolean;
  importFile: (file: File) => Promise<LutImport>;
}

function lutsOf(result: ActionResult<Media[]>): Media[] {
  return isActionError(result) ? [] : result.data.filter((media) => media.type === LUT_MEDIA_TYPE);
}

export function useLutLibrary(): LutLibrary {
  const [luts, setLuts] = useState<Media[] | null>(null);
  const [version, setVersion] = useState(0);
  const [importing, setImporting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    listLibraryAction().then((result) => {
      if (!cancelled) setLuts(lutsOf(result));
    });
    return () => {
      cancelled = true;
    };
  }, [version]);

  const importFile = useCallback(async (file: File): Promise<LutImport> => {
    if (!isCubeName(file.name)) return { ok: false, fault: "name" };
    const parsed = parseCube(await file.text());
    if (!parsed.ok) return { ok: false, fault: parsed.fault };
    setImporting(true);
    const form = new FormData();
    form.append("media", file);
    form.append("mediaType", LUT_MEDIA_TYPE);
    form.append("description", file.name.replace(/\.cube$/i, ""));
    const uploaded = await uploadMediaAction(form).finally(() => setImporting(false));
    if (uploaded.error || !uploaded.mediaId) return { ok: false, fault: "upload" };
    setVersion((current) => current + 1);
    return { ok: true, mediaId: uploaded.mediaId };
  }, []);

  return { luts, importing, importFile };
}
