"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { generatesElements } from "@/components/studio/library/element-generator";
import { LibraryPanel, type LibraryAdapter } from "@/components/studio/library/library-panel";
import { AUDIO_CATEGORY_ID } from "@/lib/studio/library/builtin/sounds";

import { useVideoLibrary } from "../library-adapter";
import { AudioLibraryActions } from "./audio-library-actions";
import { VideoElementGenerator } from "./element-generator";

export function ElementsPanel() {
  const t = useTranslations("studio.library");
  const library = useVideoLibrary();
  const adapter = useMemo<LibraryAdapter>(() => ({ ...library, aside: (categoryId) => (categoryId === AUDIO_CATEGORY_ID ? <AudioLibraryActions /> : generatesElements(categoryId) ? <VideoElementGenerator categoryId={categoryId} /> : null) }), [library]);
  return (
    <div className="p-3">
      <LibraryPanel panel="elements" adapter={adapter} searchPlaceholder={t("search.elements")} />
    </div>
  );
}
