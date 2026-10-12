"use client";

import { useTranslations } from "next-intl";

import Button from "@/components/elevated-design/button";
import { videoCanvasSize, type Clip, type VideoDocument } from "@/lib/studio/document";
import { keyState, localTime, morphValue } from "@/lib/studio/keyframe-edit";
import { morphFramesOf } from "@/lib/studio/keyframes";
import { convertClipToPath, editClipPath, morphSelectionEdit, pathLayerOf, setFirstVertex, togglePathKey, type MorphEdit } from "@/lib/studio/morph-edit";
import { MORPH_PROPERTY } from "@/lib/studio/morph-keys";

import { useEditorState, usePanelPlayhead, useVideoEditor, useViewState } from "../editor-context";
import { CodeField } from "./code-field";
import { InspectorSection } from "./fields";
import { KeyToggle } from "./key-toggle";
import { PathGlyph, PathKeyList } from "./path-key-list";
import type { SelectionEditor } from "./use-selection-editor";

interface MorphFieldsProps {
  clip: Clip;
  disabled: boolean;
  editor: SelectionEditor;
}

export function MorphFields({ clip, disabled, editor }: MorphFieldsProps) {
  const t = useTranslations("studio.video.morph");
  const { playback, view } = useVideoEditor();
  const playheadMs = usePanelPlayhead();
  const frame = useEditorState((s) => videoCanvasSize(s.document));
  const editing = useViewState((s) => s.pathEdit?.clipId === clip.id && !s.pathEdit.maskId);
  const localMs = localTime(clip, playheadMs);
  const keys = morphFramesOf(clip.keyframes);
  const converted = pathLayerOf(clip, frame);
  const isPath = clip.layer?.shape === "path";
  const shown = isPath ? morphValue(clip, localMs ?? 0) : (converted?.path ?? "");
  const run = (edit: (doc: VideoDocument) => MorphEdit) => editor.run((doc) => morphSelectionEdit(edit(doc)));

  const toggleEditing = () => {
    if (editing) {
      view.setState({ pathEdit: null });
      return;
    }
    if (isPath || run((doc) => convertClipToPath(doc, clip.id))) view.setState({ pathEdit: { clipId: clip.id } });
  };

  return (
    <InspectorSection id="morph" title={t("title")} summary={keys.length > 0 ? t("summary", { count: keys.length }) : null}>
      <div className="flex items-center gap-2">
        <PathGlyph path={shown} className="h-10 w-10" />
        <div className="flex min-w-0 flex-1 flex-wrap gap-1">
          <Button variant={editing ? "primary" : "outline"} size="sm" title={editing ? t("done") : t("edit")} disabled={disabled} aria-pressed={editing} onClick={toggleEditing} />
          {isPath ? null : <Button variant="ghost" size="sm" title={t("convert")} disabled={disabled} onClick={() => run((doc) => convertClipToPath(doc, clip.id))} />}
        </div>
        <KeyToggle
          label={t("key")}
          state={keyState(clip, MORPH_PROPERTY, localMs)}
          disabled={disabled || localMs === null}
          onClick={() => {
            if (localMs !== null) run((doc) => togglePathKey(doc, clip.id, localMs));
          }}
        />
      </div>
      {isPath ? (
        <CodeField label={t("path")} hint={t("pathHint")} value={shown} disabled={disabled} onCommit={(path) => run((doc) => editClipPath(doc, clip.id, path, localMs))} />
      ) : (
        <p className="text-2xs text-muted-foreground">{t("convertHint")}</p>
      )}
      <PathKeyList
        keys={keys}
        startMs={clip.startMs}
        localMs={localMs}
        disabled={disabled}
        onSeek={(atMs) => playback.seek(clip.startMs + atMs)}
        onVertex={(atMs, pin) => run((doc) => setFirstVertex(doc, clip.id, atMs, pin))}
        onRemove={(atMs) => run((doc) => togglePathKey(doc, clip.id, atMs))}
      />
      <p className="text-2xs text-muted-foreground">{localMs === null ? t("outsideHint") : t("hint")}</p>
    </InspectorSection>
  );
}
