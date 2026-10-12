"use client";

import { useTranslations } from "next-intl";

import { addTransition, AUDIO_TRANSITION_KINDS, findTransition, isAudioTransitionKind, targetCut, trackKindOf, TRANSITION_KINDS, updateTransition, type TransitionKind } from "@/lib/studio/transitions";
import { cn } from "@/lib/utils";

import { useEditorState, useVideoEditor, useViewState } from "../editor-context";
import { TransitionPreview } from "../transition-glyph";
import { useCutThumbnails } from "./transition-thumbnails";

export function TransitionsPanel() {
  const t = useTranslations("studio.video.transitions");
  const { store, view, commands } = useVideoEditor();
  const selectedId = useViewState((s) => s.selectedTransitionId);
  const document = useEditorState((s) => s.document);
  const current = selectedId ? findTransition(document, selectedId)?.transition : undefined;
  const thumbnails = useCutThumbnails();

  const apply = (kind: TransitionKind) => {
    if (current) {
      commands.editTransition((doc) => updateTransition(doc, current.id, { kind }));
      return;
    }
    const cut = targetCut(store.getState().document, store.getState().selection, view.getState().playheadMs, trackKindOf(kind));
    if (!cut) {
      commands.notify("transitions.noCut");
      return;
    }
    commands.editTransition((doc) => addTransition(doc, { fromClipId: cut.fromClipId, toClipId: cut.toClipId, kind }));
  };

  return (
    <div className="space-y-3 p-3">
      <p className="text-2xs text-muted-foreground">{current ? t("swapHint") : t("panelHint")}</p>
      {[
        { label: t("title"), kinds: TRANSITION_KINDS },
        { label: t("audioTitle"), kinds: AUDIO_TRANSITION_KINDS },
      ].map((group) => (
        <div key={group.label} role="group" aria-label={group.label} className="grid grid-cols-2 gap-2">
          {group.kinds.map((kind) => (
            <button
              key={kind}
              type="button"
              aria-pressed={current?.kind === kind}
              title={t(`hints.${kind}`)}
              onClick={() => apply(kind)}
              className={cn(
                "flex min-w-0 flex-col items-center gap-1.5 rounded-[--radius] border px-2 py-2.5 text-2xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                current?.kind === kind ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-foreground hover:bg-muted",
              )}
            >
              <TransitionPreview kind={kind} mode="cut" src={isAudioTransitionKind(kind) ? undefined : thumbnails?.get(kind)} />
              <span className="max-w-full truncate">{t(`kinds.${kind}`)}</span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
