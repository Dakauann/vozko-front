import { beforeEach, describe, expect, it, vi } from "vitest";

const browser = vi.hoisted(() => ({ fetch: vi.fn() }));
vi.mock("@/lib/api/browser-client", () => ({
  getApiBaseUrl: () => "https://api.test",
  scopeHeaders: () => ({ "X-Workspace-ID": "ws-1" }),
  fetchWithRefresh: (run: () => Promise<Response>) => run(),
}));

const download = vi.hoisted(() => ({ blob: vi.fn() }));
vi.mock("@/lib/browser/download", () => ({
  downloadBlob: (...args: unknown[]) => download.blob(...args),
  filenameFromDisposition: (header: string | null) => header?.match(/filename="([^"]+)"/)?.[1] ?? null,
}));

import { downloadApiFile } from "./download-file";

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubGlobal("fetch", browser.fetch);
});

describe("downloadApiFile", () => {
  it("saves the file under the name the server gave it", async () => {
    browser.fetch.mockResolvedValue(
      new Response("a,b\n", { status: 200, headers: { "Content-Disposition": 'attachment; filename="linhas.csv"' } }),
    );

    const outcome = await downloadApiFile("/leads/imports/1/rejections", "fallback.csv", { accept: "text/csv" });

    expect(outcome).toEqual({ error: null });
    expect(browser.fetch).toHaveBeenCalledWith("https://api.test/leads/imports/1/rejections", {
      method: "GET",
      credentials: "include",
      headers: { Accept: "text/csv", "X-Workspace-ID": "ws-1" },
    });
    expect(download.blob).toHaveBeenCalledWith(expect.anything(), "linhas.csv");
  });

  it("falls back to the given name", async () => {
    browser.fetch.mockResolvedValue(new Response("x", { status: 200 }));

    await downloadApiFile("/file", "fallback.csv");

    expect(download.blob).toHaveBeenCalledWith(expect.anything(), "fallback.csv");
  });

  it("returns the coded refusal and saves nothing", async () => {
    browser.fetch.mockResolvedValue(
      new Response(JSON.stringify({ message: "gone", code: "lead_import_not_found", expected: { id: "1" } }), {
        status: 404,
        statusText: "Not Found",
      }),
    );

    const outcome = await downloadApiFile("/file", "fallback.csv");

    expect(outcome).toEqual({
      error: { message: "gone", code: "lead_import_not_found", status: 404, expected: { id: "1" } },
    });
    expect(download.blob).not.toHaveBeenCalled();
  });

  it("uses the status text when the refusal has no body", async () => {
    browser.fetch.mockResolvedValue(new Response("oops", { status: 502, statusText: "Bad Gateway" }));

    const outcome = await downloadApiFile("/file", "fallback.csv");

    expect(outcome.error).toEqual({ message: "Bad Gateway", status: 502 });
  });

  it("reports a network failure", async () => {
    browser.fetch.mockRejectedValue(new Error("offline"));

    expect(await downloadApiFile("/file", "fallback.csv")).toEqual({ error: { message: "offline" } });
  });
});
