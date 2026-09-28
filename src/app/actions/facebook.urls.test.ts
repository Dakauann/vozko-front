import { afterEach, describe, expect, it, vi } from "vitest";

import { facebookConnectUrl, facebookPostAssetUrl } from "@/app/actions/facebook";

let mockHeaders: Record<string, string> = {};

vi.mock("@/lib/api/browser-client", () => ({
  apiClient: vi.fn(),
  getApiBaseUrl: () => "https://api.test",
  scopeHeaders: () => mockHeaders,
}));

afterEach(() => {
  mockHeaders = {};
});

describe("Facebook URLs", () => {
  it("scopes post assets to the active workspace", () => {
    mockHeaders = { "X-Workspace-ID": "workspace-b" };

    expect(facebookPostAssetUrl("page-1", "123_456", "thumb")).toBe(
      "https://api.test/facebook/pages/page-1/posts/123_456/asset?variant=thumb&workspace_id=workspace-b",
    );
  });

  it("asks for the full asset by default", () => {
    mockHeaders = { "X-Workspace-ID": "workspace-b" };

    expect(facebookPostAssetUrl("page-1", "123_456")).toBe(
      "https://api.test/facebook/pages/page-1/posts/123_456/asset?variant=full&workspace_id=workspace-b",
    );
  });

  it("does not add an empty workspace scope", () => {
    expect(facebookPostAssetUrl("page-1", "123_456", "thumb")).toBe(
      "https://api.test/facebook/pages/page-1/posts/123_456/asset?variant=thumb",
    );
  });

  it("builds the redirect connect URL with the return path", () => {
    expect(facebookConnectUrl("/dashboard/facebook-pages")).toBe(
      "https://api.test/oauth/facebook/start?redirect=1&returnPath=%2Fdashboard%2Ffacebook-pages",
    );
  });
});
