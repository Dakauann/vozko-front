"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { requestMediaGenerationAction } from "@/app/actions/media-generation";
import TourGuide, { type TourStep } from "@/components/TourGuide";
import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import { asUploadableImage } from "@/components/studio/canvas/uploadable-image";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { StudioEditorMountProps } from "@/components/studio/studio-editor-shell";
import { STUDIO_IMAGE_TOUR_KEY, studioImageTourPalette, studioImageTourSeed, studioImageTourSteps } from "@/data/tour-studio-image";
import { useToast } from "@/hooks/use-toast";
import { decodeClipboard, encodeClipboard } from "@/lib/studio/clipboard";
import { imageFilesFrom } from "@/lib/studio/clipboard-files";
import { newTextLayer, STUDIO_LIMITS } from "@/lib/studio/document";
import { bindKeymap, canvasActionFor, imageZoomActionFor, isEditableTarget } from "@/lib/studio/keymap";
import { createStudioStore } from "@/lib/studio/store";
import { styleActionFor } from "@/lib/studio/style";

import { CanvasArea } from "./canvas-area";
import { createImageCommands } from "./commands";
import { EditorToolbar } from "./editor-toolbar";
import { createEditorUiStore, ImageEditorContext, PANEL_IDS, type ImageEditorContextValue, type PanelId } from "./editor-state";
import { uploadImageFile } from "./image-source-picker";
import { RightDock } from "./right-dock";
import { JobFollowers } from "./jobs";
import { SideRail } from "./side-rail";

export type ImageEditorProps = StudioEditorMountProps<"image">;

async function naturalSize(assetId: string) {
  const image = await loadAssetImage(assetId);
  return { width: image.naturalWidth, height: image.naturalHeight };
}

function hasPageSelection(): boolean {
  return (window.getSelection()?.toString() ?? "") !== "";
}

function tourPanel(step: TourStep): PanelId | null {
  const tab = (step.data as { _tab?: string } | undefined)?._tab;
  return (PANEL_IDS as readonly string[]).includes(tab ?? "") ? (tab as PanelId) : null;
}

export function ImageEditor({ project, studio }: ImageEditorProps) {
  const t = useTranslations("studio.image");
  const { toast } = useToast();
  const [editor] = useState(() => {
    const store = createStudioStore(project.document);
    const ui = createEditorUiStore();
    const commands = createImageCommands(store, ui, { requestJob: requestMediaGenerationAction, naturalSize });
    return { store, ui, commands };
  });
  const projectName = studio.name ?? project.name;
  const value = useMemo<ImageEditorContextValue>(() => ({ ...editor, projectName }), [editor, projectName]);
  const edit = useRef(studio.edit);

  useEffect(() => {
    edit.current = studio.edit;
  }, [studio.edit]);

  useEffect(() => {
    let sent = editor.store.getState().document;
    return editor.store.subscribe((state) => {
      if (state.inTransaction || state.document === sent) return;
      sent = state.document;
      edit.current({ document: state.document });
    });
  }, [editor.store]);

  useEffect(() => {
    const { commands, ui } = editor;
    const unbindActions = bindKeymap(window, canvasActionFor, (action) => {
      if (ui.getState().crop && action.type !== "deselect" && action.type !== "undo" && action.type !== "redo") return;
      commands.runAction(action);
    });
    const unbindZoom = bindKeymap(window, imageZoomActionFor, (action) => (action.type === "fit" ? commands.fit() : commands.zoomStep(action.direction)));
    const unbindStyle = bindKeymap(window, styleActionFor, (action) => (action.type === "copyStyle" ? commands.copyStyle() : commands.pasteStyle()));
    const onEnter = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || isEditableTarget(event.target) || !ui.getState().crop) return;
      event.preventDefault();
      commands.finishCrop();
    };
    window.addEventListener("keydown", onEnter);
    return () => {
      unbindActions();
      unbindZoom();
      unbindStyle();
      window.removeEventListener("keydown", onEnter);
    };
  }, [editor]);

  useEffect(() => {
    const { commands } = editor;
    const copy = (event: ClipboardEvent, cut: boolean) => {
      if (isEditableTarget(event.target) || hasPageSelection()) return;
      const content = commands.copySelection();
      if (content.layers.length === 0) return;
      event.preventDefault();
      event.clipboardData?.setData("text/plain", encodeClipboard(content));
      if (cut) commands.remove();
    };
    const onCopy = (event: ClipboardEvent) => copy(event, false);
    const onCut = (event: ClipboardEvent) => copy(event, true);
    const onPaste = (event: ClipboardEvent) => {
      if (isEditableTarget(event.target) || !event.clipboardData) return;
      const images = imageFilesFrom(event.clipboardData);
      if (images.length > 0) {
        event.preventDefault();
        void (async () => {
          for (const file of images) {
            const ready = await asUploadableImage(file);
            const uploaded = ready ? await uploadImageFile(ready) : { error: null };
            const placed = "mediaId" in uploaded && (await commands.insertImage(uploaded.mediaId));
            if (!placed) toast({ title: t("clipboard.imageFailed"), variant: "destructive" });
          }
        })();
        return;
      }
      const text = event.clipboardData.getData("text/plain");
      const content = decodeClipboard(text);
      if (content) {
        event.preventDefault();
        commands.paste(content);
        return;
      }
      const clean = [...text.trim()].slice(0, STUDIO_LIMITS.maxTextRunes).join("");
      if (clean === "") return;
      event.preventDefault();
      commands.insert([newTextLayer(clean)]);
    };
    document.addEventListener("copy", onCopy);
    document.addEventListener("cut", onCut);
    document.addEventListener("paste", onPaste);
    return () => {
      document.removeEventListener("copy", onCopy);
      document.removeEventListener("cut", onCut);
      document.removeEventListener("paste", onPaste);
    };
  }, [editor, toast, t]);

  return (
    <ImageEditorContext.Provider value={value}>
      <TooltipProvider delayDuration={400}>
      <div className="flex h-full min-h-0 flex-col">
        <EditorToolbar />
        <div className="flex min-h-0 flex-1">
          <SideRail />
          <CanvasArea />
          <RightDock />
        </div>
      </div>
      <JobFollowers />
      <TourGuide
        steps={studioImageTourSteps}
        storageKey={STUDIO_IMAGE_TOUR_KEY}
        i18nNamespace="tourStudioImage"
        introPalette={studioImageTourPalette}
        introSeed={studioImageTourSeed}
        onStep={(_, step) => {
          const panel = tourPanel(step);
          if (panel) editor.ui.setState({ panel });
        }}
      />
      </TooltipProvider>
    </ImageEditorContext.Provider>
  );
}
