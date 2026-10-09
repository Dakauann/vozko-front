import { describe, expect, it } from "vitest";

import { geocodingPlatformErrorKey, readGeocodingPlatformPage } from "./geocoding-platform";

const coverage = {
  total: 10,
  withAddress: 8,
  withoutAddress: 2,
  onMap: 5,
  approximate: 2,
  pending: 1,
  notFound: 0,
  addressShare: 0.8,
  mapShare: 0.5,
};

const item = { workspaceId: "ws-1", workspaceName: "Escola", coverage };

const answer = { items: [item], page: 1, pageSize: 20, totalItems: 1, totalPages: 1 };

describe("readGeocodingPlatformPage", () => {
  it("reads a page of workspaces with their address coverage", () => {
    const page = readGeocodingPlatformPage(answer);
    expect(page).toEqual(answer);
  });

  it("keeps only the coverage, whatever else an older server sends", () => {
    const page = readGeocodingPlatformPage({
      ...answer,
      cycleStart: "2026-10-01T03:00:00Z",
      items: [{ ...item, provider: "opencage", usedThisCycle: 40, coverage: { ...coverage, refused: 3 } }],
    });
    expect(page).toEqual(answer);
  });

  it.each([
    ["not an object", null],
    ["a missing items list", { ...answer, items: undefined }],
    ["a workspace without a name", { ...answer, items: [{ ...item, workspaceName: 3 }] }],
    ["a negative count", { ...answer, items: [{ ...item, coverage: { ...coverage, onMap: -1 } }] }],
    ["a missing count", { ...answer, items: [{ ...item, coverage: { ...coverage, notFound: undefined } }] }],
    ["a share above one", { ...answer, items: [{ ...item, coverage: { ...coverage, mapShare: 1.5 } }] }],
    ["a missing page count", { ...answer, totalPages: undefined }],
  ])("refuses %s", (_, value) => {
    expect(readGeocodingPlatformPage(value)).toBeNull();
  });
});

describe("geocodingPlatformErrorKey", () => {
  it.each([
    [{ status: 403 }, "forbidden"],
    [{ status: 403, code: "geocoding_platform_forbidden" }, "forbidden"],
    [{ status: 503, code: "geocoding_unavailable" }, "unavailable"],
    [{ status: 503 }, "busy"],
    [{ status: 504 }, "slow"],
    [{ status: 500, code: "geocoding_coverage_unreadable" }, "default"],
    [{ message: "Malformed" }, "default"],
  ])("maps %o to %s", (error, key) => {
    expect(geocodingPlatformErrorKey(error)).toBe(key);
  });
});
