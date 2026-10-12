import { describe, expect, it } from "vitest";

import { heardTracks, levelsOf, reactKey } from "./audio-react";
import { bandEdges, SPECTRUM_BANDS, SPECTRUM_FFT, spectrumProfile } from "./audio-spectrum";
import { emptyVideoDocument, newMediaClip, newOverlayClip, newShapeLayer, type Clip, type VideoDocument } from "./document";
import { loudnessProfile } from "./loudness";
import { visualPlan } from "./playback";
import { documentIssue } from "./validate";
import { newVfx, vfxLook, type Vfx } from "./vfx";
import { addClipVfx, withDefaultTrack } from "./vfx-edit";
import { spectrumBars, waveformBars, withSound } from "./vfx-sound";
import { vfxTracksIssue, withHeardVfx } from "./vfx-tracks";

const RATE = 8000;

function sine(hz: number, seconds: number): Float32Array {
  return Float32Array.from({ length: RATE * seconds }, (_, i) => 0.8 * Math.sin((2 * Math.PI * hz * i) / RATE));
}

function picture(vfx: Vfx[] = []): Clip {
  const transform = { x: 0.5, y: 0.5, w: 1, h: 1, rotation: 0, opacity: 1 };
  return { ...newOverlayClip({ ...newShapeLayer("rect", transform), id: "l-p" }, 0, 1000, transform), id: "p", ...(vfx.length ? { vfx } : {}) };
}

function film(vfx: Vfx[] = []): VideoDocument {
  const doc = emptyVideoDocument("square");
  doc.tracks = [
    { id: "v1", kind: "visual", clips: [picture(vfx)] },
    { id: "music", kind: "audio", clips: [{ ...newMediaClip("audio", "tone", 0, 1000), id: "a" }] },
  ];
  doc.durationMs = 1000;
  return doc;
}

const spectrum = (trackId = "music"): Vfx => ({ ...newVfx("audioSpectrum", "s", 0), trackId, params: { count: 8 } });

describe("the spectrum of a sound", () => {
  it("splits the audible range into rising bands", () => {
    const edges = bandEdges(44_100);
    expect(edges).toHaveLength(SPECTRUM_BANDS + 1);
    for (let i = 1; i < edges.length; i++) expect(edges[i]).toBeGreaterThan(edges[i - 1]);
    expect(edges.at(-1)).toBeLessThanOrEqual(SPECTRUM_FFT / 2);
  });

  it("puts the energy of a tone in the band that holds its frequency", () => {
    const profile = spectrumProfile([sine(1000, 1)], RATE);
    const edges = bandEdges(RATE);
    const bin = 1000 / (RATE / SPECTRUM_FFT);
    const band = edges.findIndex((edge, i) => bin >= edge && bin < edges[i + 1]);
    const middle = Math.floor(profile.bands[0].length / 2);
    const energies = profile.bands.map((series) => series[middle]);
    expect(energies.indexOf(Math.max(...energies))).toBe(band);
    expect(10 * Math.log10(Math.max(...energies))).toBeGreaterThan(-6);
  });
});

describe("sound levels for the visualizers", () => {
  const profiles = (id: string) => (id === "tone" ? loudnessProfile([sine(440, 1)], RATE) : undefined);
  const spectra = (id: string) => (id === "tone" ? spectrumProfile([sine(440, 1)], RATE) : undefined);

  it("listens to the tracks the visualizers name, and only then measures bands", () => {
    expect(heardTracks(film([spectrum()])).map((heard) => [heard.trackId, heard.spectrum])).toEqual([["music", true]]);
    expect(heardTracks(film([{ ...newVfx("audioWaveform", "w", 0), trackId: "music" }]))[0].spectrum).toBe(false);
    expect(reactKey(film())).toBe("");
  });

  it("fails closed when the bands of a spectrum track are missing", () => {
    expect(levelsOf(film([spectrum()]), profiles)).toBeNull();
    expect(levelsOf(film([spectrum()]), profiles, spectra)?.("music")?.bands).toHaveLength(SPECTRUM_BANDS);
  });

  it("turns the levels into bar heights between 0 and 1", () => {
    const doc = film([spectrum()]);
    const level = levelsOf(doc, profiles, spectra)!("music")!;
    const bars = spectrumBars(vfxLook(spectrum(), 500), level, 500)!;
    expect(bars).toHaveLength(8);
    expect(Math.max(...bars)).toBeGreaterThan(0.3);
    for (const bar of bars) expect(bar).toBeGreaterThanOrEqual(0);
    const wave = waveformBars(vfxLook({ ...newVfx("audioWaveform", "w", 0), params: { count: 10, window: 400 } }, 500), level, 500);
    expect(wave).toHaveLength(10);
    expect(Math.min(...wave)).toBeGreaterThan(0);
  });

  it("puts the bars on the looks the renderer draws", () => {
    const doc = film([spectrum()]);
    const levels = levelsOf(doc, profiles, spectra)!;
    expect(visualPlan(doc, 500, undefined, levels).find((item) => item.clipId === "p")?.vfx?.[0].bars).toHaveLength(8);
    const grain = vfxLook(newVfx("grain", "g", 1), 0);
    expect(withSound([grain], [newVfx("grain", "g", 1)], 0, levels)).toEqual([grain]);
  });
});

describe("the sound track a visualizer listens to", () => {
  it("must be an audio track of the same timeline", () => {
    expect(documentIssue("video", film([spectrum()]))).toBeNull();
    expect(vfxTracksIssue(film([spectrum("v1")]))).toBe("invalid");
    expect(documentIssue("video", film([{ ...newVfx("audioSpectrum", "s", 0) }]))).not.toBeNull();
    expect(documentIssue("video", film([{ ...newVfx("glow", "g", 0), trackId: "music" }]))).not.toBeNull();
  });

  it("is dropped with the visualizer when the track goes away", () => {
    const clip = picture([spectrum(), newVfx("glow", "g", 0)]);
    expect(withHeardVfx(clip, new Set()).vfx?.map((vfx) => vfx.kind)).toEqual(["glow"]);
    expect(withHeardVfx(clip, new Set(["music"]))).toBe(clip);
  });

  it("defaults to the timeline's sound track when a person adds the effect", () => {
    const doc = film();
    expect(withDefaultTrack(newVfx("audioWaveform", "w", 0), doc).trackId).toBe("music");
    expect(withDefaultTrack(newVfx("glow", "g", 0), doc).trackId).toBeUndefined();
  });

  it("refuses an edit that points a visualizer at a track that is not sound", () => {
    expect(addClipVfx(film(), "p", spectrum("ghost"))).toEqual({ ok: false, reason: "noSound" });
    expect(addClipVfx(film(), "p", spectrum()).ok).toBe(true);
  });
});
