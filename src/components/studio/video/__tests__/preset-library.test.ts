import { describe, expect, it, vi } from "vitest";

import type { AnimationPreset } from "@/lib/studio/animation-presets";
import { emptyVideoDocument, newMediaClip, type VideoDocument } from "@/lib/studio/document";

import { cleanPresetName, createPresetLibrary, type PresetApi } from "../preset-library";

const BUILT_IN: AnimationPreset = { id: "builtin.popIn", name: "Estourar", builtIn: true, animation: { scope: "visual", durationMs: 1000, motionBlur: true } };

function film(): VideoDocument {
  const doc = emptyVideoDocument("story");
  const clip = { ...newMediaClip("image", "m-1", 0, 2000), id: "photo", keyframes: { opacity: [{ atMs: 0, value: 0, easing: "linear" as const }, { atMs: 500, value: 1, easing: "linear" as const }] } };
  doc.tracks = [{ id: "v1", kind: "visual", clips: [clip, { ...newMediaClip("image", "m-2", 3000, 1000), id: "plain" }] }];
  doc.durationMs = 4000;
  return doc;
}

function api(overrides: Partial<PresetApi> = {}): PresetApi {
  return {
    list: vi.fn(async () => ({ data: { items: [BUILT_IN] } })),
    create: vi.fn(async (input) => ({ data: { id: "p-1", builtIn: false, ...input } })),
    rename: vi.fn(async (id, change) => ({ data: { ...BUILT_IN, id, builtIn: false, name: change.name ?? "" } })),
    remove: vi.fn(async () => ({ data: true as const })),
    ...overrides,
  };
}

describe("preset library", () => {
  it("loads once and keeps the list", async () => {
    const fake = api();
    const library = createPresetLibrary(fake);
    await Promise.all([library.load(), library.load()]);
    expect(fake.list).toHaveBeenCalledTimes(1);
    expect(library.find("builtin.popIn")?.name).toBe("Estourar");
  });

  it("saves the captured animation of a clip under a clean name and lists it after the built-ins", async () => {
    const fake = api();
    const library = createPresetLibrary(fake);
    await library.load();
    const saved = await library.save(film(), "photo", "  Entrada   suave ", " para logos ");
    expect(saved.ok).toBe(true);
    expect(fake.create).toHaveBeenCalledWith(expect.objectContaining({ name: "Entrada suave", description: "para logos", animation: expect.objectContaining({ scope: "visual", durationMs: 2000 }) }));
    expect(library.store.getState().presets.map((preset) => preset.id)).toEqual(["builtin.popIn", "p-1"]);
  });

  it("refuses a blank name, a clip with nothing to save and a failed request", async () => {
    const library = createPresetLibrary(api({ create: vi.fn(async () => ({ error: "boom", status: 500 })) }));
    expect(await library.save(film(), "photo", "   ")).toEqual({ ok: false, reason: "name" });
    expect(await library.save(film(), "plain", "Nada")).toEqual({ ok: false, reason: "nothing" });
    expect(await library.save(film(), "ghost", "Nada")).toEqual({ ok: false, reason: "missing" });
    expect(await library.save(film(), "photo", "Ok")).toMatchObject({ ok: false, reason: "failed" });
    expect(cleanPresetName("a".repeat(121))).toBeNull();
  });

  it("marks the list as failed when it cannot load", async () => {
    const library = createPresetLibrary(api({ list: vi.fn(async () => ({ error: "offline" })) }));
    expect(await library.load()).toBeNull();
    expect(library.store.getState().status).toBe("failed");
  });
});
