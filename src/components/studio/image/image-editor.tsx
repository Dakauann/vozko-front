"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { requestMediaGenerationAction } from "@/app/actions/media-generation";
import TourGuide, { type TourStep } from "@/components/TourGuide";
import { assetNaturalSize } from "@/components/studio/canvas/asset-images";
import { useStudioAgent, useStudioAgentKit } from "@/components/studio/agent/use-studio-agent";
import { StoreGestures } from "@/components/studio/canvas/live-gesture";
import { asUploadableImage } from "@/components/studio/canvas/uploadable-image";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { StudioEditorMountProps } from "@/components/studio/studio-editor-shell";
import { STUDIO_IMAGE_TOUR_KEY, studioImageTourPalette, studioImageTourSeed, studioImageTourSteps } from "@/data/tour-studio-image";
import { useShapeOpFeedback } from "@/components/studio/canvas/vector/use-shape-op-feedback";
import { useSvgFeedback } from "@/components/studio/canvas/vector/use-svg-feedback";
import { useToast } from "@/hooks/use-toast";
import { decodeClipboard, encodeClipboard } from "@/lib/studio/clipboard";
import { isSvgText } from "@/lib/studio/svg-import";
import { imageFilesFrom } from "@/lib/studio/clipboard-files";
import { newTextLayer, STUDIO_LIMITS } from "@/lib/studio/document";
import { isEditableTarget } from "@/lib/keyboard/stroke";
import { createStudioStore } from "@/lib/studio/store";
import { settleImage } from "@/lib/studio/image-settle";
import { relayoutDocument } from "@/lib/studio/auto-layout";
import { createHugMeasure } from "@/components/studio/canvas/hug-measure";
import { artboardNames } from "@/lib/studio/artboards";

import { CanvasArea } from "./canvas-area";
import { artboardTitle } from "./export-artboards";
import { createImageCommands } from "./commands";
import { bindEditorKeys } from "./editor-keys";
import { EditorToolbar } from "./editor-toolbar";
import { PixelOptions } from "./pixel-toolbar";
import { createEditorUiStore, ImageEditorContext, PANEL_IDS, type ImageEditorContextValue, type PanelId } from "./editor-state";
import { createImageAgent, createImageReveal } from "./image-agent";
import { uploadImageFile } from "./image-source-picker";
import { RightDock } from "./right-dock";
import { EditWithAiDialog } from "./edit-with-ai";
import { ImageAgentCursor, JobFollowers } from "./jobs";
import { SideRail } from "./side-rail";

type ImageEditorProps = StudioEditorMountProps<"image">;

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
  const svgFeedback = useSvgFeedback();
  const shapeFeedback = useShapeOpFeedback();
  const [editor] = useState(() => {
    let relayout = () => undefined;
    const measure = createHugMeasure(() => relayout());
    const store = createStudioStore(project.document, { settle: (before, after) => settleImage(before, after, measure) });
    relayout = () => void store.getState().applyAs("hug-fonts", (doc) => relayoutDocument(doc, measure));
    const ui = createEditorUiStore();
    const commands = createImageCommands(store, ui, { requestJob: requestMediaGenerationAction, naturalSize: assetNaturalSize, measure });
    return { store, ui, commands, measure };
  });
  const projectName = studio.name ?? project.name;
  const projectId = project.id;
  const value = useMemo<ImageEditorContextValue>(() => ({ ...editor, projectId, projectName }), [editor, projectId, projectName]);
  const kit = useStudioAgentKit();
  const untitled = useTranslations("studio.image.artboards");
  const agent = useMemo(
    () =>
      createImageAgent({
        ...editor,
        naturalSize: assetNaturalSize,
        presence: kit.presence,
        label: kit.label,
        reduceMotion: kit.reduceMotion,
        library: kit.library,
        projectId,
        projectName,
        exportTitle: (artboardId) => {
          const artboards = editor.store.getState().document.artboards;
          return artboardTitle(projectName, artboardNames(artboards, (position) => untitled("untitled", { number: position })), artboards.length, artboardId);
        },
      }),
    [editor, kit, untitled, projectId, projectName],
  );
  const reveal = useMemo(() => createImageReveal(editor), [editor]);
  useStudioAgent(project.id, "image", projectName, agent, reveal);
  const { presence } = kit;
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

  useEffect(() => bindEditorKeys(window, { commands: editor.commands, ui: editor.ui, onShapeOp: shapeFeedback }), [editor, shapeFeedback]);

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
      if (isSvgText(text)) {
        event.preventDefault();
        svgFeedback.imported(commands.importSvg(text));
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
  }, [editor, toast, t, svgFeedback]);

  return (
    <ImageEditorContext.Provider value={value}>
      <StoreGestures store={value.store}>
      <TooltipProvider delayDuration={400}>
      <div className="flex h-full min-h-0 flex-col">
        <EditorToolbar />
        <PixelOptions />
        <div className="flex min-h-0 flex-1">
          <SideRail />
          <CanvasArea />
          <RightDock />
        </div>
      </div>
      <JobFollowers />
      <EditWithAiDialog />
      <ImageAgentCursor presence={presence} />
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
      </StoreGestures>
    </ImageEditorContext.Provider>
  );
}
