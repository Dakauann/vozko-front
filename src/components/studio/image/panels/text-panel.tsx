"use client";

import { useTranslations } from "next-intl";

import { LibraryPanel } from "@/components/studio/library/library-panel";

import { useImageLibrary } from "../library-adapter";
import { PanelHeading } from "./panel-heading";

export function TextPanel() {
  const t = useTranslations("studio.library");
  const tt = useTranslations("studio.image.panels.text");
  const library = useImageLibrary();
  return (
    <div className="space-y-3">
      <PanelHeading title={t("panels.text")} hint={tt("hint")} />
      <LibraryPanel panel="text" adapter={library} searchPlaceholder={t("search.text")} />
    </div>
  );
}
