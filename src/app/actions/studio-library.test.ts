import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { importLibraryAssetAction } from "./studio-library";

describe("importing a library picture", () => {
  beforeEach(() => apiClient.mockReset());

  it("posts the exact file of the item with the language of the media name", async () => {
    apiClient.mockResolvedValue({ data: { mediaId: "m-1", mediaUrl: "https://cdn/m-1.webp" } });
    const file = new Blob(["RIFF"], { type: "image/webp" });
    const result = await importLibraryAssetAction("3d-icon-rocket", file, "en");
    expect(result).toMatchObject({ data: { mediaId: "m-1" } });
    const [path, init] = apiClient.mock.calls[0];
    expect(path).toBe("/studio/library/items/3d-icon-rocket/import?locale=en");
    expect(init).toMatchObject({ method: "POST", body: file, headers: { "Content-Type": "image/webp" } });
  });
});
