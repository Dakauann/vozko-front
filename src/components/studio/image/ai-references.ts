import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import { withReference } from "@/lib/media-generation/references";

import type { EditorUiStore } from "./editor-state";

export async function addImageReferences(ui: EditorUiStore, assetIds: readonly string[]): Promise<boolean> {
  let all = true;
  for (const assetId of assetIds) {
    try {
      const image = await loadAssetImage(assetId);
      ui.setState((current) => ({ aiDraft: { ...current.aiDraft, references: withReference(current.aiDraft.references, { mediaId: assetId, url: image.src }) } }));
    } catch {
      all = false;
    }
  }
  return all;
}
