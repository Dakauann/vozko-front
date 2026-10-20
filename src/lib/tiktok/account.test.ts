import { describe, expect, it } from "vitest";

import {
  accountNotices,
  accountStatusKey,
  accountStatusTone,
  canModerateComments,
  commentManageBlock,
  canReadComments,
  canReadVideos,
  needsReconnect,
  reconnectable,
  updateBodyOf,
} from "@/lib/tiktok/account";
import { tiktokAccount } from "@/lib/tiktok/test-fixtures";

const capabilities = tiktokAccount().capabilities;

describe("accountStatusTone", () => {
  it("gives each status a solid mark", () => {
    expect(accountStatusTone("CONNECTED")).toBe("healthy");
    expect(accountStatusTone("NEEDS_RECONNECT")).toBe("fault");
    expect(accountStatusTone("REVOKED")).toBe("fault");
    expect(accountStatusTone("DISCONNECTED")).toBe("muted");
  });
});

describe("accountStatusKey", () => {
  it("names the copy key of each status", () => {
    expect(accountStatusKey("CONNECTED")).toBe("status.connected");
    expect(accountStatusKey("NEEDS_RECONNECT")).toBe("status.needs_reconnect");
    expect(accountStatusKey("REVOKED")).toBe("status.revoked");
    expect(accountStatusKey("DISCONNECTED")).toBe("status.disconnected");
  });
});

describe("accountNotices", () => {
  it("has nothing to say about a healthy account", () => {
    expect(accountNotices(tiktokAccount())).toEqual([]);
  });

  it("asks for a reconnect with the purge date when the grant died", () => {
    expect(accountNotices(tiktokAccount({ status: "REVOKED", purgeAfter: "2026-11-18T10:00:00Z" }))).toEqual([
      { kind: "reconnect", purgeAfter: "2026-11-18T10:00:00Z" },
    ]);
    expect(accountNotices(tiktokAccount({ status: "NEEDS_RECONNECT" }))).toEqual([{ kind: "reconnect" }]);
  });

  it("only talks about the reconnect while the account is down, never about webhooks or messages", () => {
    const down = tiktokAccount({
      status: "NEEDS_RECONNECT",
      webhooksHealthy: false,
      reconnectSoon: true,
      capabilities: { ...capabilities, canSendMessages: false },
    });
    expect(accountNotices(down)).toEqual([{ kind: "reconnect" }]);
  });

  it("announces the purge date of a disconnected account", () => {
    expect(accountNotices(tiktokAccount({ status: "DISCONNECTED", purgeAfter: "2026-11-18T10:00:00Z" }))).toEqual([
      { kind: "disconnected", purgeAfter: "2026-11-18T10:00:00Z" },
    ]);
    expect(accountNotices(tiktokAccount({ status: "DISCONNECTED" }))).toEqual([{ kind: "disconnected" }]);
  });

  it("warns before the yearly reconnect deadline", () => {
    expect(accountNotices(tiktokAccount({ reconnectSoon: true, reconnectBy: "2027-10-01T00:00:00Z" }))).toEqual([
      { kind: "reconnectSoon", reconnectBy: "2027-10-01T00:00:00Z" },
    ]);
    expect(accountNotices(tiktokAccount({ reconnectSoon: true }))).toEqual([{ kind: "reconnectSoon" }]);
  });

  it("warns when TikTok events stop arriving", () => {
    expect(accountNotices(tiktokAccount({ webhooksHealthy: false }))).toEqual([{ kind: "webhooks" }]);
  });

  it("says messaging is off, and whether TikTok refused it", () => {
    const refused = tiktokAccount({
      statusReason: "TikTok refused direct messages for this account (region or account type)",
      capabilities: { ...capabilities, canReceiveMessages: false, canSendMessages: false },
    });
    expect(accountNotices(refused)).toEqual([{ kind: "messaging", refused: true }]);
    expect(accountNotices(tiktokAccount({ capabilities: { ...capabilities, canSendMessages: false } }))).toEqual([
      { kind: "messaging", refused: false },
    ]);
  });

  it("lists every live warning in a stable order", () => {
    const account = tiktokAccount({
      reconnectSoon: true,
      webhooksHealthy: false,
      capabilities: { ...capabilities, canReceiveMessages: false },
    });
    expect(accountNotices(account).map((notice) => notice.kind)).toEqual(["reconnectSoon", "webhooks", "messaging"]);
  });
});

