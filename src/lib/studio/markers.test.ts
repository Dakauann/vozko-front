import { describe, expect, it } from "vitest";

import { emptyVideoDocument, STUDIO_LIMITS } from "./document";
import { addMarker, adjacentMarker, moveMarker, removeMarker, renameMarker } from "./markers";
import { documentIssue } from "./validate";

describe("markers", () => {
  it("adds markers in time order and refuses a second one at the same frame", () => {
    const first = addMarker(emptyVideoDocument("story"), 2000, "Batida");
    const second = addMarker(first.document, 500);
    expect(second.document.markers?.map((m) => m.atMs)).toEqual([500, 2000]);
    expect(addMarker(second.document, 2000).markerId).toBeNull();
    expect(documentIssue("video", second.document)).toBeNull();
  });

  it("caps the count", () => {
    let doc = emptyVideoDocument("story");
    for (let i = 0; i < STUDIO_LIMITS.maxMarkers; i++) doc = addMarker(doc, i * 10).document;
    expect(addMarker(doc, 80_000).markerId).toBeNull();
  });

  it("moves, renames and removes", () => {
    const { document, markerId } = addMarker(emptyVideoDocument("story"), 1000);
    const moved = moveMarker(document, markerId!, -50);
    expect(moved.markers?.[0].atMs).toBe(0);
    const named = renameMarker(moved, markerId!, "  Logo  ");
    expect(named.markers?.[0].label).toBe("Logo");
    expect(renameMarker(named, markerId!, " ").markers?.[0].label).toBeUndefined();
    expect(removeMarker(named, markerId!).markers).toEqual([]);
  });

  it("finds the next and previous marker", () => {
    const doc = addMarker(addMarker(emptyVideoDocument("story"), 1000).document, 3000).document;
    expect(adjacentMarker(doc, 1000, 1)?.atMs).toBe(3000);
    expect(adjacentMarker(doc, 3000, -1)?.atMs).toBe(1000);
    expect(adjacentMarker(doc, 3000, 1)).toBeNull();
  });
});
