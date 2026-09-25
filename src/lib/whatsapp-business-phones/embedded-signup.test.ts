import { describe, expect, it } from "vitest";

import { embeddedSignupResult, embeddedSignupUrl } from "./embedded-signup";

describe("embeddedSignupUrl", () => {
  it("points the popup at the backend with the workspace and the way back", () => {
    const url = new URL(embeddedSignupUrl("https://api.vozko.test", "ws 1", "https://app.vozko.test/dashboard/ai-chat"));
    expect(url.origin + url.pathname).toBe("https://api.vozko.test/oauth/meta/embedded");
    expect(url.searchParams.get("workspace_id")).toBe("ws 1");
    expect(url.searchParams.get("redirect_url")).toBe("https://app.vozko.test/dashboard/ai-chat");
  });
});

describe("embeddedSignupResult", () => {
  const api = "https://api.vozko.test";

  it("accepts only the backend's own signup message", () => {
    expect(embeddedSignupResult({ origin: api, data: { source: "wa-embedded", status: "success" } }, api)).toBe("success");
    expect(embeddedSignupResult({ origin: api, data: { source: "wa-embedded", status: "phone_limit_reached" } }, api)).toBe("phone_limit_reached");
  });

  it("ignores messages from other windows or origins", () => {
    expect(embeddedSignupResult({ origin: "https://evil.test", data: { source: "wa-embedded", status: "success" } }, api)).toBeNull();
    expect(embeddedSignupResult({ origin: api, data: { source: "other", status: "success" } }, api)).toBeNull();
    expect(embeddedSignupResult({ origin: api, data: null }, api)).toBeNull();
  });
});
