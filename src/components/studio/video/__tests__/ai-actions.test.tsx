import { act, fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const permissions = vi.hoisted(() => ({ elo: true }));
const handoff = vi.hoisted(() => ({ handOffToElo: vi.fn() }));
const generation = vi.hoisted(() => ({ request: vi.fn(() => new Promise<never>(() => undefined)) }));

vi.mock("@/contexts/workspace-context", () => ({
  useWorkspace: () => ({ currentWorkspace: { id: "ws-1" }, permissionsLoading: false, can: (resource: string) => resource !== "ai_chat" || permissions.elo }),
}));
vi.mock("@/components/ai-chat/elo-handoff", () => handoff);
vi.mock("@/app/actions/media-generation", () => ({
  requestMediaGenerationAction: generation.request,
  getMediaGenerationAction: vi.fn(),
  listMediaModelsAction: vi.fn(() => new Promise<never>(() => undefined)),
}));
vi.mock("@/app/actions/medias", () => ({
  getMediaAction: vi.fn(async () => null),
  listLibraryAction: vi.fn(async () => ({ data: [] })),
  fetchMediaFileAction: vi.fn(async () => ({ data: null, error: "offline" })),
  uploadMediaAction: vi.fn(),
}));

import ptMessages from "@/i18n/messages/pt.json";
import { emptyVideoDocument, newImageLayer, newMediaClip, newTextLayer, type VideoDocument } from "@/lib/studio/document";
import { findClip, updateClip } from "@/lib/studio/timeline";

import { placeJobResult } from "../job-placement";
import { TimelineContextMenu, type MenuTarget } from "../timeline/timeline-context-menu";
import { renderInEditor } from "./harness";

const pt = ptMessages.studio.aiActions;

function doc(): VideoDocument {
  const d = emptyVideoDocument("story");
  d.tracks = [
    {
      id: "v1",
      kind: "visual",
      clips: [
        { ...newMediaClip("image", "foto-1", 0, 2000), id: "img" },
        { ...newMediaClip("video", "filme-1", 2000, 3000), id: "vid" },
        { ...newMediaClip("image", "x", 5000, 1000), id: "txt", type: "overlay", assetId: undefined, layer: { ...newTextLayer("Promoção"), id: "tl" } },
      ],
    },
    {
      id: "v2",
      kind: "visual",
      clips: [{ ...newMediaClip("image", "x", 0, 1000), id: "logo", type: "overlay", assetId: undefined, layer: { ...newImageLayer("logo-1"), id: "ll" } }],
    },
    { id: "a1", kind: "audio", clips: [{ ...newMediaClip("audio", "som-1", 1000, 4000), id: "aud" }] },
    { id: "a2", kind: "audio", locked: true, clips: [] },
  ];
  d.durationMs = 6000;
  return d;
}

function setup(target: MenuTarget) {
  const rendered = renderInEditor(doc(), <TimelineContextMenu target={target}><div>alvo</div></TimelineContextMenu>);
  fireEvent.contextMenu(screen.getByText("alvo"));
  fireEvent.click(screen.getByRole("menuitem", { name: pt.menu }));
  return rendered;
}

const item = (name: string) => screen.getByRole("menuitem", { name });
const aiItems = () => within(screen.getAllByRole("menu").at(-1)!).getAllByRole("menuitem").map((el) => el.getAttribute("aria-label"));

beforeEach(() => {
  vi.clearAllMocks();
  permissions.elo = true;
});

describe("the AI group in the timeline clip menu", () => {
  it("removes the background of an image clip with the existing free job and shows its progress panel", { timeout: 15_000 }, () => {
    const { editor } = setup({ kind: "clip", clipId: "img" });
    expect(aiItems()).toEqual([pt.items.removeBackground, pt.items.eloAsk]);
    expect(item(pt.items.removeBackground)).toHaveAccessibleDescription(pt.cost.free);
    fireEvent.click(item(pt.items.removeBackground));
    expect(generation.request).toHaveBeenCalledWith({ kind: "cutout", sourceMediaId: "foto-1" });
    const state = editor.view.getState();
    expect(state.jobs).toMatchObject([{ purpose: "cutout", target: { clipId: "img" }, state: "running" }]);
    expect(state.panel).toBe("process");
    expect(state.clipPicks.cutout).toBe("img");
  });

  it("cleans up and captions an audio clip, aligning captions to the clip", { timeout: 15_000 }, () => {
    const { editor } = setup({ kind: "clip", clipId: "aud" });
    expect(aiItems()).toEqual([pt.items.denoise, pt.items.captions, pt.items.eloAsk]);
    fireEvent.click(item(pt.items.captions));
    expect(editor.view.getState().jobs).toMatchObject([{ purpose: "captions", target: { clipId: "aud", window: { startMs: 1000, trimInMs: 0, durationMs: 4000 } } }]);
    expect(editor.view.getState().panel).toBe("captions");
  });

  it("offers captions on a video clip", { timeout: 15_000 }, () => {
    setup({ kind: "clip", clipId: "vid" });
    expect(aiItems()).toEqual([pt.items.captions, pt.items.eloAsk]);
  });

  it("hands a text clip to Elo with the clip, its time and the playhead", { timeout: 15_000 }, () => {
    const { editor } = setup({ kind: "clip", clipId: "txt" });
    expect(aiItems()).toEqual([pt.items.eloRewrite, pt.items.eloTranslate, pt.items.eloShorten, pt.items.eloAsk]);
    act(() => editor.view.setState({ playheadMs: 5500 }));
    fireEvent.click(item(pt.items.eloShorten));
    expect(handoff.handOffToElo).toHaveBeenCalledWith({
      projectId: "p-1",
      prompt: `Sobre a seleção na linha do tempo, com a agulha em 0:05.15: "Promoção" (Texto, de 0:05.00 a 0:06.00, id txt)\n${pt.prompts.eloShorten}`,
      attachments: [],
    });
    expect(generation.request).not.toHaveBeenCalled();
  });

  it("removes the background of the picture an overlay shows and puts the result back in that overlay in one step", { timeout: 15_000 }, async () => {
    const { editor } = setup({ kind: "clip", clipId: "logo" });
    expect(aiItems()).toEqual([pt.items.removeBackground, pt.items.eloAsk]);
    fireEvent.click(item(pt.items.removeBackground));
    expect(generation.request).toHaveBeenCalledWith({ kind: "cutout", sourceMediaId: "logo-1" });
    const [job] = editor.view.getState().jobs;
    expect(job.target).toEqual({ clipId: "logo", slot: "asset" });
    const problem = await placeJobResult(job, "recorte-1", { store: editor.store, commands: editor.commands, assets: editor.assets, captionTrackName: "Legendas" });
    expect(problem).toBeNull();
    expect(findClip(editor.store.getState().document, "logo")?.clip.layer?.assetId).toBe("recorte-1");
    act(() => editor.store.getState().undo());
    expect(findClip(editor.store.getState().document, "logo")?.clip.layer?.assetId).toBe("logo-1");
  });

  it("keeps a picture replaced while the job runs and says so instead of overwriting it", { timeout: 15_000 }, async () => {
    const { editor } = setup({ kind: "clip", clipId: "logo" });
    fireEvent.click(item(pt.items.removeBackground));
    const [job] = editor.view.getState().jobs;
    const layer = findClip(editor.store.getState().document, "logo")!.clip.layer!;
    act(() => editor.store.getState().apply((d) => updateClip(d, "logo", { layer: { ...layer, assetId: "outra" } })));
    const problem = await placeJobResult(job, "recorte-1", { store: editor.store, commands: editor.commands, assets: editor.assets, captionTrackName: "Legendas" });
    expect(problem).toBe("clipChanged");
    expect(findClip(editor.store.getState().document, "logo")?.clip.layer?.assetId).toBe("outra");
    expect(ptMessages.studio.video.notices.clipChanged).toMatch(/trocada/);
  });

  it("never overwrites an image clip when a followed job does not say what it started from", { timeout: 15_000 }, async () => {
    const { editor } = setup({ kind: "clip", clipId: "img" });
    let id = "";
    act(() => void (id = editor.commands.followJob("cutout", { id: "srv", kind: "cutout", status: "queued", referenceMediaIds: [], createdAt: "", updatedAt: "" }, { clipId: "img" })));
    const job = editor.view.getState().jobs.find((candidate) => candidate.id === id)!;
    expect(await placeJobResult(job, "recorte-1", { store: editor.store, commands: editor.commands, assets: editor.assets, captionTrackName: "Legendas" })).toBe("clipChanged");
    expect(findClip(editor.store.getState().document, "img")?.clip.assetId).toBe("foto-1");
  });

  it("blocks Elo when the person may not use her", { timeout: 15_000 }, () => {
    permissions.elo = false;
    setup({ kind: "clip", clipId: "img" });
    expect(item(pt.items.eloAsk)).toHaveAccessibleDescription(pt.blocked.noElo);
    fireEvent.click(item(pt.items.eloAsk));
    expect(handoff.handOffToElo).not.toHaveBeenCalled();
  });
});

describe("the AI group in the timeline lane menu", () => {
  it("opens the paid sound generator on this track at this time, without generating", { timeout: 15_000 }, () => {
    const { editor } = setup({ kind: "lane", trackId: "a1", atMs: 2500 });
    expect(aiItems()).toEqual([pt.items.generateMusic, pt.items.generateVoice, pt.items.generateSfx]);
    expect(item(pt.items.generateVoice)).toHaveAccessibleDescription(pt.cost.paid);
    fireEvent.click(item(pt.items.generateVoice));
    const state = editor.view.getState();
    expect(state.panel).toBe("ai");
    expect(state.aiKind).toBe("voice");
    expect(state.aiDrafts.voice?.trackId).toBe("a1");
    expect(state.playheadMs).toBe(2500);
    expect(generation.request).not.toHaveBeenCalled();
  });

  it("offers the image generator on a visual lane", { timeout: 15_000 }, () => {
    setup({ kind: "lane", trackId: "v1", atMs: 0 });
    expect(aiItems()).toEqual([pt.items.generateImage]);
  });

  it("blocks generation onto a locked track", { timeout: 15_000 }, () => {
    const { editor } = setup({ kind: "lane", trackId: "a2", atMs: 0 });
    expect(item(pt.items.generateMusic)).toHaveAccessibleDescription(pt.blocked.locked);
    fireEvent.click(item(pt.items.generateMusic));
    expect(editor.view.getState().panel).toBe("media");
  });
});
