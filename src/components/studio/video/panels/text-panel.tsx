"use client";

import { useTranslations } from "next-intl";

import { LibraryPanel } from "@/components/studio/library/library-panel";

import { useVideoLibrary } from "../library-adapter";

export function TextPanel() {
  const t = useTranslations("studio.library");
  const library = useVideoLibrary();
  return (
    <div className="p-3">
      <LibraryPanel panel="text" adapter={library} searchPlaceholder={t("search.text")} />
    </div>
  );
}
