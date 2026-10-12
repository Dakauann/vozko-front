import { beforeEach, describe, expect, it, vi } from "vitest";

const apiClient = vi.fn();
vi.mock("@/lib/api/browser-client", () => ({ apiClient: (...args: unknown[]) => apiClient(...args) }));

import { saveStudioExportAction } from "./studio";

describe("saving an editor export", () => {
  beforeEach(() => apiClient.mockReset());

  it("sends the name first and then the file with its own type", async () => {
    apiClient.mockResolvedValue({ data: { mediaId: "m-1", mediaUrl: "https://cdn/m-1.pdf" } });
    const result = await saveStudioExportAction("p 1", new Blob(["%PDF-"], { type: "application/pdf" }), "Promo Feed");
    expect(result).toMatchObject({ data: { mediaId: "m-1" } });
    const [path, init] = apiClient.mock.calls[0];
    expect(path).toBe("/studio/projects/p%201/exports");
    const form = init.body as FormData;
    expect([...form.keys()]).toEqual(["description", "file"]);
    expect(form.get("description")).toBe("Promo Feed");
    const file = form.get("file") as File;
    expect(file.name).toBe("export.pdf");
    expect(file.type).toBe("application/pdf");
  });

  it("leaves the name to the server when none is given", async () => {
    apiClient.mockResolvedValue({ data: { mediaId: "m-2", mediaUrl: "https://cdn/m-2.gif" } });
    await saveStudioExportAction("p-1", new Blob(["GIF89a"], { type: "image/gif" }));
    const form = apiClient.mock.calls[0][1].body as FormData;
    expect([...form.keys()]).toEqual(["file"]);
    expect((form.get("file") as File).name).toBe("export.gif");
  });
});
