import { fireEvent, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newMediaClip, type Clip, type VideoDocument } from "@/lib/studio/document";
import { findClip } from "@/lib/studio/timeline";
import { newEffectClip } from "@/lib/studio/vfx";

import { useEditorState } from "../editor-context";
import { VfxFields } from "../inspector/vfx-fields";
import { useSelectionEditor } from "../inspector/use-selection-editor";
import { renderInEditor } from "./harness";

const IDS = ["c"];
const vfx = ptMessages.studio.video.vfx;

function doc(clip: Clip, sound: string[] = ["music", "voice"]): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [{ id: "v", kind: "visual", clips: [clip] }, ...sound.map((id) => ({ id, kind: "audio" as const, name: id, clips: [] }))];
  d.durationMs = 2000;
  return d;
}

function Fields() {
  const clip = useEditorState((s) => findClip(s.document, "c")!.clip);
  const editor = useSelectionEditor(IDS);
  return <VfxFields clip={clip} disabled={false} editor={editor} />;
}

const video = (): Clip => ({ ...newMediaClip("video", "vid", 0, 2000), id: "c" });

describe("the effects packs by hand", () => {
  it("adds a twirl and tunes its new values with sliders", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(video()), <Fields />);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.twirl}` }));
    fireEvent.change(screen.getByLabelText(vfx.params.angle), { target: { value: "-500" } });
    expect(findClip(editor.store.getState().document, "c")!.clip.vfx?.[0]).toMatchObject({ kind: "twirl", params: { angle: -500 } });
  });

  it("adds a spectrum on the first sound track and switches the track it listens to", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc(video()), <Fields />);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.audioSpectrum}` }));
    const added = () => findClip(editor.store.getState().document, "c")!.clip.vfx?.[0];
    expect(added()).toMatchObject({ kind: "audioSpectrum", trackId: "music" });
    fireEvent.change(screen.getByLabelText(vfx.soundTrack), { target: { value: "voice" } });
    expect(added()?.trackId).toBe("voice");
  });

  it("explains why a visualizer cannot be added without sound and an echo cannot go on an effect clip", { timeout: 15_000 }, () => {
    const { editor } = renderInEditor(doc({ ...newEffectClip([], 0, 2000), id: "c" }, []), <Fields />);
    fireEvent.click(screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.audioWaveform}` }));
    fireEvent.click(screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.echo}` }));
    expect(findClip(editor.store.getState().document, "c")!.clip.vfx).toEqual([]);
    expect(screen.getByRole("button", { name: `Adicionar efeito: ${vfx.kinds.echo}` }).getAttribute("aria-disabled")).toBe("true");
  });
});
