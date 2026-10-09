"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";

import { requestMediaGenerationAction } from "@/app/actions/media-generation";
import TourGuide, { type TourStep } from "@/components/TourGuide";
import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import { useStudioAgent, useStudioAgentKit } from "@/components/studio/agent/use-studio-agent";
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
import { isEditableTarget } from "@/lib/studio/keymap";
import { createStudioStore } from "@/lib/studio/store";

import { CanvasArea } from "./canvas-area";
import { createImageCommands } from "./commands";
import { bindEditorKeys } from "./editor-keys";
import { EditorToolbar } from "./editor-toolbar";
import { createEditorUiStore, ImageEditorContext, PANEL_IDS, type ImageEditorContextValue, type PanelId } from "./editor-state";
import { createImageAgent } from "./image-agent";
import { uploadImageFile } from "./image-source-picker";
import { RightDock } from "./right-dock";
import { ImageAgentCursor, JobFollowers } from "./jobs";
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
  const svgFeedback = useSvgFeedback();
  const shapeFeedback = useShapeOpFeedback();
  const [editor] = useState(() => {
    const store = createStudioStore(project.document);
    const ui = createEditorUiStore();
    const commands = createImageCommands(store, ui, { requestJob: requestMediaGenerationAction, naturalSize });
    return { store, ui, commands };
  });
  const projectName = studio.name ?? project.name;
  const value = useMemo<ImageEditorContextValue>(() => ({ ...editor, projectName }), [editor, projectName]);
  const kit = useStudioAgentKit();
  const agent = useMemo(() => createImageAgent({ ...editor, naturalSize, presence: kit.presence, label: kit.label, reduceMotion: kit.reduceMotion }), [editor, kit]);
  useStudioAgent(project.id, "image", projectName, agent);
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

  useEffect(() => bindEditorKeys(window, { commands: editor.commands, ui: editor.ui, isBusy: presence.isBusy, onShapeOp: shapeFeedback }), [editor, presence, shapeFeedback]);

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
    </ImageEditorContext.Provider>
  );
}
