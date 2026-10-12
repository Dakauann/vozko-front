import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const actions = vi.hoisted(() => ({
  uploadMediaAction: vi.fn<(form: FormData) => Promise<{ mediaId: string; mediaUrl: string }>>(async () => ({ mediaId: "6f1d3b8e-2c4a-4f1e-9a7b-0c1d2e3f4a5b", mediaUrl: "https://cdn/logo.json" })),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(),
}));

vi.mock("@/app/actions/media-generation", () => ({ requestMediaGenerationAction: vi.fn(), listMediaModelsAction: vi.fn().mockResolvedValue({ data: [] }), getMediaGenerationAction: vi.fn() }));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  fetchMediaFileAction: (id: string) => actions.fetchMediaFileAction(id),
  listLibraryAction: () => actions.listLibraryAction(),
  uploadMediaAction: (form: FormData) => actions.uploadMediaAction(form),
}));
vi.mock("@/hooks/use-toast", () => ({ useToast: () => ({ toast: vi.fn() }) }));
vi.mock("@/contexts/auth-context", () => ({ useSignedInUserId: () => "u-1" }));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument } from "@/lib/studio/document";

import { MediaPanel } from "../panels/media-panel";
import { renderInEditor } from "./harness";

const FIXTURES = join(process.cwd(), "..", "vozko-back", "domain", "studio", "testdata", "lottie");
const media = ptMessages.studio.video.media;

function fileOf(name: string, as: string): File {
  return new File([readFileSync(join(FIXTURES, name))], as, { type: "application/json" });
}

function clips(editor: ReturnType<typeof renderInEditor>["editor"]) {
  return editor.store.getState().document.tracks.flatMap((track) => track.clips);
}

describe("importing a Lottie file in the Media panel", () => {
  it("stores the file in the library and inserts a group of editable clips at the playhead", { timeout: 15_000 }, async () => {
    const { editor, container } = renderInEditor(emptyVideoDocument("story"), <MediaPanel />);
    act(() => editor.view.setState({ playheadMs: 800 }));
    const input = container.querySelector<HTMLInputElement>("[data-lottie-input]")!;
    fireEvent.change(input, { target: { files: [fileOf("keyframes.json", "Bola.json")] } });
    await waitFor(() => expect(clips(editor)).toHaveLength(1));
    expect(clips(editor)[0]).toMatchObject({ type: "group", name: "Bola", startMs: 800 });
    const form = actions.uploadMediaAction.mock.calls[0][0];
    expect(form.get("mediaType")).toBe("lottie");
    expect(form.get("description")).toBe("Bola");
    expect(await screen.findByRole("button", { name: media.importLottie })).toBeTruthy();
  });

  it("lists what blocks the conversion and stores nothing", { timeout: 15_000 }, async () => {
    actions.uploadMediaAction.mockClear();
    const { editor, container } = renderInEditor(emptyVideoDocument("story"), <MediaPanel />);
    fireEvent.change(container.querySelector<HTMLInputElement>("[data-lottie-input]")!, { target: { files: [fileOf("unsupported.json", "recusado.json")] } });
    const alert = await waitFor(() => {
      const found = container.querySelector("[data-lottie-refusal]");
      if (!found) throw new Error("no refusal yet");
      return found;
    });
    expect(alert.textContent).toContain(media.lottieRefused);
    expect(alert.textContent).toContain(`Tremida: ${ptMessages.studio.lottie.gaps.expression}`);
    expect(alert.textContent).toContain(`Foto: ${ptMessages.studio.lottie.gaps.image}`);
    expect(actions.uploadMediaAction).not.toHaveBeenCalled();
    expect(clips(editor)).toHaveLength(0);
  });

  it("inserts a Lottie file already in the library", { timeout: 15_000 }, async () => {
    const stored = { id: "0a1b2c3d-2c4a-4f1e-9a7b-0c1d2e3f4a5b", description: "Selo", url: "https://cdn/selo.lottie", previewUrl: "", createdAt: "", type: "lottie" };
    actions.fetchMediaFileAction.mockResolvedValue({ data: { blob: new Blob([readFileSync(join(FIXTURES, "static-shapes.lottie"))]), contentType: "application/zip" }, error: null });
    const { editor, container } = renderInEditor(emptyVideoDocument("story"), <MediaPanel />);
    act(() => editor.assets.store.setState({ library: { status: "ready", medias: [stored] } }));
    const add = await waitFor(() => {
      const button = container.querySelector<HTMLButtonElement>(`[data-lottie-media="${stored.id}"]`);
      if (!button) throw new Error("the Lottie file is not listed yet");
      return button;
    });
    fireEvent.click(add);
    await waitFor(() => expect(clips(editor)).toHaveLength(1));
    expect(clips(editor)[0]).toMatchObject({ type: "group", name: "Selo" });
  });
});
