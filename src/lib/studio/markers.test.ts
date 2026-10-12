import { describe, expect, it } from "vitest";

import { emptyVideoDocument, STUDIO_LIMITS } from "./document";
import { addMarker, adjacentMarker, markerListIssue, removeMarker, updateMarker } from "./markers";
import { documentIssue } from "./validate";

describe("markers", () => {
  it("adds markers in time order and refuses a second one at the same frame", () => {
    const first = addMarker(emptyVideoDocument("story"), 2000, { label: "Batida" });
    const second = addMarker(first.document, 500);
    expect(second.document.markers?.map((m) => m.atMs)).toEqual([500, 2000]);
    expect(addMarker(second.document, 2000).markerId).toBeNull();
    expect(documentIssue("video", second.document)).toBeNull();
  });

  it("takes any number of markers", () => {
    let doc = emptyVideoDocument("story");
    for (let i = 0; i < 300; i++) doc = addMarker(doc, i * 10).document;
    expect(addMarker(doc, STUDIO_LIMITS.maxVideoMs).markerId).not.toBeNull();
    expect(documentIssue("video", doc)).toBeNull();
  });

  it("moves, renames and removes", () => {
    const { document, markerId } = addMarker(emptyVideoDocument("story"), 1000);
    const moved = updateMarker(document, markerId!, { atMs: -50 });
    expect(moved.ok && moved.document.markers?.[0].atMs).toBe(0);
    const named = updateMarker(moved.ok ? moved.document : document, markerId!, { label: "  Logo  " });
    if (!named.ok) throw new Error(named.reason);
    expect(named.document.markers?.[0].label).toBe("Logo");
    const cleared = updateMarker(named.document, markerId!, { label: " " });
    expect(cleared.ok && cleared.document.markers?.[0].label).toBeUndefined();
    expect(removeMarker(named.document, markerId!).markers).toEqual([]);
  });

  it("finds the next and previous marker", () => {
    const doc = addMarker(addMarker(emptyVideoDocument("story"), 1000).document, 3000).document;
    expect(adjacentMarker(doc, 1000, 1)?.atMs).toBe(3000);
    expect(adjacentMarker(doc, 3000, -1)?.atMs).toBe(1000);
    expect(adjacentMarker(doc, 3000, 1)).toBeNull();
  });

  it("keeps a duration, a color and a note, and drops them when cleared", () => {
    const { document, markerId } = addMarker(emptyVideoDocument("story"), 1000, { label: "Refrão", durationMs: 2500, color: "orange", note: "  troca de cena aqui  " });
    expect(document.markers?.[0]).toEqual({ id: markerId, atMs: 1000, durationMs: 2500, label: "Refrão", color: "orange", note: "troca de cena aqui" });
    expect(documentIssue("video", document)).toBeNull();
    const cleared = updateMarker(document, markerId!, { durationMs: 0, color: null, note: "" });
    if (!cleared.ok) throw new Error(cleared.reason);
    expect(cleared.document.markers?.[0]).toEqual({ id: markerId, atMs: 1000, label: "Refrão" });
  });

  it("keeps a range inside the film and refuses a taken spot or an unknown marker", () => {
    const { document, markerId } = addMarker(emptyVideoDocument("story"), STUDIO_LIMITS.maxVideoMs - 1000, { durationMs: 5000 });
    expect(document.markers?.[0].durationMs).toBe(1000);
    const other = addMarker(document, 0).document;
    expect(updateMarker(other, markerId!, { atMs: 0 })).toEqual({ ok: false, reason: "taken" });
    expect(updateMarker(other, "nope", { label: "x" })).toEqual({ ok: false, reason: "missing" });
  });

  it("validates marker fields the same way for the film and for clips", () => {
    const base = { id: "k-1", atMs: 1000 };
    expect(markerListIssue([base], STUDIO_LIMITS.maxVideoMs)).toBeNull();
    expect(markerListIssue([{ ...base, durationMs: -1 }], STUDIO_LIMITS.maxVideoMs)).toBe("out_of_range");
    expect(markerListIssue([{ ...base, durationMs: STUDIO_LIMITS.maxVideoMs }], STUDIO_LIMITS.maxVideoMs)).toBe("out_of_range");
    expect(markerListIssue([{ ...base, color: "teal" as never }], STUDIO_LIMITS.maxVideoMs)).toBe("unknown");
    expect(markerListIssue([{ ...base, note: "a".repeat(STUDIO_LIMITS.maxMarkerNoteRunes + 1) }], STUDIO_LIMITS.maxVideoMs)).toBe("too_large");
    expect(markerListIssue([base, base], STUDIO_LIMITS.maxVideoMs)).toBe("duplicate");
    expect(markerListIssue([{ ...base, id: "Bad Id" }], STUDIO_LIMITS.maxVideoMs)).toBe("invalid");
  });
});
