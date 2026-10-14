import { afterEach, describe, expect, it, vi } from "vitest";

import {
  mirrorDocumentAppearance,
  requestPictureInPictureWindow,
  supportsDocumentPictureInPicture,
} from "@/lib/picture-in-picture";

const flushMutations = () => new Promise((resolve) => setTimeout(resolve, 0));

function sourceDocument() {
  const source = document.implementation.createHTMLDocument("source");
  source.documentElement.className = "dark";
  source.documentElement.setAttribute("lang", "pt");
  source.body.className = "font-sans antialiased";

  const style = source.createElement("style");
  style.textContent = ".a { color: red; }";
  source.head.appendChild(style);

  const link = source.createElement("link");
  link.rel = "stylesheet";
  link.href = "https://app.test/_next/static/css/app.css";
  source.head.appendChild(link);

  const meta = source.createElement("meta");
  meta.name = "viewport";
  source.head.appendChild(meta);

  return source;
}

describe("supportsDocumentPictureInPicture", () => {
  it("is false where the browser has no document picture-in-picture", () => {
    expect(supportsDocumentPictureInPicture({} as Window)).toBe(false);
  });

  it("is true where the browser exposes it", () => {
    const host = { documentPictureInPicture: { requestWindow: vi.fn() } };
    expect(supportsDocumentPictureInPicture(host as unknown as Window)).toBe(
      true,
    );
  });
});

describe("requestPictureInPictureWindow", () => {
  it("refuses outright where the browser cannot host one", async () => {
    await expect(
      requestPictureInPictureWindow({} as Window, { width: 400, height: 600 }),
    ).rejects.toThrow();
  });

  it("asks the browser for a window of the requested size", async () => {
    const opened = {} as Window;
    const requestWindow = vi.fn().mockResolvedValue(opened);
    const host = { documentPictureInPicture: { requestWindow } };

    const result = await requestPictureInPictureWindow(
      host as unknown as Window,
      { width: 400, height: 600 },
    );

    expect(result).toBe(opened);
    expect(requestWindow).toHaveBeenCalledWith({ width: 400, height: 600 });
  });
});

describe("mirrorDocumentAppearance", () => {
  let stop: (() => void) | null = null;

  afterEach(() => {
    stop?.();
    stop = null;
  });

  it("copies the stylesheets, and only the stylesheets", () => {
    const source = sourceDocument();
    const target = document.implementation.createHTMLDocument("target");

    stop = mirrorDocumentAppearance(source, target);

    expect(target.head.querySelector("style")?.textContent).toBe(
      ".a { color: red; }",
    );
    expect(target.head.querySelector("link")?.getAttribute("href")).toBe(
      "https://app.test/_next/static/css/app.css",
    );
    expect(target.head.querySelector("meta")).toBeNull();
  });

  it("carries the theme and fonts over", () => {
    const source = sourceDocument();
    const target = document.implementation.createHTMLDocument("target");

    stop = mirrorDocumentAppearance(source, target);

    expect(target.documentElement.className).toBe("dark");
    expect(target.documentElement.getAttribute("lang")).toBe("pt");
    expect(target.body.className).toBe("font-sans antialiased");
  });

  it("follows a theme switch made after the window opened", async () => {
    const source = sourceDocument();
    const target = document.implementation.createHTMLDocument("target");
    stop = mirrorDocumentAppearance(source, target);

    source.documentElement.className = "light";
    await flushMutations();

    expect(target.documentElement.className).toBe("light");
  });

  it("follows stylesheets the page loads or drops later", async () => {
    const source = sourceDocument();
    const target = document.implementation.createHTMLDocument("target");
    stop = mirrorDocumentAppearance(source, target);

    const late = source.createElement("style");
    late.textContent = ".late { color: blue; }";
    source.head.appendChild(late);
    source.head.querySelector("link")!.remove();
    await flushMutations();

    const copied = [...target.head.querySelectorAll("style")].map(
      (s) => s.textContent,
    );
    expect(copied).toContain(".late { color: blue; }");
    expect(target.head.querySelector("link")).toBeNull();
  });

  it("stops following once told to", async () => {
    const source = sourceDocument();
    const target = document.implementation.createHTMLDocument("target");
    mirrorDocumentAppearance(source, target)();

    source.documentElement.className = "light";
    await flushMutations();

    expect(target.documentElement.className).toBe("dark");
  });
});
