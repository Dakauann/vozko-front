"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";

import { handOffToElo } from "@/components/ai-chat/elo-handoff";
import { loadAssetImage } from "@/components/studio/canvas/asset-images";
import { useSettledPermission } from "@/hooks/use-settled-permission";
import { MAX_ATTACHMENTS } from "@/lib/aichat/attachments";
import { handoffPrompt } from "@/lib/aichat/elo-handoff";
import type { ChatAttachment } from "@/lib/aichat/types";
import { aiActionsFor, imageSubjectKind, runningActions, subjectList, type AiActionId, type AiActionSubject } from "@/lib/studio/ai-actions";
import type { ImageSurface, Layer } from "@/lib/studio/document";
import { imageSourcesOf, soleSource, type ImageSource } from "@/lib/studio/image-sources";

import type { AiActionEntry } from "../ai/ai-actions-menu";
import { addImageReferences } from "./ai-references";
import type { ImageCommands } from "./commands";
import { jobKind, useActiveArtboard, useEditorUi, useImageDoc, useImageEditor, type StudioJob } from "./editor-state";
import { useLayerLabeler } from "./use-layer-label";

export interface ImageAiTarget {
  subject: AiActionSubject;
  source: ImageSource | null;
  sources: ImageSource[];
}

export function imageAiTarget(surface: ImageSurface, picked: readonly Layer[], jobs: readonly StudioJob[], canAskElo: boolean): ImageAiTarget | null {
  const sources = imageSourcesOf(
    surface,
    picked.map((layer) => layer.id),
  );
  const kind = imageSubjectKind(picked, sources.length);
  if (!kind) return null;
  const source = soleSource(sources);
  const holder = source ? surface.layers.find((layer) => layer.id === source.layerId) : undefined;
  const ids = new Set([...picked.map((layer) => layer.id), ...(source ? [source.layerId] : [])]);
  const active = jobs.filter((job) => !job.error);
  const subject: AiActionSubject = {
    editor: "image",
    kind,
    locked: holder ? Boolean(holder.locked) : picked.some((layer) => Boolean(layer.locked)),
    hasSource: source ? Boolean(source.assetId) : picked.every((layer) => layer.type !== "image" || Boolean(layer.assetId)),
    running: runningActions(active.filter((job) => job.layerId !== null && ids.has(job.layerId)).map((job) => job.purpose)),
    activeKinds: active.map((job) => jobKind(job.purpose)),
    canAskElo,
  };
  return { subject, source, sources };
}

export function startCutout(commands: ImageCommands, source: ImageSource): void {
  if (source.assetId) void commands.startJob("cutout", { kind: "cutout", sourceMediaId: source.assetId }, source.layerId, source.slot);
}

async function imageAttachment(assetId: string, name: string): Promise<ChatAttachment> {
  const url = await loadAssetImage(assetId).then(
    (image) => image.src,
    () => undefined,
  );
  return { mediaId: assetId, name, kind: "image", ...(url ? { url } : {}) };
}

export function useImageAiActions(): AiActionEntry[] {
  const t = useTranslations("studio.aiActions");
  const tk = useTranslations("studio.image.layerKinds");
  const label = useLayerLabeler();
  const { commands, ui, projectId } = useImageEditor();
  const artboard = useActiveArtboard();
  const selection = useImageDoc((s) => s.selection);
  const jobs = useEditorUi((s) => s.jobs);
  const canAskElo = useSettledPermission("ai_chat", "create");

  return useMemo(() => {
    const wanted = new Set(selection);
    const picked = artboard.layers.filter((layer) => wanted.has(layer.id));
    const target = imageAiTarget(artboard, picked, jobs, canAskElo);
    if (!target) return [];
    const { source, sources } = target;
    const kindOf = (layer: Layer) => tk(layer.type === "shape" ? `shape.${layer.shape ?? "rect"}` : layer.type);
    const nameOf = (layerId: string) => {
      const layer = artboard.layers.find((candidate) => candidate.id === layerId);
      return layer ? label(layer) : layerId;
    };

    const askElo = (instruction?: string) => {
      const context = t("context.design", { items: subjectList(picked.map((layer) => ({ id: layer.id, label: label(layer), kind: kindOf(layer) }))) });
      const pictures = sources.flatMap((item) => (item.assetId ? [{ assetId: item.assetId, name: nameOf(item.layerId) }] : [])).slice(0, MAX_ATTACHMENTS);
      void Promise.all(pictures.map((picture) => imageAttachment(picture.assetId, picture.name))).then((attachments) => handOffToElo({ projectId, prompt: handoffPrompt(context, instruction), attachments }));
    };

    const runs: Partial<Record<AiActionId, () => void>> = {
      eloRewrite: () => askElo(t("prompts.eloRewrite")),
      eloTranslate: () => askElo(t("prompts.eloTranslate")),
      eloShorten: () => askElo(t("prompts.eloShorten")),
      eloAsk: () => askElo(),
      ...(source
        ? {
            removeBackground: () => startCutout(commands, source),
            editImage: () => ui.setState({ aiEditSource: source }),
            imageVariation: () => {
              ui.setState((current) => ({ panel: "ai", aiDraft: { ...current.aiDraft, prompt: current.aiDraft.prompt.trim() ? current.aiDraft.prompt : t("prompts.imageVariation") } }));
              if (source.assetId) void addImageReferences(ui, [source.assetId]);
            },
          }
        : {}),
    };

    return aiActionsFor(target.subject).flatMap((state) => {
      const run = runs[state.definition.id];
      return run ? [{ state, run }] : [];
    });
  }, [t, tk, label, commands, ui, projectId, artboard, selection, jobs, canAskElo]);
}
