import { afterEach, describe, expect, it, vi } from "vitest";

import { instagramAssetUrl, instagramAvatarUrl } from "@/app/actions/instagram";

let mockHeaders: Record<string, string> = {};

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: vi.fn(),
  getApiBaseUrl: () => "https://api.test",
  scopeHeaders: () => mockHeaders,
}));

afterEach(() => {
  mockHeaders = {};
});

describe("Instagram media URLs", () => {
  it("scopes post assets to the active workspace", () => {
    mockHeaders = { "X-Workspace-ID": "workspace-b" };

    expect(instagramAssetUrl("account-1", "media-1", true)).toBe(
      "https://api.test/instagram/accounts/account-1/media/media-1/asset?thumb=1&workspace_id=workspace-b",
    );
  });

  it("scopes account avatars to the active workspace", () => {
    mockHeaders = { "X-Workspace-ID": "workspace-b" };

    expect(instagramAvatarUrl("account-1")).toBe(
      "https://api.test/instagram/accounts/account-1/avatar?workspace_id=workspace-b",
    );
  });

  it("does not add an empty workspace scope", () => {
    expect(instagramAssetUrl("account-1", "media-1")).toBe(
      "https://api.test/instagram/accounts/account-1/media/media-1/asset",
    );
  });
});