describe("reconnect decisions", () => {
  it("offers a reconnect to every account that is not connected or nears the deadline", () => {
    expect(reconnectable(tiktokAccount())).toBe(false);
    expect(reconnectable(tiktokAccount({ reconnectSoon: true }))).toBe(true);
    expect(reconnectable(tiktokAccount({ status: "NEEDS_RECONNECT" }))).toBe(true);
    expect(reconnectable(tiktokAccount({ status: "REVOKED" }))).toBe(true);
    expect(reconnectable(tiktokAccount({ status: "DISCONNECTED" }))).toBe(true);
  });

  it("counts only dead grants as needing a reconnect", () => {
    expect(needsReconnect(tiktokAccount({ status: "NEEDS_RECONNECT" }))).toBe(true);
    expect(needsReconnect(tiktokAccount({ status: "REVOKED" }))).toBe(true);
    expect(needsReconnect(tiktokAccount({ status: "DISCONNECTED" }))).toBe(false);
    expect(needsReconnect(tiktokAccount())).toBe(false);
  });
});

describe("comment capabilities", () => {
  it("allows comment work only on a connected account with the capability", () => {
    expect(canModerateComments(tiktokAccount())).toBe(true);
    expect(canReadComments(tiktokAccount())).toBe(true);
    expect(canReadVideos(tiktokAccount())).toBe(true);
  });

  it("fails closed when the capability is off", () => {
    const off = tiktokAccount({ capabilities: { ...capabilities, canManageComments: false, canReadComments: false, canReadVideos: false } });
    expect(canModerateComments(off)).toBe(false);
    expect(canReadComments(off)).toBe(false);
    expect(canReadVideos(off)).toBe(false);
  });

  it("fails closed when the account is not connected, whatever the capabilities say", () => {
    for (const status of ["NEEDS_RECONNECT", "REVOKED", "DISCONNECTED"] as const) {
      const account = tiktokAccount({ status });
      expect(canModerateComments(account)).toBe(false);
      expect(canReadComments(account)).toBe(false);
      expect(canReadVideos(account)).toBe(false);
    }
  });
});

describe("updateBodyOf", () => {
  it("sends an empty string to clear a reference", () => {
    expect(updateBodyOf({ agentId: null, workflowId: null, pipelineId: null, departmentId: null })).toEqual({
      agentId: "",
      workflowId: "",
      pipelineId: "",
      departmentId: "",
    });
  });

  it("keeps set values, the analysis toggles included, and leaves out what did not change", () => {
    expect(updateBodyOf({ agentId: "agent-1", enableAgentResponses: true })).toEqual({ agentId: "agent-1", enableAgentResponses: true });
    expect(updateBodyOf({ enableAnalysis: true, enableAutoStaging: false, enableAutoMemory: true })).toEqual({
      enableAnalysis: true,
      enableAutoStaging: false,
      enableAutoMemory: true,
    });
    expect(updateBodyOf({ enableWorkflow: false, automationDisclosure: "" })).toEqual({ enableWorkflow: false, automationDisclosure: "" });
  });
});

describe("commentManageBlock", () => {
  it("lets a member with the permission manage comments of a capable account", () => {
    expect(commentManageBlock(tiktokAccount(), true)).toBeNull();
  });

  it("blocks first on the permission, then on the account capability", () => {
    expect(commentManageBlock(tiktokAccount(), false)).toBe("permission");
    expect(commentManageBlock(tiktokAccount({ status: "REVOKED" }), false)).toBe("permission");
    expect(commentManageBlock(tiktokAccount({ status: "REVOKED" }), true)).toBe("capability");
    expect(commentManageBlock(tiktokAccount({ capabilities: { ...capabilities, canManageComments: false } }), true)).toBe("capability");
  });
});
