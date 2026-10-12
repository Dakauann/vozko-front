"use client";

import { useMemo, useRef, type ChangeEvent } from "react";
import { useTranslations } from "next-intl";

import { UploadSimple } from "@/components/icons";
import { useSvgFeedback } from "@/components/studio/canvas/vector/use-svg-feedback";
import { generatesElements } from "@/components/studio/library/element-generator";
import { LibraryPanel, type LibraryAdapter } from "@/components/studio/library/library-panel";

import { useImageEditor } from "../editor-state";
import { ImageElementGenerator } from "../element-generator";
import { useImageLibrary } from "../library-adapter";
import { ComponentsList } from "./components-list";
import { PanelHeading } from "./panel-heading";

export function ElementsPanel() {
  const t = useTranslations("studio.library");
  const tv = useTranslations("studio.vectors");
  const { commands } = useImageEditor();
  const imageLibrary = useImageLibrary();
  const library = useMemo<LibraryAdapter>(() => ({ ...imageLibrary, aside: (categoryId) => (generatesElements(categoryId) ? <ImageElementGenerator categoryId={categoryId} /> : null) }), [imageLibrary]);
  const svgFeedback = useSvgFeedback();
  const svgInput = useRef<HTMLInputElement>(null);
  const importFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    svgFeedback.imported(commands.importSvg(await file.text(), file.name.replace(/\.svg$/i, "")));
  };

  return (
    <div className="space-y-3">
      <PanelHeading title={t("panels.elements")} />
      <LibraryPanel
        panel="elements"
        adapter={library}
        searchPlaceholder={t("search.elements")}
        leading={
          <>
            <ComponentsList />
            <button
              type="button"
              onClick={() => svgInput.current?.click()}
              className="flex w-full items-center justify-center gap-1.5 rounded-[--radius] border border-dashed border-border-strong px-2 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <UploadSimple className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
              {tv("svg.import")}
            </button>
            <input ref={svgInput} type="file" accept=".svg,image/svg+xml" className="hidden" aria-label={tv("svg.import")} onChange={importFile} />
          </>
        }
      />
    </div>
  );
}
