/**
 * @vitest-environment jsdom
 */

import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useAuthenticatedImage } from "@/lib/browser/use-authenticated-image";

const { fetchWithRefreshMock, scopeHeadersMock } = vi.hoisted(() => ({
  fetchWithRefreshMock: vi.fn((request: () => Promise<Response>) => request()),
  scopeHeadersMock: vi.fn(() => ({ "X-Workspace-ID": "workspace-b" })),
}));

vi.mock("@/lib/api/browser-client", () => ({
  fetchWithRefresh: fetchWithRefreshMock,
  scopeHeaders: scopeHeadersMock,
}));

describe("useAuthenticatedImage", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn(() => "blob:image-1"),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fetches with credentials and exposes a blob URL", async () => {
    const response = {
      ok: true,
      blob: vi.fn(async () => new Blob(["image"])),
    } as unknown as Response;
    vi.mocked(fetch).mockResolvedValue(response);

    const { result, unmount } = renderHook(() =>
      useAuthenticatedImage("https://api.test/image?workspace_id=workspace-b"),
    );

    await waitFor(() => expect(result.current.src).toBe("blob:image-1"));

    expect(fetch).toHaveBeenCalledWith(
      "https://api.test/image?workspace_id=workspace-b",
      expect.objectContaining({
        credentials: "include",
        headers: { "X-Workspace-ID": "workspace-b" },
      }),
    );
    expect(fetchWithRefreshMock).toHaveBeenCalledTimes(1);

    act(() => unmount());
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:image-1");
  });

  it("marks a non-success response as failed", async () => {
    vi.mocked(fetch).mockResolvedValue({ ok: false, status: 401 } as Response);

    const { result } = renderHook(() => useAuthenticatedImage("https://api.test/image"));

    await waitFor(() => expect(result.current.failed).toBe(true));
    expect(result.current.src).toBeNull();
  });
});
