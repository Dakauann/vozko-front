import { describe, expect, it, vi } from "vitest";

import { fileFromShortcutMedia } from "./shortcut-media";

function respondingWith(body: Blob, ok = true) {
  return vi.fn(async () => ({ ok, blob: async () => body }) as unknown as Response);
}

describe("fileFromShortcutMedia", () => {
  it("downloads the shortcut media into a file named after the url, ready for the normal upload", async () => {
    const fetcher = respondingWith(new Blob(["png"], { type: "image/png" }));
    const file = await fileFromShortcutMedia("https://cdn.example.com/media/tabela%20precos.png?v=2", "image", fetcher);

    expect(fetcher).toHaveBeenCalledWith("https://cdn.example.com/media/tabela%20precos.png?v=2", { credentials: "omit" });
    expect(file?.name).toBe("tabela precos.png");
    expect(file?.type).toBe("image/png");
  });

  it("falls back to the shortcut's media kind when the server sends no content type", async () => {
    const file = await fileFromShortcutMedia("https://cdn.example.com/", "video", respondingWith(new Blob(["x"])));
    expect(file?.type).toBe("video/mp4");
    expect(file?.name).toBe("atalho");
  });

  it.each(["javascript:alert(1)", "data:image/png;base64,AAAA", "ftp://host/a.png", "not a url", ""])(
    "refuses %s without fetching",
    async (url) => {
      const fetcher = respondingWith(new Blob(["x"]));
      expect(await fileFromShortcutMedia(url, "image", fetcher)).toBeNull();
      expect(fetcher).not.toHaveBeenCalled();
    },
  );

  it("gives nothing back when the download fails", async () => {
    expect(await fileFromShortcutMedia("https://cdn.example.com/a.png", "image", respondingWith(new Blob(["x"]), false))).toBeNull();
    const rejecting = vi.fn(async () => {
      throw new TypeError("cors");
    });
    expect(await fileFromShortcutMedia("https://cdn.example.com/a.png", "image", rejecting)).toBeNull();
  });
});
